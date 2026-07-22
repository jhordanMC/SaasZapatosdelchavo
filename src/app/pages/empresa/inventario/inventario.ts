/**
 * Componente de Inventario (vista empresa).
 *
 * Conectado al backend a través de InventarioService.
 * Estrategia de filtros: carga completa al iniciar + filtro local reactivo
 * (catálogos de zapatos son < 500 items, no requiere server-side filtering).
 *
 * Flujos:
 *   - Init: carga categorías, locales y productos en paralelo.
 *   - Filtros: `productos` getter aplica filtros sobre la lista en memoria.
 *   - Crear: modal "Nuevo producto" → POST /inventario/productos.
 *   - Editar: modal "Editar producto" → PATCH /inventario/productos/{id}.
 *   - Eliminar: confirm() → DELETE /inventario/productos/{id}.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CategoriaCreateInput,
  CategoriaRead,
  FiltrosProducto,
  InventarioService,
  LocalRead,
  ProductoListItem,
  ProductoRead,
  SexoProducto,
  VarianteStockInput,
} from '../../../services/inventario';

// ---------------------------------------------------------------------------
// Tipos internos del formulario
// ---------------------------------------------------------------------------

interface VarianteFormItem {
  talla: string;
  cantidad: number;
  id_local: string;
}

interface ProductoForm {
  nombre: string;
  id_categoria: string | null;
  sexo: SexoProducto | null;
  costoCompra: number;
  precioVenta: number;
  fotoUrl: string | null;
  variantes: VarianteFormItem[];
}

// Etiquetas legibles para los valores de sexo del backend
const SEXO_LABELS: Record<SexoProducto, string> = {
  hombre: 'Hombre',
  mujer: 'Mujer',
  unisex: 'Unisex',
  nino: 'Niño',
};

// Sugerencias rápidas de categoría — tipos de calzado más comunes en el
// mercado peruano. Son solo un atajo para no tener que tipear cada vez;
// el dueño igual puede crear cualquier categoría propia con nombre libre.
const CATEGORIAS_SUGERIDAS = [
  'Deportivo',
  'Tacos',
  'Ballerinas',
  'Sandalias',
  'Plataformas',
  'Mocasines',
  'Botines',
  'Urbano / Casual',
];

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.css'],
})
export class InventarioComponent implements OnInit {
  constructor(private inventarioService: InventarioService) {}

  // ── Estado de datos ────────────────────────────────────────────────────
  productos = signal<ProductoListItem[]>([]);
  categorias = signal<CategoriaRead[]>([]);
  locales = signal<LocalRead[]>([]);

  // ── Estado de UI ────────────────────────────────────────────────────────
  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  errorModal = signal<string | null>(null);

  // ── Filtros ─────────────────────────────────────────────────────────────
  busqueda = '';
  filtroIdCategoria: string | null = null;
  filtroSexo: SexoProducto | null = null;

  // ── Modal ───────────────────────────────────────────────────────────────
  showModal = false;
  editandoId: string | null = null;
  form: ProductoForm = this.formVacio();

  // ── Creador rápido de categoría (dentro del modal de producto) ──────────
  readonly categoriasSugeridas = CATEGORIAS_SUGERIDAS;
  mostrarNuevaCategoria = false;
  nuevaCategoriaNombre = '';
  creandoCategoria = signal(false);
  errorCategoria = signal<string | null>(null);

  // ── Helpers de template ─────────────────────────────────────────────────

  readonly sexosDisponibles: { valor: SexoProducto; label: string }[] = [
    { valor: 'hombre', label: 'Hombre' },
    { valor: 'mujer', label: 'Mujer' },
    { valor: 'unisex', label: 'Unisex' },
    { valor: 'nino', label: 'Niño' },
  ];

  sexoLabel(sexo: SexoProducto | null): string {
    return sexo ? SEXO_LABELS[sexo] : '—';
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  private cargarDatosIniciales(): void {
    this.cargando.set(true);
    this.error.set(null);

    // Carga categorías y locales en paralelo con los productos
    this.inventarioService.listarCategorias().subscribe({
      next: (cats) => this.categorias.set(cats),
      error: () => { /* no-fatal, los selects quedarán vacíos */ },
    });

    this.inventarioService.listarLocales().subscribe({
      next: (locs) => this.locales.set(locs),
      error: () => { /* no-fatal */ },
    });

    this.inventarioService.listarProductos().subscribe({
      next: (prods) => {
        this.productos.set(prods);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos. Verifica tu conexión.');
        this.cargando.set(false);
      },
    });
  }

  private recargarProductos(): void {
    this.inventarioService.listarProductos().subscribe({
      next: (prods) => this.productos.set(prods),
    });
  }

  // ── Filtros (aplicados localmente sobre la lista en memoria) ─────────────

  get productosFiltrados(): ProductoListItem[] {
    const busq = this.busqueda.toLowerCase().trim();
    return this.productos().filter((p) => {
      if (busq && !p.nombre.toLowerCase().includes(busq)) return false;
      if (this.filtroIdCategoria && p.id_categoria !== this.filtroIdCategoria) return false;
      if (this.filtroSexo && p.sexo !== this.filtroSexo) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroIdCategoria || this.filtroSexo);
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroIdCategoria = null;
    this.filtroSexo = null;
  }

  // ── Cálculos de display ─────────────────────────────────────────────────

  margen(p: ProductoListItem): number {
    return p.margen;
  }

  stockTotal(p: ProductoListItem): number {
    return p.stock_total;
  }

  // ── Modal ───────────────────────────────────────────────────────────────

  private formVacio(): ProductoForm {
    return {
      nombre: '',
      id_categoria: null,
      sexo: null,
      costoCompra: 0,
      precioVenta: 0,
      fotoUrl: null,
      variantes: [{ talla: '', cantidad: 0, id_local: '' }],
    };
  }

  abrirModalNuevo(): void {
    this.editandoId = null;
    this.form = this.formVacio();
    this.errorModal.set(null);
    this.cerrarPanelNuevaCategoria();
    this.showModal = true;
  }

  abrirModalEditar(p: ProductoListItem): void {
    // Carga el detalle completo (con variantes) para poblar el formulario
    this.inventarioService.obtenerProducto(p.id_producto).subscribe({
      next: (detalle: ProductoRead) => {
        this.editandoId = detalle.id_producto;
        this.form = {
          nombre: detalle.nombre,
          id_categoria: detalle.id_categoria,
          sexo: detalle.sexo,
          costoCompra: detalle.costo_compra,
          precioVenta: detalle.precio_venta,
          fotoUrl: null,
          variantes: detalle.variantes.flatMap((v) =>
            v.stock.map((s) => ({
              talla: v.talla ?? '',
              cantidad: s.cantidad,
              id_local: s.id_local,
            }))
          ),
        };
        this.errorModal.set(null);
        this.cerrarPanelNuevaCategoria();
        this.showModal = true;
      },
      error: () => this.error.set('No se pudo cargar el detalle del producto.'),
    });
  }

  cerrarModal(): void {
    this.showModal = false;
    this.errorModal.set(null);
    this.cerrarPanelNuevaCategoria();
  }

  agregarFilaVariante(): void {
    const primerLocal = this.locales()[0]?.id_local ?? '';
    this.form.variantes.push({ talla: '', cantidad: 0, id_local: primerLocal });
  }

  quitarFilaVariante(index: number): void {
    this.form.variantes.splice(index, 1);
  }

  // ── Creador rápido de categoría ──────────────────────────────────────────

  /** Nombres (en minúscula) de categorías que ya existen, para no duplicar sugerencias. */
  private get nombresCategoriaExistentes(): Set<string> {
    return new Set(this.categorias().map((c) => c.nombre.trim().toLowerCase()));
  }

  /** Sugerencias típicas que aún no están creadas como categoría en esta empresa. */
  get categoriasSugeridasDisponibles(): string[] {
    const existentes = this.nombresCategoriaExistentes;
    return this.categoriasSugeridas.filter((s) => !existentes.has(s.toLowerCase()));
  }

  abrirPanelNuevaCategoria(): void {
    this.mostrarNuevaCategoria = true;
    this.nuevaCategoriaNombre = '';
    this.errorCategoria.set(null);
  }

  cerrarPanelNuevaCategoria(): void {
    this.mostrarNuevaCategoria = false;
    this.nuevaCategoriaNombre = '';
    this.errorCategoria.set(null);
  }

  elegirCategoriaSugerida(nombre: string): void {
    this.nuevaCategoriaNombre = nombre;
  }

  crearCategoriaRapida(): void {
    const nombre = this.nuevaCategoriaNombre.trim();
    if (!nombre) {
      this.errorCategoria.set('Escribe o elige un nombre de categoría.');
      return;
    }
    if (this.nombresCategoriaExistentes.has(nombre.toLowerCase())) {
      this.errorCategoria.set('Ya existe una categoría con ese nombre.');
      return;
    }

    const datos: CategoriaCreateInput = { nombre };
    this.creandoCategoria.set(true);
    this.errorCategoria.set(null);

    this.inventarioService.crearCategoria(datos).subscribe({
      next: (nueva) => {
        // La agrega a la lista en memoria (sin recargar todo el catálogo)
        // y la deja seleccionada de una vez en el producto que se está creando.
        this.categorias.update((lista) => [...lista, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.form.id_categoria = nueva.id_categoria;
        this.creandoCategoria.set(false);
        this.cerrarPanelNuevaCategoria();
      },
      error: (err) => {
        this.creandoCategoria.set(false);
        this.errorCategoria.set(err?.error?.detail ?? 'No se pudo crear la categoría.');
      },
    });
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (this.form.fotoUrl = reader.result as string);
    reader.readAsDataURL(file);
  }

  guardar(): void {
    if (!this.form.nombre.trim()) {
      this.errorModal.set('El nombre del producto es obligatorio.');
      return;
    }

    // Construye las variantes filtrando filas incompletas
    const variantes: VarianteStockInput[] = this.form.variantes
      .filter((v) => v.talla.trim() && v.id_local)
      .map((v) => ({
        talla: v.talla.trim(),
        cantidad: v.cantidad,
        id_local: v.id_local,
      }));

    this.guardando.set(true);
    this.errorModal.set(null);

    if (this.editandoId) {
      // Actualización
      this.inventarioService
        .actualizarProducto(this.editandoId, {
          nombre: this.form.nombre,
          id_categoria: this.form.id_categoria,
          sexo: this.form.sexo,
          costo_compra: this.form.costoCompra,
          precio_venta: this.form.precioVenta,
          variantes,
        })
        .subscribe({
          next: () => {
            this.guardando.set(false);
            this.showModal = false;
            this.recargarProductos();
          },
          error: (err) => {
            this.guardando.set(false);
            this.errorModal.set(
              err?.error?.detail ?? 'No se pudo actualizar el producto.'
            );
          },
        });
    } else {
      // Creación
      this.inventarioService
        .crearProducto({
          nombre: this.form.nombre,
          id_categoria: this.form.id_categoria,
          sexo: this.form.sexo,
          costo_compra: this.form.costoCompra,
          precio_venta: this.form.precioVenta,
          variantes,
        })
        .subscribe({
          next: () => {
            this.guardando.set(false);
            this.showModal = false;
            this.recargarProductos();
          },
          error: (err) => {
            this.guardando.set(false);
            this.errorModal.set(
              err?.error?.detail ?? 'No se pudo crear el producto.'
            );
          },
        });
    }
  }

  eliminar(p: ProductoListItem): void {
    if (!confirm(`¿Eliminar "${p.nombre}" del inventario?`)) return;

    this.inventarioService.eliminarProducto(p.id_producto).subscribe({
      next: () => this.recargarProductos(),
      error: (err) =>
        this.error.set(err?.error?.detail ?? 'No se pudo eliminar el producto.'),
    });
  }

  // ── Helper para el select de locales ────────────────────────────────────
  nombreLocal(idLocal: string): string {
    return this.locales().find((l) => l.id_local === idLocal)?.nombre ?? idLocal;
  }
}
