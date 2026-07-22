import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';
import { map } from 'rxjs';
import { ClaveVista, RolUsuario } from '../services/usuarios';
import { AuthService } from './auth';

export function roleGuard(...rolesPermitidos: RolUsuario[]): CanActivateFn {
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

/**
 * Bloquea una vista puntual deshabilitada para el usuario (independiente
 * de su rol — ver modal "Permisos de vista" en el panel admin). A
 * diferencia de roleGuard, si el usuario SÍ está autenticado pero no
 * tiene acceso a esta vista, no tiene sentido mandarlo a /login: va a
 * /acceso-restringido.
 */
export function vistaGuard(clave: ClaveVista): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.esperarInicializacion().pipe(
      map(() => {
        if (!authService.estaAutenticado()) {
          router.navigate(['/login']);
          return false;
        }
        if (!authService.puedeVerVista(clave)) {
          router.navigate(['/acceso-restringido']);
          return false;
        }
        return true;
      }),
    );
  };
}

/**
 * Ruta índice de /admin y /empresa (path: '' dentro de sus children): en vez
 * de un redirectTo fijo a 'dashboard' (que rebotaba a /acceso-restringido si
 * esa vista puntual estaba deshabilitada — dashboard existe pero el usuario
 * no puede verla), calcula la primera vista realmente disponible según rol +
 * vistas deshabilitadas.
 *
 * Es un `redirectTo` FUNCIÓN (no un canActivate) a propósito: Angular exige
 * que toda ruta tenga component/loadComponent/redirectTo/children/
 * loadChildren — una ruta con SOLO canActivate (sin ninguno de esos) hace
 * fallar la validación del Router al arrancar la app entera (NG04014), aunque
 * el guard siempre redirija. `redirectTo` como función corre en contexto de
 * inyección (puede usar inject()) y soporta devolver un Observable, así que
 * es la herramienta correcta acá.
 */
export const resolverPrimeraVista: RedirectFunction = () => {
  const authService = inject(AuthService);

  return authService.esperarInicializacion().pipe(
    map(() => authService.primeraVistaDisponible() ?? '/acceso-restringido'),
  );
};

/**
 * Inverso de roleGuard: si ya hay una sesión activa, manda directo al home
 * del rol en vez de dejar ver /login de nuevo (ej. F5 sobre /login con
 * token todavía válido).
 */
export const redirigirSiAutenticado: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.esperarInicializacion().pipe(
    map(() => {
      const sesion = authService.usuarioActual();
      if (sesion) {
        router.navigate([authService.rutaHomeParaRol(sesion.rol)]);
        return false;
      }
      return true;
    }),
  );
};
