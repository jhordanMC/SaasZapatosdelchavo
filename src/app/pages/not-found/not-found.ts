import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModalBrandHeaderComponent } from '../../shared/modal-brand-header/modal-brand-header';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [ModalBrandHeaderComponent],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFoundComponent {
  constructor(private router: Router) {}

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }
}
