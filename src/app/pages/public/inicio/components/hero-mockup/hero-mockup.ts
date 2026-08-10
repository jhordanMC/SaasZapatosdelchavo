import { Component } from '@angular/core';

interface MockNavItem {
  label: string;
  active?: boolean;
}

interface MockMetric {
  label: string;
  value: string;
  delta: string;
  danger?: boolean;
}

interface MockTopProduct {
  nombre: string;
  unidades: string;
}

/**
 * Mockup puramente decorativo del dashboard de VILCAS para el hero de la
 * landing. Todo el contenido es estático (sin @Input, sin servicios) — solo
 * existe para dar contexto visual, no reutiliza componentes reales de
 * /empresa ni llama al backend.
 */
@Component({
  selector: 'app-hero-mockup',
  standalone: true,
  imports: [],
  templateUrl: './hero-mockup.html',
  styleUrl: './hero-mockup.css',
})
export class HeroMockupComponent {
  readonly navItems: MockNavItem[] = [
    { label: 'Dashboard' },
    { label: 'Inventario', active: true },
    { label: 'Catálogos' },
    { label: 'Ventas' },
    { label: 'Finanzas' },
    { label: 'Reportes' },
    { label: 'Clientes' },
    { label: 'Configuración' },
  ];

  readonly metrics: MockMetric[] = [
    { label: 'Ventas hoy', value: 'S/ 3,240', delta: '+12.5% vs ayer' },
    { label: 'Pedidos', value: '48', delta: '+8.2% vs ayer' },
    { label: 'Productos activos', value: '1,248', delta: 'Activos' },
    { label: 'Stock bajo', value: '23', delta: 'Productos', danger: true },
  ];

  readonly topProductos: MockTopProduct[] = [
    { nombre: 'Zapatilla Azul', unidades: '120 uds' },
    { nombre: 'Polo Vintage', unidades: '98 uds' },
    { nombre: 'Casaca Denim', unidades: '76 uds' },
  ];

  /** Puntos de un polyline SVG a mano alzada para simular ventas de 7 días. */
  readonly chartPoints = '0,64 40,40 80,52 120,18 160,30 200,10 240,24';
  readonly chartDays: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
}