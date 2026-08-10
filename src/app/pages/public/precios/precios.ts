import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

interface Plan {
  nombre: string;
  precio: string;
  periodo: string;
  destacado: boolean;
  items: string[];
}

@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [RouterLink, RevealOnScrollDirective],
  templateUrl: './precios.html',
  styleUrl: './precios.css',
})
export class PreciosComponent {
  readonly planes: Plan[] = [
    { nombre: 'Standard', precio: 'S/ 100', periodo: '/mes', destacado: false,
      items: ['1 local', 'Inventario y ventas básicas', 'Hasta 2 usuarios', 'Soporte por ticket'] },
    { nombre: 'Pro', precio: 'S/ 170', periodo: '/mes', destacado: true,
      items: ['Locales ilimitados', 'Catálogos y proformas', 'Analítica y finanzas', 'Integraciones con marketplaces', 'Usuarios ilimitados'] },
    { nombre: 'Empresa', precio: 'A medida', periodo: '', destacado: false,
      items: ['Todo lo de Pro', 'Onboarding dedicado', 'SLA de soporte prioritario', 'Integraciones a medida'] },
  ];
}