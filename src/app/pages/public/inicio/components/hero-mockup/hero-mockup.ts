import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CirobotComponent } from '../../../../../shared/cirobot/cirobot';

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

export interface MockTableItem {
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'danger';
}

export interface MockCatalogCard {
  titulo: string;
  productos: string;
  vistas: string;
  badge: string;
}

interface MockScene {
  navLabel: string;
  greetingTitle: string;
  greetingSubtitle: string;
  panelTitle: string;
  listTitle: string;
  metrics: MockMetric[];
  topItems: MockTopItem[];
  tableItems?: MockTableItem[];
  catalogCards?: MockCatalogCard[];
  chartPoints: string;
  viewType: 'dashboard' | 'inventory' | 'catalogs' | 'sales' | 'finance';
}

/**
 * Mockup puramente decorativo del dashboard de VILCAS para el hero de la
 * landing. Todo el contenido es estático/hardcodeado (sin @Input, sin
 * servicios, sin backend) — solo existe para dar contexto visual.
 *
 * Auto-play: cicla sola entre unas pocas "escenas" (Inventario → Ventas →
 * Finanzas) cada pocos segundos, para que se sienta viva sin que el
 * usuario tenga que interactuar. Un cursor decorativo se desplaza hasta
 * el nav item correspondiente y "hace clic" justo antes de que cambie
 * la escena, simulando a alguien navegando el dashboard. Todo corre con
 * signals + setTimeout local, no hay lógica de negocio real detrás.
 */
@Component({
  selector: 'app-hero-mockup',
  standalone: true,
  imports: [CommonModule, CirobotComponent],
  templateUrl: './hero-mockup.html',
  styleUrl: './hero-mockup.css',
})
export class HeroMockupComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('navItemRef') navItemRefs!: QueryList<ElementRef<HTMLElement>>;

  readonly navList: string[] = [
    'Dashboard',
    'Inventario',
    'Catálogos',
    'Ventas',
    'Finanzas',
  ];

  private readonly scenes: MockScene[] = [
    {
      navLabel: 'Dashboard',
      greetingTitle: '¡Hola, Empresa Demo! 👋',
      greetingSubtitle: 'Este es el resumen de tu negocio hoy.',
      panelTitle: 'Ventas últimos 7 días',
      listTitle: 'Productos más vendidos',
      viewType: 'dashboard',
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
      navLabel: 'Inventario',
      greetingTitle: '📦 Inventario de Productos',
      greetingSubtitle: 'Gestión y control de stock en tiempo real.',
      panelTitle: 'Stock de Productos',
      listTitle: 'Artículos por Agotar',
      viewType: 'inventory',
      metrics: [
        { label: 'Total artículos', value: '1,240', delta: 'En catálogo' },
        { label: 'Categorías', value: '18', delta: 'Registradas' },
        { label: 'Valorizado', value: 'S/ 48,200', delta: 'Costo total' },
        { label: 'Por agotar', value: '8', delta: 'Urgente', danger: true },
      ],
      topItems: [
        { nombre: 'Polera Oversize', dato: '5 uds restantes' },
        { nombre: 'Zapatilla Urban', dato: '3 uds restantes' },
        { nombre: 'Casaca Denim', dato: '2 uds restantes' },
      ],
      tableItems: [
        { col1: 'Zapato Cuero Oxford', col2: 'SKU: ZAP-001', col3: 'S/ 189.00', col4: '42 uds', badge: 'En Stock', badgeType: 'success' },
        { col1: 'Zapatilla Urban White', col2: 'SKU: ZAP-084', col3: 'S/ 149.00', col4: '3 uds', badge: 'Stock Bajo', badgeType: 'danger' },
        { col1: 'Mocasín Classic Black', col2: 'SKU: ZAP-012', col3: 'S/ 129.00', col4: '18 uds', badge: 'En Stock', badgeType: 'success' },
      ],
      chartPoints: '0,30 40,20 80,45 120,15 160,30 200,10 240,25',
    },
    {
      navLabel: 'Catálogos',
      greetingTitle: '🎨 Catálogos Digitales IA',
      greetingSubtitle: 'Tus productos listos para vender por WhatsApp.',
      panelTitle: 'Visitas al Catálogo',
      listTitle: 'Catálogos Activos',
      viewType: 'catalogs',
      metrics: [
        { label: 'Visitas hoy', value: '542', delta: '+14.2% vs ayer' },
        { label: 'Catálogos IA', value: '4', delta: 'Publicados' },
        { label: 'Compartidos', value: '128', delta: 'Vía WhatsApp' },
        { label: 'Sin stock', value: '2', delta: 'En catálogo', danger: true },
      ],
      topItems: [
        { nombre: 'Colección Otoño', dato: '320 vistas' },
        { nombre: 'Calzado & Accesorios', dato: '184 vistas' },
        { nombre: 'Ofertas de Temporada', dato: '95 vistas' },
      ],
      catalogCards: [
        { titulo: 'Colección Primavera 2026', productos: '142 productos', vistas: '320 vistas', badge: 'Publicado' },
        { titulo: 'Calzado & Accesorios Top', productos: '86 productos', vistas: '184 vistas', badge: 'Publicado' },
      ],
      chartPoints: '0,60 40,35 80,50 120,20 160,30 200,15 240,8',
    },
    {
      navLabel: 'Ventas',
      greetingTitle: '🛒 Pedidos & Ventas',
      greetingSubtitle: 'Historial de ventas y seguimiento de cobros.',
      panelTitle: 'Pedidos de la semana',
      listTitle: 'Últimos Pedidos',
      viewType: 'sales',
      metrics: [
        { label: 'Pedidos hoy', value: '31', delta: '+6.1% vs ayer' },
        { label: 'Ticket promedio', value: 'S/ 210', delta: '+4.2% vs ayer' },
        { label: 'Clientes nuevos', value: '6', delta: 'Esta semana' },
        { label: 'Pendientes', value: '3', delta: 'Por confirmar', danger: true },
      ],
      topItems: [
        { nombre: 'Rosa Fernández', dato: 'S/ 410.00' },
        { nombre: 'Luis Quispe', dato: 'S/ 95.00' },
        { nombre: 'Diana Cárdenas', dato: 'S/ 260.00' },
      ],
      tableItems: [
        { col1: '#PED-1094', col2: 'Rosa Fernández', col3: 'Yape', col4: 'S/ 410.00', badge: 'Completado', badgeType: 'success' },
        { col1: '#PED-1093', col2: 'Luis Quispe', col3: 'Efectivo', col4: 'S/ 95.00', badge: 'Completado', badgeType: 'success' },
        { col1: '#PED-1092', col2: 'Diana Cárdenas', col3: 'Tarjeta', col4: 'S/ 260.00', badge: 'Pendiente', badgeType: 'warning' },
      ],
      chartPoints: '0,44 40,52 80,24 120,36 160,16 200,28 240,10',
    },
    {
      navLabel: 'Finanzas',
      greetingTitle: '💰 Flujo de Caja & Finanzas',
      greetingSubtitle: 'Balance general de ingresos y egresos.',
      panelTitle: 'Balance últimos 7 días',
      listTitle: 'Resumen del mes',
      viewType: 'finance',
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

  // Tiempos del ciclo cursor → clic → cambio de escena. Suman ~3.5s por
  // escena, similar al INTERVALO_MS fijo que usaba el setInterval anterior.
  private readonly HOLD_MS = 2700; // cuánto se queda quieta la escena antes de moverse
  private readonly MOVE_MS = 550; // duración del desplazamiento del cursor (debe calzar con la transition del CSS)
  private readonly CLICK_MS = 260; // duración del pulso de clic antes de soltar la escena

  private cycleTimeoutId: ReturnType<typeof setTimeout> | undefined;

  readonly activeIndex = signal(0);
  readonly cursorX = signal(0);
  readonly cursorY = signal(0);
  readonly isClicking = signal(false);

  get activeScene(): MockScene {
    return this.scenes[this.activeIndex()];
  }

  ngAfterViewInit(): void {
    // Espera un tick a que el DOM tenga layout real antes de medir el nav item.
    setTimeout(() => {
      this.moveCursorToScene(this.activeIndex());
      this.cycleTimeoutId = setTimeout(() => this.scheduleNextStep(), this.HOLD_MS);
    });
  }

  ngOnDestroy(): void {
    if (this.cycleTimeoutId) clearTimeout(this.cycleTimeoutId);
  }

  /** Mueve el cursor hasta el nav item que corresponde a una escena. */
  private moveCursorToScene(sceneIndex: number): void {
    const navIndex = this.navList.indexOf(this.scenes[sceneIndex].navLabel);
    const el = this.navItemRefs?.toArray()[navIndex]?.nativeElement;
    if (!el) return;
    this.cursorX.set(el.offsetLeft + el.offsetWidth / 2);
    this.cursorY.set(el.offsetTop + el.offsetHeight / 2);
  }

  /** Un ciclo completo: desliza el cursor, hace "clic" y recién ahí cambia la escena. */
  private scheduleNextStep(): void {
    const nextIndex = (this.activeIndex() + 1) % this.scenes.length;

    this.moveCursorToScene(nextIndex);

    this.cycleTimeoutId = setTimeout(() => {
      this.isClicking.set(true);
      this.activeIndex.set(nextIndex);

      this.cycleTimeoutId = setTimeout(() => {
        this.isClicking.set(false);
        this.cycleTimeoutId = setTimeout(() => this.scheduleNextStep(), this.HOLD_MS);
      }, this.CLICK_MS);
    }, this.MOVE_MS);
  }
}
