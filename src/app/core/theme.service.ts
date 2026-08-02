import { Injectable, effect, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

/** Alterna data-theme en <html>; tokens.css define los valores oscuros bajo [data-theme='dark']. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'vilcas.tema';

  tema = signal<Tema>(this.leerInicial());

  constructor() {
    effect(() => {
      const valor = this.tema();
      document.documentElement.setAttribute('data-theme', valor === 'oscuro' ? 'dark' : 'light');
      localStorage.setItem(this.STORAGE_KEY, valor);
    });
  }

  private leerInicial(): Tema {
    const guardado = localStorage.getItem(this.STORAGE_KEY);
    if (guardado === 'oscuro' || guardado === 'claro') return guardado;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }

  alternar(): void {
    this.tema.set(this.tema() === 'oscuro' ? 'claro' : 'oscuro');
  }
}
