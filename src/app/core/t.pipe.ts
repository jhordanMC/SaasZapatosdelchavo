import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Pipe de traducción global. Uso: {{ 'NAV.DASHBOARD' | t }}
 * Es "impure" (pure:false) a propósito: así se re-evalúa automáticamente
 * cada vez que cambia el idioma activo, sin necesidad de recargar la página.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: string | null | undefined): string {
    if (!key) return '';
    return this.i18n.t(key);
  }
}
