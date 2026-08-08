import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { CuentaGuardada } from '../../core/cuentas-guardadas.service';
import { ThemeService } from '../../core/theme.service';
import { AnuncioParaUsuario, AnunciosService } from '../../services/anuncios';
import { SatisfaccionService } from '../../services/satisfaccion';
import { esArchivoDeImagen } from '../../utils/validar-imagen';
import { environment } from '../../../environments/environment';

/** Las secciones del menú de perfil — todas viven dentro del mismo modal/toolbar. */
export type VistaPerfil = 'menu' | 'info' | 'calificar' | 'acerca' | 'password' | 'cuentas';

/** 'lista' = ver/alternar cuentas guardadas; las otras 2 son el mini-login para sumar una nueva. */
type PasoCuentas = 'lista' | 'agregar-credenciales' | 'agregar-codigo';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css'],
})
export class TopbarComponent implements OnInit, OnDestroy {
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

    if (!esArchivoDeImagen(archivo)) {
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
    this.resetCuentas();
  }

  abrirVistaPerfil(vista: VistaPerfil): void {
    this.vistaPerfil = vista;
  }

  volverAlMenuPerfil(): void {
    this.vistaPerfil = 'menu';
    this.resetCuentas();
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
      case 'cuentas':
        return 'Cambiar de cuenta';
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

  // ── "Cambiar de cuenta" — alternar entre sesiones guardadas en este
  //    dispositivo sin volver a loguearse, o sumar una cuenta nueva sin
  //    perder la actual (ver AuthService.cambiarDeCuenta/cuentasGuardadas). ──
  vistaCuentas: PasoCuentas = 'lista';
  idCuentaActivando: string | null = null;
  errorCambioCuenta = '';
  /** La cuenta cuyo cambio falló — permite ofrecer "Volver a iniciar sesión" ya con su correo. */
  cuentaConError: CuentaGuardada | null = null;

  nuevaCuentaEmail = '';
  nuevaCuentaPassword = '';
  nuevaCuentaCargando = false;
  nuevaCuentaError = '';
  nuevaCuentaSegundosRestantes = 0;
  /** true cuando el correo viene precargado de una reautenticación (no de "Agregar otra cuenta") — no tiene sentido dejarlo editable ahí. */
  nuevaCuentaEmailBloqueado = false;
  private intervaloNuevaCuenta: ReturnType<typeof setInterval> | null = null;

  // ── Código de 6 dígitos: mismo patrón de casillas que verificar-2fa.ts,
  //    reutilizado acá para que se vea y se sienta igual dentro del modal. ──
  @ViewChildren('casillaCuenta') casillasCuentaRef?: QueryList<ElementRef<HTMLInputElement>>;
  nuevaCuentaDigitos: string[] = ['', '', '', '', '', ''];
  shakeCodigoCuenta = false;
  private shakeCodigoCuentaTimeout: ReturnType<typeof setTimeout> | null = null;

  get nuevaCuentaDigitosLlenos(): number {
    return this.nuevaCuentaDigitos.filter((d) => d !== '').length;
  }

  trackByIndiceCuenta(indice: number): number {
    return indice;
  }

  private enfocarCasillaCuenta(indice: number): void {
    this.casillasCuentaRef?.get(indice)?.nativeElement.focus();
  }

  private limpiarCasillasCuenta(): void {
    this.nuevaCuentaDigitos = ['', '', '', '', '', ''];
    this.casillasCuentaRef?.forEach((ref) => (ref.nativeElement.value = ''));
    this.enfocarCasillaCuenta(0);
  }

  private shakeCuenta(): void {
    this.shakeCodigoCuenta = false;
    if (this.shakeCodigoCuentaTimeout) clearTimeout(this.shakeCodigoCuentaTimeout);
    setTimeout(() => (this.shakeCodigoCuenta = true), 0);
    this.shakeCodigoCuentaTimeout = setTimeout(() => (this.shakeCodigoCuenta = false), 320);
  }

  onInputDigitoCuenta(indice: number, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const valor = input.value.replace(/[^0-9]/g, '').slice(-1);
    this.nuevaCuentaDigitos[indice] = valor;
    input.value = valor;

    if (valor && indice < 5) {
      this.enfocarCasillaCuenta(indice + 1);
    }

    if (this.nuevaCuentaDigitos.every((d) => d !== '')) {
      this.verificarCodigoNuevaCuenta();
    }
  }

  onKeydownCuenta(indice: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.nuevaCuentaDigitos[indice] && indice > 0) {
      this.enfocarCasillaCuenta(indice - 1);
    } else if (evento.key === 'ArrowLeft' && indice > 0) {
      this.enfocarCasillaCuenta(indice - 1);
    } else if (evento.key === 'ArrowRight' && indice < 5) {
      this.enfocarCasillaCuenta(indice + 1);
    }
  }

  onPasteCuenta(evento: ClipboardEvent): void {
    const soloDigitos = (evento.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
    if (!soloDigitos) return;
    evento.preventDefault();

    for (let i = 0; i < 6; i++) {
      this.nuevaCuentaDigitos[i] = soloDigitos[i] ?? '';
      const input = this.casillasCuentaRef?.get(i)?.nativeElement;
      if (input) input.value = this.nuevaCuentaDigitos[i];
    }
    this.enfocarCasillaCuenta(Math.min(soloDigitos.length, 5));

    if (this.nuevaCuentaDigitos.every((d) => d !== '')) {
      this.verificarCodigoNuevaCuenta();
    }
  }

  cuentasGuardadas(): CuentaGuardada[] {
    return this.authService.cuentasGuardadas();
  }

  esCuentaActiva(cuenta: CuentaGuardada): boolean {
    return cuenta.idUsuario === this.authService.usuarioActual()?.idUsuario;
  }

  avatarSrcPara(url: string | null): string | null {
    return url ? `${this.apiUrl}${url}` : null;
  }

  activarCuenta(cuenta: CuentaGuardada): void {
    if (this.esCuentaActiva(cuenta) || this.idCuentaActivando) return;
    this.idCuentaActivando = cuenta.idUsuario;
    this.errorCambioCuenta = '';
    this.cuentaConError = null;

    this.authService.cambiarDeCuenta(cuenta.idUsuario).subscribe({
      next: (usuario) => {
        // Reload duro a propósito: algunos componentes (ej. sidebar del
        // layout de empresa) capturan datos derivados del rol una sola vez
        // en su constructor — solo un reload garantiza que TODO el shell
        // (no solo los signals) refleje la cuenta nueva de una.
        window.location.href = this.authService.rutaHomeParaRol(usuario.rol);
      },
      error: () => {
        this.idCuentaActivando = null;
        this.errorCambioCuenta = `Tu sesión guardada de ${cuenta.correo} venció.`;
        this.cuentaConError = cuenta;
      },
    });
  }

  /** Desde el error de un cambio fallido: reabre el login con el correo ya puesto, solo falta la contraseña. */
  reautenticarCuenta(cuenta: CuentaGuardada): void {
    this.errorCambioCuenta = '';
    this.cuentaConError = null;
    this.vistaCuentas = 'agregar-credenciales';
    this.nuevaCuentaEmail = cuenta.correo;
    this.nuevaCuentaEmailBloqueado = true;
    this.nuevaCuentaPassword = '';
    this.nuevaCuentaError = '';
  }

  eliminarCuentaGuardada(cuenta: CuentaGuardada, evento: Event): void {
    evento.stopPropagation();
    if (this.cuentaConError?.idUsuario === cuenta.idUsuario) {
      this.errorCambioCuenta = '';
      this.cuentaConError = null;
    }
    this.authService.eliminarCuentaGuardada(cuenta.idUsuario);
  }

  mostrarFormularioAgregarCuenta(): void {
    this.vistaCuentas = 'agregar-credenciales';
    this.errorCambioCuenta = '';
    this.cuentaConError = null;
    this.nuevaCuentaEmailBloqueado = false;
  }

  cancelarAgregarCuenta(): void {
    this.authService.limpiarLoginPendiente();
    this.detenerIntervaloNuevaCuenta();
    this.vistaCuentas = 'lista';
    this.nuevaCuentaEmail = '';
    this.nuevaCuentaPassword = '';
    this.nuevaCuentaDigitos = ['', '', '', '', '', ''];
    this.nuevaCuentaError = '';
    this.nuevaCuentaEmailBloqueado = false;
  }

  enviarCredencialesNuevaCuenta(): void {
    if (this.nuevaCuentaCargando || !this.nuevaCuentaEmail || !this.nuevaCuentaPassword) return;
    this.nuevaCuentaCargando = true;
    this.nuevaCuentaError = '';

    this.authService.login(this.nuevaCuentaEmail, this.nuevaCuentaPassword).subscribe({
      next: (pendiente) => {
        this.nuevaCuentaCargando = false;
        this.vistaCuentas = 'agregar-codigo';
        this.nuevaCuentaDigitos = ['', '', '', '', '', ''];
        this.nuevaCuentaSegundosRestantes = pendiente.expira_en_segundos;
        setTimeout(() => this.enfocarCasillaCuenta(0), 150);
        this.detenerIntervaloNuevaCuenta();
        this.intervaloNuevaCuenta = setInterval(() => {
          this.nuevaCuentaSegundosRestantes--;
          if (this.nuevaCuentaSegundosRestantes <= 0) {
            this.detenerIntervaloNuevaCuenta();
            this.nuevaCuentaError = 'El código venció. Vuelve a intentar.';
            this.vistaCuentas = 'agregar-credenciales';
          }
        }, 1000);
      },
      error: (error: HttpErrorResponse) => {
        this.nuevaCuentaCargando = false;
        this.nuevaCuentaError =
          error.status === 401 ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión. Intenta de nuevo.';
      },
    });
  }

  verificarCodigoNuevaCuenta(): void {
    const codigo = this.nuevaCuentaDigitos.join('');
    if (this.nuevaCuentaCargando || codigo.length !== 6) return;
    this.nuevaCuentaCargando = true;
    this.nuevaCuentaError = '';

    this.authService.verificar2fa(codigo).subscribe({
      next: (usuario) => {
        this.detenerIntervaloNuevaCuenta();
        // Igual que activarCuenta(): reload duro para que todo el shell
        // arranque limpio con la cuenta recién agregada.
        window.location.href = this.authService.rutaHomeParaRol(usuario.rol);
      },
      error: (error: HttpErrorResponse) => {
        this.nuevaCuentaCargando = false;
        if (error.status === 401) {
          this.detenerIntervaloNuevaCuenta();
          this.nuevaCuentaError = 'El código venció o hubo demasiados intentos. Vuelve a intentar.';
          this.vistaCuentas = 'agregar-credenciales';
          return;
        }
        this.nuevaCuentaError = 'Código incorrecto, intenta de nuevo.';
        this.shakeCuenta();
        this.limpiarCasillasCuenta();
      },
    });
  }

  private detenerIntervaloNuevaCuenta(): void {
    if (this.intervaloNuevaCuenta) {
      clearInterval(this.intervaloNuevaCuenta);
      this.intervaloNuevaCuenta = null;
    }
  }

  private resetCuentas(): void {
    this.detenerIntervaloNuevaCuenta();
    this.authService.limpiarLoginPendiente();
    this.vistaCuentas = 'lista';
    this.idCuentaActivando = null;
    this.errorCambioCuenta = '';
    this.cuentaConError = null;
    this.nuevaCuentaEmail = '';
    this.nuevaCuentaPassword = '';
    this.nuevaCuentaDigitos = ['', '', '', '', '', ''];
    this.nuevaCuentaCargando = false;
    this.nuevaCuentaError = '';
    this.nuevaCuentaEmailBloqueado = false;
    if (this.shakeCodigoCuentaTimeout) clearTimeout(this.shakeCodigoCuentaTimeout);
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
  enviandoCambioPassword = false;
  verificandoCodigoPassword = false;
  errorCambioPassword = '';
  errorCodigoPassword = '';

  // Mismas casillas de 6 dígitos que en "Agregar otra cuenta" (ver arriba) — un solo patrón reusado en los 2 lugares del modal que piden un código de email.
  @ViewChildren('casillaPassword') casillasPasswordRef?: QueryList<ElementRef<HTMLInputElement>>;
  codigoPasswordDigitos: string[] = ['', '', '', '', '', ''];
  shakeCodigoPassword = false;
  private shakeCodigoPasswordTimeout: ReturnType<typeof setTimeout> | null = null;

  get codigoPasswordDigitosLlenos(): number {
    return this.codigoPasswordDigitos.filter((d) => d !== '').length;
  }

  trackByIndicePassword(indice: number): number {
    return indice;
  }

  private enfocarCasillaPassword(indice: number): void {
    this.casillasPasswordRef?.get(indice)?.nativeElement.focus();
  }

  private limpiarCasillasPassword(): void {
    this.codigoPasswordDigitos = ['', '', '', '', '', ''];
    this.casillasPasswordRef?.forEach((ref) => (ref.nativeElement.value = ''));
    this.enfocarCasillaPassword(0);
  }

  private shakePassword(): void {
    this.shakeCodigoPassword = false;
    if (this.shakeCodigoPasswordTimeout) clearTimeout(this.shakeCodigoPasswordTimeout);
    setTimeout(() => (this.shakeCodigoPassword = true), 0);
    this.shakeCodigoPasswordTimeout = setTimeout(() => (this.shakeCodigoPassword = false), 320);
  }

  onInputDigitoPassword(indice: number, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const valor = input.value.replace(/[^0-9]/g, '').slice(-1);
    this.codigoPasswordDigitos[indice] = valor;
    input.value = valor;

    if (valor && indice < 5) {
      this.enfocarCasillaPassword(indice + 1);
    }

    if (this.codigoPasswordDigitos.every((d) => d !== '')) {
      this.confirmarCambioPassword();
    }
  }

  onKeydownPassword(indice: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.codigoPasswordDigitos[indice] && indice > 0) {
      this.enfocarCasillaPassword(indice - 1);
    } else if (evento.key === 'ArrowLeft' && indice > 0) {
      this.enfocarCasillaPassword(indice - 1);
    } else if (evento.key === 'ArrowRight' && indice < 5) {
      this.enfocarCasillaPassword(indice + 1);
    }
  }

  onPastePassword(evento: ClipboardEvent): void {
    const soloDigitos = (evento.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
    if (!soloDigitos) return;
    evento.preventDefault();

    for (let i = 0; i < 6; i++) {
      this.codigoPasswordDigitos[i] = soloDigitos[i] ?? '';
      const input = this.casillasPasswordRef?.get(i)?.nativeElement;
      if (input) input.value = this.codigoPasswordDigitos[i];
    }
    this.enfocarCasillaPassword(Math.min(soloDigitos.length, 5));

    if (this.codigoPasswordDigitos.every((d) => d !== '')) {
      this.confirmarCambioPassword();
    }
  }

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
        this.codigoPasswordDigitos = ['', '', '', '', '', ''];
        setTimeout(() => this.enfocarCasillaPassword(0), 150);
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
    const codigo = this.codigoPasswordDigitos.join('');
    if (codigo.length !== 6 || this.verificandoCodigoPassword) return;
    this.verificandoCodigoPassword = true;
    this.errorCodigoPassword = '';
    this.authService.confirmarCambioPassword(codigo).subscribe({
      next: () => {
        this.verificandoCodigoPassword = false;
        this.pasoCambioPassword = 'exito';
      },
      error: (error: HttpErrorResponse) => {
        this.verificandoCodigoPassword = false;
        if (error.status === 401) {
          this.errorCodigoPassword = 'Código vencido o demasiados intentos. Vuelve a solicitar el cambio.';
          return;
        }
        this.errorCodigoPassword = 'Código incorrecto. Verifica e intenta de nuevo.';
        this.shakePassword();
        this.limpiarCasillasPassword();
      },
    });
  }

  private resetCambioPassword(): void {
    this.pasoCambioPassword = 'form';
    this.passwordActual = '';
    this.passwordNueva = '';
    this.passwordConfirmar = '';
    this.codigoPasswordDigitos = ['', '', '', '', '', ''];
    this.enviandoCambioPassword = false;
    this.verificandoCodigoPassword = false;
    this.errorCambioPassword = '';
    this.errorCodigoPassword = '';
    if (this.shakeCodigoPasswordTimeout) clearTimeout(this.shakeCodigoPasswordTimeout);
  }

  // ════════════════════════════════════════════════════════
  // Accesibilidad: botón junto a la campana. El widget (accesibilidad.js /
  // accesibilidad-responsive.js) ya no muestra su propio botón flotante:
  // se abre/cierra únicamente desde acá vía window.AccessibilityWidget.
  // ════════════════════════════════════════════════════════
  toggleAccesibilidad(): void {
    (window as any).AccessibilityWidget?.toggle?.();
  }

  // ════════════════════════════════════════════════════════
  // Campana: desplegable con títulos/vigencia → modal con el
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

  ngOnDestroy(): void {
    this.detenerIntervaloNuevaCuenta();
    if (this.shakeCodigoCuentaTimeout) clearTimeout(this.shakeCodigoCuentaTimeout);
    if (this.shakeCodigoPasswordTimeout) clearTimeout(this.shakeCodigoPasswordTimeout);
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