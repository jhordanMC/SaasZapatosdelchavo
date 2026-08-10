import { Component, signal } from '@angular/core';

type TabKey = 'inventario' | 'catalogo' | 'ventas' | 'finanzas';

interface DemoTab {
  key: TabKey;
  label: string;
  icon: 'box' | 'globe' | 'cart' | 'coin';
}

interface DemoCard {
  titulo: string;
  linea1: string;
  linea2: string;
  destaque: string;
  badge?: string;
}

/**
 * Vitrina visual con tabs — cambia qué set de cards mock se muestra al
 * hacer click. 100% datos hardcodeados en el propio componente: no llama
 * al backend ni reutiliza componentes reales de /empresa. El único
 * "estado" es qué tab está activo (signal), para simular interactividad.
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
    ventas: ['Registra ventas y proformas al toque', 'Sigue el estado de cada pedido', 'Historial siempre a la mano'],
    finanzas: ['Ingresos y gastos en un solo panel', 'Reportes automáticos por periodo', 'Ve tu balance sin armar Excel'],
  };

  private readonly cardsByTab: Record<TabKey, DemoCard[]> = {
    inventario: [
      { titulo: 'Zapatilla Azul', linea1: 'Stock: 12 unidades', linea2: 'Margen: 32%', destaque: 'S/ 150' },
      { titulo: 'Zapatilla Negra', linea1: 'Stock: 5 unidades', linea2: 'Margen: 28%', destaque: 'S/ 180', badge: 'Stock bajo' },
      { titulo: 'Polo Vintage', linea1: 'Stock: 20 unidades', linea2: 'Margen: 40%', destaque: 'S/ 80' },
      { titulo: 'Casaca Denim', linea1: 'Stock: 8 unidades', linea2: 'Margen: 32%', destaque: 'S/ 220' },
    ],
    catalogo: [
      { titulo: 'Colección Verano', linea1: '18 productos publicados', linea2: 'Enlace público activo', destaque: 'Activo' },
      { titulo: 'Colección Urbana', linea1: '12 productos publicados', linea2: 'Enlace público activo', destaque: 'Activo' },
      { titulo: 'Accesorios', linea1: '9 productos publicados', linea2: 'Borrador', destaque: 'Borrador', badge: 'Sin publicar' },
      { titulo: 'Temporada Fría', linea1: '15 productos publicados', linea2: 'Enlace público activo', destaque: 'Activo' },
    ],
    ventas: [
      { titulo: 'Pedido #1042', linea1: 'María López', linea2: 'Hoy, 10:24 a.m.', destaque: 'S/ 320', badge: 'Pagado' },
      { titulo: 'Pedido #1041', linea1: 'Carlos Ramírez', linea2: 'Hoy, 9:10 a.m.', destaque: 'S/ 145', badge: 'Pendiente' },
      { titulo: 'Pedido #1040', linea1: 'Ana Torres', linea2: 'Ayer, 6:52 p.m.', destaque: 'S/ 580', badge: 'Pagado' },
      { titulo: 'Pedido #1039', linea1: 'Jorge Salas', linea2: 'Ayer, 3:15 p.m.', destaque: 'S/ 95', badge: 'Pagado' },
    ],
    finanzas: [
      { titulo: 'Ingresos del mes', linea1: 'Vs. mes anterior', linea2: '+12.5%', destaque: 'S/ 24,300' },
      { titulo: 'Gastos del mes', linea1: 'Vs. mes anterior', linea2: '+3.1%', destaque: 'S/ 8,120' },
      { titulo: 'Balance neto', linea1: 'Vs. mes anterior', linea2: '+18.4%', destaque: 'S/ 16,180' },
      { titulo: 'Ticket promedio', linea1: 'Vs. mes anterior', linea2: '+5.6%', destaque: 'S/ 187' },
    ],
  };

  readonly activeTab = signal<TabKey>('inventario');

  get activeCards(): DemoCard[] {
    return this.cardsByTab[this.activeTab()];
  }

  get activeChecklist(): string[] {
    return this.checklist[this.activeTab()];
  }

  setTab(key: TabKey): void {
    this.activeTab.set(key);
  }
}