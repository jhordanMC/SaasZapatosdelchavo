import { Component, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { SesionExpiradaService } from '../../core/sesion-expirada.service';
import { ModalBrandHeaderComponent } from '../modal-brand-header/modal-brand-header';

/**
 * Modal global montado en la raíz de la app (ver app.html): se muestra
 * cuando authInterceptor detecta que el refresh token también falló (la
 * sesión ya no se puede recuperar). No tiene cierre "casual" -- la única
 * salida es aceptar, que limpia todo y manda a /login.
 */
@Component({
  selector: 'app-session-expired-modal',
  standalone: true,
  imports: [CommonModule, ModalBrandHeaderComponent],
  templateUrl: './session-expired-modal.html',
  styleUrls: ['./session-expired-modal.css'],
})
export class SessionExpiredModalComponent {
  sesionExpirada: Signal<boolean>;

  constructor(
    private sesionExpiradaService: SesionExpiradaService,
    private authService: AuthService,
    private router: Router
  ) {
    this.sesionExpirada = this.sesionExpiradaService.sesionExpirada;
  }

  onAceptar(): void {
    this.authService.logout();
    this.sesionExpiradaService.limpiar();
    this.router.navigate(['/login']);
  }
}
