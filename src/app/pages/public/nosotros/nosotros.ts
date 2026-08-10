import { Component } from '@angular/core';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

interface Valor {
  titulo: string;
  desc: string;
}

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [RevealOnScrollDirective],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css',
})
export class NosotrosComponent {
  readonly valores: Valor[] = [
    { titulo: 'Simplicidad', desc: 'Si toma más de dos clics, lo repensamos. Herramientas que se aprenden en minutos.' },
    { titulo: 'Cercanía', desc: 'Soporte real, con Cirobot y con personas, para negocios que no tienen equipo de TI.' },
    { titulo: 'Datos claros', desc: 'Cada número en el panel tiene que servir para tomar una decisión, no solo para verse bonito.' },
  ];
}