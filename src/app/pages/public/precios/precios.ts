import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';
import { PlanesPublicosService, PlanPublico } from '../../../services/planes-publicos';

/** Mismo número que usa el resto del sitio (ver login.html) para "Contactar ventas". */
const WHATSAPP_VENTAS = '51957306279';

@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealOnScrollDirective],
  templateUrl: './precios.html',
  styleUrl: './precios.css',
})
export class PreciosComponent implements OnInit {
  constructor(private planesService: PlanesPublicosService) {}

  planes = signal<PlanPublico[]>([]);
  cargando = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.planesService.listarPlanes().subscribe({
      next: (planes) => {
        this.planes.set(planes);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  /** El plan "A medida" no tiene precio fijo: siempre redirige a WhatsApp. */
  esPlanAMedida(p: PlanPublico): boolean {
    return p.tipo_plan === 'custom';
  }

  hayDescuento(p: PlanPublico): boolean {
    return !!p.descuento_activo && p.precio_efectivo < p.precio;
  }

  precioFormateado(p: PlanPublico): string {
    return `${p.moneda === 'PEN' ? 'S/' : p.moneda} ${this.hayDescuento(p) ? p.precio_efectivo : p.precio}`;
  }

  periodoFormateado(p: PlanPublico): string {
    return p.periodo === 'anual' ? '/año' : '/mes';
  }

  whatsappUrl(p: PlanPublico): string {
    const mensaje = encodeURIComponent(`Hola, quisiera cotizar el plan ${p.nombre} (a medida) de VILCAS.`);
    return `https://wa.me/${WHATSAPP_VENTAS}?text=${mensaje}`;
  }
}