import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { MenuAccesibilidadComponent } from '../../shared/menu-accesibilidad/menu-accesibilidad';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MenuAccesibilidadComponent],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFoundComponent {
  anioActual: number = new Date().getFullYear();
  menuAbierto: boolean = false;

  constructor(private router: Router, private location: Location) {}

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarMenu(): void {
    this.menuAbierto = false;
  }

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }

  regresar(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
