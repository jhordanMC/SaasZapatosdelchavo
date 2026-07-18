import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Categoria, Producto, ProductosService, Sexo } from '../../../services/productos';
import { AuthService } from '../../../core/auth';
import { ItemCarrito, MetodoPago, requiereComprobante, TipoDescuento, VentasService } from '../../../services/ventas';

const CATEGORIAS: (Categoria | 'Todos')[] = ['Todos', 'Deportivos', 'Casuales', 'Formales', 'Botines', 'Sandalias', 'Escolares', 'Textiles'];

/** Tamaño máximo permitido para fotos adjuntas (comprobantes / fotos de venta), en bytes. */
const MAX_FOTO_BYTES = 6 * 1024 * 1024; // 6MB

type PasoCheckout = 'formulario' | 'confirmar' | 'exito';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
})
export class VentasComponent {
  productosSignal;

  constructor(
    private productosService: ProductosService,
    public ventasService: VentasService,
    private authService: AuthService
  ) {
    this.productosSignal = this.productosService.getProductos();
  }

  categorias = CATEGORIAS;
  filtroCategoria: Categoria | 'Todos' = 'Todos';
  filtroSexo: Sexo | 'Todos' = 'Todos';
  filtroTalla = 'Todas';
  busqueda = '';

  showVariantePicker: Producto | null = null;
  varianteSeleccionadaId = '';
  cantidadSeleccionada = 1;
  descuentoSeleccionado = 0;
  tipoDescuentoSeleccionado: TipoDescuento = 'producto';

  editandoVarianteId: string | null = null;
  edicionCantidad = 1;
  edicionDescuento = 0;
  edicionTipoDescuento: TipoDescuento = 'producto';

  fotoVentaUrl: string | null = null;
  errorFoto = '';

  pasoCheckout: PasoCheckout = 'formulario';
  showCheckout = false;
  metodoPago: MetodoPago = 'efectivo';
  montoPagado = 0;
  checkoutError = '';
  ventaConfirmada: { total: number; vuelto: number } | null = null;

  get tallasDisponibles(): string[] {
    const set = new Set<string>();
    for (const p of this.productosSignal()) {
      for (const v of p.variantes) set.add(v.talla);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  get productos(): Producto[] {
    return this.productosSignal().filter((p) => {
      if (this.busqueda && !p.nombre.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      if (this.filtroCategoria !== 'Todos' && p.categoria !== this.filtroCategoria) return false;
      if (this.filtroSexo !== 'Todos' && p.sexo !== this.filtroSexo) return false;
      if (this.filtroTalla !== 'Todas' && !p.variantes.some((v) => v.talla === this.filtroTalla)) return false;
      return true;
    });
  }

  toggleSexo(valor: Sexo): void {
    this.filtroSexo = this.filtroSexo === valor ? 'Todos' : valor;
  }

  get hayFiltrosActivos(): boolean {
    return !!(this.busqueda || this.filtroCategoria !== 'Todos' || this.filtroSexo !== 'Todos' || this.filtroTalla !== 'Todas');
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroCategoria = 'Todos';
    this.filtroSexo = 'Todos';
    this.filtroTalla = 'Todas';
  }

  stockTotal(p: Producto): number {
    return this.productosService.stockTotal(p);
  }

  abrirSelectorVariante(p: Producto): void {
    this.showVariantePicker = p;
    this.varianteSeleccionadaId = p.variantes[0]?.id ?? '';
    this.cantidadSeleccionada = 1;
    this.descuentoSeleccionado = 0;
    this.tipoDescuentoSeleccionado = 'producto';
  }

  cerrarSelectorVariante(): void {
    this.showVariantePicker = null;
  }

  confirmarAgregado(): void {
    const p = this.showVariantePicker;
    if (!p) return;
    const variante = p.variantes.find((v) => v.id === this.varianteSeleccionadaId);
    if (!variante || variante.stock < this.cantidadSeleccionada) return;

    const item: ItemCarrito = {
      productoId: p.id,
      varianteId: variante.id,
      nombre: `${p.nombre} (talla ${variante.talla})`,
      talla: variante.talla,
      fotoUrl: p.fotoUrl,
      precioUnitario: p.precioVenta,
      cantidad: this.cantidadSeleccionada,
      descuento: this.descuentoSeleccionado,
      tipoDescuento: this.tipoDescuentoSeleccionado,
    };
    this.ventasService.agregarAlCarrito(item);
    this.showVariantePicker = null;
  }

  quitarDelCarrito(varianteId: string): void {
    this.ventasService.quitarDelCarrito(varianteId);
    if (this.editandoVarianteId === varianteId) this.editandoVarianteId = null;
  }

  totalItem(item: ItemCarrito): number {
    return this.ventasService.totalItem(item);
  }

  iniciarEdicion(item: ItemCarrito): void {
    this.editandoVarianteId = item.varianteId;
    this.edicionCantidad = item.cantidad;
    this.edicionDescuento = item.descuento;
    this.edicionTipoDescuento = item.tipoDescuento;
  }

  cancelarEdicion(): void {
    this.editandoVarianteId = null;
  }

  guardarEdicion(item: ItemCarrito): void {
    if (this.edicionCantidad < 1) return;
    this.ventasService.editarItemCarrito(item.varianteId, {
      cantidad: this.edicionCantidad,
      descuento: this.edicionDescuento,
      tipoDescuento: this.edicionTipoDescuento,
    });
    this.editandoVarianteId = null;
  }

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
    lector.onload = () => {
      this.fotoVentaUrl = lector.result as string;
    };
    lector.onerror = () => {
      this.errorFoto = 'No se pudo leer la imagen. Intenta nuevamente.';
    };
    lector.readAsDataURL(archivo);
    input.value = '';
  }

  quitarFotoVenta(): void {
    this.fotoVentaUrl = null;
  }

  get requiereFotoComprobante(): boolean {
    return requiereComprobante(this.metodoPago);
  }

  get vueltoEstimado(): number {
    if (this.metodoPago !== 'efectivo') return 0;
    return Math.max(0, this.montoPagado - this.totalCarrito);
  }

  get totalCarrito(): number {
    return this.ventasService.totalCarrito();
  }

  /** Ítems del carrito, usados para mostrar las fotos de los productos en el checkout. */
  get itemsCarrito(): ItemCarrito[] {
    return this.ventasService.carrito();
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
  }

  cerrarCheckout(): void {
    this.showCheckout = false;
    this.ventaConfirmada = null;
  }

  /** Valida los datos del método de pago y pasa a la pantalla de confirmación final. */
  irAConfirmar(): void {
    this.checkoutError = '';

    if (this.metodoPago === 'efectivo' && this.montoPagado < this.totalCarrito) {
      this.checkoutError = 'El monto pagado es menor al total. Verifica el importe recibido.';
      return;
    }
    if (this.requiereFotoComprobante && !this.fotoVentaUrl) {
      this.checkoutError = 'Adjunta la foto de la transacción/transferencia para continuar.';
      return;
    }

    this.pasoCheckout = 'confirmar';
  }

  volverAFormulario(): void {
    this.pasoCheckout = 'formulario';
    this.checkoutError = '';
  }

  /** Confirmación final: aquí sí se descuenta stock y se registra la venta. */
  confirmarVenta(): void {
    this.checkoutError = '';
    const vendedor = this.authService.usuarioActual()?.nombre ?? 'vendedor';
    try {
      const venta = this.ventasService.confirmarVenta(this.metodoPago, this.montoPagado, vendedor, this.fotoVentaUrl);
      this.ventaConfirmada = { total: venta.total, vuelto: venta.vuelto };
      this.pasoCheckout = 'exito';
      this.fotoVentaUrl = null;
    } catch (e) {
      this.checkoutError = e instanceof Error ? e.message : 'No se pudo registrar la venta.';
      this.pasoCheckout = 'formulario';
    }
  }

  cerrarTodo(): void {
    this.showCheckout = false;
    this.pasoCheckout = 'formulario';
    this.ventaConfirmada = null;
    this.fotoVentaUrl = null;
    this.errorFoto = '';
  }
}
