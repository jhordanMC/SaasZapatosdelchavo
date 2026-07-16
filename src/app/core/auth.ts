import { Injectable, signal } from '@angular/core';

export type Rol = 'admin' | 'dueño' | 'vendedor';

export interface SesionUsuario {
  nombre: string;
  correo: string;
  rol: Rol;
  empresaId: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sesion = signal<SesionUsuario | null>(null);

  usuarioActual = this.sesion.asReadonly();

  /**
   * TODO: reemplazar por POST /auth/login contra el backend Python (FastAPI),
   * que debe devolver { token, rol, empresaId } tras validar el hash de password.
   */
  login(correo: string, _password: string): SesionUsuario {
    let rol: Rol = 'vendedor';
    if (correo.includes('admin')) rol = 'admin';
    else if (correo.includes('dueno') || correo.includes('dueño')) rol = 'dueño';

    const usuario: SesionUsuario = {
      nombre: correo.split('@')[0],
      correo,
      rol,
      empresaId: rol === 'admin' ? null : 'empresa-demo',
    };
    this.sesion.set(usuario);
    return usuario;
  }

  logout(): void {
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
