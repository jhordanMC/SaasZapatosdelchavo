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
import { environment } from '../../../../environments/environment';
import { esArchivoDeImagen, esPrevisualizableEnNavegador } from '../../../utils/validar-imagen';
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
  ProveedorCreateInput,
  ProveedorRead,
  SexoProducto,
  VarianteStockInput,
  ProductoCreateInput,
  ProductoUpdateInput
} from '../../../services/inventario';

// ---------------------------------------------------------------------------
// Tipos internos del formulario
// ---------------------------------------------------------------------------

interface VarianteFormItem {
  talla: string;
  // Texto plano tal cual lo digita el usuario (sin flechas de subir/bajar,
  // sin arrancar en "0"). Se convierte a número recién al guardar.
  cantidad: string;
  sku: string | null;
  codigo_barras: string | null;
  ubicacion: string;
  // Filtro de UI: qué lista mostrar en el segundo select ('almacen' | 'local' | '').
  // No se envía al backend, solo decide qué opciones ve el usuario.
  tipoUbicacion: 'almacen' | 'local' | '';
}

interface ProductoForm {
  nombre: string;
  id_categoria: string | null;
  id_proveedor: string | null;
  sexo: SexoProducto | null;
  // Texto plano (ver VarianteFormItem.cantidad) — se parsean a número al guardar.
  costoCompra: string;
  precioVenta: string;
  fotoUrl: string | null;
  /** false = el navegador no puede pintar una preview de este archivo (HEIC/DNG en la mayoría) — se muestra un placeholder en vez de <img>. */
  fotoPrevisualizable: boolean;
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
  proveedores = signal<ProveedorRead[]>([]);
  locales = signal<LocalRead[]>([]);
  almacenesReales = signal<AlmacenRead[]>([]);

  // ── Estado de UI ────────────────────────────────────────────────────────
  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  errorModal = signal<string | null>(null);

  // ── Foto del producto: se sube al backend recién en guardar(), no al
  //    elegirla — form.fotoUrl es un preview base64 hasta ese momento. ──
  private archivoFotoPendiente: File | null = null;

  // ── Confirmación al eliminar un producto (reemplaza el confirm() nativo) ──
  productoAEliminar: ProductoListItem | null = null;
  eliminandoProducto = signal(false);

  // ── Producto + acción cuyo detalle se está trayendo (Editar o Duplicar),
  //    para mostrar el spinner solo en el botón que se clickeó, no en el otro ──
  cargandoDetalle = signal<{ id: string; accion: 'editar' | 'duplicar' } | null>(null);

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

  // ── Tooltip informativo del margen de ganancia ───────────────────────────
  mostrarInfoMargen = false;

  // ── Creador rápido de categoría (dentro del modal de producto) ──────────
  readonly categoriasSugeridas = CATEGORIAS_SUGERIDAS;
  mostrarNuevaCategoria = false;
  busquedaCategoria = '';
  nuevaCategoriaNombre = '';
  creandoCategoria = signal(false);
  errorCategoria = signal<string | null>(null);

  // ── Creador rápido de proveedor (dentro del modal de producto) ──────────
  mostrarNuevoProveedor = false;
  busquedaProveedor = '';
  nuevoProveedorNombre = '';
  creandoProveedor = signal(false);
  errorProveedor = signal<string | null>(null);

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
          this.sembrarCategoriasPredeterminadas();
        } else {
          this.categorias.set(cats);
        }
      },
      error: () => { /* no-fatal, los selects quedarán vacíos */ },
    });

    this.inventarioService.listarProveedores().subscribe({
      next: (provs) => this.proveedores.set(provs),
      error: () => { /* no-fatal */ },
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
      this.hayMasProductos.set(true);
      // OJO: no se vacía `productos` acá — se reemplaza recién cuando llega
      // la respuesta (ver next), para que la grilla no se quede en blanco
      // ("resetee") mientras espera la página 1 (ej. justo después de
      // guardar un producto).
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
        this.productos.update((lista) => (reiniciar ? resp.items : [...lista, ...resp.items]));
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

  // ── Creador de Proveedores ───────────────────────────────────────────────

  get proveedoresFiltrados(): ProveedorRead[] {
    const q = this.busquedaProveedor.toLowerCase();
    return this.proveedores().filter((p) => p.razon_social.toLowerCase().includes(q));
  }

  abrirNuevoProveedor(): void {
    this.nuevoProveedorNombre = this.busquedaProveedor;
    this.mostrarNuevoProveedor = true;
    this.errorProveedor.set(null);
  }

  cancelarNuevoProveedor(): void {
    this.mostrarNuevoProveedor = false;
    this.nuevoProveedorNombre = '';
    this.errorProveedor.set(null);
  }

  guardarNuevoProveedor(): void {
    const razonSocial = this.nuevoProveedorNombre.trim();
    if (!razonSocial) return;

    this.creandoProveedor.set(true);
    this.errorProveedor.set(null);

    this.inventarioService.crearProveedor({ razon_social: razonSocial }).subscribe({
      next: (prov) => {
        this.proveedores.update((lista) => [...lista, prov].sort((a, b) => a.razon_social.localeCompare(b.razon_social)));
        this.form.id_proveedor = prov.id_proveedor;
        this.mostrarNuevoProveedor = false;
        this.nuevoProveedorNombre = '';
        this.busquedaProveedor = '';
        this.creandoProveedor.set(false);
      },
      error: () => {
        this.errorProveedor.set('No se pudo crear el proveedor.');
        this.creandoProveedor.set(false);
      },
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
      id_proveedor: null,
      sexo: null,
      costoCompra: '',
      precioVenta: '',
      fotoUrl: null,
      fotoPrevisualizable: true,
      variantes: [
        { talla: '', cantidad: '', sku: null, codigo_barras: null, ubicacion: '', tipoUbicacion: '' },
      ],
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
    this.archivoFotoPendiente = null;
    this.mostrarInfoMargen = false;
    this.cerrarPanelNuevaCategoria();
    this.cerrarPanelGestionAlmacenes();
    this.showModal = true;
  }

  abrirModalEditar(p: ProductoListItem): void {
    // Carga el detalle completo (con variantes) para poblar el formulario
    this.cargandoDetalle.set({ id: p.id_producto, accion: 'editar' });
    this.inventarioService.obtenerProducto(p.id_producto).subscribe({
      next: (detalle: ProductoRead) => {
        this.editandoId = detalle.id_producto;
        this.form = this.formDesdeDetalle(detalle, true);
        this.errorModal.set(null);
        this.archivoFotoPendiente = null;
        this.cerrarPanelNuevaCategoria();
        this.cerrarPanelGestionAlmacenes();
        this.showModal = true;
        this.cargandoDetalle.set(null);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del producto.');
        this.cargandoDetalle.set(null);
      },
    });
  }

  /** Abre el modal como "Nuevo producto" pero con los datos de otro ya cargados,
   *  para no tener que digitar todo de nuevo cuando es muy parecido (mismo modelo,
   *  otro color, etc). Al guardar se crea un producto aparte, no se sobreescribe el original. */
  duplicarProducto(p: ProductoListItem): void {
    this.cargandoDetalle.set({ id: p.id_producto, accion: 'duplicar' });
    this.inventarioService.obtenerProducto(p.id_producto).subscribe({
      next: (detalle: ProductoRead) => {
        this.editandoId = null;
        this.form = this.formDesdeDetalle(detalle, false);
        this.form.nombre = `${detalle.nombre} (copia)`;
        this.errorModal.set(null);
        this.archivoFotoPendiente = null;
        this.cerrarPanelNuevaCategoria();
        this.cerrarPanelGestionAlmacenes();
        this.showModal = true;
        this.cargandoDetalle.set(null);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del producto para duplicarlo.');
        this.cargandoDetalle.set(null);
      },
    });
  }

  /**
   * Arma el formulario a partir del detalle del backend (usado por editar y
   * duplicar). copiarFoto=false en duplicar a propósito: si el "copia"
   * heredara la misma imagen_url del original, ambos productos quedarían
   * apuntando al mismo archivo en disco — y si más adelante uno de los dos
   * reemplaza su foto, el borrado del archivo viejo (ver backend,
   * actualizar_producto) rompería la foto del otro sin que nadie la tocara.
   */
  private formDesdeDetalle(detalle: ProductoRead, copiarFoto: boolean): ProductoForm {
    return {
      nombre: detalle.nombre,
      id_categoria: detalle.id_categoria,
      id_proveedor: detalle.id_proveedor ?? null,
      sexo: detalle.sexo,
      costoCompra: String(detalle.costo_compra ?? ''),
      precioVenta: String(detalle.precio_venta ?? ''),
      fotoUrl: copiarFoto ? detalle.imagen_url : null,
      fotoPrevisualizable: true,
      variantes: detalle.variantes.flatMap((v) =>
        v.stock.map((s) => ({
            talla: v.talla || '',
            cantidad: String(s.cantidad),
            sku: v.sku || null,
            codigo_barras: v.codigo_barras || null,
            ubicacion: s.id_local ? `local:${s.id_local}` : (s.id_almacen ? `almacen:${s.id_almacen}` : ''),
            tipoUbicacion: s.id_local ? 'local' as const : (s.id_almacen ? 'almacen' as const : '' as const),
          }))
      ),
    };
  }

  cerrarModal(): void {
    this.showModal = false;
    this.mostrarConfirmarSalir = false;
    this.mostrarInfoMargen = false;
    this.errorModal.set(null);
    this.archivoFotoPendiente = null;
    this.cerrarPanelNuevaCategoria();
    this.cerrarPanelGestionAlmacenes();
  }

  /** True si el formulario tiene algo digitado (para no perderlo por accidente). */
  get hayCambiosSinGuardar(): boolean {
    const f = this.form;
    if (f.nombre.trim() !== '') return true;
    if (f.id_categoria) return true;
    if (f.id_proveedor) return true;
    if (f.sexo) return true;
    if (f.costoCompra.trim() !== '') return true;
    if (f.precioVenta.trim() !== '') return true;
    if (f.fotoUrl) return true;
    return f.variantes.some((v) => v.talla.trim() !== '' || v.cantidad.trim() !== '' || v.ubicacion);
  }

  /** Ligado al click fuera de la tarjeta del modal: siempre pide confirmación antes de cerrar (nuevo o editar). */
  intentarCerrarModal(): void {
    this.mostrarConfirmarSalir = true;
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

  /** Margen de ganancia en vivo (precio venta - costo compra), texto plano → número.
   *  Es solo informativo: no descuenta IGV, gastos ni otros costos. */
  get margenForm(): number {
    const costo = parseFloat(this.form.costoCompra) || 0;
    const precio = parseFloat(this.form.precioVenta) || 0;
    return precio - costo;
  }

  /** Suma el stock de todas las filas de tallas del formulario (texto plano → número). */
  get stockTotalForm(): number {
    return this.form.variantes.reduce((total, v) => total + (parseInt(v.cantidad, 10) || 0), 0);
  }

  agregarFilaVariante(): void {
    const hayLocales = this.locales().length > 0;
    const hayAlmacenes = this.almacenesReales().length > 0;
    const tipo: 'almacen' | 'local' | '' = hayLocales ? 'local' : (hayAlmacenes ? 'almacen' : '');
    const primerUbicacion = hayLocales
      ? `local:${this.locales()[0].id_local}`
      : (hayAlmacenes ? `almacen:${this.almacenesReales()[0].id_almacen}` : '');
    this.form.variantes.push({ talla: '', cantidad: '', sku: null, codigo_barras: null, ubicacion: primerUbicacion, tipoUbicacion: tipo });
  }

  /** Al cambiar el tipo (Almacén/Local) se limpia la ubicación elegida, para que
   *  el segundo select siempre muestre solo la lista del tipo seleccionado. */
  onTipoUbicacionChange(index: number, tipo: 'almacen' | 'local' | ''): void {
    this.form.variantes[index].tipoUbicacion = tipo;
    this.form.variantes[index].ubicacion = '';
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

  /**
   * Solo vista previa local (base64) acá — la subida real al backend queda
   * pendiente hasta guardar() (ver archivoFotoPendiente). Si se sube de
   * una al elegir la foto, cancelar el modal o cambiar de foto de nuevo
   * antes de guardar deja archivos huérfanos en el disco del VPS, sin que
   * ningún producto los termine referenciando.
   */
  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!esArchivoDeImagen(file)) {
      this.errorModal.set('El archivo debe ser una imagen (foto).');
      input.value = '';
      return;
    }

    this.archivoFotoPendiente = file;
    this.form.fotoPrevisualizable = esPrevisualizableEnNavegador(file);
    const reader = new FileReader();
    reader.onload = () => (this.form.fotoUrl = reader.result as string);
    reader.readAsDataURL(file);
  }

  /** Arma la URL absoluta de una foto de producto (imagen_url guarda solo la ruta relativa). */
  imagenSrc(imagenUrl: string | null): string | null {
    if (!imagenUrl) return null;
    // Mientras se sube, form.fotoUrl es un data: URL (base64) de la
    // preview local — ya es una URL válida tal cual, no lleva prefijo.
    return imagenUrl.startsWith('data:') ? imagenUrl : `${environment.apiUrl}${imagenUrl}`;
  }

  guardar(): void {
    if (!this.form.nombre.trim()) {
      this.errorModal.set('El nombre del producto es obligatorio.');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set(null);

    // La foto recién se sube al backend acá (no al elegirla) — así, si el
    // usuario cancela el modal o cambia de foto varias veces antes de
    // guardar, nunca queda un archivo huérfano en el disco del VPS.
    if (this.archivoFotoPendiente) {
      const archivo = this.archivoFotoPendiente;
      this.inventarioService.subirImagenProducto(archivo).subscribe({
        next: (resp) => {
          this.archivoFotoPendiente = null;
          this.form.fotoUrl = resp.url;
          this.guardarProductoConDatos();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorModal.set(err?.error?.detail ?? 'No se pudo subir la foto. Intenta de nuevo.');
        },
      });
      return;
    }

    this.guardarProductoConDatos();
  }

  /** Segunda mitad de guardar(): ya con form.fotoUrl resuelto a una URL real (o null). */
  private guardarProductoConDatos(): void {
    // Construye las variantes filtrando filas incompletas
    const variantes: VarianteStockInput[] = this.form.variantes
      .filter((v) => v.talla.trim() && v.ubicacion)
      .map((v) => {
        const [tipo, id] = v.ubicacion.split(':');
        const cantidadNum = parseInt(v.cantidad, 10) || 0;
        return {
          talla: v.talla.trim(),
          cantidad: cantidadNum,
          sku: v.sku?.trim() || null,
          codigo_barras: v.codigo_barras?.trim() || null,
          id_local: tipo === 'local' ? id : null,
          id_almacen: tipo === 'almacen' ? id : null,
        };
      });

    // ── Validaciones de negocio en el frontend (respuesta inmediata sin round-trip) ──

    // 1. Variantes con combinación (talla + ubicación) duplicada
    const ubicacionesVistas = new Set<string>();
    for (const v of variantes) {
      const clave = `${v.talla.toLowerCase()}|${v.id_local ?? ''}|${v.id_almacen ?? ''}`;
      if (ubicacionesVistas.has(clave)) {
        const ubicacionStr = v.id_local ? 'el mismo local' : 'el mismo almacén';
        this.guardando.set(false);
        this.errorModal.set(
          `La talla "${v.talla}" aparece más de una vez para ${ubicacionStr}.`
        );
        return;
      }
      ubicacionesVistas.add(clave);
    }

    // 2. SKU duplicado dentro del formulario
    const skusVistos = new Set<string>();
    for (const v of variantes) {
      if (v.sku) {
        if (skusVistos.has(v.sku)) {
          this.guardando.set(false);
          this.errorModal.set(
            `El SKU "${v.sku}" aparece más de una vez.`
          );
          return;
        }
        skusVistos.add(v.sku);
      }
    }

    // 3. Código de barras duplicado dentro del formulario
    const barcodesVistos = new Set<string>();
    for (const v of variantes) {
      if (v.codigo_barras) {
        if (barcodesVistos.has(v.codigo_barras)) {
          this.guardando.set(false);
          this.errorModal.set(
            `El código de barras "${v.codigo_barras}" aparece más de una vez.`
          );
          return;
        }
        barcodesVistos.add(v.codigo_barras);
      }
    }

    const costoCompra = parseFloat(this.form.costoCompra) || 0;
    const precioVenta = parseFloat(this.form.precioVenta) || 0;


    if (this.editandoId) {
      // Actualización
      const payload: ProductoUpdateInput = {
        nombre: this.form.nombre.trim(),
        id_categoria: this.form.id_categoria,
        id_proveedor: this.form.id_proveedor,
        sexo: this.form.sexo,
        costo_compra: costoCompra,
        precio_venta: precioVenta,
        imagen_url: this.form.fotoUrl,
        variantes,
      };
      this.inventarioService
        .actualizarProducto(this.editandoId, payload)
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
      const payload: ProductoCreateInput = {
        nombre: this.form.nombre.trim(),
        id_categoria: this.form.id_categoria,
        id_proveedor: this.form.id_proveedor,
        sexo: this.form.sexo,
        costo_compra: costoCompra,
        precio_venta: precioVenta,
        imagen_url: this.form.fotoUrl,
        variantes,
      };
      this.inventarioService
        .crearProducto(payload)
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

  /** Abre el modal de confirmación (en vez del confirm() nativo del navegador). */
  eliminar(p: ProductoListItem): void {
    this.productoAEliminar = p;
  }

  cancelarEliminarProducto(): void {
    this.productoAEliminar = null;
  }

  confirmarEliminarProducto(): void {
    const p = this.productoAEliminar;
    if (!p) return;

    this.eliminandoProducto.set(true);
    this.inventarioService.eliminarProducto(p.id_producto).subscribe({
      next: () => {
        this.eliminandoProducto.set(false);
        this.productoAEliminar = null;
        this.recargarProductos();
      },
      error: (err) => {
        this.eliminandoProducto.set(false);
        this.productoAEliminar = null;
        this.error.set(err?.error?.detail ?? 'No se pudo eliminar el producto.');
      },
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