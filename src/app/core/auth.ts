import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, ReplaySubject, catchError, forkJoin, map, switchMap, take, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenResponse, TokenStore } from './token-store';

export type Rol = 'admin' | 'dueño' | 'vendedor';

export interface SesionUsuario {
  nombre: string;
  correo: string;
  rol: Rol;
  empresaId: string | null;
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
        tap((tokens) => this.tokenStore.guardar(tokens)),
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
