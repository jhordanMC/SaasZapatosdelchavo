import { Injectable, signal } from '@angular/core';

/**
 * Bandera global de "sesión expirada". Va separado de AuthService por la
 * misma razón que TokenStore (ver su docstring): el interceptor HTTP la
 * inyecta directamente, y si dependiera de AuthService se formaría un ciclo
 * (NG0200) apenas AuthService dispare su primera llamada HTTP.
 */
@Injectable({ providedIn: 'root' })
export class SesionExpiradaService {
  private expiradaSignal = signal(false);

  sesionExpirada = this.expiradaSignal.asReadonly();

  marcarExpirada(): void {
    this.expiradaSignal.set(true);
  }

  limpiar(): void {
    this.expiradaSignal.set(false);
  }
}
