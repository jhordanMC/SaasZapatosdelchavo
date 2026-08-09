/**
 * Componente de Catálogos Públicos (vista empresa, solo dueño).
 *
 * Por ahora es un front sin backend: la lista de catálogos, las métricas
 * y las plantillas son datos mock (MOCK_CATALOGOS / MOCK_PLANTILLAS) que
 * se reemplazarán cuando exista un CatalogoService real (GET/POST/PATCH
 * /catalogos, similar al patrón de InventarioService).
 *
 * Flujos ya cableados en el front:
 *   - Tabs: "Mis Catálogos" (con datos) / "Diseños Guardados" / "Preferencias"
 *     (placeholders vacíos por ahora).
 *   - Búsqueda por nombre con filtrado en memoria (son pocos catálogos).
 *   - "+ Nuevo catálogo" y las dos opciones del panel lateral (IA / desde
 *     cero) abren el mismo modal placeholder — se separará en un wizard
 *     real cuando se conecte el backend.
 *   - Copiar enlace al portapapeles con feedback visual momentáneo.
 *   - Menú de acciones por fila (ver, copiar, editar, eliminar) con
 *     eliminar mockeado en memoria.
 */
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type EstadoCatalogo = 'publicado' | 'borrador';

export interface CatalogoItem {
  id: string;
  nombre: string;
  actualizado: string;
  productos: number;
  visitas: number;
  enlace: string;
  estado: EstadoCatalogo;
  colorDiseno: string;
}

export interface PlantillaCatalogo {
  id: string;
  nombre: string;
  colorDiseno: string;
}

type TabCatalogo = 'mis-catalogos' | 'diseños-guardados' | 'preferencias';

const MOCK_CATALOGOS: CatalogoItem[] = [
  {
    id: 'cat-1',
    nombre: 'Catálogo Principal',
    actualizado: '10/05/2024',
    productos: 120,
    visitas: 532,
    enlace: 'vilcas.com/c/cat-principal',
    estado: 'publicado',
    colorDiseno: '#0f2b23',
  },
  {
    id: 'cat-2',
    nombre: 'Zapatillas Deportivas',
    actualizado: '08/05/2024',
    productos: 45,
    visitas: 312,
    enlace: 'vilcas.com/c/zapatillas',
    estado: 'publicado',
    colorDiseno: '#1c1c1c',
  },
  {
    id: 'cat-3',
    nombre: 'Productos Premium',
    actualizado: '05/05/2024',
    productos: 28,
    visitas: 156,
    enlace: 'vilcas.com/c/premium',
    estado: 'borrador',
    colorDiseno: '#3a3a3a',
  },
  {
    id: 'cat-4',
    nombre: 'Colección Verano',
    actualizado: '01/05/2024',
    productos: 67,
    visitas: 245,
    enlace: 'vilcas.com/c/verano',
    estado: 'publicado',
    colorDiseno: '#f4c9c9',
  },
];

const MOCK_PLANTILLAS: PlantillaCatalogo[] = [
  { id: 'plt-1', nombre: 'Minimal', colorDiseno: '#1c1c1c' },
  { id: 'plt-2', nombre: 'Vibrante', colorDiseno: '#da9e0b' },
  { id: 'plt-3', nombre: 'Clásica', colorDiseno: '#0f2b23' },
];

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class CatalogoComponent {
  readonly tabs: { clave: TabCatalogo; label: string }[] = [
    { clave: 'mis-catalogos', label: 'Mis Catálogos' },
    { clave: 'diseños-guardados', label: 'Diseños Guardados' },
    { clave: 'preferencias', label: 'Preferencias' },
  ];

  tabActiva = signal<TabCatalogo>('mis-catalogos');
  busqueda = signal('');
  catalogos = signal<CatalogoItem[]>(MOCK_CATALOGOS);
  plantillas = signal<PlantillaCatalogo[]>(MOCK_PLANTILLAS);

  /** id del catálogo cuyo enlace acaba de copiarse (feedback momentáneo del botón). */
  enlaceCopiado = signal<string | null>(null);
  /** id del catálogo cuyo menú de acciones (⋮) está abierto. */
  menuAbierto = signal<string | null>(null);
  modalCrearAbierto = signal(false);
  metodoCreacion = signal<'ia' | 'plantilla' | null>(null);

  catalogosFiltrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    if (!termino) return this.catalogos();
    return this.catalogos().filter((c) => c.nombre.toLowerCase().includes(termino));
  });

  // ── Métricas del header (derivadas de la lista mock) ────────────────────
  catalogosPublicados = computed(() => this.catalogos().filter((c) => c.estado === 'publicado').length);
  visitasTotales = computed(() => this.catalogos().reduce((suma, c) => suma + c.visitas, 0));
  productosMostrados = computed(() => this.catalogos().reduce((suma, c) => suma + c.productos, 0));
  enlacesActivos = computed(() => this.catalogos().filter((c) => c.estado === 'publicado').length);

  seleccionarTab(tab: TabCatalogo): void {
    this.tabActiva.set(tab);
  }

  onBusquedaChange(valor: string): void {
    this.busqueda.set(valor);
  }

  abrirModalCrear(metodo: 'ia' | 'plantilla' | null = null): void {
    this.metodoCreacion.set(metodo);
    this.modalCrearAbierto.set(true);
  }

  cerrarModalCrear(): void {
    this.modalCrearAbierto.set(false);
    this.metodoCreacion.set(null);
  }

  toggleMenu(id: string): void {
    this.menuAbierto.set(this.menuAbierto() === id ? null : id);
  }

  cerrarMenus(): void {
    this.menuAbierto.set(null);
  }

  copiarEnlace(item: CatalogoItem): void {
    const url = `https://${item.enlace}`;
    navigator.clipboard?.writeText(url).catch(() => {
      /* portapapeles no disponible (permiso/navegador) — se ignora en silencio */
    });
    this.enlaceCopiado.set(item.id);
    setTimeout(() => {
      if (this.enlaceCopiado() === item.id) this.enlaceCopiado.set(null);
    }, 1500);
  }

  eliminarCatalogo(item: CatalogoItem): void {
    this.menuAbierto.set(null);
    if (!confirm(`¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.catalogos.set(this.catalogos().filter((c) => c.id !== item.id));
  }

  estadoLabel(estado: EstadoCatalogo): string {
    return estado === 'publicado' ? 'Publicado' : 'Borrador';
  }
}