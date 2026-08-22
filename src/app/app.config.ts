import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Sin esto, Angular Router deja el scroll donde estaba al cambiar de
    // ruta (ej: vuelves de /login con scroll bajado -> aterrizas en Inicio
    // ya desplazado, viendo el hueco vacío del hero en vez del top de la
    // página). 'top' resetea el scroll en cada navegación normal, pero
    // sigue restaurando la posición correcta al usar atrás/adelante del
    // navegador. anchorScrolling habilita los links con #fragmento.
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};