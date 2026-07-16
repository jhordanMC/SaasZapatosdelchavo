import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements AfterViewInit, OnDestroy {

  @ViewChild('cur') curRef?: ElementRef<HTMLDivElement>;
  @ViewChild('crn') crnRef?: ElementRef<HTMLDivElement>;
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

  // ── Cursor / parallax ──
  private cx = 0; private cy = 0;
  private rx = 0; private ry = 0;
  private tx = 0; private ty = 0;
  private ox = 0; private oy = 0;
  private rafId: number | null = null;
  private hintTimeout: ReturnType<typeof setTimeout> | null = null;
  private shakeEmailTimeout: ReturnType<typeof setTimeout> | null = null;
  private shakePwTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {}

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

  // ── Loop del cursor con inercia + parallax de la card ──
  private loop(): void {
    this.rx += (this.cx - this.rx) * 0.12;
    this.ry += (this.cy - this.ry) * 0.12;
    if (this.crnRef) {
      this.crnRef.nativeElement.style.left = this.rx + 'px';
      this.crnRef.nativeElement.style.top = this.ry + 'px';
    }

    this.ox += (this.tx - this.ox) * 0.06;
    this.oy += (this.ty - this.oy) * 0.06;
    if (this.cardWrapRef?.nativeElement.classList.contains('in')) {
      this.cardWrapRef.nativeElement.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.cx = e.clientX;
    this.cy = e.clientY;
    if (this.curRef) {
      this.curRef.nativeElement.style.left = this.cx + 'px';
      this.curRef.nativeElement.style.top = this.cy + 'px';
    }
    this.tx = (e.clientX / window.innerWidth - 0.5) * 16;
    this.ty = (e.clientY / window.innerHeight - 0.5) * 10;
  }

  onCursorEnter(): void {
    if (!this.curRef || !this.crnRef) return;
    this.curRef.nativeElement.style.width = '14px';
    this.curRef.nativeElement.style.height = '14px';
    this.crnRef.nativeElement.style.width = '42px';
    this.crnRef.nativeElement.style.height = '42px';
    this.crnRef.nativeElement.style.borderColor = 'rgba(100,213,156,.85)';
  }

  onCursorLeave(): void {
    if (!this.curRef || !this.crnRef) return;
    this.curRef.nativeElement.style.width = '8px';
    this.curRef.nativeElement.style.height = '8px';
    this.crnRef.nativeElement.style.width = '30px';
    this.crnRef.nativeElement.style.height = '30px';
    this.crnRef.nativeElement.style.borderColor = 'rgba(100,213,156,.65)';
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
      this.errorMessage = 'Ingresa tu correo.';
      this.showError = true;
      this.shake('email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.errorMessage = 'El correo no es válido.';
      this.showError = true;
      this.shake('email');
      return;
    }
    if (!this.password || this.password.length < 6) {
      this.errorMessage = 'Contraseña mínimo 6 caracteres.';
      this.showError = true;
      this.shake('password');
      return;
    }

    this.loading = true;
    setTimeout(() => {
      this.loading = false;
      this.success = true;

      // TODO: conectar con el servicio de autenticación real
      console.log('Login intento:', { email: this.email, remember: this.remember });

      setTimeout(() => this.router.navigate(['/admin/dashboard']), 1200);
    }, 1600);
  }

  onSubmit(): void {
    this.tryLogin();
  }
}
