import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, Rol } from './auth';

export function roleGuard(...rolesPermitidos: Rol[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Espera a que termine el intento de restaurar sesión desde el token
    // guardado (ej. tras un F5) antes de decidir, para no expulsar a un
    // usuario ya logueado mientras esa llamada todavía está en vuelo.
    return authService.esperarInicializacion().pipe(
      map(() => {
        if (!authService.estaAutenticado()) {
          router.navigate(['/login']);
          return false;
        }
        if (!authService.tieneRol(...rolesPermitidos)) {
          router.navigate(['/login']);
          return false;
        }
        return true;
      }),
    );
  };
}
