import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { SesionExpiradaService } from './sesion-expirada.service';
import { TokenStore } from './token-store';

const RUTAS_SIN_TOKEN = [
  '/iam/auth/login',
  '/iam/auth/verificar-2fa',
  '/iam/auth/refresh',
  '/iam/auth/recuperar-password',
  '/iam/auth/resetear-password',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStore = inject(TokenStore);
  const sesionExpirada = inject(SesionExpiradaService);
  const esRutaPublica = RUTAS_SIN_TOKEN.some((ruta) => req.url.includes(ruta));

  const accessToken = tokenStore.accessToken();
  const conToken = accessToken && !esRutaPublica
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(conToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || esRutaPublica) {
        return throwError(() => error);
      }
      return tokenStore.refrescar().pipe(
        switchMap((nuevoAccessToken) => {
          if (!nuevoAccessToken) {
            sesionExpirada.marcarExpirada();
            return throwError(() => error);
          }
          const reintento = req.clone({ setHeaders: { Authorization: `Bearer ${nuevoAccessToken}` } });
          return next(reintento);
        }),
      );
    }),
  );
};
