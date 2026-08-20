import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppLang, I18nService } from '../../core/i18n.service';
import { AccessibilityService, ContrastMode, FontSizeMode } from '../../core/accessibility.service';

export type AccTab = 'vision' | 'texto' | 'idioma' | 'salud' | 'enfoque';

@Component({
  selector: 'app-menu-accesibilidad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-accesibilidad.html',
  styleUrl: './menu-accesibilidad.css',
})
export class MenuAccesibilidadComponent {
  public i18n = inject(I18nService);
  public acc = inject(AccessibilityService);
  private elementRef = inject(ElementRef);

  readonly isOpen = signal<boolean>(false);
  readonly activeTab = signal<AccTab>('vision');

  readonly idiomas: { code: AppLang; label: string; nativeLabel: string; flag: string; short: string }[] = [
    { code: 'es', label: 'Castellano', nativeLabel: 'Castellano', flag: '🇵🇪', short: 'PE' },
    { code: 'qu', label: 'Quechua', nativeLabel: 'Runasimi', flag: '🏔️', short: 'QU' },
    { code: 'en', label: 'Inglés', nativeLabel: 'English', flag: '🇺🇸', short: 'EN' },
  ];

  get idiomaActual() {
    return this.idiomas.find((i) => i.code === this.i18n.lang()) ?? this.idiomas[0];
  }

  toggleOpen(): void {
    this.isOpen.set(!this.isOpen());
  }

  close(): void {
    this.isOpen.set(false);
  }

  setTab(tab: AccTab): void {
    this.activeTab.set(tab);
  }

  seleccionarIdioma(code: AppLang): void {
    this.i18n.setLang(code);
  }

  resetAll(): void {
    this.acc.resetAll();
    this.i18n.setLang('es');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
