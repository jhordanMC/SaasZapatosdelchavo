import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Categoria, Producto, ProductosService, Sexo } from '../../../services/productos';
import { AuthService } from '../../../core/auth';
import { ItemCarrito, MetodoPago, VentasService } from '../../../services/ventas';

const CATEGORIAS: (Categoria | 'Todos')[] = ['Todos', 'Deportivos', 'Casuales', 'Formales', 'Botines', 'Sandalias', 'Escolares', 'Textiles'];

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
  busqueda = '';

  showVariantePicker: Producto | null = null;
  varianteSeleccionadaId = '';
  cantidadSeleccionada = 1;
  descuentoSeleccionado = 0;

  showCheckout = false;
  metodoPago: MetodoPago = 'efectivo';
  montoPagado = 0;
  checkoutError = '';
  ventaConfirmada: { total: number; vuelto: number } | null = null;

  get productos(): Producto[] {
    return this.productosSignal().filter((p) => {
      if (this.busqueda && !p.nombre.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      if (this.filtroCategoria !== 'Todos' && p.categoria !== this.filtroCategoria) return false;
      if (this.filtroSexo !== 'Todos' && p.sexo !== this.filtroSexo) return false;
      return true;
    });
  }

  stockTotal(p: Producto): number {
    return this.productosService.stockTotal(p);
  }

  abrirSelectorVariante(p: Producto): void {
    this.showVariantePicker = p;
    this.varianteSeleccionadaId = p.variantes[0]?.id ?? '';
    this.cantidadSeleccionada = 1;
    this.descuentoSeleccionado = 0;
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
      precioUnitario: p.precioVenta,
      cantidad: this.cantidadSeleccionada,
      descuento: this.descuentoSeleccionado,
    };
    this.ventasService.agregarAlCarrito(item);
    this.showVariantePicker = null;
  }

  quitarDelCarrito(varianteId: string): void {
    this.ventasService.quitarDelCarrito(varianteId);
  }

  get totalCarrito(): number {
    return this.ventasService.totalCarrito();
  }

  abrirCheckout(): void {
    if (this.ventasService.carrito().length === 0) return;
    this.showCheckout = true;
    this.montoPagado = this.totalCarrito;
    this.checkoutError = '';
  }

  cerrarCheckout(): void {
    this.showCheckout = false;
    this.ventaConfirmada = null;
  }

  confirmarVenta(): void {
    if (this.metodoPago === 'efectivo' && this.montoPagado < this.totalCarrito) {
      this.checkoutError = 'El monto pagado es menor al total.';
      return;
    }
    const vendedor = this.authService.usuarioActual()?.nombre ?? 'vendedor';
    const venta = this.ventasService.confirmarVenta(this.metodoPago, this.montoPagado, vendedor);
    this.ventaConfirmada = { total: venta.total, vuelto: venta.vuelto };
  }

  cerrarTodo(): void {
    this.showCheckout = false;
    this.ventaConfirmada = null;
  }
}
