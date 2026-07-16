import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductosService } from '../../../services/productos';
import { VentasService } from '../../../services/ventas';

@Component({
  selector: 'app-analitica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analitica.html',
  styleUrls: ['./analitica.css'],
})
export class AnaliticaComponent {
  constructor(private productosService: ProductosService, private ventasService: VentasService) {}

  get ventasPorSegmento() {
    const mapa = new Map<string, number>();
    for (const venta of this.ventasService.historial()) {
      for (const item of venta.items) {
        const producto = this.productosService.getProductoById(item.productoId);
        const sexo = producto?.sexo ?? 'Sin dato';
        mapa.set(sexo, (mapa.get(sexo) ?? 0) + item.cantidad);
      }
    }
    return Array.from(mapa.entries()).map(([segmento, unidades]) => ({ segmento, unidades }));
  }

  get totalVentas(): number {
    return this.ventasService.historial().length;
  }
}
