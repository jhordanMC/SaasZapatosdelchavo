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
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AlmacenCreateInput,
  AlmacenRead,
  CategoriaCreateInput,
  CategoriaRead,
  FiltrosProducto,
  InventarioService,
  LocalCreateInput,
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
  ubicacion: string;
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
  almacenesReales = signal<AlmacenRead[]>([]);

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
  busquedaCategoria = '';
  nuevaCategoriaNombre = '';
  creandoCategoria = signal(false);
  errorCategoria = signal<string | null>(null);

  // ── Gestión de Almacenes ─────────────────────────────────────────────────
  mostrarGestionAlmacenes = false;
  busquedaAlmacenReal = '';
  editandoAlmacenRealId: string | null = null;
  almacenRealForm: { nombre: string; direccion: string; descripcion: string } = this.almacenRealFormVacio();
  guardandoAlmacenReal = signal(false);
  errorAlmacenReal = signal<string | null>(null);

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
      next: (cats) => {
        if (cats.length === 0) {
          // Empresa nueva sin categorías todavía: precarga las más comunes
          // del mercado peruano de calzado, para que el inventario se pueda
          // llenar de una vez sin tener que crear cada categoría a mano.
          this.sembrarCategoriasPredeterminadas();
        } else {
          this.categorias.set(cats);
        }
      },
      error: () => { /* no-fatal, los selects quedarán vacíos */ },
    });

    this.inventarioService.listarLocales().subscribe({
      next: (locs) => this.locales.set(locs),
      error: () => { /* no-fatal */ },
    });

    this.inventarioService.listarAlmacenes().subscribe({
      next: (almacenes) => this.almacenesReales.set(almacenes),
      error: () => { /* no-fatal, el panel de almacenes quedará vacío */ },
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

  /** Crea en el backend las categorías sugeridas (deportivo, tacos, ballerinas...)
   *  la primera vez que la empresa entra a Inventario sin tener ninguna todavía. */
  private sembrarCategoriasPredeterminadas(): void {
    const creaciones = this.categoriasSugeridas.map((nombre) =>
      this.inventarioService.crearCategoria({ nombre }).pipe(catchError(() => of(null)))
    );
    forkJoin(creaciones).subscribe((resultados) => {
      const creadas = resultados.filter((r): r is CategoriaRead => r !== null);
      this.categorias.set(creadas.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });
  }

  private recargarProductos(): void {
    this.inventarioService.listarProductos().subscribe({
      next: (prods) => {
        this.productos.set(prods);
      },
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
      variantes: [{ talla: '', cantidad: 0, ubicacion: '' }],
    };
  }

  abrirModalNuevo(): void {
    this.editandoId = null;
    this.form = this.formVacio();
    this.errorModal.set(null);
    this.cerrarPanelNuevaCategoria();
    this.cerrarPanelGestionAlmacenes();
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
                ubicacion: s.id_local ? `local:${s.id_local}` : (s.id_almacen ? `almacen:${s.id_almacen}` : ''),
              }))
          ),
        };
        this.errorModal.set(null);
        this.cerrarPanelNuevaCategoria();
        this.cerrarPanelGestionAlmacenes();
        this.showModal = true;
      },
      error: () => this.error.set('No se pudo cargar el detalle del producto.'),
    });
  }

  cerrarModal(): void {
    this.showModal = false;
    this.errorModal.set(null);
    this.cerrarPanelNuevaCategoria();
    this.cerrarPanelGestionAlmacenes();
  }

  agregarFilaVariante(): void {
    const primerUbicacion = this.locales().length > 0 
      ? `local:${this.locales()[0].id_local}` 
      : (this.almacenesReales().length > 0 ? `almacen:${this.almacenesReales()[0].id_almacen}` : '');
    this.form.variantes.push({ talla: '', cantidad: 0, ubicacion: primerUbicacion });
  }

  quitarFilaVariante(index: number): void {
    this.form.variantes.splice(index, 1);
  }

  // ── Creador / gestor rápido de categoría ──────────────────────────────────

  /** Nombres (en minúscula) de categorías que ya existen, para no duplicar sugerencias. */
  private get nombresCategoriaExistentes(): Set<string> {
    return new Set(this.categorias().map((c) => c.nombre.trim().toLowerCase()));
  }

  /** Sugerencias típicas que aún no están creadas como categoría en esta empresa. */
  get categoriasSugeridasDisponibles(): string[] {
    const existentes = this.nombresCategoriaExistentes;
    return this.categoriasSugeridas.filter((s) => !existentes.has(s.toLowerCase()));
  }

  /** Lista de categorías ya creadas, filtrada por el buscador del panel. */
  get categoriasFiltradas(): CategoriaRead[] {
    const busq = this.busquedaCategoria.toLowerCase().trim();
    const lista = this.categorias();
    if (!busq) return lista;
    return lista.filter((c) => c.nombre.toLowerCase().includes(busq));
  }

  abrirPanelNuevaCategoria(): void {
    this.mostrarNuevaCategoria = true;
    this.busquedaCategoria = '';
    this.nuevaCategoriaNombre = '';
    this.errorCategoria.set(null);
  }

  cerrarPanelNuevaCategoria(): void {
    this.mostrarNuevaCategoria = false;
    this.busquedaCategoria = '';
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
        this.nuevaCategoriaNombre = '';
        this.creandoCategoria.set(false);
      },
      error: (err) => {
        this.creandoCategoria.set(false);
        this.errorCategoria.set(err?.error?.detail ?? 'No se pudo crear la categoría.');
      },
    });
  }

  /** Por si se agregó una categoría de más o por error — la borra del catálogo. */
  eliminarCategoriaGestion(cat: CategoriaRead): void {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Los productos que la usan quedarán sin categoría.`)) return;

    this.errorCategoria.set(null);
    this.inventarioService.eliminarCategoria(cat.id_categoria).subscribe({
      next: () => {
        this.categorias.update((lista) => lista.filter((c) => c.id_categoria !== cat.id_categoria));
        if (this.form.id_categoria === cat.id_categoria) this.form.id_categoria = null;
        if (this.filtroIdCategoria === cat.id_categoria) this.filtroIdCategoria = null;
      },
      error: (err) => {
        this.errorCategoria.set(err?.error?.detail ?? 'No se pudo eliminar la categoría.');
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
      .filter((v) => v.talla.trim() && v.ubicacion)
      .map((v) => {
        const [tipo, id] = v.ubicacion.split(':');
        return {
          talla: v.talla.trim(),
          cantidad: v.cantidad,
          id_local: tipo === 'local' ? id : null,
          id_almacen: tipo === 'almacen' ? id : null,
        };
      });

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



  private almacenRealFormVacio(): { nombre: string; direccion: string; descripcion: string } {
    return { nombre: '', direccion: '', descripcion: '' };
  }

  /** Lista de almacenes reales filtrada por el buscador del modal. */
  get almacenesRealesFiltrados(): AlmacenRead[] {
    const busq = this.busquedaAlmacenReal.toLowerCase().trim();
    const lista = this.almacenesReales();
    if (!busq) return lista;
    return lista.filter((a) => a.nombre.toLowerCase().includes(busq));
  }

  abrirPanelGestionAlmacenes(): void {
    this.mostrarGestionAlmacenes = true;
    this.busquedaAlmacenReal = '';
    this.cancelarEdicionAlmacenReal();
  }

  cerrarPanelGestionAlmacenes(): void {
    this.mostrarGestionAlmacenes = false;
    this.busquedaAlmacenReal = '';
    this.cancelarEdicionAlmacenReal();
  }

  /** Prepara el formulario para crear uno nuevo (limpio) o editar uno existente. */
  editarAlmacenReal(almacen: AlmacenRead): void {
    this.editandoAlmacenRealId = almacen.id_almacen;
    this.almacenRealForm = {
      nombre: almacen.nombre,
      direccion: almacen.direccion ?? '',
      descripcion: almacen.descripcion ?? '',
    };
    this.errorAlmacenReal.set(null);
  }

  cancelarEdicionAlmacenReal(): void {
    this.editandoAlmacenRealId = null;
    this.almacenRealForm = this.almacenRealFormVacio();
    this.errorAlmacenReal.set(null);
  }

  guardarAlmacenReal(): void {
    const nombre = this.almacenRealForm.nombre.trim();
    if (!nombre) {
      this.errorAlmacenReal.set('El nombre del almacén es obligatorio.');
      return;
    }

    const datos: AlmacenCreateInput = {
      nombre,
      direccion: this.almacenRealForm.direccion.trim() || null,
      descripcion: this.almacenRealForm.descripcion.trim() || null,
    };

    this.guardandoAlmacenReal.set(true);
    this.errorAlmacenReal.set(null);

    if (this.editandoAlmacenRealId) {
      this.inventarioService.actualizarAlmacen(this.editandoAlmacenRealId, datos).subscribe({
        next: (actualizado) => {
          this.almacenesReales.update((lista) =>
            lista.map((a) => (a.id_almacen === actualizado.id_almacen ? actualizado : a))
          );
          this.guardandoAlmacenReal.set(false);
          this.cancelarEdicionAlmacenReal();
        },
        error: (err) => {
          this.guardandoAlmacenReal.set(false);
          this.errorAlmacenReal.set(err?.error?.detail ?? 'No se pudo actualizar el almacén.');
        },
      });
    } else {
      this.inventarioService.crearAlmacen(datos).subscribe({
        next: (nuevo) => {
          this.almacenesReales.update((lista) => [...lista, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          this.guardandoAlmacenReal.set(false);
          this.cancelarEdicionAlmacenReal();
        },
        error: (err) => {
          this.guardandoAlmacenReal.set(false);
          this.errorAlmacenReal.set(err?.error?.detail ?? 'No se pudo crear el almacén.');
        },
      });
    }
  }

  eliminarAlmacenReal(almacen: AlmacenRead): void {
    if (!confirm(`¿Eliminar el almacén "${almacen.nombre}"?`)) return;

    this.errorAlmacenReal.set(null);
    this.inventarioService.eliminarAlmacen(almacen.id_almacen).subscribe({
      next: () => {
        this.almacenesReales.update((lista) => lista.filter((a) => a.id_almacen !== almacen.id_almacen));
        if (this.editandoAlmacenRealId === almacen.id_almacen) this.cancelarEdicionAlmacenReal();
      },
      error: (err) => {
        this.errorAlmacenReal.set(err?.error?.detail ?? 'No se pudo eliminar el almacén.');
      },
    });
  }
}
