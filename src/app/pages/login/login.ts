import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../core/t.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TPipe],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements AfterViewInit, OnDestroy {

  @ViewChild('cardWrap') cardWrapRef!: ElementRef<HTMLDivElement>;

  // ── Formulario ──
  email = '';
  password = '';
  remember = true;
  showPassword = false;
  showLogoFallback = false;

  errorMessage = '';
  showError = false;
  shakeEmail = false;
  shakePassword = false;

  loading = false;
  success = false;

  // ── Float cards (revelado por click) ──
  cardsCount = 4;
  revealedCount = 0;
  revealed: boolean[] = [false, false, false, false];
  showHint = false;

  // ── Parallax de la card (mouse en desktop, touch en móvil) ──
  private tx = 0; private ty = 0;
  private ox = 0; private oy = 0;
  private rafId: number | null = null;
  private hintTimeout: ReturnType<typeof setTimeout> | null = null;
  private shakeEmailTimeout: ReturnType<typeof setTimeout> | null = null;
  private shakePwTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router, private authService: AuthService, private i18n: I18nService) {}

  ngAfterViewInit(): void {
    this.hintTimeout = setTimeout(() => (this.showHint = true), 3000);
    this.rafId = requestAnimationFrame(() => this.loop());
    setTimeout(() => this.cardWrapRef.nativeElement.classList.add('in'), 200);
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.hintTimeout) clearTimeout(this.hintTimeout);
    if (this.shakeEmailTimeout) clearTimeout(this.shakeEmailTimeout);
    if (this.shakePwTimeout) clearTimeout(this.shakePwTimeout);
  }

  // ── Loop de inercia del parallax de la card ──
  private loop(): void {
    this.ox += (this.tx - this.ox) * 0.06;
    this.oy += (this.ty - this.oy) * 0.06;
    if (this.cardWrapRef?.nativeElement.classList.contains('in')) {
      this.cardWrapRef.nativeElement.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private setParallaxTarget(clientX: number, clientY: number): void {
    this.tx = (clientX / window.innerWidth - 0.5) * 16;
    this.ty = (clientY / window.innerHeight - 0.5) * 10;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.setParallaxTarget(e.clientX, e.clientY);
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    this.setParallaxTarget(touch.clientX, touch.clientY);
  }

  @HostListener('document:touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    this.setParallaxTarget(touch.clientX, touch.clientY);
  }

  // ── Revelado de float cards al hacer click en el fondo ──
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('.card-wrap') || target.closest('.fc')) return;

    if (this.revealedCount < this.cardsCount) {
      this.revealed[this.revealedCount] = true;
      this.revealedCount++;
      if (this.revealedCount >= this.cardsCount) this.showHint = false;
    } else {
      this.revealed = this.revealed.map(() => false);
      this.revealedCount = 0;
      setTimeout(() => (this.showHint = true), 800);
    }
  }

  // ── Tilt 3D de cada float card ──
  onFcMouseMove(e: MouseEvent, fc: HTMLElement): void {
    const r = fc.getBoundingClientRect();
    const rotX = ((e.clientY - r.top) / r.height - 0.5) * -14;
    const rotY = ((e.clientX - r.left) / r.width - 0.5) * 14;
    fc.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.04)`;
    fc.style.transition = 'box-shadow .2s';
  }

  onFcMouseLeave(fc: HTMLElement): void {
    fc.style.transform = '';
    fc.style.transition =
      'transform .4s cubic-bezier(.22,.8,.35,1), box-shadow .3s, opacity .38s';
  }

  togglePwd(): void {
    this.showPassword = !this.showPassword;
  }

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  @HostListener('document:keydown.enter')
  onEnterKey(): void {
    this.tryLogin();
  }

  private shake(field: 'email' | 'password'): void {
    if (field === 'email') {
      this.shakeEmail = false;
      if (this.shakeEmailTimeout) clearTimeout(this.shakeEmailTimeout);
      setTimeout(() => (this.shakeEmail = true), 0);
      this.shakeEmailTimeout = setTimeout(() => (this.shakeEmail = false), 320);
    } else {
      this.shakePassword = false;
      if (this.shakePwTimeout) clearTimeout(this.shakePwTimeout);
      setTimeout(() => (this.shakePassword = true), 0);
      this.shakePwTimeout = setTimeout(() => (this.shakePassword = false), 320);
    }
  }

  tryLogin(): void {
    if (this.loading || this.success) return;
    this.showError = false;

    if (!this.email) {
      this.errorMessage = this.i18n.t('LOGIN.ERR_CORREO_VACIO');
      this.showError = true;
      this.shake('email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.errorMessage = this.i18n.t('LOGIN.ERR_CORREO_INVALIDO');
      this.showError = true;
      this.shake('email');
      return;
    }
    if (!this.password || this.password.length < 6) {
      this.errorMessage = this.i18n.t('LOGIN.ERR_PASSWORD_CORTA');
      this.showError = true;
      this.shake('password');
      return;
    }

    this.loading = true;
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;

        // Password correcto: falta el código de 6 dígitos que ya se
        // mandó por email (2FA obligatorio, ver AuthService.login).
        setTimeout(() => this.router.navigate(['/verificar-2fa']), 1200);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.mensajeError(error);
        this.showError = true;
        this.shake('password');
      },
    });
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) return this.i18n.t('LOGIN.ERR_401');
    if (error.status === 403) return this.i18n.t('LOGIN.ERR_403');
    if (error.status === 429) return this.i18n.t('LOGIN.ERR_429');
    if (error.status === 0) return this.i18n.t('LOGIN.ERR_SIN_CONEXION');
    return this.i18n.t('LOGIN.ERR_INESPERADO');
  }

  onSubmit(): void {
    this.tryLogin();
  }
}
