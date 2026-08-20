import { Injectable, signal } from '@angular/core';

export type AppLang = 'es' | 'en' | 'qu';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (options: any, containerId: string) => void;
      };
    };
  }
}

const STORAGE_KEY = 'vilcas_app_lang';

@Injectable({ providedIn: 'root' })
export class GoogleTranslateService {
  /** Signal reactivo con el idioma seleccionado */
  readonly currentLang = signal<AppLang>(this.readInitialLang());

  private isScriptInjected = false;
  private isInitialized = false;

  constructor() {
    this.initGoogleTranslate();
  }

  private readInitialLang(): AppLang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'es' || stored === 'en' || stored === 'qu') {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return 'es';
  }

  private initGoogleTranslate(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const initialLang = this.currentLang();
    this.setGoogleTransCookie(initialLang);

    // Crear el contenedor #google_translate_element oculto si no existe
    if (!document.getElementById('google_translate_element')) {
      const container = document.createElement('div');
      container.id = 'google_translate_element';
      container.style.display = 'none';
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      document.body.appendChild(container);
    }

    // Definir callback global para Google Translate Widget
    window.googleTranslateElementInit = () => {
      try {
        if (window.google?.translate?.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'es',
              includedLanguages: 'es,en,qu',
              autoDisplay: false,
            },
            'google_translate_element'
          );
          this.isInitialized = true;
          
          // Aplicar idioma guardado si no es español
          const activeLang = this.currentLang();
          if (activeLang !== 'es') {
            setTimeout(() => this.triggerComboChange(activeLang), 300);
          }
        }
      } catch (err) {
        console.warn('Google Translate init warning:', err);
      }
    };

    // Inyectar script público de Google Translate si no existe
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.type = 'text/javascript';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.head.appendChild(script);
      this.isScriptInjected = true;
    }
  }

  /**
   * Cambia el idioma objetivo de la aplicación usando Google Translate.
   */
  public setLanguage(lang: AppLang): void {
    this.currentLang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }

    this.setGoogleTransCookie(lang);
    this.triggerComboChange(lang);
  }

  /**
   * Actualiza la cookie 'googtrans' leída por Google Translate.
   */
  private setGoogleTransCookie(lang: AppLang): void {
    if (typeof document === 'undefined') return;

    const cookieVal = `/es/${lang}`;
    const domain = window.location.hostname;

    // Cookie en path=/
    document.cookie = `googtrans=${cookieVal}; path=/;`;
    
    // Cookie con domain
    if (domain && domain !== 'localhost') {
      document.cookie = `googtrans=${cookieVal}; domain=${domain}; path=/;`;
      document.cookie = `googtrans=${cookieVal}; domain=.${domain}; path=/;`;
    }

    if (lang === 'es') {
      // Para español (original), expirar cookie previa si existe
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      if (domain && domain !== 'localhost') {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${domain}; path=/;`;
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${domain}; path=/;`;
      }
    }
  }

  /**
   * Dispara el evento change en el select `.goog-te-combo` generado por Google Translate.
   */
  private triggerComboChange(lang: AppLang, retries = 6): void {
    if (typeof document === 'undefined') return;

    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (combo) {
      combo.value = lang;
      combo.dispatchEvent(new Event('change'));
    } else if (retries > 0) {
      setTimeout(() => this.triggerComboChange(lang, retries - 1), 350);
    }
  }
}
