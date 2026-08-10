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
        { label: 'Ventas hoy', value: 'S/ 3,240', delta: '+12.5% vs ayer' },
        { label: 'Pedidos', value: '48', delta: '+8.2% vs ayer' },
        { label: 'Productos activos', value: '1,248', delta: 'Activos' },
        { label: 'Stock bajo', value: '23', delta: 'Productos', danger: true },
      ],
      topItems: [
        { nombre: 'Zapatilla Azul', dato: '120 uds' },
        { nombre: 'Polo Vintage', dato: '98 uds' },
        { nombre: 'Casaca Denim', dato: '76 uds' },
      ],
      chartPoints: '0,64 40,40 80,52 120,18 160,30 200,10 240,24',
    },
    {
      navLabel: 'Ventas',
      panelTitle: 'Pedidos últimos 7 días',
      listTitle: 'Últimos pedidos',
      metrics: [
        { label: 'Pedidos hoy', value: '48', delta: '+8.2% vs ayer' },
        { label: 'Ticket promedio', value: 'S/ 187', delta: '+5.6% vs ayer' },
        { label: 'Clientes nuevos', value: '9', delta: 'Esta semana' },
        { label: 'Pendientes', value: '4', delta: 'Por confirmar', danger: true },
      ],
      topItems: [
        { nombre: 'María López', dato: 'S/ 320' },
        { nombre: 'Carlos Ramírez', dato: 'S/ 145' },
        { nombre: 'Ana Torres', dato: 'S/ 580' },
      ],
      chartPoints: '0,50 40,58 80,30 120,42 160,20 200,34 240,12',
    },
    {
      navLabel: 'Finanzas',
      panelTitle: 'Balance últimos 7 días',
      listTitle: 'Resumen del mes',
      metrics: [
        { label: 'Ingresos', value: 'S/ 24,300', delta: '+12.5% vs mes ant.' },
        { label: 'Gastos', value: 'S/ 8,120', delta: '+3.1% vs mes ant.' },
        { label: 'Balance neto', value: 'S/ 16,180', delta: '+18.4% vs mes ant.' },
        { label: 'Por cobrar', value: 'S/ 1,240', delta: 'Pendiente', danger: true },
      ],
      topItems: [
        { nombre: 'Ingresos del mes', dato: 'S/ 24,300' },
        { nombre: 'Gastos del mes', dato: 'S/ 8,120' },
        { nombre: 'Balance neto', dato: 'S/ 16,180' },
      ],
      chartPoints: '0,40 40,44 80,26 120,48 160,32 200,16 240,26',
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