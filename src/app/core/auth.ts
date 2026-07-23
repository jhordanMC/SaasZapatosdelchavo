import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, catchError, forkJoin, map, of, switchMap, take, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClaveVista, RolUsuario, mapearRol } from '../services/usuarios';
import { TokenResponse, TokenStore } from './token-store';

export interface SesionUsuario {
  idUsuario: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  dni: string | null;
  rol: RolUsuario;
  empresaId: string | null;
  nombreEmpresa: string;
  // Vistas deshabilitadas puntualmente para este usuario, independiente
  // de lo que ya le da su rol (ver modal "Permisos de vista" en el panel
  // admin). Todo lo que NO está en esta lista se entiende habilitado.
  vistasDeshabilitadas: ClaveVista[];
}

export interface LoginTokenResponse {
  login_token: string;
  expira_en_segundos: number;
}

interface MiPerfilResponse {
  id_usuario: string;
  id_empresa: string;
  nombre_empresa: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  dni: string | null;
  estado: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  private sesion = signal<SesionUsuario | null>(null);

  // Login en dos pasos (2FA obligatorio): login() ya no entrega tokens,
  // deja acá el login_token pendiente hasta que verificar2fa() lo
  // confirme con el código que llega por email.
  private loginPendiente: LoginTokenResponse | null = null;

  // Se emite una vez que el intento de restaurar sesión (al recargar la
  // página) terminó, haya encontrado sesión válida o no. Los guards de
  // ruta esperan esto para no expulsar a un usuario ya logueado mientras
  // todavía se está confirmando el token contra el backend.
  private inicializacion$ = new ReplaySubject<void>(1);

  usuarioActual = this.sesion.asReadonly();

  constructor(private http: HttpClient, private tokenStore: TokenStore) {
    if (this.tokenStore.accessToken()) {
      this.cargarPerfilYPermisos().subscribe({
        next: () => this.finalizarInicializacion(),
        error: () => {
          this.tokenStore.limpiar();
          this.finalizarInicializacion();
        },
      });
    } else {
      this.finalizarInicializacion();
    }
  }

  private finalizarInicializacion(): void {
    this.inicializacion$.next();
    this.inicializacion$.complete();
  }

  esperarInicializacion(): Observable<void> {
    return this.inicializacion$.pipe(take(1));
  }

  private cargarPerfilYPermisos(): Observable<SesionUsuario> {
    return forkJoin({
      perfil: this.http.get<MiPerfilResponse>(`${this.apiUrl}/iam/mi-perfil`),
      permisos: this.http.get<string[]>(`${this.apiUrl}/iam/mis-permisos`),
      // Tolerante a fallos a propósito: si este endpoint falla (ej. la
      // tabla usuarios_vistas_deshabilitadas todavía no existe en la BD),
      // no debe tumbar la carga de sesión entera — se asume "sin vistas
      // deshabilitadas", coherente con la semántica ya documentada de
      // vistasDeshabilitadas (todo lo que no está en la lista se entiende
      // habilitado).
      vistasDeshabilitadas: this.http
        .get<ClaveVista[]>(`${this.apiUrl}/iam/mis-vistas-deshabilitadas`)
        .pipe(catchError(() => of([] as ClaveVista[]))),
    }).pipe(
      map(({ perfil, vistasDeshabilitadas }) => {
        const usuario: SesionUsuario = {
          idUsuario: perfil.id_usuario,
          nombre: `${perfil.nombres} ${perfil.apellidos}`.trim(),
          correo: perfil.email,
          telefono: perfil.telefono,
          dni: perfil.dni,
          rol: mapearRol(perfil.roles),
          empresaId: perfil.id_empresa,
          nombreEmpresa: perfil.nombre_empresa,
          vistasDeshabilitadas,
        };
        this.sesion.set(usuario);
        return usuario;
      }),
    );
  }

  /**
   * Primer paso del login: valida email+password. Ya NO entrega tokens
   * (2FA obligatorio) — guarda el login_token pendiente y lo devuelve
   * junto con cuánto dura vigente, para que la pantalla de verificación
   * arme su cuenta regresiva.
   */
  login(correo: string, password: string): Observable<LoginTokenResponse> {
    const body = new HttpParams().set('username', correo).set('password', password);

    return this.http
      .post<LoginTokenResponse>(`${this.apiUrl}/iam/auth/login`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(tap((respuesta) => (this.loginPendiente = respuesta)));
  }

  obtenerLoginPendiente(): LoginTokenResponse | null {
    return this.loginPendiente;
  }

  limpiarLoginPendiente(): void {
    this.loginPendiente = null;
  }

  /** Segundo paso: el código de 6 dígitos que llegó por email. Acá sí se emiten los tokens. */
  verificar2fa(codigo: string): Observable<SesionUsuario> {
    const loginToken = this.loginPendiente?.login_token;
    if (!loginToken) {
      return throwError(() => new Error('No hay un login en curso'));
    }

    return this.http
      .post<TokenResponse>(`${this.apiUrl}/iam/auth/verificar-2fa`, { login_token: loginToken, codigo })
      .pipe(
        tap((tokens) => {
          this.tokenStore.guardar(tokens);
          this.loginPendiente = null;
        }),
        switchMap(() => this.cargarPerfilYPermisos()),
        catchError((error) => {
          this.tokenStore.limpiar();
          this.sesion.set(null);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Cambio de contraseña desde el menú de perfil (topbar): mismo patrón de
   * 2 pasos que el login (código de 6 dígitos por email), pero mientras la
   * sesión ya está activa.
   *
   * TODO(backend): estos dos endpoints todavía NO existen en
   * backendsaasalba — hay que coordinarlos con el equipo de backend:
   *   POST {apiUrl}/iam/auth/solicitar-cambio-password  { password_nueva }
   *     → guarda la password nueva pendiente + envía el código por email,
   *       análogo a /iam/auth/login guardando loginPendiente.
   *   POST {apiUrl}/iam/auth/confirmar-cambio-password  { codigo }
   *     → valida el código y recién ahí aplica el cambio de password.
   * Mientras no existan, el topbar mostrará el mensaje de error ya
   * contemplado en la UI (ver TopbarComponent.errorPassword).
   */
  solicitarCambioPassword(passwordNueva: string): Observable<{ expira_en_segundos: number }> {
    return this.http.post<{ expira_en_segundos: number }>(
      `${this.apiUrl}/iam/auth/solicitar-cambio-password`,
      { password_nueva: passwordNueva },
    );
  }

  confirmarCambioPassword(codigo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.apiUrl}/iam/auth/confirmar-cambio-password`,
      { codigo },
    );
  }

  logout(): void {
    const refreshToken = this.tokenStore.refreshToken;
    this.tokenStore.limpiar();
    this.sesion.set(null);
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/iam/auth/logout`, { refresh_token: refreshToken }).subscribe();
    }
  }

  estaAutenticado(): boolean {
    return this.sesion() !== null;
  }

  tieneRol(...roles: RolUsuario[]): boolean {
    const actual = this.sesion();
    return !!actual && roles.includes(actual.rol);
  }

  puedeVerVista(clave: ClaveVista): boolean {
    const actual = this.sesion();
    return !!actual && !actual.vistasDeshabilitadas.includes(clave);
  }

  /** Única fuente de verdad rol -> ruta base, usada por los guards para saber a dónde mandar a alguien ya autenticado. */
  rutaHomeParaRol(rol: RolUsuario): string {
    return rol === 'admin' ? '/admin' : '/empresa';
  }

  /**
   * Ruta completa de la primera vista a la que este usuario tiene acceso
   * (rol + vistas deshabilitadas), o null si no le queda ninguna
   * disponible (-> /acceso-restringido). Mismo orden/reglas que los
   * sidebars (EmpresaLayoutComponent / AdminLayoutComponent). 'analitica'
   * (dueño) y 'reportes'/'configuración' (admin) quedan afuera a
   * propósito: están ocultas del sidebar / no tienen página real todavía.
   */
  primeraVistaDisponible(): string | null {
    const actual = this.sesion();
    if (!actual) return null;

    if (actual.rol === 'admin') {
      if (this.puedeVerVista('dashboard')) return '/admin/dashboard';
      if (this.puedeVerVista('empresas')) return '/admin/empresas';
      if (this.puedeVerVista('suscripciones')) return '/admin/suscripciones';
      if (this.puedeVerVista('actividad')) return '/admin/actividad';
      if (this.puedeVerVista('anuncios')) return '/admin/anuncios';
      return null;
    }

    const esDueño = actual.rol === 'dueño';
    if (esDueño && this.puedeVerVista('dashboard')) return '/empresa/dashboard';
    if (this.puedeVerVista('inventario')) return '/empresa/inventario';
    if (this.puedeVerVista('ventas')) return '/empresa/ventas';
    if (esDueño && this.puedeVerVista('finanzas')) return '/empresa/finanzas';
    return null;
  }
}
