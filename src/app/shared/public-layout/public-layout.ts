import { Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuAccesibilidadComponent } from '../menu-accesibilidad/menu-accesibilidad';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MenuAccesibilidadComponent],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
})
export class PublicLayoutComponent {
  anioActual = new Date().getFullYear();
  menuAbierto = false;

  /** Navbar se oculta al bajar y reaparece al subir (o cerca del top). */
  readonly navHidden = signal(false);
  private lastScrollY = 0;

  /** Dispara el fade-in de la vista cada vez que el router activa un componente. */
  readonly viewVisible = signal(true);

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    if (this.menuAbierto) this.navHidden.set(false);
  }

  cerrarMenu(): void {
    this.menuAbierto = false;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    // La cabecera siempre sigue al usuario al hacer scroll (arriba o abajo)
    this.navHidden.set(false);
  }

  /** (activate) del router-outlet: reinicia la clase de animación en cada
   *  cambio de vista para que el fade-in se vuelva a disparar. */
  onRouteActivate(): void {
    this.viewVisible.set(false);
    requestAnimationFrame(() => this.viewVisible.set(true));
  }
}