import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink],
  templateUrl: './precios.html',
  styleUrl: './precios.css',
})
export class PreciosComponent {
  readonly planes: Plan[] = [
    { nombre: 'Starter', precio: 'S/ 0', periodo: '/mes', destacado: false,
      items: ['1 local', 'Inventario y ventas básicas', 'Hasta 2 usuarios', 'Soporte por ticket'] },
    { nombre: 'Negocio', precio: 'S/ 79', periodo: '/mes', destacado: true,
      items: ['Locales ilimitados', 'Catálogos y proformas', 'Analítica y finanzas', 'Integraciones con marketplaces', 'Usuarios ilimitados'] },
    { nombre: 'Empresa', precio: 'A medida', periodo: '', destacado: false,
      items: ['Todo lo de Negocio', 'Onboarding dedicado', 'SLA de soporte prioritario', 'Integraciones a medida'] },
  ];
}