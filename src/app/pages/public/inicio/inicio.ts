import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroMockupComponent } from './components/hero-mockup/hero-mockup';
import { DemoExplorerComponent } from './components/demo-explorer/demo-explorer';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

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
  foto: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, HeroMockupComponent, DemoExplorerComponent, RevealOnScrollDirective],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class InicioComponent implements OnInit, OnDestroy {
  testimonioActivo = 0;
  private testimonioTimer?: ReturnType<typeof setInterval>;

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
    {
      quote: 'Vilcas me cambió el chip, pasé de perder horas renegando con el stock de mi inventario a tener todo mi catálogo digital listo para mandar por WhatsApp en segundos. Ahora sé exactamente qué se vende y qué no, sin volverme loca con sistemas raros y caros.',
      autor: 'Sandra Matienzo',
      rubro: 'Dueña de Deco Sky',
      foto: 'testimonios/resena1.png',
    },
    {
      quote: 'La plataforma es intuitiva y de fácil manejo, organiza y muestra cómo se está manejando el negocio de manera rápida y fácil.',
      autor: 'Diego Saldarriaga',
      rubro: 'Dueño de Papayawash',
      foto: 'testimonios/resena2.png',
    },
    {
      quote: 'Lo que más me sorprende de Vilcas es lo rápido que cualquier negocio lo entiende y lo empieza a usar, en cuestión de minutos pasan de un control manual a estar 100% digitalizados, evitando errores de stock y ofreciendo una atención impecable.',
      autor: 'Edgar Manco',
      rubro: 'Team Leader Live Operations Spain',
      foto: 'testimonios/resena3.png',
    },
    {
      quote: 'Lo que más me gusta de Vilcas es que me simplificó bastante el día a día. Puedo revisar mis productos y mis ventas sin estar buscando información por todos lados.',
      autor: 'Ricardo Liendo',
      rubro: 'Dueño de Takana (empresa de marketing digital)',
      foto: 'testimonios/resena4.png',
    },
    {
      quote: 'No tengo mucho tiempo entre la universidad y el negocio, así que necesitaba algo sencillo. Vilcas me permite revisar lo importante rápidamente y seguir con mis cosas.',
      autor: 'Piero Rojas',
      rubro: 'Estudiante de medicina y emprendedor de Kstyle',
      foto: 'testimonios/resena5.png',
    },
  ];

  ngOnInit(): void {
    this.testimonioTimer = setInterval(() => {
      this.testimonioActivo = (this.testimonioActivo + 1) % this.testimonios.length;
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.testimonioTimer) {
      clearInterval(this.testimonioTimer);
    }
  }
}
