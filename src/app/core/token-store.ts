import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

const CLAVE_ACCESS_TOKEN = 'alba_access_token';
const CLAVE_REFRESH_TOKEN = 'alba_refresh_token';

/**
 * Guarda y refresca los tokens de sesión. Va separado de AuthService a
 * propósito: el interceptor HTTP necesita leer el token en cada request
 * (incluidas las que dispara AuthService al construirse, para restaurar
 * sesión tras un F5). Si el interceptor inyectara AuthService directamente
 * se formaría una dependencia circular (NG0200) apenas AuthService hiciera
 * su primera llamada HTTP dentro del propio constructor.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly apiUrl = environment.apiUrl;
  private accessTokenSignal = signal<string | null>(localStorage.getItem(CLAVE_ACCESS_TOKEN));

  accessToken = this.accessTokenSignal.asReadonly();

  constructor(private http: HttpClient) {}

  get refreshToken(): string | null {
    return localStorage.getItem(CLAVE_REFRESH_TOKEN);
  }

  guardar(tokens: TokenResponse): void {
    localStorage.setItem(CLAVE_ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(CLAVE_REFRESH_TOKEN, tokens.refresh_token);
    this.accessTokenSignal.set(tokens.access_token);
  }

  limpiar(): void {
    localStorage.removeItem(CLAVE_ACCESS_TOKEN);
    localStorage.removeItem(CLAVE_REFRESH_TOKEN);
    this.accessTokenSignal.set(null);
  }

  /** Usado por el interceptor HTTP para reintentar tras un 401. */
  refrescar(): Observable<string | null> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) {
      this.limpiar();
      return of(null);
    }
    return this.http.post<TokenResponse>(`${this.apiUrl}/iam/auth/refresh`, { refresh_token: refreshToken }).pipe(
      map((tokens) => {
        this.guardar(tokens);
        return tokens.access_token;
      }),
      catchError(() => {
        this.limpiar();
        return of(null);
      }),
    );
  }
}
