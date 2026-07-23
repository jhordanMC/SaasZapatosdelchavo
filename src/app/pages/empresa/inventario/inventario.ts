/**
 * Componente de Inventario (vista empresa).
 *
 * Conectado al backend a través de InventarioService.
 * Estrategia de catálogo: paginado por el servidor (scroll infinito),
 * ordenado por ranking (recientes de las últimas 2 semanas + más vendidos
 * primero). Los filtros (búsqueda con debounce, categoría, sexo) reinician
 * la paginación y se resuelven en el backend — no hay filtro en memoria.
 *
 * Flujos:
 *   - Init: carga categorías/locales/almacenes en paralelo + primera página
 *     de productos.
 *   - Filtros: cualquier cambio reinicia `offset` a 0 y vuelve a pedir la
 *     página 1 con esos filtros.
 *   - Scroll infinito: un IntersectionObserver sobre un sentinel al final
 *     del grid pide la siguiente página y la anexa a `productos()`.
 *   - Crear: modal "Nuevo producto" → POST /inventario/productos.
 *   - Editar: modal "Editar producto" → PATCH /inventario/productos/{id}.
 *   - Eliminar: confirm() → DELETE /inventario/productos/{id}.
 */
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
  ProductosPaginados,
  SexoProducto,
  VarianteStockInput,
} from '../../../services/inventario';

// ---------------------------------------------------------------------------
// Tipos internos del formulario
// ---------------------------------------------------------------------------

interface VarianteFormItem {
  talla: string;
  // Texto plano tal cual lo digita el usuario (sin flechas de subir/bajar,
  // sin arrancar en "0"). Se convierte a número recién al guardar.
  cantidad: string;
  ubicacion: string;
}

interface ProductoForm {
  nombre: string;
  id_categoria: string | null;
  sexo: SexoProducto | null;
  // Texto plano (ver VarianteFormItem.cantidad) — se parsean a número al guardar.
  costoCompra: string;
  precioVenta: string;
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
export class InventarioComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(private inventarioService: InventarioService) {
    // Debounce de 300ms: espera a que el usuario deje de teclear antes de
    // pedir la página 1 al backend con el nuevo texto de búsqueda.
    this.busquedaSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.cargarPrimeraPaginaProductos();
    });
  }

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

  // ── Paginación del catálogo (scroll infinito) ────────────────────────────
  private offset = 0;
  hayMasProductos = signal(true);
  cargandoPagina = signal(false);
  private readonly busquedaSubject = new Subject<string>();
  @ViewChild('sentinelaInfiniteScroll') private sentinelaRef?: ElementRef<HTMLElement>;
  private observerScroll?: IntersectionObserver;

  // ── Filtros ─────────────────────────────────────────────────────────────
  busqueda = '';
  filtroIdCategoria: string | null = null;
  filtroSexo: SexoProducto | null = null;

  // ── Modal ───────────────────────────────────────────────────────────────
  showModal = false;
  editandoId: string | null = null;
  form: ProductoForm = this.formVacio();

  // ── Confirmación al intentar salir del modal con datos sin guardar ──────
  mostrarConfirmarSalir = false;

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

    this.cargarPrimeraPaginaProductos();
  }

  // ── Paginación del catálogo (scroll infinito) ────────────────────────────

  /** Reinicia la paginación (offset 0, lista vacía) y pide la página 1 con los filtros actuales. */
  cargarPrimeraPaginaProductos(): void {
    this.cargarPaginaProductos(true);
  }

  /** Pide la siguiente página con los mismos filtros y la anexa al final de la lista. */
  cargarSiguientePaginaProductos(): void {
    this.cargarPaginaProductos(false);
  }

  private cargarPaginaProductos(reiniciar: boolean): void {
    if (reiniciar) {
      this.offset = 0;
      this.productos.set([]);
      this.hayMasProductos.set(true);
    }
    if (!this.hayMasProductos() || this.cargandoPagina()) return;

    this.cargandoPagina.set(true);
    this.error.set(null);

    const filtros: FiltrosProducto = {};
    if (this.busqueda) filtros.busqueda = this.busqueda;
    if (this.filtroIdCategoria) filtros.id_categoria = this.filtroIdCategoria;
    if (this.filtroSexo) filtros.sexo = this.filtroSexo;

    this.inventarioService.listarProductos(filtros, this.offset).subscribe({
      next: (resp: ProductosPaginados) => {
        this.productos.update((lista) => [...lista, ...resp.items]);
        this.hayMasProductos.set(resp.hay_mas);
        this.offset = resp.siguiente_offset;
        this.cargandoPagina.set(false);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos. Verifica tu conexión.');
        this.cargandoPagina.set(false);
        this.cargando.set(false);
      },
    });
  }

  // ── Scroll infinito (IntersectionObserver sobre el sentinel del grid) ───

  ngAfterViewInit(): void {
    if (!this.sentinelaRef) return;
    this.observerScroll = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          this.cargarSiguientePaginaProductos();
        }
      },
      { rootMargin: '200px' }
    );
    this.observerScroll.observe(this.sentinelaRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.observerScroll?.disconnect();
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
    this.cargarPrimeraPaginaProductos();
  }

  // ── Filtros (resueltos en el backend — cualquier cambio reinicia la página) ──

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroIdCategoria || this.filtroSexo);
  }

  /** Ligado al input de búsqueda: actualiza el texto y dispara el debounce. */
  onBusquedaChange(valor: string): void {
    this.busqueda = valor;
    this.busquedaSubject.next(valor);
  }

  onFiltroCategoriaChange(valor: string | null): void {
    this.filtroIdCategoria = valor;
    this.cargarPrimeraPaginaProductos();
  }

  onFiltroSexoChange(valor: SexoProducto | null): void {
    this.filtroSexo = valor;
    this.cargarPrimeraPaginaProductos();
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroIdCategoria = null;
    this.filtroSexo = null;
    this.cargarPrimeraPaginaProductos();
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
      costoCompra: '',
      precioVenta: '',
      fotoUrl: null,
      variantes: [{ talla: '', cantidad: '', ubicacion: '' }],
    };
  }

  /** Deja pasar solo dígitos y un único punto decimal (costo/precio). */
  private limpiarDecimal(valor: string): string {
    let limpio = (valor ?? '').replace(/[^0-9.]/g, '');
    const partes = limpio.split('.');
    if (partes.length > 2) limpio = partes[0] + '.' + partes.slice(1).join('');
    return limpio;
  }

  /** Deja pasar solo dígitos (cantidad de stock). */
  private limpiarEntero(valor: string): string {
    return (valor ?? '').replace(/[^0-9]/g, '');
  }

  onCostoCompraChange(valor: string): void {
    this.form.costoCompra = this.limpiarDecimal(valor);
  }

  onPrecioVentaChange(valor: string): void {
    this.form.precioVenta = this.limpiarDecimal(valor);
  }

  onCantidadVarianteChange(index: number, valor: string): void {
    this.form.variantes[index].cantidad = this.limpiarEntero(valor);
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
          costoCompra: String(detalle.costo_compra ?? ''),
          precioVenta: String(detalle.precio_venta ?? ''),
          fotoUrl: null,
          variantes: detalle.variantes.flatMap((v) =>
            v.stock.map((s) => ({
                talla: v.talla ?? '',
                cantidad: String(s.cantidad ?? ''),
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
    this.mostrarConfirmarSalir = false;
    this.errorModal.set(null);
    this.cerrarPanelNuevaCategoria();
    this.cerrarPanelGestionAlmacenes();
  }

  /** True si el formulario tiene algo digitado (para no perderlo por accidente). */
  get hayCambiosSinGuardar(): boolean {
    const f = this.form;
    if (f.nombre.trim() !== '') return true;
    if (f.id_categoria) return true;
    if (f.sexo) return true;
    if (f.costoCompra.trim() !== '') return true;
    if (f.precioVenta.trim() !== '') return true;
    if (f.fotoUrl) return true;
    return f.variantes.some((v) => v.talla.trim() !== '' || v.cantidad.trim() !== '' || v.ubicacion);
  }

  /** Ligado al click fuera de la tarjeta del modal: si hay datos, pide confirmación en vez de cerrar de una. */
  intentarCerrarModal(): void {
    if (this.hayCambiosSinGuardar) {
      this.mostrarConfirmarSalir = true;
    } else {
      this.cerrarModal();
    }
  }

  /** "Sí, salir": descarta lo digitado y cierra ambos modales. */
  confirmarSalirModal(): void {
    this.mostrarConfirmarSalir = false;
    this.cerrarModal();
  }

  /** "No, quiero seguir": vuelve al formulario sin perder nada. */
  cancelarSalirModal(): void {
    this.mostrarConfirmarSalir = false;
  }

  agregarFilaVariante(): void {
    const primerUbicacion = this.locales().length > 0 
      ? `local:${this.locales()[0].id_local}` 
      : (this.almacenesReales().length > 0 ? `almacen:${this.almacenesReales()[0].id_almacen}` : '');
    this.form.variantes.push({ talla: '', cantidad: '', ubicacion: primerUbicacion });
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
          cantidad: parseInt(v.cantidad, 10) || 0,
          id_local: tipo === 'local' ? id : null,
          id_almacen: tipo === 'almacen' ? id : null,
        };
      });

    const costoCompra = parseFloat(this.form.costoCompra) || 0;
    const precioVenta = parseFloat(this.form.precioVenta) || 0;

    this.guardando.set(true);
    this.errorModal.set(null);

    if (this.editandoId) {
      // Actualización
      this.inventarioService
        .actualizarProducto(this.editandoId, {
          nombre: this.form.nombre,
          id_categoria: this.form.id_categoria,
          sexo: this.form.sexo,
          costo_compra: costoCompra,
          precio_venta: precioVenta,
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
          costo_compra: costoCompra,
          precio_venta: precioVenta,
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