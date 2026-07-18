import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth';

const RUTAS_SIN_TOKEN = ['/iam/auth/login', '/iam/auth/refresh', '/iam/auth/recuperar-password', '/iam/auth/resetear-password'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const esRutaPublica = RUTAS_SIN_TOKEN.some((ruta) => req.url.includes(ruta));

  const accessToken = authService.accessToken();
  const conToken = accessToken && !esRutaPublica
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(conToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || esRutaPublica) {
        return throwError(() => error);
      }
      return authService.refrescarSesion().pipe(
        switchMap((nuevoAccessToken) => {
          if (!nuevoAccessToken) {
            return throwError(() => error);
          }
          const reintento = req.clone({ setHeaders: { Authorization: `Bearer ${nuevoAccessToken}` } });
          return next(reintento);
        }),
      );
    }),
  );
};
