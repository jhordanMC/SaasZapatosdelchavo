import { HttpContextToken } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

/**
 * Marca requests que NO deben disparar el modal global de "sesión
 * expirada" si su token falla y el refresh también falla — usado por
 * AuthService.cambiarDeCuenta: si la cuenta a la que se está cambiando
 * tiene tokens vencidos, la cuenta ACTUAL (que sí sigue viva) no debe
 * verse afectada por ese fallo puntual.
 */
export const OMITIR_EXPIRACION_GLOBAL = new HttpContextToken<boolean>(() => false);

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
