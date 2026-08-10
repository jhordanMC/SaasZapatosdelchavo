import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroMockupComponent } from './components/hero-mockup/hero-mockup';
import { DemoExplorerComponent } from './components/demo-explorer/demo-explorer';

interface Feature {
  icon: 'box' | 'globe' | 'cart' | 'chart' | 'radar';
  titulo: string;
  desc: string;
}

interface PasoIA {
  numero: number;
  titulo: string;
  desc: string;
}

interface Testimonio {
  quote: string;
  autor: string;
  rubro: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, HeroMockupComponent, DemoExplorerComponent],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class InicioComponent {
  readonly features: Feature[] = [
    { icon: 'box', titulo: 'Inventario Inteligente', desc: 'Controla tu stock, categorías, precios y más.' },
    { icon: 'globe', titulo: 'Catálogos Públicos', desc: 'Crea catálogos online y compártelos con tus clientes.' },
    { icon: 'cart', titulo: 'Ventas y Pedidos', desc: 'Gestiona pedidos, clientes y ventas desde un solo lugar.' },
    { icon: 'chart', titulo: 'Finanzas Claras', desc: 'Reportes automáticos para tomar mejores decisiones.' },
    { icon: 'radar', titulo: 'Analítica en tiempo real', desc: 'Conoce tu negocio al instante con dashboards poderosos.' },
  ];

  readonly pasosIA: PasoIA[] = [
    { numero: 1, titulo: 'Sube tu referencia', desc: 'Una imagen de tu producto o describe cómo quieres que se vea.' },
    { numero: 2, titulo: 'La IA analiza y diseña', desc: 'Analizando estilo, colores y estructura de tu catálogo.' },
    { numero: 3, titulo: 'Vista previa del diseño', desc: 'Revisa el resultado antes de publicarlo.' },
    { numero: 4, titulo: 'Publica tu catálogo', desc: '¡Listo! Comparte tu catálogo con el mundo.' },
  ];

  readonly testimonios: Testimonio[] = [
    { quote: 'Nos ayudó a ordenar todo nuestro inventario y ahora tenemos control total del negocio.', autor: 'Dueño de tienda de ropa', rubro: 'Retail' },
    { quote: 'El catálogo online nos ha traído muchos más clientes. Es súper fácil de usar.', autor: 'Administradora de tienda deportiva', rubro: 'Deporte y calzado' },
    { quote: 'Los reportes financieros nos ahorran horas de trabajo cada semana.', autor: 'Encargado de librería', rubro: 'Papelería y librería' },
  ];
}