import { Injectable, signal } from '@angular/core';
import { RolUsuario } from '../services/usuarios';

/**
 * Snapshot de una sesión guardada en este dispositivo: perfil resumido +
 * sus propios tokens, independientes de la cuenta activa en TokenStore.
 * Permite alternar entre cuentas sin volver a loguearse cada vez (ver
 * AuthService.cambiarDeCuenta).
 */
export interface CuentaGuardada {
  idUsuario: string;
  nombre: string;
  correo: string;
  nombreEmpresa: string;
  avatarUrl: string | null;
  rol: RolUsuario;
  accessToken: string;
  refreshToken: string;
}

const CLAVE = 'alba_cuentas_guardadas';

/**
 * CRUD puro sobre localStorage — sin HTTP, sin depender de AuthService ni
 * TokenStore, a propósito: evita el riesgo de dependencia circular que ya
 * documenta el docstring de TokenStore (el interceptor HTTP no necesita
 * esto, así que no hay ciclo posible).
 */
@Injectable({ providedIn: 'root' })
export class CuentasGuardadasService {
  private cuentasSignal = signal<CuentaGuardada[]>(this.leer());

  cuentas = this.cuentasSignal.asReadonly();

  private leer(): CuentaGuardada[] {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return [];
      const lista = JSON.parse(crudo);
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }

  private persistir(lista: CuentaGuardada[]): void {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    this.cuentasSignal.set(lista);
  }

  obtener(idUsuario: string): CuentaGuardada | undefined {
    return this.cuentasSignal().find((c) => c.idUsuario === idUsuario);
  }

  /** Inserta o actualiza (por idUsuario) — se llama cada vez que se confirma una sesión válida. */
  upsert(cuenta: CuentaGuardada): void {
    const lista = this.cuentasSignal().filter((c) => c.idUsuario !== cuenta.idUsuario);
    lista.push(cuenta);
    this.persistir(lista);
  }

  eliminar(idUsuario: string): void {
    this.persistir(this.cuentasSignal().filter((c) => c.idUsuario !== idUsuario));
  }
}
