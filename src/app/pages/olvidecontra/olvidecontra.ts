import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';

@Component({selector: 'app-olvidecontra', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './olvidecontra.html', styleUrl: './olvidecontra.css'})
export class OlvidecontraComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  email = ''; loading = false; emailSent = false; showLogoFallback = false; error = '';
  onLogoError(event: Event): void { this.showLogoFallback = true; (event.target as HTMLImageElement).style.display = 'none'; }
  onSubmit(): void {
    const email = this.email.trim();
    if (this.loading) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.error = 'Ingresa un correo válido.'; return; }
    this.email = email; this.loading = true; this.error = '';
    this.http.post(`${environment.apiUrl}/iam/auth/recuperar-password`, {email})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false))
      .subscribe({next: () => this.emailSent = true, error: (failure: HttpErrorResponse) => {
        this.error = typeof failure.error?.detail === 'string' ? failure.error.detail : 'No se pudo enviar el enlace. Intenta nuevamente.';
      }});
  }
  onResend(): void { this.onSubmit(); }
}
