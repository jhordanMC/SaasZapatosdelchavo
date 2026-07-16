import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Rol } from './auth';

export function roleGuard(...rolesPermitidos: Rol[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.estaAutenticado()) {
      router.navigate(['/login']);
      return false;
    }
    if (!authService.tieneRol(...rolesPermitidos)) {
      router.navigate(['/login']);
      return false;
    }
    return true;
  };
}
