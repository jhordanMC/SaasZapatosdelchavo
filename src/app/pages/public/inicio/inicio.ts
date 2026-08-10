import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Feature {
  icon: string;
  titulo: string;
  desc: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class InicioComponent {
  readonly features: Feature[] = [
    { icon: 'box', titulo: 'Inventario en tiempo real', desc: 'Stock por producto, talla y local desde un solo panel.' },
    { icon: 'cart', titulo: 'Ventas y proformas', desc: 'Registra ventas y arma cotizaciones con historial siempre a mano.' },
    { icon: 'chart', titulo: 'Analítica y finanzas', desc: 'Ingresos, gastos y balance para decidir con datos.' },
    { icon: 'link', titulo: 'Integraciones', desc: 'Marketplaces conectados y catálogo sincronizado.' },
    { icon: 'shield', titulo: 'Roles y permisos', desc: 'Dueño, vendedor, y accesos por vista.' },
    { icon: 'bolt', titulo: 'Soporte con Cirobot', desc: 'Tickets y ayuda integrada, sin salir de la plataforma.' },
  ];
}