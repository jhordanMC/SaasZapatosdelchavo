import { Injectable, effect, signal } from '@angular/core';

export type ContrastMode = 'normal' | 'light' | 'dark' | 'text';
export type FontSizeMode = 'small' | 'medium' | 'large';

export interface AccessibilityConfig {
  contrast: ContrastMode;
  fontSize: FontSizeMode;
  dyslexiaFont: boolean;
  focusMode: boolean;
  nightMode: boolean;
  bigCursor: boolean;
}

const STORAGE_KEY = 'vilcas_accessibility_config';

const DEFAULT_CONFIG: AccessibilityConfig = {
  contrast: 'normal',
  fontSize: 'medium',
  dyslexiaFont: false,
  focusMode: false,
  nightMode: false,
  bigCursor: false,
};

@Injectable({
  providedIn: 'root',
})
export class AccessibilityService {
  readonly contrast = signal<ContrastMode>('normal');
  readonly fontSize = signal<FontSizeMode>('medium');
  readonly dyslexiaFont = signal<boolean>(false);
  readonly focusMode = signal<boolean>(false);
  readonly nightMode = signal<boolean>(false);
  readonly bigCursor = signal<boolean>(false);

  // Temporizador de Salud Visual (Regla 20-20-20: 20 min trabajo -> 20 seg descanso)
  readonly timer2020Running = signal<boolean>(false);
  readonly timer2020Seconds = signal<number>(1200); // 20 minutos (1200s)
  readonly timer2020Mode = signal<'work' | 'rest'>('work');
  private timerInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.cargarConfiguracion();

    // Efecto reactivo para aplicar cambios al DOM de la ventana
    effect(() => {
      this.aplicarEstilosAlDom({
        contrast: this.contrast(),
        fontSize: this.fontSize(),
        dyslexiaFont: this.dyslexiaFont(),
        focusMode: this.focusMode(),
        nightMode: this.nightMode(),
        bigCursor: this.bigCursor(),
      });
    });
  }

  private cargarConfiguracion(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: AccessibilityConfig = JSON.parse(raw);
        if (parsed.contrast) this.contrast.set(parsed.contrast);
        if (parsed.fontSize) this.fontSize.set(parsed.fontSize);
        if (typeof parsed.dyslexiaFont === 'boolean') this.dyslexiaFont.set(parsed.dyslexiaFont);
        if (typeof parsed.focusMode === 'boolean') this.focusMode.set(parsed.focusMode);
        if (typeof parsed.nightMode === 'boolean') this.nightMode.set(parsed.nightMode);
        if (typeof parsed.bigCursor === 'boolean') this.bigCursor.set(parsed.bigCursor);
      }
    } catch {
      // Ignorar errores de parseo
    }
  }

  private guardarConfiguracion(): void {
    const config: AccessibilityConfig = {
      contrast: this.contrast(),
      fontSize: this.fontSize(),
      dyslexiaFont: this.dyslexiaFont(),
      focusMode: this.focusMode(),
      nightMode: this.nightMode(),
      bigCursor: this.bigCursor(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignorar errores de quota
    }
  }

  setContrast(mode: ContrastMode): void {
    this.contrast.set(mode);
    this.guardarConfiguracion();
  }

  setFontSize(size: FontSizeMode): void {
    this.fontSize.set(size);
    this.guardarConfiguracion();
  }

  toggleDyslexiaFont(): void {
    this.dyslexiaFont.set(!this.dyslexiaFont());
    this.guardarConfiguracion();
  }

  toggleFocusMode(): void {
    this.focusMode.set(!this.focusMode());
    this.guardarConfiguracion();
  }

  toggleNightMode(): void {
    this.nightMode.set(!this.nightMode());
    this.guardarConfiguracion();
  }

  toggleBigCursor(): void {
    this.bigCursor.set(!this.bigCursor());
    this.guardarConfiguracion();
  }

  resetAll(): void {
    this.contrast.set(DEFAULT_CONFIG.contrast);
    this.fontSize.set(DEFAULT_CONFIG.fontSize);
    this.dyslexiaFont.set(DEFAULT_CONFIG.dyslexiaFont);
    this.focusMode.set(DEFAULT_CONFIG.focusMode);
    this.nightMode.set(DEFAULT_CONFIG.nightMode);
    this.bigCursor.set(DEFAULT_CONFIG.bigCursor);
    this.detenerTimer2020();
    this.guardarConfiguracion();
  }

  // ── Temporizador 20-20-20 ──
  iniciarTimer2020(): void {
    if (this.timer2020Running()) return;
    this.timer2020Running.set(true);
    this.timer2020Mode.set('work');
    this.timer2020Seconds.set(1200); // 20 minutos

    this.timerInterval = setInterval(() => {
      const actual = this.timer2020Seconds();
      if (actual > 1) {
        this.timer2020Seconds.set(actual - 1);
      } else {
        if (this.timer2020Mode() === 'work') {
          // Cambiar a descanso (20s)
          this.timer2020Mode.set('rest');
          this.timer2020Seconds.set(20);
        } else {
          // Volver a trabajo (20 min)
          this.timer2020Mode.set('work');
          this.timer2020Seconds.set(1200);
        }
      }
    }, 1000);
  }

  pausarTimer2020(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.timer2020Running.set(false);
  }

  detenerTimer2020(): void {
    this.pausarTimer2020();
    this.timer2020Seconds.set(1200);
    this.timer2020Mode.set('work');
  }

  private aplicarEstilosAlDom(config: AccessibilityConfig): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    // Contraste
    html.classList.remove('acc-contrast-light', 'acc-contrast-dark', 'acc-contrast-text');
    if (config.contrast === 'light') html.classList.add('acc-contrast-light');
    if (config.contrast === 'dark') html.classList.add('acc-contrast-dark');
    if (config.contrast === 'text') html.classList.add('acc-contrast-text');

    // Noche / Cálido
    html.classList.toggle('acc-night-mode', config.nightMode);

    // Enfoque (TDAH)
    html.classList.toggle('acc-focus-mode', config.focusMode);

    // Dislexia
    html.classList.toggle('acc-dyslexia', config.dyslexiaFont);

    // Cursor grande
    html.classList.toggle('acc-big-cursor', config.bigCursor);

    // Tamaño de texto
    html.classList.remove('acc-font-small', 'acc-font-large');
    if (config.fontSize === 'small') html.classList.add('acc-font-small');
    if (config.fontSize === 'large') html.classList.add('acc-font-large');
  }
}
