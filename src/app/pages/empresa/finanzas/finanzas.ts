import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService, TipoGasto } from '../../../services/finanzas';
import { ProductosService } from '../../../services/productos';

const TIPOS_GASTO: TipoGasto[] = [
  'Pago de local',
  'Seguridad local',
  'Pago trabajador',
  'Almuerzo trabajador',
  'Pasajes trabajador',
  'SaaS Vilcas',
];

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finanzas.html',
  styleUrls: ['./finanzas.css'],
})
export class FinanzasComponent {
  constructor(public finanzasService: FinanzasService, private productosService: ProductosService) {}

  tiposGasto = TIPOS_GASTO;

  showModal = false;
  form: { tipo: TipoGasto; monto: number; periodo: 'diario' | 'semanal' | 'mensual' } = {
    tipo: 'Pago de local',
    monto: 0,
    periodo: 'mensual',
  };

  get ingresosMes() { return this.finanzasService.ingresosMes(); }
  get ingresosSemana() { return this.finanzasService.ingresosSemana(); }
  get gastoOperativoMensual() { return this.finanzasService.gastoOperativoMensualEstimado(); }
  get gananciaNeta() { return this.finanzasService.gananciaNetaMensual(); }
  get generandoGanancia() { return this.finanzasService.estaGenerandoGanancia(); }

  // Panel de decisiones
  get ticketPromedio() { return this.finanzasService.ticketPromedio(); }
  get margenPromedio() { return this.finanzasService.margenPromedioPorcentaje(); }
  get puntoEquilibrio() { return this.finanzasService.puntoEquilibrioMensual(); }
  get progresoEquilibrio() { return this.finanzasService.progresoPuntoEquilibrio(); }
  get proyeccionMes() { return this.finanzasService.proyeccionCierreMes(); }
  get crecimientoSemanal() { return this.finanzasService.crecimientoSemanal(); }
  get productoEstrella() { return this.finanzasService.productoEstrella(); }
  get productoMasRentable() { return this.finanzasService.productoMasRentable(); }
  get alertasStockBajo() { return this.finanzasService.alertasStockBajo(); }
  get recomendacion() { return this.finanzasService.recomendacion(); }
  get ingresosPorSemana() { return this.finanzasService.ingresosPorSemana(4); }

  get maxSemana(): number {
    return Math.max(1, ...this.ingresosPorSemana.map((p) => p.total));
  }

  alturaBarra(total: number): number {
    return Math.round((total / this.maxSemana) * 100);
  }

  get productosRentabilidad() {
    return this.productosService.getProductos()().map((p) => ({
      nombre: p.nombre,
      margen: this.productosService.margen(p),
      stock: this.productosService.stockTotal(p),
    })).sort((a, b) => b.margen - a.margen);
  }

  abrirModal(): void {
    this.form = { tipo: 'Pago de local', monto: 0, periodo: 'mensual' };
    this.showModal = true;
  }

  cerrarModal(): void {
    this.showModal = false;
  }

  guardarGasto(): void {
    if (this.form.monto <= 0) return;
    this.finanzasService.agregarGasto(this.form);
    this.showModal = false;
  }

  eliminarGasto(id: string): void {
    this.finanzasService.eliminarGasto(id);
  }
}
