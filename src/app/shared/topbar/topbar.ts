import { Component, ElementRef, HostListener, Input, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { ThemeService } from '../../core/theme.service';
import { AnuncioParaUsuario, AnunciosService } from '../../services/anuncios';
import { SatisfaccionService } from '../../services/satisfaccion';
import { environment } from '../../../environments/environment';

/** Las 4 secciones del menú de perfil — todas viven dentro del mismo modal/toolbar. */
export type VistaPerfil = 'menu' | 'info' | 'calificar' | 'acerca' | 'password';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css'],
})
export class TopbarComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
    private anunciosService: AnunciosService,
    private satisfaccionService: SatisfaccionService,
    public themeService: ThemeService,
  ) {}

  readonly apiUrl = environment.apiUrl;

  @Input() title = 'Dashboard';
  @Input() subtitle = '';
  @Input() company = 'ALBA Corporation';
  @Input() avatarLabel = 'A';
  // Ruta relativa (/uploads/usuarios/...) o null si no tiene foto todavía
  // — el prefijo de apiUrl se arma acá mismo (ver avatarSrc()), no en el
  // layout que lo pasa.
  @Input() avatarUrl: string | null = null;
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

  // ── Buscador (⌘K / Ctrl+K enfoca el campo) ──
  // Solo enfoca el input por ahora — todavía no hay un endpoint de
  // búsqueda global en el backend, así que no pretende devolver resultados.
  @ViewChild('buscadorInput') buscadorInput?: ElementRef<HTMLInputElement>;
  busqueda = '';

  @HostListener('document:keydown', ['$event'])
  manejarAtajoBusqueda(evento: KeyboardEvent): void {
    const esAtajo = (evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k';
    if (!esAtajo) return;
    evento.preventDefault();
    this.buscadorInput?.nativeElement.focus();
  }

  // ── Foto de perfil (avatar) ────────────────────────────────────────
  subiendoAvatar = signal(false);
  errorAvatar = signal<string | null>(null);

  /** URL absoluta lista para <img> — avatarUrl solo guarda la ruta relativa. */
  avatarSrc(): string | null {
    return this.avatarUrl ? `${this.apiUrl}${this.avatarUrl}` : null;
  }

  onAvatarSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite re-seleccionar el mismo archivo después de un error
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      this.errorAvatar.set('El archivo debe ser una imagen (foto).');
      return;
    }

    this.subiendoAvatar.set(true);
    this.errorAvatar.set(null);
    this.authService.subirAvatar(archivo).subscribe({
      next: (usuario) => {
        this.avatarUrl = usuario.avatarUrl;
        this.showAvatarFallback = false;
        this.subiendoAvatar.set(false);
      },
      error: (err) => {
        this.subiendoAvatar.set(false);
        this.errorAvatar.set(err?.error?.detail ?? 'No se pudo subir la foto. Intenta de nuevo.');
      },
    });
  }

  // ── Menú de perfil: 4 secciones dentro del mismo toolbar ──────────
  readonly VERSION_APP = 'V1.0';
  readonly ESLOGAN = 'Lo que vendiste, lo que gastaste, lo que ganaste. Todo en VILCAS.';

  vistaPerfil: VistaPerfil = 'menu';

  openProfile(): void {
    this.showProfileModal = true;
  }

  /**
   * Único punto de salida real del modal — se llama SOLO desde la "X", el
   * botón "Cerrar" y tras confirmar "Cerrar sesión". El overlay ya NO tiene
   * (click) para cerrar: a propósito, para que un clic afuera no tire todo
   * el progreso de una sección (ej. a mitad del cambio de contraseña).
   */
  closeProfile(): void {
    this.showProfileModal = false;
    this.confirmandoCierre = false;
    this.vistaPerfil = 'menu';
    this.resetCalificar();
    this.resetCambioPassword();
  }

  abrirVistaPerfil(vista: VistaPerfil): void {
    this.vistaPerfil = vista;
  }

  volverAlMenuPerfil(): void {
    this.vistaPerfil = 'menu';
  }

  tituloVistaPerfil(): string {
    switch (this.vistaPerfil) {
      case 'info':
        return 'Información personal';
      case 'calificar':
        return 'Califícanos';
      case 'acerca':
        return 'Acerca de VILCAS';
      case 'password':
        return 'Cambio de contraseña';
      default:
        return '';
    }
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
    this.vistaPerfil = 'menu';
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ── "Califícanos / ayúdanos con tu opinión" ────────────────────────
  readonly MAX_COMENTARIO_CALIFICACION = 500;

  calificacionEstrellas = 0;
  comentarioCalificacion = '';
  enviandoCalificacion = false;
  calificacionEnviada = false;
  errorCalificacion = false;

  get comentarioCalificacionRestante(): number {
    return this.MAX_COMENTARIO_CALIFICACION - this.comentarioCalificacion.length;
  }

  seleccionarEstrellaCalificacion(valor: number): void {
    this.calificacionEstrellas = valor;
  }

  enviarCalificacion(): void {
    if (this.calificacionEstrellas === 0 || this.enviandoCalificacion) return;
    this.enviandoCalificacion = true;
    this.errorCalificacion = false;
    this.satisfaccionService
      .enviarCalificacionTopbar({
        calificacion: this.calificacionEstrellas,
        comentario: this.comentarioCalificacion.trim() || null,
      })
      .subscribe({
        next: () => {
          this.enviandoCalificacion = false;
          this.calificacionEnviada = true;
        },
        error: () => {
          this.enviandoCalificacion = false;
          this.errorCalificacion = true;
        },
      });
  }

  private resetCalificar(): void {
    this.calificacionEstrellas = 0;
    this.comentarioCalificacion = '';
    this.enviandoCalificacion = false;
    this.calificacionEnviada = false;
    this.errorCalificacion = false;
  }

  // ── "Cambio de contraseña" (2 pasos: nueva password → código por email) ──
  pasoCambioPassword: 'form' | 'codigo' | 'exito' = 'form';
  passwordActual = '';
  passwordNueva = '';
  passwordConfirmar = '';
  codigoCambioPassword = '';
  enviandoCambioPassword = false;
  verificandoCodigoPassword = false;
  errorCambioPassword = '';
  errorCodigoPassword = '';

  get passwordNuevaValida(): boolean {
    return (
      this.passwordActual.length > 0 &&
      this.passwordNueva.length >= 8 &&
      this.passwordNueva === this.passwordConfirmar
    );
  }

  solicitarCambioPassword(): void {
    if (!this.passwordNuevaValida || this.enviandoCambioPassword) return;
    this.enviandoCambioPassword = true;
    this.errorCambioPassword = '';
    this.authService.solicitarCambioPassword(this.passwordActual, this.passwordNueva).subscribe({
      next: () => {
        this.enviandoCambioPassword = false;
        this.pasoCambioPassword = 'codigo';
      },
      error: (error: HttpErrorResponse) => {
        this.enviandoCambioPassword = false;
        if (error.status === 401) {
          this.errorCambioPassword = 'La contraseña actual es incorrecta.';
        } else if (error.status === 429) {
          this.errorCambioPassword = 'Demasiados intentos. Espera unos minutos antes de volver a intentar.';
        } else {
          this.errorCambioPassword = 'No pudimos enviar el código. Intenta nuevamente en unos minutos.';
        }
      },
    });
  }

  confirmarCambioPassword(): void {
    if (!this.codigoCambioPassword || this.verificandoCodigoPassword) return;
    this.verificandoCodigoPassword = true;
    this.errorCodigoPassword = '';
    this.authService.confirmarCambioPassword(this.codigoCambioPassword).subscribe({
      next: () => {
        this.verificandoCodigoPassword = false;
        this.pasoCambioPassword = 'exito';
      },
      error: (error: HttpErrorResponse) => {
        this.verificandoCodigoPassword = false;
        if (error.status === 401) {
          this.errorCodigoPassword = 'Código vencido o demasiados intentos. Vuelve a solicitar el cambio.';
        } else {
          this.errorCodigoPassword = 'Código incorrecto. Verifica e intenta de nuevo.';
        }
      },
    });
  }

  private resetCambioPassword(): void {
    this.pasoCambioPassword = 'form';
    this.passwordActual = '';
    this.passwordNueva = '';
    this.passwordConfirmar = '';
    this.codigoCambioPassword = '';
    this.enviandoCambioPassword = false;
    this.verificandoCodigoPassword = false;
    this.errorCambioPassword = '';
    this.errorCodigoPassword = '';
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
