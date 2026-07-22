import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  Anuncio,
  AnuncioCreateInput,
  AnuncioUpdateInput,
  AnunciosService,
  TipoAnuncio,
} from '../../../services/anuncios';

interface AnuncioForm {
  tipo: TipoAnuncio;
  titulo: string;
  mensaje: string;
  imagenUrl: string | null;
  expiraEn: string;
  estaActivo: boolean;
  opciones: string[];
  esSatisfaccion: boolean;
  // Solo aplica cuando esSatisfaccion === true: en vez de tipear opciones de
  // texto libre, se elige cuántas estrellas tiene la escala (3 a 10) y las
  // opciones se generan solas ('1'..'N') — ver guardarAnuncio().
  cantidadEstrellas: number;
}

@Component({
  selector: 'app-anuncios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anuncios.html',
  styleUrl: './anuncios.css',
})
export class Anuncios implements OnInit {
  constructor(private anunciosService: AnunciosService) {}

  readonly apiUrl = environment.apiUrl;

  anuncios = signal<Anuncio[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);
  modalLogoError = false;

  ngOnInit(): void {
    this.cargarAnuncios();
  }

  private cargarAnuncios(): void {
    this.cargando.set(true);
    this.anunciosService.listarAnuncios(true).subscribe({
      next: (anuncios) => {
        this.anuncios.set(anuncios);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el listado de anuncios.');
        this.cargando.set(false);
      },
    });
  }

  imagenSrc(anuncio: { imagen_url: string | null }): string | null {
    return anuncio.imagen_url ? `${this.apiUrl}${anuncio.imagen_url}` : null;
  }

  totalVotos(anuncio: Anuncio): number {
    return anuncio.opciones.reduce((acumulado, o) => acumulado + (o.votos ?? 0), 0);
  }

  pctVotos(opcionVotos: number | null, total: number): number {
    if (!opcionVotos || total === 0) return 0;
    return Math.round((opcionVotos / total) * 100);
  }

  // ════════════════════════════════════════════════════════
  // ── Modal "Nuevo / editar anuncio" ─────────────────────────
  // ════════════════════════════════════════════════════════
  modalAbierto = false;
  form: AnuncioForm = this.formularioVacio();
  guardando = false;
  anuncioEditando: Anuncio | null = null;
  subiendoImagen = false;

  private formularioVacio(): AnuncioForm {
    return {
      tipo: 'anuncio', titulo: '', mensaje: '', imagenUrl: null, expiraEn: '',
      estaActivo: true, opciones: ['', ''], esSatisfaccion: false, cantidadEstrellas: 5,
    };
  }

  abrirModalNuevo(): void {
    this.anuncioEditando = null;
    this.form = this.formularioVacio();
    this.modalAbierto = true;
  }

  abrirModalEditar(anuncio: Anuncio): void {
    this.anuncioEditando = anuncio;
    this.form = {
      tipo: anuncio.tipo,
      titulo: anuncio.titulo,
      mensaje: anuncio.mensaje,
      imagenUrl: anuncio.imagen_url,
      expiraEn: anuncio.expira_en ? anuncio.expira_en.slice(0, 10) : '',
      estaActivo: anuncio.esta_activo,
      opciones: anuncio.opciones.length ? anuncio.opciones.map((o) => o.texto) : ['', ''],
      esSatisfaccion: anuncio.es_satisfaccion,
      cantidadEstrellas: anuncio.opciones.length || 5,
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.anuncioEditando = null;
  }

  seleccionarTipo(tipo: TipoAnuncio): void {
    if (this.anuncioEditando) return; // el tipo no se puede cambiar al editar
    this.form.tipo = tipo;
  }

  agregarOpcion(): void {
    this.form.opciones = [...this.form.opciones, ''];
  }

  quitarOpcion(indice: number): void {
    if (this.form.opciones.length <= 2) return;
    this.form.opciones = this.form.opciones.filter((_, i) => i !== indice);
  }

  ajustarEstrellas(delta: number): void {
    const nuevoValor = this.form.cantidadEstrellas + delta;
    this.form.cantidadEstrellas = Math.min(10, Math.max(3, nuevoValor));
  }

  /** Repite el ícono de estrella según el valor de la opción — solo para
   *  encuestas de satisfacción, cuyas opciones son '1'..'N' por diseño. */
  estrellasDe(opcion: { texto: string }): string {
    return '★'.repeat(Number(opcion.texto) || 0);
  }

  onSeleccionarImagen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoImagen = true;
    this.anunciosService.subirImagen(archivo).subscribe({
      next: ({ url }) => {
        this.subiendoImagen = false;
        this.form.imagenUrl = url;
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoImagen = false;
        this.error.set(err.error?.detail ?? 'No se pudo subir la imagen.');
      },
    });
    input.value = '';
  }

  quitarImagen(): void {
    this.form.imagenUrl = null;
  }

  get imagenPreviewSrc(): string | null {
    return this.form.imagenUrl ? `${this.apiUrl}${this.form.imagenUrl}` : null;
  }

  get formValido(): boolean {
    if (!this.form.titulo.trim() || !this.form.mensaje.trim()) return false;
    if (this.form.tipo === 'encuesta' && !this.anuncioEditando) {
      if (this.form.esSatisfaccion) return this.form.cantidadEstrellas >= 2;
      const opcionesValidas = this.form.opciones.map((o) => o.trim()).filter((o) => o.length > 0);
      return opcionesValidas.length >= 2;
    }
    return true;
  }

  private generarOpciones(): string[] {
    if (this.form.esSatisfaccion) {
      return Array.from({ length: this.form.cantidadEstrellas }, (_, i) => String(i + 1));
    }
    return this.form.opciones.map((o) => o.trim()).filter((o) => o);
  }

  guardarAnuncio(): void {
    if (!this.formValido || this.guardando) return;
    this.guardando = true;

    if (this.anuncioEditando) {
      const payload: AnuncioUpdateInput = {
        titulo: this.form.titulo.trim(),
        mensaje: this.form.mensaje.trim(),
        imagen_url: this.form.imagenUrl,
        expira_en: this.form.expiraEn ? new Date(this.form.expiraEn).toISOString() : null,
        esta_activo: this.form.estaActivo,
        es_satisfaccion: this.form.esSatisfaccion,
      };
      const idAnuncio = this.anuncioEditando.id_anuncio;
      this.anunciosService.actualizarAnuncio(idAnuncio, payload).subscribe({
        next: (actualizado) => {
          this.guardando = false;
          this.anuncios.set(this.anuncios().map((a) => (a.id_anuncio === idAnuncio ? actualizado : a)));
          this.cerrarModal();
        },
        error: () => {
          this.guardando = false;
          this.error.set('No se pudo actualizar el anuncio.');
        },
      });
      return;
    }

    const payload: AnuncioCreateInput = {
      tipo: this.form.tipo,
      titulo: this.form.titulo.trim(),
      mensaje: this.form.mensaje.trim(),
      imagen_url: this.form.imagenUrl,
      expira_en: this.form.expiraEn ? new Date(this.form.expiraEn).toISOString() : null,
      opciones: this.form.tipo === 'encuesta' ? this.generarOpciones() : undefined,
      es_satisfaccion: this.form.tipo === 'encuesta' ? this.form.esSatisfaccion : false,
    };
    this.anunciosService.crearAnuncio(payload).subscribe({
      next: (creado) => {
        this.guardando = false;
        this.anuncios.set([creado, ...this.anuncios()]);
        this.cerrarModal();
      },
      error: () => {
        this.guardando = false;
        this.error.set('No se pudo crear el anuncio.');
      },
    });
  }

  toggleActivo(anuncio: Anuncio): void {
    this.anunciosService.actualizarAnuncio(anuncio.id_anuncio, { esta_activo: !anuncio.esta_activo }).subscribe({
      next: (actualizado) => {
        this.anuncios.set(this.anuncios().map((a) => (a.id_anuncio === anuncio.id_anuncio ? actualizado : a)));
      },
      error: () => this.error.set('No se pudo cambiar el estado del anuncio.'),
    });
  }
}
