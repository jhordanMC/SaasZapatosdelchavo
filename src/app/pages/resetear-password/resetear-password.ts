import { Component, DestroyRef, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({selector: 'app-resetear-password', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './resetear-password.html', styleUrl: '../olvidecontra/olvidecontra.css'})
export class ResetearPasswordComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private token = '';
  password = ''; confirm = ''; loading = false; done = false; error = '';
  constructor() {
    const route = inject(ActivatedRoute);
    this.token = new URLSearchParams(route.snapshot.fragment ?? '').get('token') ?? route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error = 'El enlace no es válido. Solicita uno nuevo.';
    if (typeof window !== 'undefined') window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  get valid(): boolean { return !!this.token && this.password.length >= 8 && this.password === this.confirm; }
  submit(): void {
    if (this.loading || !this.valid) { if (!this.loading) this.error = 'Usa al menos 8 caracteres y repite la misma contraseña.'; return; }
    this.loading = true; this.error = '';
    this.http.post(`${environment.apiUrl}/iam/auth/resetear-password`, {token: this.token, password_nueva: this.password})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false))
      .subscribe({next: () => { this.done = true; this.token = ''; this.password = ''; this.confirm = ''; },
        error: (failure: HttpErrorResponse) => { this.error = typeof failure.error?.detail === 'string' ? failure.error.detail : 'No se pudo actualizar la contraseña. Intenta nuevamente.'; }});
  }
  ngOnDestroy(): void { this.token = ''; this.password = ''; this.confirm = ''; }
}
