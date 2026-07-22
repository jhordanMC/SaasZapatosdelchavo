import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { AnuncioParaUsuario, AnunciosService } from '../../services/anuncios';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css'],
})
export class TopbarComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router, private anunciosService: AnunciosService) {}

  readonly apiUrl = environment.apiUrl;

  @Input() title = 'Dashboard';
  @Input() company = 'ALBA Corporation';
  @Input() avatarLabel = 'A';
  @Input() avatarSrc = '/LogoAlba.png';
  @Input() userName = 'Admin ALBA';
  @Input() userRole = 'Administrador';
  @Input() userId = 'EMP-0231';
  @Input() userDni = '00000000';
  @Input() userEmail = 'admin@vilcas.pe';
  @Input() userPhone = '+51 999 999 999';
  @Input() logoSrc = '/vilcas.png';
  @Input() brandName = 'VILCAS';
  @Input() brandAccentIndex = 4;

  showAvatarFallback = false;
  showProfileModal = false;
  confirmandoCierre = false;

  openProfile(): void {
    this.showProfileModal = true;
  }

  closeProfile(): void {
    this.showProfileModal = false;
    this.confirmandoCierre = false;
  }

  pedirConfirmacionCierre(): void {
    this.confirmandoCierre = true;
  }

  cancelarCierre(): void {
    this.confirmandoCierre = false;
  }

  cerrarSesion(): void {
    this.showProfileModal = false;
    this.confirmandoCierre = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ════════════════════════════════════════════════════════
  // ── Campana: desplegable con títulos/vigencia → modal con el
  //    detalle del anuncio elegido (100% global, ver AnunciosService)
  // ════════════════════════════════════════════════════════
  anuncios: AnuncioParaUsuario[] = [];
  showAnunciosDropdown = false;
  showAnunciosModal = false;
  anuncioSeleccionado: AnuncioParaUsuario | null = null;
  votando: Record<string, boolean> = {};

  ngOnInit(): void {
    this.cargarAnuncios();
  }

  private cargarAnuncios(): void {
    this.anunciosService.listarAnunciosActivos().subscribe({
      next: (anuncios) => {
        this.anuncios = anuncios;
        if (this.anuncioSeleccionado) {
          this.anuncioSeleccionado =
            anuncios.find((a) => a.id_anuncio === this.anuncioSeleccionado!.id_anuncio) ?? null;
        }
      },
      error: () => {
        /* si falla, la campana simplemente no muestra el punto rojo */
      },
    });
  }

  get hayAnunciosSinVer(): boolean {
    return this.anuncios.some((a) => !a.visto);
  }

  imagenSrc(anuncio: AnuncioParaUsuario): string | null {
    return anuncio.imagen_url ? `${this.apiUrl}${anuncio.imagen_url}` : null;
  }

  vigenciaTexto(anuncio: AnuncioParaUsuario): string {
    return anuncio.expira_en ? `Vence ${anuncio.expira_en.slice(0, 10)}` : 'Sin vencimiento';
  }

  totalVotos(anuncio: AnuncioParaUsuario): number {
    return anuncio.opciones.reduce((acumulado, o) => acumulado + (o.votos ?? 0), 0);
  }

  pctVotos(opcionVotos: number | null, total: number): number {
    if (!opcionVotos || total === 0) return 0;
    return Math.round((opcionVotos / total) * 100);
  }

  /** Cuántas estrellas eligió el usuario (1-based) — solo para encuestas de satisfacción. */
  estrellasVotadas(anuncio: AnuncioParaUsuario): number {
    return this.indiceActivo(anuncio) + 1;
  }

  /** Texto de la opción que el usuario votó — solo para encuestas de texto libre. */
  opcionVotadaTexto(anuncio: AnuncioParaUsuario): string {
    return anuncio.opciones.find((o) => o.id_opcion === anuncio.id_opcion_votada)?.texto ?? '';
  }

  /** Promedio ponderado de estrellas (1..N) a partir de la distribución de
   *  votos — reemplaza a las barras por nivel para encuestas de satisfacción. */
  promedioEstrellas(anuncio: AnuncioParaUsuario): number {
    const total = this.totalVotos(anuncio);
    if (total === 0) return 0;
    const suma = anuncio.opciones.reduce((acumulado, o, i) => acumulado + (i + 1) * (o.votos ?? 0), 0);
    return Math.round((suma / total) * 10) / 10;
  }

  toggleAnunciosDropdown(): void {
    this.showAnunciosDropdown = !this.showAnunciosDropdown;
    if (!this.showAnunciosDropdown) return;

    const sinVer = this.anuncios.filter((a) => !a.visto);
    sinVer.forEach((a) => {
      a.visto = true; // optimista: apaga el punto rojo de inmediato
      this.anunciosService.marcarVisto(a.id_anuncio).subscribe({ error: () => {} });
    });
  }

  cerrarDropdown(): void {
    this.showAnunciosDropdown = false;
  }

  abrirDetalleAnuncio(anuncio: AnuncioParaUsuario): void {
    this.anuncioSeleccionado = anuncio;
    this.opcionSeleccionada = null;
    this.showAnunciosDropdown = false;
    this.showAnunciosModal = true;
  }

  cerrarAnuncios(): void {
    this.showAnunciosModal = false;
    this.anuncioSeleccionado = null;
    this.opcionSeleccionada = null;
  }

  // ── Votación: primero se elige (sin llamar a la API), y recién al
  //    confirmar se manda el voto — evita votos por clics accidentales. ──
  opcionSeleccionada: string | null = null;

  seleccionarOpcion(anuncio: AnuncioParaUsuario, idOpcion: string): void {
    if (anuncio.id_opcion_votada) return;
    this.opcionSeleccionada = idOpcion;
  }

  /** Índice (0-based) de la opción elegida o ya votada — para pintar las
   *  estrellas llenas de una encuesta de satisfacción. -1 = ninguna. */
  indiceActivo(anuncio: AnuncioParaUsuario): number {
    const id = anuncio.id_opcion_votada ?? this.opcionSeleccionada;
    if (!id) return -1;
    return anuncio.opciones.findIndex((o) => o.id_opcion === id);
  }

  confirmarVoto(anuncio: AnuncioParaUsuario): void {
    if (!this.opcionSeleccionada || anuncio.id_opcion_votada || this.votando[anuncio.id_anuncio]) return;
    this.votando[anuncio.id_anuncio] = true;
    this.anunciosService.votar(anuncio.id_anuncio, this.opcionSeleccionada).subscribe({
      next: () => {
        this.votando[anuncio.id_anuncio] = false;
        this.opcionSeleccionada = null;
        this.cargarAnuncios();
      },
      error: () => {
        this.votando[anuncio.id_anuncio] = false;
      },
    });
  }
}