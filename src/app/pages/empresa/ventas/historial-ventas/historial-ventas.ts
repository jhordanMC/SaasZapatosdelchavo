/**
 * Historial de ventas — vista administrativa dentro del módulo Ventas.
 *
 * Tiene 2 vistas conmutables con un selector tipo pestaña (mismo patrón que
 * el interruptor "Ingresos completos/con margen" de Finanzas): "Ventas" y
 * "Devoluciones". Cada una es su propia tabla con paginación numerada real
 * (mismo patrón que /admin/actividad: el backend expone COUNT(*) con los
 * mismos filtros, así que no hace falta el truco de "cargar más").
 *
 * "Ver detalle" (de una venta o de una devolución) pide su propio GET al
 * abrir el modal — no viene precargado en la lista, para no traer todos
 * los ítems/fotos solo para pintar la tabla.
 *
 * "Eliminar" de una venta es anular_venta en el backend (pregunta si se
 * debe devolver el stock). "Eliminar" de una devolución es un DESHACER:
 * reintegra el monto a la venta y revierte el stock si esa devolución lo
 * había restaurado — no es un simple borrado de fila.
 *
 * La edición de ventas queda para una próxima etapa (no hay botón/flujo de
 * editar todavía).
 */
import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { ModalBrandHeaderComponent } from '../../../../shared/modal-brand-header/modal-brand-header';
import { AuthService } from '../../../../core/auth';
import { environment } from '../../../../../environments/environment';
import { ComprasService } from '../../../../services/compras';
import {
  DetalleVentaRead,
  DevolucionListItem,
  DevolucionRead,
  ETIQUETAS_METODO_REEMBOLSO,
  ETIQUETAS_TIPO_DEVOLUCION,
  EstadoDevolucion,
  EstadoVenta,
  FiltrosHistorialDevoluciones,
  FiltrosHistorialVentas,
  ItemCambioProducto,
  MetodoReembolso,
  MotivoDevolucion,
  ProductoPOSRead,
  UsuarioDevolucionHistorial,
  VendedorHistorial,
  VentaListItem,
  VentaRead,
  VentasService,
  tipoDevolucion,
} from '../../../../services/ventas';

const ETIQUETAS_ESTADO: Record<EstadoVenta, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  anulada: 'Eliminada',
  devuelta: 'Devuelta',
};

const ETIQUETAS_MOTIVO_DEVOLUCION: Record<MotivoDevolucion, string> = {
  producto_defectuoso: 'Producto defectuoso',
  talla_incorrecta: 'Talla incorrecta',
  arrepentimiento: 'Arrepentimiento del cliente',
  otro: 'Otro',
};

const ETIQUETAS_ESTADO_DEVOLUCION: Record<EstadoDevolucion, string> = {
  pendiente: 'Pendiente',
  procesada: 'Procesada',
  rechazada: 'Eliminada',
};

/** Estado editable en el modal de registrar devolución: una fila por línea de la venta. */
interface LineaDevolucion {
  detalle: DetalleVentaRead;
  disponible: number;
  cantidad: number;
  restaurarStock: boolean;
  /** Proveedor de este producto — texto libre, se sugiere de compras.ts. */
  idProveedor: string | null;
  /** Motivo puntual de esta línea, si difiere del motivo general de la devolución. */
  motivoLinea: MotivoDevolucion | null;
}

type Vista = 'ventas' | 'devoluciones';

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalBrandHeaderComponent],
  templateUrl: './historial-ventas.html',
  styleUrls: ['./historial-ventas.css'],
})
export class HistorialVentasComponent implements OnInit {
  constructor(
    private ventasService: VentasService,
    private authService: AuthService,
    private comprasService: ComprasService
  ) {
    this.busquedaSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.aplicarCambio();
    });
    this.busquedaDevolucionesSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.aplicarCambioDevoluciones();
    });
    this.busquedaProductoCambioSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((texto) => {
      this.ejecutarBusquedaProductoCambio(texto);
    });
  }

  // ── Selector de vista ────────────────────────────────────────────────────
  vista = signal<Vista>('ventas');
  private devolucionesYaCargadas = false;

  // ── Listado de ventas ────────────────────────────────────────────────────
  ventas = signal<VentaListItem[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  filtroEstado: EstadoVenta | '' = '';
  filtroVendedor: string | null = null;
  busqueda = '';
  fechaDesde = '';
  fechaHasta = '';
  private readonly busquedaSubject = new Subject<string>();

  /** Vendedores con ventas registradas (no "usuarios con rol X"), para poblar el filtro. */
  vendedores = signal<VendedorHistorial[]>([]);

  // ── Paginación numerada (ventas) ─────────────────────────────────────────
  readonly tamanosPagina = [10, 25, 50, 100];
  tamanoPagina = 10;
  pagina = 0;
  totalRegistros = signal(0);
  totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalRegistros() / this.tamanoPagina)));
  hayPaginaSiguiente = computed(() => this.pagina + 1 < this.totalPaginas());
  paginasVisibles = computed<(number | '…')[]>(() => paginasVisibles(this.totalPaginas(), this.pagina));

  // ── Listado de devoluciones ──────────────────────────────────────────────
  devoluciones = signal<DevolucionListItem[]>([]);
  cargandoDevoluciones = signal(true);
  errorDevoluciones = signal<string | null>(null);

  filtroEstadoDevolucion: EstadoDevolucion | '' = '';
  filtroUsuarioDevolucion: string | null = null;
  busquedaDevoluciones = '';
  fechaDesdeDevoluciones = '';
  fechaHastaDevoluciones = '';
  private readonly busquedaDevolucionesSubject = new Subject<string>();

  /** Usuarios que registraron devoluciones (no "usuarios con rol X"), para poblar el filtro. */
  usuariosDevolucion = signal<UsuarioDevolucionHistorial[]>([]);

  // ── Paginación numerada (devoluciones) ───────────────────────────────────
  tamanoPaginaDevoluciones = 10;
  paginaDevoluciones = 0;
  totalRegistrosDevoluciones = signal(0);
  totalPaginasDevoluciones = computed(() =>
    Math.max(1, Math.ceil(this.totalRegistrosDevoluciones() / this.tamanoPaginaDevoluciones))
  );
  hayPaginaSiguienteDevoluciones = computed(() => this.paginaDevoluciones + 1 < this.totalPaginasDevoluciones());
  paginasVisiblesDevoluciones = computed<(number | '…')[]>(() =>
    paginasVisibles(this.totalPaginasDevoluciones(), this.paginaDevoluciones)
  );

  // ── Modal de detalle de venta ────────────────────────────────────────────
  ventaDetalle = signal<VentaRead | null>(null);
  cargandoDetalle = signal(false);
  errorDetalle = signal<string | null>(null);

  // ── Modal de detalle de devolución ───────────────────────────────────────
  devolucionDetalle = signal<DevolucionRead | null>(null);
  cargandoDetalleDevolucion = signal(false);
  errorDetalleDevolucion = signal<string | null>(null);

  // ── Modal de eliminar venta ──────────────────────────────────────────────
  ventaAEliminar = signal<VentaListItem | null>(null);
  restaurarStock = true;
  eliminando = signal(false);
  errorEliminar = signal<string | null>(null);

  // ── Modal de eliminar (deshacer) devolución ──────────────────────────────
  devolucionAEliminar = signal<DevolucionListItem | null>(null);
  eliminandoDevolucion = signal(false);
  errorEliminarDevolucion = signal<string | null>(null);

  // ── Modal de registrar devolución ────────────────────────────────────────
  ventaADevolver = signal<VentaRead | null>(null);
  cargandoVentaADevolver = signal(false);
  lineasDevolucion: LineaDevolucion[] = [];
  motivoDevolucion: MotivoDevolucion = 'producto_defectuoso';
  notasDevolucion = '';
  registrandoDevolucion = signal(false);
  errorDevolucion = signal<string | null>(null);

  readonly motivosDevolucion: { valor: MotivoDevolucion; etiqueta: string }[] = [
    { valor: 'producto_defectuoso', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.producto_defectuoso },
    { valor: 'talla_incorrecta', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.talla_incorrecta },
    { valor: 'arrepentimiento', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.arrepentimiento },
    { valor: 'otro', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.otro },
  ];

  // ── Devolución: proveedor por línea ──────────────────────────────────────
  /** Nombres de proveedor ya usados en Compras, para sugerir en el select (más "Otro"). */
  proveedoresSugeridos = signal<string[]>([]);

  // ── Devolución: forma de reembolso ───────────────────────────────────────
  metodoReembolso: MetodoReembolso = 'efectivo';
  readonly metodosReembolso: { valor: MetodoReembolso; etiqueta: string }[] = [
    { valor: 'efectivo', etiqueta: ETIQUETAS_METODO_REEMBOLSO.efectivo },
    { valor: 'yape', etiqueta: ETIQUETAS_METODO_REEMBOLSO.yape },
    { valor: 'plin', etiqueta: ETIQUETAS_METODO_REEMBOLSO.plin },
    { valor: 'cambio_producto', etiqueta: ETIQUETAS_METODO_REEMBOLSO.cambio_producto },
  ];

  // ── Devolución: evidencias (fotos) ───────────────────────────────────────
  evidencias: string[] = [];
  errorEvidencia = '';

  // ── Devolución: cambio de producto ───────────────────────────────────────
  busquedaProductoCambio = '';
  resultadosProductoCambio = signal<ProductoPOSRead[]>([]);
  buscandoProductoCambio = signal(false);
  private readonly busquedaProductoCambioSubject = new Subject<string>();
  productosCambio: ItemCambioProducto[] = [];

  /** Valor total (S/) de los productos elegidos como cambio. */
  get totalProductosCambio(): number {
    return this.productosCambio.reduce((acc, p) => acc + p.precio_unitario * p.cantidad, 0);
  }

  /** Diferencia entre lo devuelto en S/ y el valor del producto de cambio elegido. */
  get diferenciaCambio(): number {
    return this.totalDevolucionCalculado - this.totalProductosCambio;
  }

  buscarProductoCambio(valor: string): void {
    this.busquedaProductoCambio = valor;
    this.busquedaProductoCambioSubject.next(valor);
  }

  agregarProductoCambio(p: ProductoPOSRead, variante: ProductoPOSRead['variantes'][number]): void {
    const existente = this.productosCambio.find((i) => i.id_variante === variante.id_variante);
    if (existente) {
      existente.cantidad += 1;
      return;
    }
    this.productosCambio.push({
      id_variante: variante.id_variante,
      nombre: `${p.nombre}${variante.talla ? ` (talla ${variante.talla})` : ''}`,
      talla: variante.talla,
      cantidad: 1,
      precio_unitario: p.precio_venta,
      id_ubicacion_origen: variante.id_ubicacion_origen ?? '',
    });
  }

  quitarProductoCambio(idVariante: string): void {
    this.productosCambio = this.productosCambio.filter((i) => i.id_variante !== idVariante);
  }

  onFotoEvidenciaSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.errorEvidencia = '';
    if (!archivo.type.startsWith('image/')) {
      this.errorEvidencia = 'El archivo debe ser una imagen (foto).';
      input.value = '';
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      this.evidencias = [...this.evidencias, lector.result as string];
    };
    lector.onerror = () => (this.errorEvidencia = 'No se pudo leer la imagen. Intenta nuevamente.');
    lector.readAsDataURL(archivo);
    input.value = '';
  }

  quitarEvidencia(index: number): void {
    this.evidencias = this.evidencias.filter((_, i) => i !== index);
  }

  /** Suma de lo marcado a devolver en las líneas (S/), antes de restar el producto de cambio. */
  get totalDevolucionCalculado(): number {
    return this.lineasDevolucion.reduce((acc, l) => {
      if (l.cantidad <= 0) return acc;
      const precioUnit = l.detalle.subtotal / Math.max(1, l.detalle.cantidad);
      return acc + precioUnit * l.cantidad;
    }, 0);
  }

  ngOnInit(): void {
    this.cargarVentas();
    this.ventasService.listarVendedoresDeVentas().subscribe({
      next: (vendedores) => this.vendedores.set(vendedores),
      error: () => this.vendedores.set([]),
    });
  }

  puedeEliminar(): boolean {
    return this.authService.tieneRol('dueño');
  }

  /** Registrar/eliminar una devolución usa el mismo permiso que eliminar una venta (solo Dueño). */
  puedeDevolver(): boolean {
    return this.authService.tieneRol('dueño');
  }

  get hayFiltros(): boolean {
    return !!this.filtroEstado || !!this.filtroVendedor || !!this.busqueda || !!this.fechaDesde || !!this.fechaHasta;
  }

  limpiarFiltros(): void {
    this.filtroEstado = '';
    this.filtroVendedor = null;
    this.busqueda = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.aplicarCambio();
  }

  get hayFiltrosDevoluciones(): boolean {
    return (
      !!this.filtroEstadoDevolucion ||
      !!this.filtroUsuarioDevolucion ||
      !!this.busquedaDevoluciones ||
      !!this.fechaDesdeDevoluciones ||
      !!this.fechaHastaDevoluciones
    );
  }

  limpiarFiltrosDevoluciones(): void {
    this.filtroEstadoDevolucion = '';
    this.filtroUsuarioDevolucion = null;
    this.busquedaDevoluciones = '';
    this.fechaDesdeDevoluciones = '';
    this.fechaHastaDevoluciones = '';
    this.aplicarCambioDevoluciones();
  }

  nombreCliente(v: VentaListItem): string {
    return v.nombre_cliente ?? 'Cliente genérico';
  }

  etiquetaEstado(estado: EstadoVenta): string {
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  /** Arma la URL absoluta de una foto de producto (imagen_url guarda solo la ruta relativa). */
  imagenSrc(imagenUrl: string | null): string | null {
    return imagenUrl ? `${environment.apiUrl}${imagenUrl}` : null;
  }

  etiquetaMotivoDevolucion(motivo: MotivoDevolucion): string {
    return ETIQUETAS_MOTIVO_DEVOLUCION[motivo] ?? motivo;
  }

  etiquetaMetodoReembolso(metodo: MetodoReembolso): string {
    return ETIQUETAS_METODO_REEMBOLSO[metodo] ?? metodo;
  }

  etiquetaTipoDevolucion(d: DevolucionListItem): string {
    return ETIQUETAS_TIPO_DEVOLUCION[tipoDevolucion(d)];
  }

  private ejecutarBusquedaProductoCambio(texto: string): void {
    if (!texto.trim()) {
      this.resultadosProductoCambio.set([]);
      return;
    }
    this.buscandoProductoCambio.set(true);
    this.ventasService.listarProductosPOS(null, { busqueda: texto.trim() }, 0, 10).subscribe({
      next: (resp) => {
        this.resultadosProductoCambio.set(resp.items);
        this.buscandoProductoCambio.set(false);
      },
      error: () => {
        this.resultadosProductoCambio.set([]);
        this.buscandoProductoCambio.set(false);
      },
    });
  }

  etiquetaEstadoDevolucion(estado: EstadoDevolucion): string {
    return ETIQUETAS_ESTADO_DEVOLUCION[estado] ?? estado;
  }

  fechaHora(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  iniciales(nombre: string | null): string {
    if (!nombre) return '·';
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  // ── Selector de vista ────────────────────────────────────────────────────

  cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    if (vista === 'devoluciones' && !this.devolucionesYaCargadas) {
      this.devolucionesYaCargadas = true;
      this.cargarDevoluciones();
      this.ventasService.listarUsuariosDeDevoluciones().subscribe({
        next: (usuarios) => this.usuariosDevolucion.set(usuarios),
        error: () => this.usuariosDevolucion.set([]),
      });
    }
  }

  // ── Ventas: filtros / paginación ─────────────────────────────────────────

  /** Cualquier cambio de filtro o tamaño de página reinicia a la página 0. */
  aplicarCambio(): void {
    this.pagina = 0;
    this.cargarVentas();
  }

  onFiltroEstadoChange(valor: EstadoVenta | ''): void {
    this.filtroEstado = valor;
    this.aplicarCambio();
  }

  onFiltroVendedorChange(valor: string | null): void {
    this.filtroVendedor = valor;
    this.aplicarCambio();
  }

  /** Ligado al input de búsqueda: actualiza el texto y dispara el debounce. */
  onBusquedaChange(valor: string): void {
    this.busqueda = valor;
    this.busquedaSubject.next(valor);
  }

  onFiltroFechaChange(): void {
    this.aplicarCambio();
  }

  paginaAnterior(): void {
    if (this.pagina === 0) return;
    this.pagina -= 1;
    this.cargarVentas();
  }

  paginaSiguiente(): void {
    if (!this.hayPaginaSiguiente()) return;
    this.pagina += 1;
    this.cargarVentas();
  }

  irAPagina(pagina: number): void {
    if (pagina === this.pagina + 1) return;
    this.pagina = pagina - 1;
    this.cargarVentas();
  }

  cargarVentas(): void {
    this.cargando.set(true);
    this.error.set(null);
    const filtros: FiltrosHistorialVentas = {};
    if (this.filtroEstado) filtros.estado = this.filtroEstado;
    if (this.filtroVendedor) filtros.id_usuario = this.filtroVendedor;
    if (this.busqueda.trim()) filtros.busqueda = this.busqueda.trim();
    if (this.fechaDesde) filtros.desde = `${this.fechaDesde}T00:00:00`;
    if (this.fechaHasta) filtros.hasta = `${this.fechaHasta}T23:59:59`;
    this.ventasService.listarVentas(filtros, this.pagina * this.tamanoPagina, this.tamanoPagina).subscribe({
      next: (lista) => {
        this.totalRegistros.set(lista.total);
        this.ventas.set(lista.items);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de ventas. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** Exporta los registros de la página actual (lo único que hay cargado en memoria) a Excel. */
  exportarExcel(): void {
    const filas = this.ventas().map((v) => ({
      Fecha: this.fechaHora(v.creado_en),
      Vendedor: v.nombre_vendedor || '—',
      Cliente: this.nombreCliente(v),
      Ítems: v.cantidad_items,
      Total: v.total,
      Estado: this.etiquetaEstado(v.estado),
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Ventas');
    XLSX.writeFile(libro, `ventas-pagina-${this.pagina + 1}.xlsx`);
  }

  // ── Devoluciones: filtros / paginación ───────────────────────────────────

  aplicarCambioDevoluciones(): void {
    this.paginaDevoluciones = 0;
    this.cargarDevoluciones();
  }

  onFiltroEstadoDevolucionChange(valor: EstadoDevolucion | ''): void {
    this.filtroEstadoDevolucion = valor;
    this.aplicarCambioDevoluciones();
  }

  onFiltroUsuarioDevolucionChange(valor: string | null): void {
    this.filtroUsuarioDevolucion = valor;
    this.aplicarCambioDevoluciones();
  }

  /** Ligado al input de búsqueda: actualiza el texto y dispara el debounce. */
  onBusquedaDevolucionesChange(valor: string): void {
    this.busquedaDevoluciones = valor;
    this.busquedaDevolucionesSubject.next(valor);
  }

  onFiltroFechaDevolucionesChange(): void {
    this.aplicarCambioDevoluciones();
  }

  paginaAnteriorDevoluciones(): void {
    if (this.paginaDevoluciones === 0) return;
    this.paginaDevoluciones -= 1;
    this.cargarDevoluciones();
  }

  paginaSiguienteDevoluciones(): void {
    if (!this.hayPaginaSiguienteDevoluciones()) return;
    this.paginaDevoluciones += 1;
    this.cargarDevoluciones();
  }

  irAPaginaDevoluciones(pagina: number): void {
    if (pagina === this.paginaDevoluciones + 1) return;
    this.paginaDevoluciones = pagina - 1;
    this.cargarDevoluciones();
  }

  cargarDevoluciones(): void {
    this.cargandoDevoluciones.set(true);
    this.errorDevoluciones.set(null);
    const filtros: FiltrosHistorialDevoluciones = {};
    if (this.filtroEstadoDevolucion) filtros.estado = this.filtroEstadoDevolucion;
    if (this.filtroUsuarioDevolucion) filtros.id_usuario = this.filtroUsuarioDevolucion;
    if (this.busquedaDevoluciones.trim()) filtros.busqueda = this.busquedaDevoluciones.trim();
    if (this.fechaDesdeDevoluciones) filtros.desde = `${this.fechaDesdeDevoluciones}T00:00:00`;
    if (this.fechaHastaDevoluciones) filtros.hasta = `${this.fechaHastaDevoluciones}T23:59:59`;
    this.ventasService
      .listarDevoluciones(filtros, this.paginaDevoluciones * this.tamanoPaginaDevoluciones, this.tamanoPaginaDevoluciones)
      .subscribe({
        next: (lista) => {
          this.totalRegistrosDevoluciones.set(lista.total);
          this.devoluciones.set(lista.items);
          this.cargandoDevoluciones.set(false);
        },
        error: () => {
          this.errorDevoluciones.set('No se pudo cargar el historial de devoluciones. Intenta de nuevo.');
          this.cargandoDevoluciones.set(false);
        },
      });
  }

  /** Exporta las devoluciones de la página actual a Excel. */
  exportarExcelDevoluciones(): void {
    const filas = this.devoluciones().map((d) => ({
      Fecha: this.fechaHora(d.creado_en),
      'Venta relacionada': `Venta del ${new Date(d.fecha_venta).toLocaleDateString('es-PE')} · S/${d.total_venta.toFixed(2)}`,
      Motivo: this.etiquetaMotivoDevolucion(d.motivo),
      Usuario: d.nombre_usuario || '—',
      Proveedor: d.nombre_proveedor || '—',
      'Forma de reembolso': this.etiquetaMetodoReembolso(d.metodo_reembolso),
      'Tipo de devolución': this.etiquetaTipoDevolucion(d),
      'Monto devuelto': d.total_devuelto,
      Estado: this.etiquetaEstadoDevolucion(d.estado),
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Devoluciones');
    XLSX.writeFile(libro, `devoluciones-pagina-${this.paginaDevoluciones + 1}.xlsx`);
  }

  // ── Detalle de venta ─────────────────────────────────────────────────────

  abrirDetalle(item: VentaListItem): void {
    this.ventaDetalle.set(null);
    this.errorDetalle.set(null);
    this.cargandoDetalle.set(true);
    this.ventasService.obtenerVenta(item.id_venta).subscribe({
      next: (venta) => {
        this.ventaDetalle.set(venta);
        this.cargandoDetalle.set(false);
      },
      error: () => {
        this.errorDetalle.set('No se pudo cargar el detalle de esta venta.');
        this.cargandoDetalle.set(false);
      },
    });
  }

  cerrarDetalle(): void {
    this.ventaDetalle.set(null);
    this.errorDetalle.set(null);
  }

  totalPagos(venta: VentaRead): number {
    return venta.pagos.reduce((acc, p) => acc + p.monto, 0);
  }

  // ── Detalle de devolución ────────────────────────────────────────────────

  abrirDetalleDevolucion(item: DevolucionListItem): void {
    this.devolucionDetalle.set(null);
    this.errorDetalleDevolucion.set(null);
    this.cargandoDetalleDevolucion.set(true);
    this.ventasService.obtenerDevolucion(item.id_devolucion).subscribe({
      next: (devolucion) => {
        this.devolucionDetalle.set(devolucion);
        this.cargandoDetalleDevolucion.set(false);
      },
      error: () => {
        this.errorDetalleDevolucion.set('No se pudo cargar el detalle de esta devolución.');
        this.cargandoDetalleDevolucion.set(false);
      },
    });
  }

  cerrarDetalleDevolucion(): void {
    this.devolucionDetalle.set(null);
    this.errorDetalleDevolucion.set(null);
  }

  // ── Eliminar venta ───────────────────────────────────────────────────────

  abrirEliminar(item: VentaListItem): void {
    this.ventaAEliminar.set(item);
    this.restaurarStock = true;
    this.errorEliminar.set(null);
  }

  cerrarEliminar(): void {
    if (this.eliminando()) return;
    this.ventaAEliminar.set(null);
  }

  confirmarEliminar(): void {
    const venta = this.ventaAEliminar();
    if (!venta) return;
    this.eliminando.set(true);
    this.errorEliminar.set(null);
    this.ventasService
      .eliminarVenta(venta.id_venta, { restaurar_stock: this.restaurarStock })
      .subscribe({
        next: () => {
          this.eliminando.set(false);
          this.ventaAEliminar.set(null);
          this.cargarVentas();
        },
        error: (err) => {
          this.eliminando.set(false);
          this.errorEliminar.set(err?.error?.detail ?? 'No se pudo eliminar la venta.');
        },
      });
  }

  // ── Eliminar (deshacer) devolución ───────────────────────────────────────

  abrirEliminarDevolucion(item: DevolucionListItem): void {
    this.devolucionAEliminar.set(item);
    this.errorEliminarDevolucion.set(null);
  }

  cerrarEliminarDevolucion(): void {
    if (this.eliminandoDevolucion()) return;
    this.devolucionAEliminar.set(null);
  }

  confirmarEliminarDevolucion(): void {
    const devolucion = this.devolucionAEliminar();
    if (!devolucion) return;
    this.eliminandoDevolucion.set(true);
    this.errorEliminarDevolucion.set(null);
    this.ventasService
      .eliminarDevolucion(devolucion.id_devolucion)
      .subscribe({
        next: () => {
          this.eliminandoDevolucion.set(false);
          this.devolucionAEliminar.set(null);
          this.cargarDevoluciones();
        },
        error: (err) => {
          this.eliminandoDevolucion.set(false);
          this.errorEliminarDevolucion.set(err?.error?.detail ?? 'No se pudo eliminar la devolución.');
        },
      });
  }

  // ── Registrar devolución ─────────────────────────────────────────────────

  /**
   * Pide el detalle completo de la venta (para conocer cantidad_devuelta
   * por línea) y arma una fila editable por cada línea activa.
   */
  abrirDevolucion(item: VentaListItem): void {
    this.ventaADevolver.set(null);
    this.lineasDevolucion = [];
    this.motivoDevolucion = 'producto_defectuoso';
    this.notasDevolucion = '';
    this.metodoReembolso = 'efectivo';
    this.evidencias = [];
    this.errorEvidencia = '';
    this.productosCambio = [];
    this.busquedaProductoCambio = '';
    this.resultadosProductoCambio.set([]);
    this.errorDevolucion.set(null);
    this.cargandoVentaADevolver.set(true);

    this.proveedoresSugeridos.set(
      Array.from(new Set(this.comprasService.obtenerResumenProveedores().map((p) => p.proveedor)))
    );

    this.ventasService.obtenerVenta(item.id_venta).subscribe({
      next: (venta) => {
        this.ventaADevolver.set(venta);
        this.lineasDevolucion = venta.detalles.map((detalle) => ({
          detalle,
          disponible: detalle.cantidad - detalle.cantidad_devuelta,
          cantidad: 0,
          restaurarStock: true,
          idProveedor: null,
          motivoLinea: null,
        }));
        this.cargandoVentaADevolver.set(false);
      },
      error: () => {
        this.errorDevolucion.set('No se pudo cargar la venta para registrar la devolución.');
        this.cargandoVentaADevolver.set(false);
      },
    });
  }

  cerrarDevolucion(): void {
    if (this.registrandoDevolucion()) return;
    this.ventaADevolver.set(null);
    this.lineasDevolucion = [];
    this.productosCambio = [];
    this.evidencias = [];
  }

  cambiarCantidadDevolucion(linea: LineaDevolucion, valor: number): void {
    const cantidad = Math.max(0, Math.min(valor || 0, linea.disponible));
    linea.cantidad = cantidad;
  }

  confirmarDevolucion(): void {
    const venta = this.ventaADevolver();
    if (!venta) return;

    const items = this.lineasDevolucion
      .filter((l) => l.cantidad > 0)
      .map((l) => ({
        id_detalle_venta: l.detalle.id_detalle_venta,
        cantidad: l.cantidad,
        restaurar_stock: l.restaurarStock,
        id_proveedor: l.idProveedor,
        motivo_linea: l.motivoLinea,
      }));

    if (items.length === 0) {
      this.errorDevolucion.set('Indica al menos una cantidad a devolver en alguna línea.');
      return;
    }

    if (this.metodoReembolso === 'cambio_producto' && this.productosCambio.length === 0) {
      this.errorDevolucion.set('Elige al menos un producto de cambio, o cambia la forma de reembolso.');
      return;
    }

    this.registrandoDevolucion.set(true);
    this.errorDevolucion.set(null);
    this.ventasService
      .registrarDevolucion(venta.id_venta, {
        motivo: this.motivoDevolucion,
        notas: this.notasDevolucion.trim() || null,
        items,
        metodo_reembolso: this.metodoReembolso,
        evidencias: this.evidencias,
        ...(this.metodoReembolso === 'cambio_producto'
          ? { productos_cambio: this.productosCambio, monto_efectivo_ajuste: this.diferenciaCambio }
          : {}),
      })
      .subscribe({
        next: () => {
          this.registrandoDevolucion.set(false);
          this.ventaADevolver.set(null);
          this.lineasDevolucion = [];
          this.productosCambio = [];
          this.evidencias = [];
          this.cargarVentas();
          this.devolucionesYaCargadas = false; // refresca la próxima vez que se abra la pestaña
          // Si el detalle de esta venta está abierto, refresca para ver el nuevo total.
          if (this.ventaDetalle()?.id_venta === venta.id_venta) {
            this.abrirDetalle({ id_venta: venta.id_venta } as VentaListItem);
          }
        },
        error: (err) => {
          this.registrandoDevolucion.set(false);
          this.errorDevolucion.set(err?.error?.detail ?? 'No se pudo registrar la devolución.');
        },
      });
  }
}

/** Números de página a mostrar, con "…" cuando hay demasiadas para listarlas todas (compartido ventas/devoluciones). */
function paginasVisibles(total: number, paginaActualCero: number): (number | '…')[] {
  const actual = paginaActualCero + 1; // 1-based para mostrar
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set<number>([1, total, actual - 1, actual, actual + 1]);
  const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const resultado: (number | '…')[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (anterior && p - anterior > 1) resultado.push('…');
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}
