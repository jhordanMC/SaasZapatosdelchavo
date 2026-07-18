import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, catchError, map, of, switchMap, take, tap, throwError, forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';

export type Rol = 'admin' | 'dueño' | 'vendedor';

export interface SesionUsuario {
  nombre: string;
  correo: string;
  rol: Rol;
  empresaId: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface MiPerfilResponse {
  id_usuario: string;
  id_empresa: string;
  nombres: string;
  apellidos: string;
  email: string;
  estado: string;
  roles: string[];
}

const CLAVE_ACCESS_TOKEN = 'alba_access_token';
const CLAVE_REFRESH_TOKEN = 'alba_refresh_token';

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
  private tokenAcceso = signal<string | null>(localStorage.getItem(CLAVE_ACCESS_TOKEN));

  // Se emite una vez que el intento de restaurar sesión (al recargar la
  // página) terminó, haya encontrado sesión válida o no. Los guards de
  // ruta esperan esto para no expulsar a un usuario ya logueado mientras
  // todavía se está confirmando el token contra el backend.
  private inicializacion$ = new ReplaySubject<void>(1);

  usuarioActual = this.sesion.asReadonly();
  accessToken = this.tokenAcceso.asReadonly();

  constructor(private http: HttpClient) {
    if (this.tokenAcceso()) {
      this.cargarPerfilYPermisos().subscribe({
        next: () => this.finalizarInicializacion(),
        error: () => {
          this.limpiarSesion();
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
          nombre: `${perfil.nombres} ${perfil.apellidos}`.trim(),
          correo: perfil.email,
          rol: mapearRol(perfil.roles),
          empresaId: perfil.id_empresa,
        };
        this.sesion.set(usuario);
        return usuario;
      }),
    );
  }

  login(correo: string, password: string): Observable<SesionUsuario> {
    const body = new HttpParams().set('username', correo).set('password', password);

    return this.http
      .post<TokenResponse>(`${this.apiUrl}/iam/auth/login`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((tokens) => this.guardarTokens(tokens)),
        switchMap(() => this.cargarPerfilYPermisos()),
        catchError((error) => {
          this.limpiarSesion();
          return throwError(() => error);
        }),
      );
  }

  logout(): void {
    const refreshToken = localStorage.getItem(CLAVE_REFRESH_TOKEN);
    this.limpiarSesion();
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/iam/auth/logout`, { refresh_token: refreshToken }).subscribe();
    }
  }

  /** Usado por el interceptor HTTP para reintentar tras un 401. */
  refrescarSesion(): Observable<string | null> {
    const refreshToken = localStorage.getItem(CLAVE_REFRESH_TOKEN);
    if (!refreshToken) {
      this.limpiarSesion();
      return of(null);
    }
    return this.http.post<TokenResponse>(`${this.apiUrl}/iam/auth/refresh`, { refresh_token: refreshToken }).pipe(
      map((tokens) => {
        this.guardarTokens(tokens);
        return tokens.access_token;
      }),
      catchError(() => {
        this.limpiarSesion();
        return of(null);
      }),
    );
  }

  private guardarTokens(tokens: TokenResponse): void {
    localStorage.setItem(CLAVE_ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(CLAVE_REFRESH_TOKEN, tokens.refresh_token);
    this.tokenAcceso.set(tokens.access_token);
  }

  private limpiarSesion(): void {
    localStorage.removeItem(CLAVE_ACCESS_TOKEN);
    localStorage.removeItem(CLAVE_REFRESH_TOKEN);
    this.tokenAcceso.set(null);
    this.sesion.set(null);
  }

  estaAutenticado(): boolean {
    return this.sesion() !== null;
  }

  tieneRol(...roles: Rol[]): boolean {
    const actual = this.sesion();
    return !!actual && roles.includes(actual.rol);
  }
}
