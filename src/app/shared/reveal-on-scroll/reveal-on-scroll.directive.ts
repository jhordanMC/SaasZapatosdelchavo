import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2 } from '@angular/core';

/**
 * Directiva de "aparición al hacer scroll": agrega la clase `is-visible`
 * la primera vez que el elemento entra en el viewport. El fade + slide-up
 * en sí vive en CSS global (ver `.reveal` / `.reveal.is-visible` en
 * src/styles/public.css) — esta directiva solo decide CUÁNDO se agrega
 * la clase, usando IntersectionObserver en vez de escuchar el scroll a mano.
 *
 * Pensada para secciones grandes (hero, features, testimonios, etc.), no
 * para listas largas de items individuales uno por uno.
 *
 * Uso:
 *   <section class="page-section" appReveal>...</section>
 *
 * Para escalonar varios elementos hermanos (que no aparezcan todos a la vez):
 *   <div appReveal [appRevealDelay]="0">...</div>
 *   <div appReveal [appRevealDelay]="120">...</div>
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: {
    class: 'reveal',
  },
})
export class RevealOnScrollDirective implements OnInit, OnDestroy {
  /** Retraso en ms antes de que arranque la transición, para escalonar hermanos. */
  @Input() appRevealDelay = 0;

  private observer?: IntersectionObserver;

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Sin soporte de IntersectionObserver (o el usuario pide menos
    // movimiento): mostrar el contenido directo, sin animación.
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      this.renderer.addClass(this.el.nativeElement, 'is-visible');
      return;
    }

    if (this.appRevealDelay) {
      this.renderer.setStyle(this.el.nativeElement, 'transition-delay', `${this.appRevealDelay}ms`);
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.renderer.addClass(this.el.nativeElement, 'is-visible');
            // Una sola vez: se desconecta apenas aparece, no se vuelve a ocultar al salir del viewport.
            this.observer?.unobserve(entry.target);

            // El transition-delay solo debe afectar la animación de entrada.
            // Si se queda seteado, cualquier :hover con transition en este
            // mismo elemento heredaría ese retraso para siempre.
            if (this.appRevealDelay) {
              setTimeout(() => {
                this.renderer.removeStyle(this.el.nativeElement, 'transition-delay');
              }, this.appRevealDelay + 700);
            }
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}