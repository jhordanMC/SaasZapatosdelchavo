import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductosService } from '../../../services/productos';
import { VentasService } from '../../../services/ventas';
import { FinanzasService } from '../../../services/finanzas';

@Component({
  selector: 'app-empresa-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class EmpresaDashboardComponent {
  constructor(
    private productosService: ProductosService,
    public ventasService: VentasService,
    public finanzasService: FinanzasService
  ) {}

  get productos() {
    return this.productosService.getProductos()();
  }

  get stockTotalInventario(): number {
    return this.productos.reduce((acc, p) => acc + this.productosService.stockTotal(p), 0);
  }

  get productosBajoStock() {
    return this.productosService.productosBajoStock(5);
  }

  get topModelos() {
    const ventasPorProducto = new Map<string, { nombre: string; unidades: number }>();
    for (const venta of this.ventasService.historial()) {
      for (const item of venta.items) {
        const actual = ventasPorProducto.get(item.productoId) ?? { nombre: item.nombre, unidades: 0 };
        actual.unidades += item.cantidad;
        ventasPorProducto.set(item.productoId, actual);
      }
    }
    return Array.from(ventasPorProducto.values()).sort((a, b) => b.unidades - a.unidades).slice(0, 3);
  }

  get ventasCompletadas(): number {
    return this.ventasService.historial().length;
  }

  get ingresosTotales(): number {
    return this.ventasService.historial().reduce((acc, v) => acc + v.total, 0);
  }
}
