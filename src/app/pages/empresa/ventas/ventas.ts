/**
 * Componente de Ventas — POS (vista empresa).
 *
 * Conectado al backend a través de VentasService (HTTP).
 * El carrito se gestiona localmente (sin endpoint intermedio).
 *
 * Flujo:
 *   1. Init: listarMisLocales() → obtiene idLocal del vendedor.
 *   2. Con idLocal: listarProductosPOS() → carga catálogo.
 *   3. Filtros: aplican localmente sobre el catálogo cargado.
 *   4. Clic en producto: abre modal de talla/cantidad/descuento.
 *   5. "Agregar al carrito": actualiza signal local.
 *   6. "Completar venta": abre checkout modal.
 *   7. Confirmar: buildVentaPayload() + POST /ventas/pos/confirmar.
 */
import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalBrandHeaderComponent } from '../../../shared/modal-brand-header/modal-brand-header';
import { SexoProducto } from '../../../services/inventario';
import {
  FiltrosPOS,
  ItemCarrito,
  LocalPOSRead,
  MetodoPago,
  PagoCreate,
  ProductoPOSRead,
  TipoDescuento,
  VariantePOSRead,
  VentaRead,
  VentasService,
  requiereComprobante,
} from '../../../services/ventas';

const MAX_FOTO_BYTES = 6 * 1024 * 1024; // 6 MB

type PasoCheckout = 'formulario' | 'confirmar' | 'exito';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalBrandHeaderComponent],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
})
export class VentasComponent implements OnInit {
  constructor(public ventasService: VentasService) {}

  @ViewChild('carritoVueloDestino') carritoVueloDestinoRef?: ElementRef<HTMLElement>;

  // ── Datos del backend ────────────────────────────────────────────────────
  locales = signal<LocalPOSRead[]>([]);
  productos = signal<ProductoPOSRead[]>([]);

  /** Local activo del vendedor en esta sesión POS. */
  localActivo = signal<LocalPOSRead | null>(null);

  // ── Estado de UI ─────────────────────────────────────────────────────────
  cargando = signal(true);
  cargandoProductos = signal(false);
  error = signal<string | null>(null);

  // ── Filtros del catálogo POS (locales) ───────────────────────────────────
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
  varianteSeleccionadaId = '';
  cantidadSeleccionada = 1;
  descuentoSeleccionado = 0;
  tipoDescuentoSeleccionado: TipoDescuento = 'producto';
  private origenVueloEl: HTMLElement | null = null;

  // ── Edición de ítem en carrito ───────────────────────────────────────────
  editandoVarianteId: string | null = null;
  edicionCantidad = 1;
  edicionDescuento = 0;
  edicionTipoDescuento: TipoDescuento = 'producto';

  // ── Checkout ─────────────────────────────────────────────────────────────
  pasoCheckout: PasoCheckout = 'formulario';
  showCheckout = false;
  metodoPago: MetodoPago = 'efectivo';
  montoPagado = 0;
  fotoVentaUrl: string | null = null;
  errorFoto = '';
  checkoutError = '';
  ventaConfirmada: VentaRead | null = null;
  confirmando = false;

  // ── Micro-interacciones ──────────────────────────────────────────────────
  justAddedProductoId: string | null = null;
  badgeBump = false;
  removingVarianteId: string | null = null;
  qtyPulseModal = false;
  qtyPulseEdicion = false;
  totalPulse = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargando.set(true);
    this.ventasService.listarMisLocales().subscribe({
      next: (locales) => {
        this.locales.set(locales);
        if (locales.length > 0) {
          this.localActivo.set(locales[0]);
          this.cargarProductosPOS();
        } else {
          this.error.set('No tienes locales asignados. Contacta al administrador.');
          this.cargando.set(false);
        }
      },
      error: () => {
        this.error.set('No se pudieron cargar los locales. Verifica tu conexión.');
        this.cargando.set(false);
      },
    });
  }

  cambiarLocal(idLocal: string): void {
    const local = this.locales().find((l) => l.id_local === idLocal);
    if (local) {
      this.localActivo.set(local);
      this.cargarProductosPOS();
    }
  }

  private cargarProductosPOS(): void {
    const local = this.localActivo();
    if (!local) return;

    this.cargandoProductos.set(true);
    const filtros: FiltrosPOS = {};
    if (this.busqueda) filtros.busqueda = this.busqueda;
    if (this.filtroIdCategoria) filtros.id_categoria = this.filtroIdCategoria;
    if (this.filtroSexo) filtros.sexo = this.filtroSexo;

    this.ventasService.listarProductosPOS(local.id_local, filtros).subscribe({
      next: (prods) => {
        this.productos.set(prods);
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

  // ── Filtros (locales + búsqueda server-side al aplicar) ──────────────────

  get productosFiltrados(): ProductoPOSRead[] {
    const busq = this.busqueda.toLowerCase().trim();
    return this.productos().filter((p) => {
      if (busq && !p.nombre.toLowerCase().includes(busq)) return false;
      if (this.filtroSexo && p.sexo !== this.filtroSexo) return false;
      if (
        this.filtroTalla !== 'Todas' &&
        !p.variantes.some((v) => v.talla === this.filtroTalla)
      )
        return false;
      return true;
    });
  }

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
  }

  get hayFiltrosActivos(): boolean {
    return !!(this.busqueda || this.filtroSexo || this.filtroTalla !== 'Todas');
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroSexo = null;
    this.filtroTalla = 'Todas';
    this.filtroIdCategoria = null;
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
    return p.stock_total;
  }

  // ── Modal selector de variante ───────────────────────────────────────────

  abrirSelectorVariante(p: ProductoPOSRead, event?: MouseEvent): void {
    this.origenVueloEl = (event?.currentTarget as HTMLElement) ?? null;
    this.showVariantePicker = p;
    const primeraVariante = p.variantes[0];
    this.varianteSeleccionadaId = primeraVariante?.id_variante ?? '';
    this.cantidadSeleccionada = 1;
    this.descuentoSeleccionado = 0;
    this.tipoDescuentoSeleccionado = 'producto';
  }

  cerrarSelectorVariante(): void {
    this.showVariantePicker = null;
  }

  get varianteSeleccionada(): VariantePOSRead | undefined {
    return this.showVariantePicker?.variantes.find(
      (v) => v.id_variante === this.varianteSeleccionadaId
    );
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

  confirmarAgregado(): void {
    const p = this.showVariantePicker;
    const variante = this.varianteSeleccionada;
    const local = this.localActivo();
    if (!p || !variante) return;
    if (this.cantidadSeleccionada < 1) return;
    if (variante.stock_disponible < this.cantidadSeleccionada) return;
    if (!local) {
      this.error.set('No hay un local activo seleccionado. Recarga la página e intenta de nuevo.');
      return;
    }

    const item: ItemCarrito = {
      varianteId: variante.id_variante,
      productoId: p.id_producto,
      nombre: `${p.nombre} (talla ${variante.talla ?? variante.sku})`,
      talla: variante.talla,
      fotoUrl: null,
      precioUnitario: p.precio_venta,
      cantidad: this.cantidadSeleccionada,
      descuentoMonto: this.descuentoSeleccionado,
      tipoDescuento: this.tipoDescuentoSeleccionado,
      idLocal: local.id_local,
      nombreLocal: local.nombre,
    };
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
    this.editandoVarianteId = item.varianteId;
    this.edicionCantidad = item.cantidad;
    this.edicionDescuento = item.descuentoMonto;
    this.edicionTipoDescuento = item.tipoDescuento;
  }

  cancelarEdicion(): void {
    this.editandoVarianteId = null;
  }

  guardarEdicion(item: ItemCarrito): void {
    if (this.edicionCantidad < 1) return;
    this.ventasService.editarItemCarrito(item.varianteId, {
      cantidad: this.edicionCantidad,
      descuentoMonto: this.edicionDescuento,
      tipoDescuento: this.edicionTipoDescuento,
    });
    this.editandoVarianteId = null;
    this.pulseTotal();
  }

  // ── Cantidad: steppers +/- (modal y edición inline) ─────────────────────

  incrementarCantidadModal(): void {
    const max = this.varianteSeleccionada?.stock_disponible ?? 1;
    if (this.cantidadSeleccionada >= max) return;
    this.cantidadSeleccionada++;
    this.pulseQty('modal');
  }

  decrementarCantidadModal(): void {
    if (this.cantidadSeleccionada <= 1) return;
    this.cantidadSeleccionada--;
    this.pulseQty('modal');
  }

  incrementarEdicion(): void {
    this.edicionCantidad++;
    this.pulseQty('edicion');
  }

  decrementarEdicion(): void {
    if (this.edicionCantidad <= 1) return;
    this.edicionCantidad--;
    this.pulseQty('edicion');
  }

  private pulseQty(cual: 'modal' | 'edicion'): void {
    if (cual === 'modal') {
      this.qtyPulseModal = false;
      setTimeout(() => (this.qtyPulseModal = true), 0);
      setTimeout(() => (this.qtyPulseModal = false), 220);
    } else {
      this.qtyPulseEdicion = false;
      setTimeout(() => (this.qtyPulseEdicion = true), 0);
      setTimeout(() => (this.qtyPulseEdicion = false), 220);
    }
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
    if (!archivo.type.startsWith('image/')) {
      this.errorFoto = 'El archivo debe ser una imagen (foto).';
      input.value = '';
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      this.errorFoto = 'La imagen es muy pesada. Usa una foto de menos de 6MB.';
      input.value = '';
      return;
    }
    const lector = new FileReader();
    lector.onload = () => (this.fotoVentaUrl = lector.result as string);
    lector.onerror = () => (this.errorFoto = 'No se pudo leer la imagen. Intenta nuevamente.');
    lector.readAsDataURL(archivo);
    input.value = '';
  }

  quitarFotoVenta(): void {
    this.fotoVentaUrl = null;
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  get requiereFotoComprobante(): boolean {
    return requiereComprobante(this.metodoPago);
  }

  get vueltoEstimado(): number {
    if (this.metodoPago !== 'efectivo') return 0;
    return Math.max(0, this.montoPagado - this.totalCarrito);
  }

  abrirCheckout(): void {
    if (this.ventasService.carrito().length === 0) return;
    this.pasoCheckout = 'formulario';
    this.showCheckout = true;
    this.metodoPago = 'efectivo';
    this.montoPagado = this.totalCarrito;
    this.checkoutError = '';
    this.errorFoto = '';
    this.fotoVentaUrl = null;
    this.ventaConfirmada = null;
  }

  cerrarCheckout(): void {
    this.showCheckout = false;
    this.ventaConfirmada = null;
    this.confirmando = false;
  }

  irAConfirmar(): void {
    this.checkoutError = '';
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
    const local = this.localActivo();
    if (!local) return;

    this.checkoutError = '';
    this.confirmando = true;

    // Construir payload de pago
    const pago: PagoCreate = {
      metodo: this.metodoPago,
      monto: this.totalCarrito,
      ...(this.metodoPago === 'efectivo'
        ? { monto_recibido: this.montoPagado }
        : {}),
    };

    const payload = this.ventasService.buildVentaPayload(local.id_local, [pago]);

    this.ventasService.confirmarVenta(payload).subscribe({
      next: (venta) => {
        this.ventaConfirmada = venta;
        this.pasoCheckout = 'exito';
        this.confirmando = false;
        this.fotoVentaUrl = null;
        // Vaciar carrito tras venta exitosa
        this.ventasService.vaciarCarrito();
        // Refrescar catálogo para actualizar stock visible
        this.cargarProductosPOS();
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
  }
}
