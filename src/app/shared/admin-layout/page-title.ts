import { Injectable, signal } from '@angular/core';

/**
 * Fuente única del título que muestra el topbar dentro de AdminLayoutComponent.
 *
 * Flujo normal: AdminLayoutComponent lo actualiza automáticamente con
 * `data: { title: '...' }` de cada ruta al navegar.
 *
 * Flujo dinámico (ej. empresa-detalle, donde el título es el nombre de la
 * empresa cargada): la página hija llama a `setTitle(...)` después de
 * resolver sus datos, y eso pisa el valor por defecto de la ruta.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
  title = signal('Dashboard');

  setTitle(title: string): void {
    this.title.set(title);
  }
}