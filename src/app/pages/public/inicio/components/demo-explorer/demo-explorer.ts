import { Component, signal } from '@angular/core';

type TabKey = 'inventario' | 'catalogo' | 'ventas' | 'finanzas';

interface DemoTab {
  key: TabKey;
  label: string;
  icon: 'box' | 'globe' | 'cart' | 'coin';
}

interface DemoCard {
  titulo: string;
  linea1?: string;
  linea2?: string;
  destaque: string;
  badge?: string;
  imagen?: string;
  tags?: string[];
}

interface FinanzasStat {
  label: string;
  valor: string;
  destacado?: boolean;
}

/**
 * Vitrina visual con tabs — cambia qué set de cards mock se muestra al
 * hacer click. 100% datos hardcodeados en el propio componente: no llama
 * al backend ni reutiliza componentes reales de /empresa, pero el diseño
 * de cada tab está calcado del diseño real de esa sección (inventario,
 * ventas, catálogo, finanzas) para que la demo se sienta fiel al producto.
 * El único "estado" es qué tab está activo (signal), para simular
 * interactividad.
 */
@Component({
  selector: 'app-demo-explorer',
  standalone: true,
  imports: [],
  templateUrl: './demo-explorer.html',
  styleUrl: './demo-explorer.css',
})
export class DemoExplorerComponent {
  readonly tabs: DemoTab[] = [
    { key: 'inventario', label: 'Inventario', icon: 'box' },
    { key: 'catalogo', label: 'Catálogo', icon: 'globe' },
    { key: 'ventas', label: 'Ventas', icon: 'cart' },
    { key: 'finanzas', label: 'Finanzas', icon: 'coin' },
  ];

  readonly checklist: Record<TabKey, string[]> = {
    inventario: ['Agrega y organiza tus productos', 'Controla stock, precios y categorías', 'Actualiza todo en tiempo real'],
    catalogo: ['Publica tu catálogo con un enlace público', 'Organiza por categorías y colecciones', 'Compártelo directo con tus clientes'],
    ventas: ['Registra ventas al toque desde el catálogo', 'Controla el stock disponible en vivo', 'Genera proformas sin salir de la app'],
    finanzas: ['Sabe al toque si estás siendo rentable', 'Ingresos, gastos y flujo de caja claros', 'Resumen mensual descargable en PDF o Excel'],
  };

  /** Cards con foto, tags y precio — mismo layout que /empresa/inventario. */
  private readonly cardsInventario: DemoCard[] = [
    {
      titulo: 'Zapatilla Azul',
      tags: ['Deportivo', 'Hombre'],
      linea1: '12 unidades en stock',
      destaque: 'S/ 150',
      linea2: 'Margen: S/ 50',
      imagen: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Zapatilla Negra',
      tags: ['Deportivo', 'Hombre'],
      linea1: '5 unidades en stock',
      destaque: 'S/ 180',
      linea2: 'Margen: S/ 46',
      badge: 'Stock bajo',
      imagen: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Polo Vintage',
      tags: ['Casual', 'Unisex'],
      linea1: '20 unidades en stock',
      destaque: 'S/ 80',
      linea2: 'Margen: S/ 28',
      imagen: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Casaca Denim',
      tags: ['Casual', 'Mujer'],
      linea1: '8 unidades en stock',
      destaque: 'S/ 220',
      linea2: 'Margen: S/ 70',
      imagen: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&h=225&q=80&auto=format&fit=crop',
    },
  ];

  /** Colecciones con portada — mismo espíritu que /empresa/catalogo. */
  private readonly cardsCatalogo: DemoCard[] = [
    {
      titulo: 'Colección Verano',
      linea1: '18 productos publicados',
      linea2: 'Enlace público activo',
      destaque: 'Activo',
      imagen: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Colección Urbana',
      linea1: '12 productos publicados',
      linea2: 'Enlace público activo',
      destaque: 'Activo',
      imagen: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Accesorios',
      linea1: '9 productos publicados',
      linea2: 'Borrador',
      destaque: 'Borrador',
      badge: 'Sin publicar',
      imagen: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Temporada Fría',
      linea1: '15 productos publicados',
      linea2: 'Enlace público activo',
      destaque: 'Activo',
      imagen: 'https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=300&h=225&q=80&auto=format&fit=crop',
    },
  ];

  /** Cards de venta rápida — mismo layout que /empresa/ventas (foto, nombre, precio, stock). */
  private readonly cardsVentas: DemoCard[] = [
    {
      titulo: 'Zapatilla Azul',
      destaque: 'S/ 150',
      linea1: '12 unidades',
      imagen: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Zapatilla Negra',
      destaque: 'S/ 180',
      linea1: '5 unidades',
      badge: 'Stock bajo',
      imagen: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Polo Vintage',
      destaque: 'S/ 80',
      linea1: '20 unidades',
      imagen: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=225&q=80&auto=format&fit=crop',
    },
    {
      titulo: 'Casaca Denim',
      destaque: 'S/ 220',
      linea1: '8 unidades',
      imagen: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&h=225&q=80&auto=format&fit=crop',
    },
  ];

  private readonly cardsByTab: Partial<Record<TabKey, DemoCard[]>> = {
    inventario: this.cardsInventario,
    catalogo: this.cardsCatalogo,
    ventas: this.cardsVentas,
  };

  /** Panel de finanzas — calcado del cuadro de rentabilidad + KPIs de /empresa/finanzas. */
  readonly finanzasBanner = {
    badge: 'ESTADO: RENTABLE',
    titulo: '¿Estás ganando dinero y siendo rentable?',
    respuesta: 'SÍ',
    texto: 'Tu negocio está generando ganancias netas en este período por un total de S/10,100. Tus ventas superan los costos operativos y de mercadería.',
  };

  readonly finanzasStats: FinanzasStat[] = [
    { label: 'Ingresos totales del período', valor: 'S/ 11,100' },
    { label: 'Ventas registradas', valor: '6' },
    { label: 'Gasto operativo del período', valor: 'S/ 1,000' },
    { label: 'Flujo de caja del período', valor: 'S/ 10,100', destacado: true },
  ];

  readonly activeTab = signal<TabKey>('inventario');

  get activeCards(): DemoCard[] {
    return this.cardsByTab[this.activeTab()] ?? [];
  }

  get activeChecklist(): string[] {
    return this.checklist[this.activeTab()];
  }

  setTab(key: TabKey): void {
    this.activeTab.set(key);
  }
}