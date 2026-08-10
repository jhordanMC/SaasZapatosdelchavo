import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface PlanTeaser {
  nombre: string;
  descripcion: string;
  precioMensual: number | null; // null = "A medida"
  destacado: boolean;
  items: string[];
}

/**
 * Vitrina de precios de la landing (independiente de /precios). Toggle
 * mensual/anual es solo UI: aplica un 20% de descuento simulado al
 * calcular el precio anual mostrado, sin llamar a ningún backend.
 */
@Component({
  selector: 'app-precios-teaser',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './precios-teaser.html',
  styleUrl: './precios-teaser.css',
})
export class PreciosTeaserComponent {
  readonly DESCUENTO_ANUAL = 0.2;

  readonly planes: PlanTeaser[] = [
    {
      nombre: 'Gratis',
      descripcion: 'Ideal para empezar',
      precioMensual: 0,
      destacado: false,
      items: ['1 local', 'Inventario y ventas básicas', 'Hasta 2 usuarios'],
    },
    {
      nombre: 'Starter',
      descripcion: 'Para negocios pequeños',
      precioMensual: 49,
      destacado: false,
      items: ['Todo lo de Gratis', 'Catálogo público', 'Hasta 5 usuarios', 'Soporte por ticket'],
    },
    {
      nombre: 'Pro',
      descripcion: 'Para negocios en crecimiento',
      precioMensual: 99,
      destacado: true,
      items: ['Todo lo de Starter', 'Locales ilimitados', 'Analítica y finanzas', 'Usuarios ilimitados'],
    },
    {
      nombre: 'Enterprise',
      descripcion: 'Para grandes empresas',
      precioMensual: null,
      destacado: false,
      items: ['Todo lo de Pro', 'Soporte prioritario', 'Integraciones a medida', 'SLA dedicado'],
    },
  ];

  readonly incluyeTodo: string[] = [
    'Todos los módulos incluidos',
    'Soporte prioritario',
    'Sin límites de usuarios',
    'Actualizaciones constantes',
    'Seguridad y respaldo diario',
  ];

  readonly esAnual = signal(false);

  setAnual(valor: boolean): void {
    this.esAnual.set(valor);
  }

  precioMostrado(plan: PlanTeaser): string {
    if (plan.precioMensual === null) return 'A medida';
    if (plan.precioMensual === 0) return 'S/ 0';
    const precio = this.esAnual()
      ? Math.round(plan.precioMensual * (1 - this.DESCUENTO_ANUAL))
      : plan.precioMensual;
    return `S/ ${precio}`;
  }

  periodoMostrado(plan: PlanTeaser): string {
    if (plan.precioMensual === null) return '';
    if (plan.precioMensual === 0) return '/mes, para siempre';
    return this.esAnual() ? '/mes, facturado anual' : '/mes, facturado mensual';
  }
}