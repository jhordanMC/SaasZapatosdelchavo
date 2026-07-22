import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModalBrandHeaderComponent } from '../../shared/modal-brand-header/modal-brand-header';

@Component({
  selector: 'app-acceso-restringido',
  standalone: true,
  imports: [ModalBrandHeaderComponent],
  templateUrl: './acceso-restringido.html',
  styleUrl: './acceso-restringido.css',
})
export class AccesoRestringidoComponent {
  constructor(private router: Router) {}

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }
}
