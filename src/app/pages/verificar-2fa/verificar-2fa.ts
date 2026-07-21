import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  AfterViewInit,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-verificar-2fa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verificar-2fa.html',
  styleUrl: './verificar-2fa.css',
})
export class Verificar2faComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('casilla') casillasRef!: QueryList<ElementRef<HTMLInputElement>>;

  digitos: string[] = ['', '', '', '', '', ''];
  showLogoFallback = false;

  errorMessage = '';
  showError = false;
  shakeRow = false;

  loading = false;
  success = false;
  bloqueado = false; // login_token vencido/agotado: hay que volver a /login

  segundosRestantes = 0;

  private intervaloId: ReturnType<typeof setInterval> | null = null;
  private shakeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    const pendiente = this.authService.obtenerLoginPendiente();
    if (!pendiente) {
      this.router.navigate(['/login']);
      return;
    }

    this.segundosRestantes = pendiente.expira_en_segundos;
    this.intervaloId = setInterval(() => {
      this.segundosRestantes--;
      if (this.segundosRestantes <= 0) {
        this.bloquear('El código venció. Vuelve a iniciar sesión.');
      }
    }, 1000);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.enfocarCasilla(0), 150);
  }

  ngOnDestroy(): void {
    if (this.intervaloId) clearInterval(this.intervaloId);
    if (this.shakeTimeout) clearTimeout(this.shakeTimeout);
  }

  get tiempoFormateado(): string {
    const m = Math.floor(this.segundosRestantes / 60);
    const s = this.segundosRestantes % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  get digitosLlenos(): number {
    return this.digitos.filter((d) => d !== '').length;
  }

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private enfocarCasilla(indice: number): void {
    this.casillasRef?.get(indice)?.nativeElement.focus();
  }

  private limpiarCasillas(): void {
    this.digitos = ['', '', '', '', '', ''];
    this.casillasRef?.forEach((ref) => (ref.nativeElement.value = ''));
    this.enfocarCasilla(0);
  }

  private shake(): void {
    this.shakeRow = false;
    if (this.shakeTimeout) clearTimeout(this.shakeTimeout);
    setTimeout(() => (this.shakeRow = true), 0);
    this.shakeTimeout = setTimeout(() => (this.shakeRow = false), 320);
  }

  private bloquear(mensaje: string): void {
    if (this.intervaloId) clearInterval(this.intervaloId);
    this.authService.limpiarLoginPendiente();
    this.bloqueado = true;
    this.errorMessage = mensaje;
    this.showError = true;
  }

  onInputDigito(indice: number, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const valor = input.value.replace(/[^0-9]/g, '').slice(-1);
    this.digitos[indice] = valor;
    input.value = valor;

    if (valor && indice < 5) {
      this.enfocarCasilla(indice + 1);
    }

    if (this.digitos.every((d) => d !== '')) {
      this.verificar();
    }
  }

  onKeydown(indice: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.digitos[indice] && indice > 0) {
      this.enfocarCasilla(indice - 1);
    } else if (evento.key === 'ArrowLeft' && indice > 0) {
      this.enfocarCasilla(indice - 1);
    } else if (evento.key === 'ArrowRight' && indice < 5) {
      this.enfocarCasilla(indice + 1);
    }
  }

  onPaste(evento: ClipboardEvent): void {
    const soloDigitos = (evento.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
    if (!soloDigitos) return;
    evento.preventDefault();

    for (let i = 0; i < 6; i++) {
      this.digitos[i] = soloDigitos[i] ?? '';
      const input = this.casillasRef.get(i)?.nativeElement;
      if (input) input.value = this.digitos[i];
    }
    this.enfocarCasilla(Math.min(soloDigitos.length, 5));

    if (this.digitos.every((d) => d !== '')) {
      this.verificar();
    }
  }

  verificar(): void {
    if (this.loading || this.success || this.bloqueado) return;
    const codigo = this.digitos.join('');
    if (codigo.length !== 6) return;

    this.showError = false;
    this.loading = true;

    this.authService.verificar2fa(codigo).subscribe({
      next: (usuario) => {
        this.loading = false;
        this.success = true;
        if (this.intervaloId) clearInterval(this.intervaloId);

        const destino =
          usuario.rol === 'admin' ? '/admin/dashboard' : usuario.rol === 'dueño' ? '/empresa/dashboard' : '/empresa/ventas';

        setTimeout(() => this.router.navigate([destino]), 1200);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;

        // 401 = login_token vencido o se agotaron los intentos del código
        // (ver AuthService.verificar_2fa en el backend): no tiene caso
        // seguir tipeando, hay que loguearse de nuevo. 400 = código
        // incorrecto pero todavía quedan intentos, se puede reintentar.
        if (error.status === 401) {
          this.bloquear(this.mensajeError(error));
          return;
        }

        this.errorMessage = this.mensajeError(error);
        this.showError = true;
        this.shake();
        this.limpiarCasillas();
      },
    });
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Tu código venció o hubo demasiados intentos. Vuelve a iniciar sesión.';
    if (error.status === 400) return 'Código incorrecto, intenta de nuevo.';
    if (error.status === 429) return 'Demasiados intentos. Espera un momento antes de volver a intentar.';
    if (error.status === 503) return 'No se pudo verificar el código, intenta nuevamente en unos minutos.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
    return 'Ocurrió un error inesperado. Intenta de nuevo.';
  }

  volverAIniciarSesion(): void {
    this.authService.limpiarLoginPendiente();
    this.router.navigate(['/login']);
  }
}
