import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-olvidecontra',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './olvidecontra.html',
  styleUrl: './olvidecontra.css'
})
export class OlvidecontraComponent {

  email: string = '';
  loading: boolean = false;
  emailSent: boolean = false;
  showLogoFallback: boolean = false;

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  onSubmit(): void {
    if (!this.email) return;

    this.loading = true;

    // TODO: conectar con el servicio real de recuperación de contraseña
    console.log('Solicitud de recuperación para:', this.email);

    setTimeout(() => {
      this.loading = false;
      this.emailSent = true;
    }, 1200);
  }

  onResend(): void {
    if (!this.email) return;

    this.loading = true;

    // TODO: reenviar el correo usando el servicio real
    console.log('Reenviando enlace a:', this.email);

    setTimeout(() => {
      this.loading = false;
    }, 1200);
  }
}