import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { filter, take } from 'rxjs';
import { SessionExpiredModalComponent } from './shared/session-expired-modal/session-expired-modal';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, SessionExpiredModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ProyectoSaasAlba');

  /**
   * En true hasta que el router resuelve su PRIMERA navegación. Cubre el
   * blanco que se veía al abrir la app con una sesión ya guardada: los
   * guards (ver auth.guard.ts) esperan a AuthService.esperarInicializacion()
   * — que dispara la verificación del token contra el backend — antes de
   * decidir a dónde navegar, y hasta entonces el <router-outlet> no tiene
   * nada que mostrar.
   */
  protected readonly cargandoInicial = signal(true);
  protected readonly logoFallback = signal(false);

  constructor(router: Router) {
    router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
        take(1),
      )
      .subscribe(() => this.cargandoInicial.set(false));
  }
}
