import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, catchError, forkJoin, map, switchMap, take, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenResponse, TokenStore } from './token-store';

export type Rol = 'admin' | 'dueño' | 'vendedor';

export interface SesionUsuario {
  idUsuario: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  dni: string | null;
  rol: Rol;
  empresaId: string | null;
  nombreEmpresa: string;
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

// Nombres exactos de los roles de sistema sembrados en el backend
// (app/scripts/seed_catalogo_rbac.py). Un usuario puede tener varios
// roles a la vez; se usa el de mayor privilegio para decidir a dónde
// navega y qué layout ve.
function mapearRol(nombresRoles: string[]): Rol {
  if (nombresRoles.includes('Administrador')) return 'admin';
  if (nombresRoles.includes('Dueño de empresa')) return 'dueño';
  return 'vendedor';
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
    }).pipe(
      map(({ perfil }) => {
        const usuario: SesionUsuario = {
          idUsuario: perfil.id_usuario,
          nombre: `${perfil.nombres} ${perfil.apellidos}`.trim(),
          correo: perfil.email,
          telefono: perfil.telefono,
          dni: perfil.dni,
          rol: mapearRol(perfil.roles),
          empresaId: perfil.id_empresa,
          nombreEmpresa: perfil.nombre_empresa,
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

  tieneRol(...roles: Rol[]): boolean {
    const actual = this.sesion();
    return !!actual && roles.includes(actual.rol);
  }
}
