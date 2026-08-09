/**
 * Componente de Ventas — POS (vista empresa).
 *
 * Conectado al backend a través de VentasService (HTTP).
 * El carrito se gestiona localmente (sin endpoint intermedio).
 *
 * Catálogo paginado por el servidor (scroll infinito), ordenado por
 * ranking (recientes de las últimas 2 semanas + más vendidos primero).
 * Todos los filtros (búsqueda con debounce, categoría, sexo, talla, sede)
 * se resuelven en el backend — no hay filtro en memoria.
 *
 * Flujo:
 *   1. Init: listarSedes() → obtiene la sede del vendedor.
 *   2. Con sede: cargarPrimeraPaginaProductosPOS() → carga la página 1.
 *   3. Cualquier filtro reinicia la paginación y pide la página 1 de nuevo.
 *   4. Scroll infinito: IntersectionObserver sobre un sentinel pide la
 *      siguiente página y la anexa.
 *   5. Clic en producto: abre modal de talla/cantidad/descuento.
 *   6. "Agregar al carrito": actualiza signal local.
 *   7. "Completar venta": abre checkout modal.
 *   8. Confirmar: buildVentaPayload() + POST /ventas/pos/confirmar.
 */
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ModalBrandHeaderComponent } from '../../../shared/modal-brand-header/modal-brand-header';
import { environment } from '../../../../environments/environment';
import { esArchivoDeImagen, esPrevisualizableEnNavegador } from '../../../utils/validar-imagen';
import { SexoProducto } from '../../../services/inventario';
import { ComprasService } from '../../../services/compras';
import {
  DetalleVentaRead,
  FiltrosPOS,
  ItemCarrito,
  MotivoDevolucion,
  SedePOSRead,
  VentaCreate,
  VentaListItem,
  VentaRead,
  MetodoPago,
  PagoCreate,
  ProductoPOSRead,
  ProductosPOSPaginados,
  TipoDescuento,
  VariantePOSRead,
  VentasService,
  requiereComprobante,
} from '../../../services/ventas';

type PasoCheckout = 'formulario' | 'confirmar' | 'exito';

/** Una línea de pago dentro del checkout mixto (varios métodos en una sola venta). */
interface LineaPagoMixto {
  metodo: MetodoPago;
  monto: number;
  /** Solo si metodo === 'efectivo': lo que el cliente entrega en físico (para calcular vuelto de esa línea). */
  montoRecibido: number;
  fotoUrl: string | null;
  /** false = el navegador no puede pintar una preview de este archivo (HEIC/DNG en la mayoría) — se muestra un placeholder en vez de <img>. */
  fotoPrevisualizable: boolean;
  errorFoto: string;
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalBrandHeaderComponent],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
})
export class VentasComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(public ventasService: VentasService, private comprasService: ComprasService) {
    // Debounce de 300ms: espera a que el usuario deje de teclear antes de
    // pedir la página 1 al backend con el nuevo texto de búsqueda.
    this.busquedaSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.cargarPrimeraPaginaProductosPOS();
    });
    this.busquedaDevolucionVentaSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((texto) => {
      this.ejecutarBusquedaVentaADevolver(texto);
    });
  }

  @ViewChild('carritoVueloDestino') carritoVueloDestinoRef?: ElementRef<HTMLElement>;
  @ViewChild('sentinelaInfiniteScrollPOS') private sentinelaRef?: ElementRef<HTMLElement>;
  private observerScroll?: IntersectionObserver;

  // ── Datos del backend ────────────────────────────────────────────────────
  sedes = signal<SedePOSRead[]>([]);
  productos = signal<ProductoPOSRead[]>([]);

  /** Sede seleccionada en el filtro (puede ser Local o Almacén) */
  sedeFiltro = signal<SedePOSRead | null>(null);

  // ── Estado de UI ─────────────────────────────────────────────────────────
  cargando = signal(true);
  cargandoProductos = signal(false);
  error = signal<string | null>(null);

  // ── Paginación del catálogo POS (scroll infinito) ────────────────────────
  private offset = 0;
  hayMasProductos = signal(true);
  private readonly busquedaSubject = new Subject<string>();

  // ── Filtros del catálogo POS (resueltos en el backend) ───────────────────
  busqueda = '';
  filtroIdCategoria: string | null = null;
  filtroSexo: SexoProducto | null = null;
  filtroTalla = 'Todas';

  readonly sexosDisponibles: { valor: SexoProducto; label: string }[] = [
    { valor: 'hombre', label: 'Hombre' },
    { valor: 'mujer', label: 'Mujer' },
    { valor: 'unisex', label: 'Unisex' },
    { valor: 'nino', label: 'Niño' },
  ];

  // ── Modal de selección de variante ──────────────────────────────────────
  showVariantePicker: ProductoPOSRead | null = null;
  tallaModalActiva: string | null = null;
  ubicacionModalActiva: string | null = null;
  cantidadSeleccionada = 1;
  descuentoSeleccionado = 0;
  tipoDescuentoSeleccionado: 'producto' | 'unidad' = 'producto';
  private origenVueloEl: HTMLElement | null = null;

  // ── Edición de ítem en carrito ───────────────────────────────────────────
  editandoVarianteId: string | null = null;

  // ── Checkout ─────────────────────────────────────────────────────────────
  pasoCheckout: PasoCheckout = 'formulario';
  showCheckout = false;
  cajaSeleccionadaId: string | null = null;
  get localesSoloCaja(): SedePOSRead[] {
    return this.sedes().filter(s => s.tipo === 'local');
  }

  get nombreCajaSeleccionada(): string {
    if (!this.cajaSeleccionadaId) return '';
    const caja = this.localesSoloCaja.find(c => c.id_sede === this.cajaSeleccionadaId);
    return caja ? caja.nombre : '';
  }
  metodoPago: MetodoPago = 'efectivo';
  montoPagado = 0;
  fotoVentaUrl: string | null = null;
  /** false = el navegador no puede pintar una preview de este archivo (HEIC/DNG en la mayoría) — se muestra un placeholder en vez de <img>. */
  fotoVentaPrevisualizable = true;
  errorFoto = '';

  // ── Pago mixto (varios métodos en una sola venta) ────────────────────────
  pagoMixto = false;
  pagosDivididos: LineaPagoMixto[] = [];
  readonly metodosPagoMixto: { valor: MetodoPago; etiqueta: string }[] = [
    { valor: 'efectivo', etiqueta: 'Efectivo' },
    { valor: 'yape', etiqueta: 'Yape' },
    { valor: 'plin', etiqueta: 'Plin' },
    { valor: 'transferencia', etiqueta: 'Transferencia' },
  ];
  checkoutError = '';
  ventaConfirmada: VentaRead | null = null;
  confirmando = false;

  // ── Micro-interacciones ──────────────────────────────────────────────────
  justAddedProductoId: string | null = null;
  badgeBump = false;
  removingVarianteId: string | null = null;
  totalPulse = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargando.set(true);
    this.ventasService.listarSedes().subscribe({
      next: (sedes) => {
        this.sedes.set(sedes);
        if (sedes.length > 0) {
          // Por defecto, mantenemos Todas las sedes (null) para mostrar todo el catálogo global.
          // this.sedeFiltro.set(sedes[0]);

          // Preselecciona la caja si solo hay un local disponible
          const locales = sedes.filter(s => s.tipo === 'local');
          if (locales.length === 1) {
            this.cajaSeleccionadaId = locales[0].id_sede;
          } else if (locales.length > 1) {
            this.cajaSeleccionadaId = locales[0].id_sede; // Valor por defecto
          }

          this.cargarPrimeraPaginaProductosPOS();
        } else {
          this.error.set('No tienes sedes asignadas. Contacta al administrador.');
          this.cargando.set(false);
        }
      },
      error: () => {
        this.error.set('No se pudieron cargar las sedes. Verifica tu conexión.');
        this.cargando.set(false);
      },
    });
  }

  cambiarSede(idSede: string): void {
    if (idSede === 'todos') {
      this.sedeFiltro.set(null);
    } else {
      const sede = this.sedes().find((s) => s.id_sede === idSede);
      if (sede) this.sedeFiltro.set(sede);
    }
    this.cargarPrimeraPaginaProductosPOS();
  }

  // ── Paginación del catálogo POS (scroll infinito) ────────────────────────

  /** Reinicia la paginación (offset 0, lista vacía) y pide la página 1 con los filtros actuales. */
  cargarPrimeraPaginaProductosPOS(): void {
    this.cargarPaginaProductosPOS(true);
  }

  /** Pide la siguiente página con los mismos filtros y la anexa al final de la lista. */
  cargarSiguientePaginaProductosPOS(): void {
    this.cargarPaginaProductosPOS(false);
  }

  private cargarPaginaProductosPOS(reiniciar: boolean): void {
    if (reiniciar) {
      this.offset = 0;
      this.productos.set([]);
      this.hayMasProductos.set(true);
    }
    if (!this.hayMasProductos() || this.cargandoProductos()) return;

    const sede = this.sedeFiltro();
    this.cargandoProductos.set(true);
    this.error.set(null);

    const filtros: FiltrosPOS = {};
    if (this.busqueda) filtros.busqueda = this.busqueda;
    if (this.filtroIdCategoria) filtros.id_categoria = this.filtroIdCategoria;
    if (this.filtroSexo) filtros.sexo = this.filtroSexo;
    if (this.filtroTalla !== 'Todas') filtros.talla = this.filtroTalla;

    this.ventasService.listarProductosPOS(sede ? sede.id_sede : null, filtros, this.offset).subscribe({
      next: (resp: ProductosPOSPaginados) => {
        this.productos.update((lista) => [...lista, ...resp.items]);
        this.hayMasProductos.set(resp.hay_mas);
        this.offset = resp.siguiente_offset;
        this.cargandoProductos.set(false);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos.');
        this.cargandoProductos.set(false);
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
          this.cargarSiguientePaginaProductosPOS();
        }
      },
      { rootMargin: '200px' }
    );
    this.observerScroll.observe(this.sentinelaRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.observerScroll?.disconnect();
  }

  // ── Filtros (búsqueda con debounce; el resto dispara de inmediato) ──────

  /** Ligado al input de búsqueda: actualiza el texto y dispara el debounce. */
  onBusquedaChange(valor: string): void {
    this.busqueda = valor;
    this.busquedaSubject.next(valor);
  }

  onFiltroTallaChange(valor: string): void {
    this.filtroTalla = valor;
    this.cargarPrimeraPaginaProductosPOS();
  }

  /**
   * Tallas conocidas para poblar el select — se derivan de lo ya cargado
   * en `productos()`, no de todo el catálogo. Con paginación, esto puede
   * no mostrar tallas que existan más adelante en páginas no cargadas
   * todavía; es un trade-off aceptado por ahora (se resolvería con un
   * endpoint aparte de "tallas distintas del catálogo" si llega a molestar).
   */
  get tallasDisponibles(): string[] {
    const set = new Set<string>();
    for (const p of this.productos()) {
      for (const v of p.variantes) {
        if (v.talla) set.add(v.talla);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  toggleSexo(valor: SexoProducto): void {
    this.filtroSexo = this.filtroSexo === valor ? null : valor;
    this.cargarPrimeraPaginaProductosPOS();
  }

  get hayFiltrosActivos(): boolean {
    return !!(this.busqueda || this.filtroSexo || this.filtroTalla !== 'Todas');
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroSexo = null;
    this.filtroTalla = 'Todas';
    this.filtroIdCategoria = null;
    this.cargarPrimeraPaginaProductosPOS();
  }

  // ── Carrito ─────────────────────────────────────────────────────────────

  get itemsCarrito(): ItemCarrito[] {
    return this.ventasService.carrito();
  }

  get totalCarrito(): number {
    return this.ventasService.totalCarrito();
  }

  totalItem(item: ItemCarrito): number {
    return this.ventasService.totalItem(item);
  }

  stockProducto(p: ProductoPOSRead): number {
    const idSede = this.sedeFiltro() ? this.sedeFiltro()!.id_sede : null;
    let total = 0;
    for (const v of p.variantes) {
      if (idSede) {
        if (v.id_ubicacion_origen === idSede) {
           total += v.stock_disponible;
        }
      } else {
        total += v.stock_disponible;
      }
    }
    return total;
  }

  stockEnCarrito(p: ProductoPOSRead): number {
    const idSede = this.sedeFiltro() ? this.sedeFiltro()!.id_sede : null;
    let total = 0;
    for (const item of this.ventasService.carrito()) {
      if (item.productoId === p.id_producto) {
        if (idSede) {
          if (item.idUbicacionOrigen === idSede) total += item.cantidad;
        } else {
          total += item.cantidad;
        }
      }
    }
    return total;
  }

  /** Arma la URL absoluta de una foto de producto (imagen_url guarda solo la ruta relativa). */
  imagenSrc(imagenUrl: string | null): string | null {
    return imagenUrl ? `${environment.apiUrl}${imagenUrl}` : null;
  }

  // ── Modal selector de variante ───────────────────────────────────────────

  abrirSelectorVariante(p: ProductoPOSRead, event?: MouseEvent): void {
    this.origenVueloEl = (event?.currentTarget as HTMLElement) ?? null;
    this.showVariantePicker = p;

    const globalTalla = this.filtroTalla !== 'Todas' ? this.filtroTalla : null;
    const globalSede = this.sedeFiltro() ? this.sedeFiltro()!.id_sede : null;

    let preTalla = globalTalla;
    let preUbi = globalSede;

    // Validar si los filtros globales tienen stock
    if (preTalla && !p.variantes.some(v => v.talla === preTalla && this.stockDisponibleReal(v) > 0)) {
        preTalla = null;
    }
    if (preUbi && !p.variantes.some(v => v.id_ubicacion_origen === preUbi && this.stockDisponibleReal(v) > 0)) {
        preUbi = null;
    }

    if (preTalla && preUbi) {
       if (!p.variantes.some(v => v.talla === preTalla && v.id_ubicacion_origen === preUbi && this.stockDisponibleReal(v) > 0)) {
           preTalla = null;
       }
    }

    this.tallaModalActiva = preTalla;
    this.ubicacionModalActiva = preUbi;

    this.cantidadSeleccionada = 1;
    this.descuentoSeleccionado = 0;
    this.tipoDescuentoSeleccionado = 'producto';
    this.errorTalla = null;
    this.errorUbicacion = null;
    this.errorCantidad = null;

    this.actualizarOpcionesModal();
  }

  cerrarSelectorVariante(): void {
    this.showVariantePicker = null;
    this.editandoVarianteId = null;
  }

  get varianteSeleccionada(): VariantePOSRead | undefined {
    if (!this.tallaModalActiva || !this.ubicacionModalActiva) return undefined;
    return this.showVariantePicker?.variantes.find(
      (v) => v.talla === this.tallaModalActiva && v.id_ubicacion_origen === this.ubicacionModalActiva
    );
  }

  _opcionesTallaModal: { talla: string, label: string }[] = [];
  _opcionesUbicacionModal: { id: string, label: string }[] = [];

  stockDisponibleReal(v: VariantePOSRead): number {
    let enCarrito = 0;
    const itemEnCarrito = this.ventasService.carrito().find(i => i.varianteId === v.id_variante);
    if (itemEnCarrito && this.editandoVarianteId !== v.id_variante) enCarrito = itemEnCarrito.cantidad;
    return v.stock_disponible - enCarrito;
  }

  actualizarOpcionesModal() {
    if (!this.showVariantePicker) {
      this._opcionesTallaModal = [];
      this._opcionesUbicacionModal = [];
      return;
    }

    let varsTalla = this.showVariantePicker.variantes;
    if (this.ubicacionModalActiva) {
        varsTalla = varsTalla.filter(v => v.id_ubicacion_origen === this.ubicacionModalActiva && this.stockDisponibleReal(v) > 0);
    } else {
        varsTalla = varsTalla.filter(v => this.stockDisponibleReal(v) > 0);
    }
    const set = new Set<string>();
    for (const v of varsTalla) {
       if (v.talla) set.add(v.talla);
    }
    this._opcionesTallaModal = Array.from(set).map(talla => ({
       talla,
       label: talla
    })).sort((a, b) => a.talla.localeCompare(b.talla, undefined, { numeric: true }));

    let varsUbi = this.showVariantePicker.variantes;
    if (this.tallaModalActiva) {
        varsUbi = varsUbi.filter(v => v.talla === this.tallaModalActiva && this.stockDisponibleReal(v) > 0);
    } else {
        varsUbi = varsUbi.filter(v => this.stockDisponibleReal(v) > 0);
    }
    const map = new Map<string, string>();
    for (const v of varsUbi) {
       if (v.id_ubicacion_origen) map.set(v.id_ubicacion_origen, v.nombre_ubicacion || 'Sede');
    }
    this._opcionesUbicacionModal = Array.from(map.entries()).map(([id, nombre]) => ({
       id,
       label: nombre
    })).sort((a, b) => a.label.localeCompare(b.label));
  }

  alCambiarTallaModal(talla: string | null) {
    if (talla === 'null') talla = null;
    this.tallaModalActiva = talla;
    this.errorTalla = null;
    if (talla && this.ubicacionModalActiva) {
       const isValid = this.showVariantePicker?.variantes.some(v => v.talla === talla && v.id_ubicacion_origen === this.ubicacionModalActiva && this.stockDisponibleReal(v) > 0);
       if (!isValid) {
           this.ubicacionModalActiva = null;
       }
    }
    this.actualizarOpcionesModal();
    this.validarCantidadModal();
  }

  alCambiarUbicacionModal(idUbi: string | null) {
    if (idUbi === 'null') idUbi = null;
    this.ubicacionModalActiva = idUbi;
    this.errorUbicacion = null;
    if (idUbi && this.tallaModalActiva) {
       const isValid = this.showVariantePicker?.variantes.some(v => v.talla === this.tallaModalActiva && v.id_ubicacion_origen === idUbi && this.stockDisponibleReal(v) > 0);
       if (!isValid) {
           this.tallaModalActiva = null;
       }
    }
    this.actualizarOpcionesModal();
    this.validarCantidadModal();
  }

  get textoDescripcionDescuento(): string {
    if (this.descuentoSeleccionado <= 0) return '';
    const v = this.varianteSeleccionada;
    if (!v) return '';
    if (this.tipoDescuentoSeleccionado === 'producto') {
      return `Se descuenta S/${this.descuentoSeleccionado} una sola vez del total de esta línea.`;
    }
    return `Se descuenta S/${this.descuentoSeleccionado} × ${this.cantidadSeleccionada} = S/${
      this.descuentoSeleccionado * this.cantidadSeleccionada
    } del total de esta línea.`;
  }

  get subtotalModal(): number {
    if (!this.showVariantePicker) return 0;
    const precio = Number(this.showVariantePicker.precio_venta) || 0;
    const descuento = Number(this.descuentoSeleccionado) || 0;

    let totalDescuento = descuento;
    if (this.tipoDescuentoSeleccionado === 'unidad') {
       totalDescuento = descuento * this.cantidadSeleccionada;
    }

    const sub = (precio * this.cantidadSeleccionada) - totalDescuento;
    return sub > 0 ? sub : 0;
  }

  errorTalla: string | null = null;
  errorUbicacion: string | null = null;
  errorCantidad: string | null = null;

  confirmarAgregado(): void {
    this.errorTalla = null;
    this.errorUbicacion = null;
    this.errorCantidad = null;

    let hasError = false;

    if (!this.tallaModalActiva) {
      this.errorTalla = 'Falta seleccionar talla';
      hasError = true;
    }
    if (!this.ubicacionModalActiva) {
      this.errorUbicacion = 'Falta seleccionar sede';
      hasError = true;
    }
    // Eliminamos el return temprano para que siga y valide la cantidad
    const p = this.showVariantePicker;
    if (!p) return;

    this.validarCantidadModal();
    if (this.errorCantidad) {
      hasError = true;
    }

    if (hasError) return;

    const variante = this.varianteSeleccionada;
    if (!variante) return;

    let totalDescuento = this.descuentoSeleccionado;
    if (this.tipoDescuentoSeleccionado === 'unidad') {
      totalDescuento = this.descuentoSeleccionado * this.cantidadSeleccionada;
    }

    if (!variante.id_ubicacion_origen) {
      this.error.set('La variante seleccionada no tiene origen de stock.');
      return;
    }

    const item: ItemCarrito = {
      varianteId: variante.id_variante,
      productoId: p.id_producto,
      nombre: `${p.nombre} (talla ${variante.talla ?? variante.sku})`,
      talla: variante.talla,
      fotoUrl: p.imagen_url,
      precioUnitario: p.precio_venta,
      cantidad: this.cantidadSeleccionada,
      descuentoMonto: this.descuentoSeleccionado,
      tipoDescuento: this.tipoDescuentoSeleccionado,
      idUbicacionOrigen: variante.id_ubicacion_origen,
      nombreUbicacion: variante.nombre_ubicacion ?? 'Sede',
      stockMaximo: variante.stock_disponible,
    };

    if (this.editandoVarianteId) {
      if (this.editandoVarianteId === variante.id_variante) {
        this.ventasService.editarItemCarrito(variante.id_variante, {
          cantidad: this.cantidadSeleccionada,
          descuentoMonto: this.descuentoSeleccionado,
          tipoDescuento: this.tipoDescuentoSeleccionado
        });
      } else {
        this.ventasService.quitarDelCarrito(this.editandoVarianteId);
        this.ventasService.agregarAlCarrito(item);
      }
      this.editandoVarianteId = null;
      this.showVariantePicker = null;
      this.pulseTotal();
      return;
    }

    this.ventasService.agregarAlCarrito(item);
    this.showVariantePicker = null;
    this.dispararFeedbackAgregado(p.id_producto);
    this.dispararVueloAlCarrito();
  }

  quitarDelCarrito(varianteId: string): void {
    this.removingVarianteId = varianteId;
    setTimeout(() => {
      this.ventasService.quitarDelCarrito(varianteId);
      if (this.editandoVarianteId === varianteId) this.editandoVarianteId = null;
      this.removingVarianteId = null;
      this.pulseTotal();
    }, 220);
  }

  // ── Edición inline de ítem en carrito ────────────────────────────────────

  iniciarEdicion(item: ItemCarrito): void {
    const p = this.productos().find(x => x.id_producto === item.productoId);
    if (!p) return;

    this.editandoVarianteId = item.varianteId;
    this.origenVueloEl = null;
    
    this.showVariantePicker = p;
    this.tallaModalActiva = item.talla ?? null;
    this.ubicacionModalActiva = item.idUbicacionOrigen ?? null;
    
    this.cantidadSeleccionada = item.cantidad;
    this.descuentoSeleccionado = item.descuentoMonto;
    this.tipoDescuentoSeleccionado = item.tipoDescuento;
    
    this.errorTalla = null;
    this.errorUbicacion = null;
    this.errorCantidad = null;

    this.actualizarOpcionesModal();
    this.validarCantidadModal();
  }

  // ── Cantidad: se escribe directamente como texto plano ──────────────────

  validarCantidadModal(): void {
    const p = this.showVariantePicker;
    if (!p) return;

    let maxDisp = 0;
    if (this.varianteSeleccionada) {
      let enCarrito = 0;
      const itemEnCarrito = this.ventasService.carrito().find(i => i.varianteId === this.varianteSeleccionada!.id_variante);
      if (itemEnCarrito && this.editandoVarianteId !== this.varianteSeleccionada!.id_variante) {
        enCarrito = itemEnCarrito.cantidad;
      }
      maxDisp = this.varianteSeleccionada.stock_disponible - enCarrito;
    } else {
      let variantesFiltradas = p.variantes;
      
      if (this.tallaModalActiva) {
        variantesFiltradas = variantesFiltradas.filter(v => v.talla === this.tallaModalActiva);
      }
      if (this.ubicacionModalActiva) {
        variantesFiltradas = variantesFiltradas.filter(v => v.id_ubicacion_origen === this.ubicacionModalActiva);
      }

      for (const v of variantesFiltradas) {
        let enCarrito = 0;
        const itemEnCarrito = this.ventasService.carrito().find(i => i.varianteId === v.id_variante);
        if (itemEnCarrito && this.editandoVarianteId !== v.id_variante) enCarrito = itemEnCarrito.cantidad;
        maxDisp += Math.max(0, v.stock_disponible - enCarrito);
      }
    }

    if (this.cantidadSeleccionada > maxDisp) {
      this.cantidadSeleccionada = maxDisp;
      this.errorCantidad = `Solo hay ${maxDisp} unid. disp.`;
    } else {
      this.errorCantidad = null;
    }
  }

  /** Escribir la cantidad directamente como texto plano (ya no hay botones +/-). */
  onCantidadModalInput(valor: string): void {
    let n = parseInt(valor, 10);
    if (isNaN(n) || n < 1) n = 1;
    this.cantidadSeleccionada = n;
    this.errorCantidad = null;
  }


  // ── Feedback visual: agregar al carrito / total ──────────────────────────

  private dispararFeedbackAgregado(idProducto: string): void {
    this.justAddedProductoId = idProducto;
    this.badgeBump = false;
    setTimeout(() => (this.badgeBump = true), 0);
    this.pulseTotal();
    setTimeout(() => {
      this.justAddedProductoId = null;
      this.badgeBump = false;
    }, 900);
  }

  /**
   * Animación de "vuelo al carrito": clona la miniatura del producto que
   * realmente tocaste (no un ícono genérico) y la anima con la Web
   * Animations API en un arco suave hasta el carrito, a un ritmo pausado
   * (no un salto rápido), encogiéndose y desvaneciéndose al llegar. Cuando
   * aterriza, el panel del carrito reacciona con un rebote.
   */
  private dispararVueloAlCarrito(): void {
    const origen = this.origenVueloEl;
    const destinoEl = this.carritoVueloDestinoRef?.nativeElement;
    if (!origen || !destinoEl) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Clona la miniatura real de la tarjeta tocada (hoy es el placeholder
    // "Sin foto"; cuando el catálogo tenga fotos reales, esto mismo clonará
    // la imagen del producto sin cambios adicionales).
    const miniaturaOrigen = origen.querySelector<HTMLElement>('.venta-foto') ?? origen;
    const rectOrigen = miniaturaOrigen.getBoundingClientRect();
    const rectDestino = destinoEl.getBoundingClientRect();

    const clon = miniaturaOrigen.cloneNode(true) as HTMLElement;
    clon.classList.add('vuelo-carrito-clon');
    clon.style.width = `${rectOrigen.width}px`;
    clon.style.height = `${rectOrigen.height}px`;
    clon.style.left = `${rectOrigen.left}px`;
    clon.style.top = `${rectOrigen.top}px`;
    document.body.appendChild(clon);

    const dx = rectDestino.left + rectDestino.width / 2 - (rectOrigen.left + rectOrigen.width / 2);
    const dy = rectDestino.top + rectDestino.height / 2 - (rectOrigen.top + rectOrigen.height / 2);

    // Duración pausada (no un salto brusco): ~1.1s con un arco amplio.
    const animacion = clon.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy - 90}px) scale(0.75)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.3 },
      ],
      { duration: 1100, easing: 'cubic-bezier(0.33, 0.1, 0.35, 1)', fill: 'forwards' }
    );

    animacion.onfinish = () => {
      clon.remove();
      this.rebotarCarrito();
    };
    setTimeout(() => clon.remove(), 1300); // red de seguridad si onfinish no dispara
  }

  /** El panel del carrito "rebota" al recibir un producto (además del bump del contador). */
  private rebotarCarrito(): void {
    const panel = this.carritoVueloDestinoRef?.nativeElement.closest('.carrito-panel') as HTMLElement | null;
    if (!panel) return;
    panel.classList.remove('carrito-rebote');
    // Reflow para forzar que la animación se pueda re-disparar en agregados seguidos.
    void panel.offsetWidth;
    panel.classList.add('carrito-rebote');
  }

  private pulseTotal(): void {
    this.totalPulse = false;
    setTimeout(() => (this.totalPulse = true), 0);
    setTimeout(() => (this.totalPulse = false), 300);
  }

  // ── Foto de comprobante ──────────────────────────────────────────────────

  onFotoVentaSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.errorFoto = '';
    if (!esArchivoDeImagen(archivo)) {
      this.errorFoto = 'El archivo debe ser una imagen (foto).';
      input.value = '';
      return;
    }
    this.fotoVentaPrevisualizable = esPrevisualizableEnNavegador(archivo);
    const lector = new FileReader();
    lector.onload = () => (this.fotoVentaUrl = lector.result as string);
    lector.onerror = () => (this.errorFoto = 'No se pudo leer la imagen. Intenta nuevamente.');
    lector.readAsDataURL(archivo);
    input.value = '';
  }

  quitarFotoVenta(): void {
    this.fotoVentaUrl = null;
    this.fotoVentaPrevisualizable = true;
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  get requiereFotoComprobante(): boolean {
    return requiereComprobante(this.metodoPago);
  }

  get vueltoEstimado(): number {
    if (this.metodoPago !== 'efectivo') return 0;
    return Math.max(0, this.montoPagado - this.totalCarrito);
  }

  // ── Pago mixto (varios métodos en una sola venta) ────────────────────────
  // Ej: S/1000 en efectivo + S/500 en Yape para completar una venta de S/1500.
  // El backend ya soporta un arreglo de pagos por venta (VentaCreate.pagos);
  // esto solo activa esa capacidad desde la UI, con su propia validación.

  activarPagoMixto(): void {
    this.pagoMixto = true;
    // Arranca con una sola línea prellenada por el total, para que el
    // usuario solo tenga que ajustar montos y agregar la(s) línea(s) que falten.
    this.pagosDivididos = [
      { metodo: 'efectivo', monto: this.totalCarrito, montoRecibido: this.totalCarrito, fotoUrl: null, fotoPrevisualizable: true, errorFoto: '' },
    ];
    this.checkoutError = '';
  }

  desactivarPagoMixto(): void {
    this.pagoMixto = false;
    this.pagosDivididos = [];
    this.checkoutError = '';
  }

  agregarLineaPago(): void {
    const usados = new Set(this.pagosDivididos.map((l) => l.metodo));
    const siguienteMetodo = this.metodosPagoMixto.find((m) => !usados.has(m.valor))?.valor ?? 'efectivo';
    this.pagosDivididos.push({
      metodo: siguienteMetodo,
      monto: Math.max(0, this.saldoPendientePagoMixto),
      montoRecibido: Math.max(0, this.saldoPendientePagoMixto),
      fotoUrl: null,
      fotoPrevisualizable: true,
      errorFoto: '',
    });
  }

  quitarLineaPago(index: number): void {
    this.pagosDivididos.splice(index, 1);
  }

  cambiarMetodoLinea(linea: LineaPagoMixto, metodo: MetodoPago): void {
    linea.metodo = metodo;
    linea.errorFoto = '';
    if (metodo !== 'efectivo') linea.fotoUrl = null;
  }

  actualizarMontoLinea(linea: LineaPagoMixto, valor: number): void {
    linea.monto = Math.max(0, valor || 0);
    if (linea.metodo === 'efectivo' && linea.montoRecibido < linea.monto) {
      linea.montoRecibido = linea.monto;
    }
  }

  vueltoLinea(linea: LineaPagoMixto): number {
    if (linea.metodo !== 'efectivo') return 0;
    return Math.max(0, linea.montoRecibido - linea.monto);
  }

  requiereFotoLinea(linea: LineaPagoMixto): boolean {
    return requiereComprobante(linea.metodo);
  }

  onFotoLineaSeleccionada(linea: LineaPagoMixto, event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    linea.errorFoto = '';
    if (!esArchivoDeImagen(archivo)) {
      linea.errorFoto = 'El archivo debe ser una imagen (foto).';
      input.value = '';
      return;
    }
    linea.fotoPrevisualizable = esPrevisualizableEnNavegador(archivo);
    const lector = new FileReader();
    lector.onload = () => (linea.fotoUrl = lector.result as string);
    lector.onerror = () => (linea.errorFoto = 'No se pudo leer la imagen. Intenta nuevamente.');
    lector.readAsDataURL(archivo);
    input.value = '';
  }

  quitarFotoLinea(linea: LineaPagoMixto): void {
    linea.fotoUrl = null;
    linea.fotoPrevisualizable = true;
  }

  /** Suma de lo asignado en las líneas de pago mixto. */
  get totalAsignadoPagoMixto(): number {
    return this.pagosDivididos.reduce((acc, l) => acc + (l.monto || 0), 0);
  }

  /** Positivo = falta asignar; negativo = se pasó del total; 0 = cuadra exacto. */
  get saldoPendientePagoMixto(): number {
    return Math.round((this.totalCarrito - this.totalAsignadoPagoMixto) * 100) / 100;
  }

  get pagoMixtoCuadraExacto(): boolean {
    return Math.abs(this.saldoPendientePagoMixto) < 0.005;
  }

  /** Válido para continuar: cuadra exacto, al menos 2 métodos distintos, montos > 0 y comprobantes donde corresponda. */
  get pagoMixtoValido(): boolean {
    if (this.pagosDivididos.length < 2) return false;
    if (!this.pagoMixtoCuadraExacto) return false;
    return this.pagosDivididos.every(
      (l) => l.monto > 0 && (!this.requiereFotoLinea(l) || !!l.fotoUrl)
    );
  }

  abrirCheckout(): void {
    if (this.ventasService.carrito().length === 0) return;
    if (this.localesSoloCaja.length === 0) {
      this.error.set('No tienes cajas (locales) asignadas para registrar la venta.');
      setTimeout(() => this.error.set(null), 4000);
      return;
    }
    this.pasoCheckout = 'formulario';
    this.showCheckout = true;
    this.metodoPago = 'efectivo';
    this.montoPagado = this.totalCarrito;
    this.checkoutError = '';
    this.errorFoto = '';
    this.fotoVentaUrl = null;
    this.ventaConfirmada = null;
    this.pagoMixto = false;
    this.pagosDivididos = [];
  }

  cerrarCheckout(): void {
    this.showCheckout = false;
    this.ventaConfirmada = null;
    this.confirmando = false;
  }

  irAConfirmar(): void {
    this.checkoutError = '';

    if (this.pagoMixto) {
      if (this.pagosDivididos.length < 2) {
        this.checkoutError = 'Agrega al menos 2 métodos de pago, o desactiva el pago dividido.';
        return;
      }
      if (!this.pagoMixtoCuadraExacto) {
        this.checkoutError =
          this.saldoPendientePagoMixto > 0
            ? `Falta asignar S/${this.saldoPendientePagoMixto.toFixed(2)} del total.`
            : `Te pasaste por S/${Math.abs(this.saldoPendientePagoMixto).toFixed(2)}. Ajusta los montos.`;
        return;
      }
      const lineaSinFoto = this.pagosDivididos.find((l) => this.requiereFotoLinea(l) && !l.fotoUrl);
      if (lineaSinFoto) {
        this.checkoutError = `Adjunta la foto del comprobante de ${lineaSinFoto.metodo}.`;
        return;
      }
      this.pasoCheckout = 'confirmar';
      return;
    }

    if (this.metodoPago === 'efectivo' && this.montoPagado < this.totalCarrito) {
      this.checkoutError = 'El monto pagado es menor al total. Verifica el importe recibido.';
      return;
    }
    if (this.requiereFotoComprobante && !this.fotoVentaUrl) {
      this.checkoutError = 'Adjunta la foto del comprobante para continuar.';
      return;
    }
    this.pasoCheckout = 'confirmar';
  }

  volverAFormulario(): void {
    this.pasoCheckout = 'formulario';
    this.checkoutError = '';
  }

  /** Envía el carrito al backend y registra la venta. */
  confirmarVenta(): void {
    if (!this.cajaSeleccionadaId) {
      this.checkoutError = 'Por favor, selecciona la caja de cobro (Local) antes de confirmar la venta.';
      return;
    }

    this.checkoutError = '';
    this.confirmando = true;

    // Construir payload de pago(s) — uno solo, o varios si es pago mixto.
    const pagos: PagoCreate[] = this.pagoMixto
      ? this.pagosDivididos.map((l) => ({
          metodo: l.metodo,
          monto: l.monto,
          ...(l.metodo === 'efectivo' ? { monto_recibido: l.montoRecibido } : {}),
          ...(l.fotoUrl ? { foto_comprobante: l.fotoUrl } : {}),
        }))
      : [
          {
            metodo: this.metodoPago,
            monto: this.totalCarrito,
            ...(this.metodoPago === 'efectivo' ? { monto_recibido: this.montoPagado } : {}),
            ...(this.fotoVentaUrl ? { foto_comprobante: this.fotoVentaUrl } : {}),
          },
        ];

    const payload = this.ventasService.buildVentaPayload(this.cajaSeleccionadaId, pagos);

    this.ventasService.confirmarVenta(payload).subscribe({
      next: (venta) => {
        this.ventaConfirmada = venta;
        this.pasoCheckout = 'exito';
        this.confirmando = false;
        this.fotoVentaUrl = null;
        this.pagoMixto = false;
        this.pagosDivididos = [];
        // Vaciar carrito tras venta exitosa
        this.ventasService.vaciarCarrito();
        // Refrescar catálogo para actualizar stock visible
        this.cargarPrimeraPaginaProductosPOS();
      },
      error: (err) => {
        this.checkoutError =
          err?.error?.detail ?? 'No se pudo registrar la venta. Intenta nuevamente.';
        this.pasoCheckout = 'formulario';
        this.confirmando = false;
      },
    });
  }

  cerrarTodo(): void {
    this.showCheckout = false;
    this.pasoCheckout = 'formulario';
    this.ventaConfirmada = null;
    this.fotoVentaUrl = null;
    this.errorFoto = '';
    this.confirmando = false;
    this.pagoMixto = false;
    this.pagosDivididos = [];
  }

  // ══════════════════════════════════════════════════════════════════════
  // Devoluciones — accesible desde el botón "Devoluciones" del POS.
  //
  // Flujo: 1) buscar la venta (folio/cliente) → 2) elegir líneas y cantidad
  // → 3) motivo + proveedor + evidencias → 4) forma de reembolso (si es
  // cambio de producto, elegir el/los reemplazo(s) del mismo catálogo POS).
  // Reutiliza los mismos endpoints que el flujo de Historial de Ventas.
  // ══════════════════════════════════════════════════════════════════════

  // ── Paso 1: buscar la venta a devolver ───────────────────────────────────
  showBuscadorDevolucion = false;
  busquedaDevolucionVenta = '';
  private readonly busquedaDevolucionVentaSubject = new Subject<string>();
  resultadosDevolucionVenta = signal<VentaListItem[]>([]);
  buscandoDevolucionVenta = signal(false);

  abrirBuscadorDevolucion(): void {
    this.showBuscadorDevolucion = true;
    this.busquedaDevolucionVenta = '';
    this.resultadosDevolucionVenta.set([]);
    this.ventaADevolver = null;
  }

  cerrarBuscadorDevolucion(): void {
    this.showBuscadorDevolucion = false;
  }

  buscarVentaADevolver(valor: string): void {
    this.busquedaDevolucionVenta = valor;
    this.busquedaDevolucionVentaSubject.next(valor);
  }

  private ejecutarBusquedaVentaADevolver(texto: string): void {
    if (!texto.trim()) {
      this.resultadosDevolucionVenta.set([]);
      return;
    }
    this.buscandoDevolucionVenta.set(true);
    this.ventasService.listarVentas({ estado: 'pagada', busqueda: texto.trim() }, 0, 15).subscribe({
      next: (lista) => {
        this.resultadosDevolucionVenta.set(lista);
        this.buscandoDevolucionVenta.set(false);
      },
      error: () => {
        this.resultadosDevolucionVenta.set([]);
        this.buscandoDevolucionVenta.set(false);
      },
    });
  }

  // ── Paso 2: elegir la venta → editar líneas + resto del formulario ───────
  ventaADevolver: VentaRead | null = null;
  cargandoVentaADevolver = signal(false);
  lineasDevolucion: {
    detalle: DetalleVentaRead;
    disponible: number;
    cantidad: number;
    restaurarStock: boolean;
  }[] = [];

  motivoDevolucion: MotivoDevolucion = 'producto_defectuoso';
  readonly motivosDevolucion: { valor: MotivoDevolucion; etiqueta: string }[] = [
    { valor: 'producto_defectuoso', etiqueta: 'Producto defectuoso' },
    { valor: 'talla_incorrecta', etiqueta: 'Talla incorrecta' },
    { valor: 'arrepentimiento', etiqueta: 'Arrepentimiento del cliente' },
    { valor: 'otro', etiqueta: 'Otro' },
  ];
  notasDevolucion = '';

  busquedaProductoCambio = '';
  resultadosProductoCambio = signal<ProductoPOSRead[]>([]);
  buscandoProductoCambio = signal(false);
  productosCambio: { id_variante: string; nombre: string; talla: string | null; cantidad: number; precio_unitario: number; id_ubicacion_origen: string }[] = [];

  registrandoDevolucion = signal(false);
  errorDevolucion = signal<string | null>(null);
  devolucionRegistradaOk = signal(false);

  elegirVentaADevolver(item: VentaListItem): void {
    this.showBuscadorDevolucion = false;
    this.cargandoVentaADevolver.set(true);
    this.lineasDevolucion = [];
    this.motivoDevolucion = 'producto_defectuoso';
    this.notasDevolucion = '';
    this.productosCambio = [];
    this.busquedaProductoCambio = '';
    this.resultadosProductoCambio.set([]);
    this.errorDevolucion.set(null);


    this.ventasService.obtenerVenta(item.id_venta).subscribe({
      next: (venta) => {
        this.ventaADevolver = venta;
        this.lineasDevolucion = venta.detalles.map((detalle) => ({
          detalle,
          disponible: detalle.cantidad - detalle.cantidad_devuelta,
          cantidad: 0,
          restaurarStock: true,
        }));
        this.cargandoVentaADevolver.set(false);
      },
      error: () => {
        this.errorDevolucion.set('No se pudo cargar la venta seleccionada.');
        this.cargandoVentaADevolver.set(false);
      },
    });
  }

  volverABuscadorDevolucion(): void {
    this.ventaADevolver = null;
    this.showBuscadorDevolucion = true;
  }

  cerrarDevolucionPOS(): void {
    if (this.registrandoDevolucion()) return;
    this.showBuscadorDevolucion = false;
    this.ventaADevolver = null;
    this.lineasDevolucion = [];
    this.productosCambio = [];
    this.productosCambio = [];
    this.busquedaProductoCambio = '';
    this.resultadosProductoCambio.set([]);
  }

  cambiarCantidadDevolucion(linea: (typeof this.lineasDevolucion)[number], valor: number): void {
    linea.cantidad = Math.max(0, Math.min(valor || 0, linea.disponible));
  }





  confirmarDevolucionPOS(): void {
    const venta = this.ventaADevolver;
    if (!venta) return;

    const items = this.lineasDevolucion
      .filter((l) => l.cantidad > 0)
      .map((l) => ({
        id_detalle_venta: l.detalle.id_detalle_venta,
        cantidad: l.cantidad,
        restaurar_stock: l.restaurarStock,
      }));

    if (items.length === 0) {
      this.errorDevolucion.set('Indica al menos una cantidad a devolver en alguna línea.');
      return;
    }

    this.registrandoDevolucion.set(true);
    this.errorDevolucion.set(null);
    this.ventasService
      .registrarDevolucion(venta.id_venta, {
        motivo: this.motivoDevolucion,
        notas: this.notasDevolucion.trim() || null,
        items,
      })
      .subscribe({
        next: () => {
          this.registrandoDevolucion.set(false);
          this.ventaADevolver = null;
          this.lineasDevolucion = [];
          this.productosCambio = [];

          this.devolucionRegistradaOk.set(true);
          setTimeout(() => this.devolucionRegistradaOk.set(false), 3500);
          // Refresca el catálogo por si la devolución restauró stock visible.
          this.cargarPrimeraPaginaProductosPOS();
        },
        error: (err) => {
          this.registrandoDevolucion.set(false);
          this.errorDevolucion.set(err?.error?.detail ?? 'No se pudo registrar la devolución.');
        },
      });
  }
}