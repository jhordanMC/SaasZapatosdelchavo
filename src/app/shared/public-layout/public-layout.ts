import { Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
    const currentY = window.scrollY;
    const scrollingDown = currentY > this.lastScrollY;
    const pastThreshold = currentY > 80;

    // No ocultar la barra si el menú móvil está abierto, para no
    // "tapar" el menú justo cuando el usuario lo está usando.
    if (!this.menuAbierto) {
      this.navHidden.set(scrollingDown && pastThreshold);
    }

    this.lastScrollY = currentY;
  }

  /** (activate) del router-outlet: reinicia la clase de animación en cada
   *  cambio de vista para que el fade-in se vuelva a disparar. */
  onRouteActivate(): void {
    this.viewVisible.set(false);
    requestAnimationFrame(() => this.viewVisible.set(true));
  }
}