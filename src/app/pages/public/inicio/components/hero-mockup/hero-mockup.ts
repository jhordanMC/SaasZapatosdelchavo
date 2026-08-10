import { Component, OnDestroy, OnInit, signal } from '@angular/core';

interface MockMetric {
  label: string;
  value: string;
  delta: string;
  danger?: boolean;
}

interface MockTopItem {
  nombre: string;
  dato: string;
}

interface MockScene {
  navLabel: string;
  panelTitle: string;
  listTitle: string;
  metrics: MockMetric[];
  topItems: MockTopItem[];
  chartPoints: string;
}

/**
 * Mockup puramente decorativo del dashboard de VILCAS para el hero de la
 * landing. Todo el contenido es estático/hardcodeado (sin @Input, sin
 * servicios, sin backend) — solo existe para dar contexto visual.
 *
 * Auto-play: cicla sola entre unas pocas "escenas" (Inventario → Ventas →
 * Finanzas) cada pocos segundos, para que se sienta viva sin que el
 * usuario tenga que interactuar. Es solo un signal + setInterval local,
 * no hay lógica de negocio real detrás.
 */
@Component({
  selector: 'app-hero-mockup',
  standalone: true,
  imports: [],
  templateUrl: './hero-mockup.html',
  styleUrl: './hero-mockup.css',
})
export class HeroMockupComponent implements OnInit, OnDestroy {
  readonly navList: string[] = [
    'Dashboard',
    'Inventario',
    'Catálogos',
    'Ventas',
    'Finanzas',
    'Reportes',
    'Clientes',
    'Configuración',
  ];

  private readonly scenes: MockScene[] = [
    {
      navLabel: 'Inventario',
      panelTitle: 'Ventas últimos 7 días',
      listTitle: 'Productos más vendidos',
      metrics: [
        { label: 'Ventas hoy', value: 'S/ 2,180', delta: '+9.4% vs ayer' },
        { label: 'Pedidos', value: '31', delta: '+6.1% vs ayer' },
        { label: 'Productos activos', value: '860', delta: 'Activos' },
        { label: 'Stock bajo', value: '14', delta: 'Productos', danger: true },
      ],
      topItems: [
        { nombre: 'Chompa Beige', dato: '145 uds' },
        { nombre: 'Jean Slim', dato: '110 uds' },
        { nombre: 'Gorra Snapback', dato: '64 uds' },
      ],
      chartPoints: '0,58 40,46 80,60 120,26 160,38 200,14 240,30',
    },
    {
      navLabel: 'Ventas',
      panelTitle: 'Pedidos últimos 7 días',
      listTitle: 'Últimos pedidos',
      metrics: [
        { label: 'Pedidos hoy', value: '31', delta: '+6.1% vs ayer' },
        { label: 'Ticket promedio', value: 'S/ 210', delta: '+4.2% vs ayer' },
        { label: 'Clientes nuevos', value: '6', delta: 'Esta semana' },
        { label: 'Pendientes', value: '3', delta: 'Por confirmar', danger: true },
      ],
      topItems: [
        { nombre: 'Rosa Fernández', dato: 'S/ 410' },
        { nombre: 'Luis Quispe', dato: 'S/ 95' },
        { nombre: 'Diana Cárdenas', dato: 'S/ 260' },
      ],
      chartPoints: '0,44 40,52 80,24 120,36 160,16 200,28 240,10',
    },
    {
      navLabel: 'Finanzas',
      panelTitle: 'Balance últimos 7 días',
      listTitle: 'Resumen del mes',
      metrics: [
        { label: 'Ingresos', value: 'S/ 18,540', delta: '+9.8% vs mes ant.' },
        { label: 'Gastos', value: 'S/ 6,300', delta: '+2.4% vs mes ant.' },
        { label: 'Balance neto', value: 'S/ 12,240', delta: '+14.1% vs mes ant.' },
        { label: 'Por cobrar', value: 'S/ 860', delta: 'Pendiente', danger: true },
      ],
      topItems: [
        { nombre: 'Ingresos del mes', dato: 'S/ 18,540' },
        { nombre: 'Gastos del mes', dato: 'S/ 6,300' },
        { nombre: 'Balance neto', dato: 'S/ 12,240' },
      ],
      chartPoints: '0,36 40,40 80,22 120,44 160,28 200,12 240,22',
    },
  ];

  readonly chartDays: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  private readonly INTERVALO_MS = 3600;
  private timerId: ReturnType<typeof setInterval> | undefined;

  readonly activeIndex = signal(0);

  get activeScene(): MockScene {
    return this.scenes[this.activeIndex()];
  }

  ngOnInit(): void {
    this.timerId = setInterval(() => {
      this.activeIndex.set((this.activeIndex() + 1) % this.scenes.length);
    }, this.INTERVALO_MS);
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }
}