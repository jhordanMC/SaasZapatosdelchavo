import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, FilaRotacion } from '../../../services/dashboard';
import { FinanzasService, GastoRecurrenteRead } from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';
import { TPipe } from '../../../core/t.pipe';

interface FilaGasto {
  tipo: string;
  montoMensual: number;
  pct: number;
}

interface FilaModelo {
  nombre: string;
  stock: number;
  valorCosto: number;
}

/** Tamaño de página para "Inventario por modelo" — un dashboard no necesita scroll infinito, alcanza con un límite generoso. */
const LIMITE_INVENTARIO_POR_MODELO = 100;

@Component({
  selector: 'app-empresa-dashboard',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class EmpresaDashboardComponent implements OnInit {
  constructor(
    public dashboardService: DashboardService,
    public finanzasService: FinanzasService,
    private inventarioService: InventarioService
  ) {}

  inventarioPorModelo: FilaModelo[] = [];

  ngOnInit(): void {
    this.dashboardService.recargarTodo();
    this.finanzasService.recargarTodo();
    this.finanzasService.cargarIngresosPorSemana(6);
    this.inventarioService.listarProductos({}, 0, LIMITE_INVENTARIO_POR_MODELO).subscribe((pagina) => {
      this.inventarioPorModelo = pagina.items
        .map((p: ProductoListItem) => ({
          nombre: p.nombre,
          stock: p.stock_total,
          valorCosto: p.stock_total * p.costo_compra,
        }))
        .sort((a, b) => b.stock - a.stock);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 1) Resumen ejecutivo del mes
  // ═══════════════════════════════════════════════════════════

  get resumen() {
    return this.dashboardService.resumen();
  }

  // ═══════════════════════════════════════════════════════════
  // 2) Ranking de productos
  // ═══════════════════════════════════════════════════════════

  get rankingProductos() {
    return this.dashboardService.rankingProductos();
  }

  get productoMasVendido() {
    return this.rankingProductos[0] ?? null;
  }

  get productosSinVentas() {
    return this.dashboardService.productosSinVentas();
  }

  // ═══════════════════════════════════════════════════════════
  // 3) Rotación de inventario y riesgo de merma
  // ═══════════════════════════════════════════════════════════

  get analisisRotacion(): FilaRotacion[] {
    return this.dashboardService.rotacionInventario();
  }

  get productoMayorMerma(): FilaRotacion | null {
    return this.analisisRotacion[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════
  // 4) Inventario por talla y por modelo
  // ═══════════════════════════════════════════════════════════

  get inventarioPorTalla() {
    return this.dashboardService.inventarioPorTalla();
  }

  get maxStockTalla(): number {
    return Math.max(1, ...this.inventarioPorTalla.map((t) => t.stock));
  }

  // ═══════════════════════════════════════════════════════════
  // 5) Comparativos temporales: semana a semana / mes a mes
  // ═══════════════════════════════════════════════════════════

  get ingresosPorSemana() {
    return this.finanzasService.ingresosPorSemana();
  }

  get ingresosPorMes() {
    return this.dashboardService.ingresosPorMes();
  }

  get maxIngresosSemana(): number {
    return Math.max(1, ...this.ingresosPorSemana.map((p) => p.total));
  }

  get maxIngresosMes(): number {
    return Math.max(1, ...this.ingresosPorMes.map((p) => p.ingresos));
  }

  alturaBarra(valor: number, max: number): number {
    return Math.round((valor / max) * 100);
  }

  get crecimientoSemanal(): number {
    return this.resumen?.crecimiento_semanal_pct ?? 0;
  }

  // ═══════════════════════════════════════════════════════════
  // 6) Gastos operativos de mayor impacto
  // ═══════════════════════════════════════════════════════════
  // Solo considera gastos RECURRENTES (alquiler, sueldos, servicios): un
  // gasto único/extraordinario no debería distorsionar la estructura de
  // costos recurrentes mes a mes.

  private mensualizarGasto(g: GastoRecurrenteRead): number {
    if (g.frecuencia === 'mensual') return g.monto;
    if (g.frecuencia === 'semanal') return g.monto * 4.33;
    return g.monto * 30; // diario
  }

  get gastosPorTipo(): FilaGasto[] {
    const mapa = new Map<string, number>();
    for (const g of this.finanzasService.gastosRecurrentes()) {
      mapa.set(g.tipo_gasto, (mapa.get(g.tipo_gasto) ?? 0) + this.mensualizarGasto(g));
    }
    const total = Array.from(mapa.values()).reduce((acc, v) => acc + v, 0);
    return Array.from(mapa.entries())
      .map(([tipo, montoMensual]) => ({ tipo, montoMensual, pct: total > 0 ? (montoMensual / total) * 100 : 0 }))
      .sort((a, b) => b.montoMensual - a.montoMensual);
  }

  // ═══════════════════════════════════════════════════════════
  // 7) Días de mayor foco de venta (patrón semanal)
  // ═══════════════════════════════════════════════════════════

  get ventasPorDiaSemana() {
    // El backend ya devuelve lunes..domingo en ese orden.
    return this.dashboardService.ventasPorDiaSemana();
  }

  get maxIngresosDia(): number {
    return Math.max(1, ...this.ventasPorDiaSemana.map((d) => d.ingresos));
  }

  get mejorDiaVenta() {
    const conVentas = this.ventasPorDiaSemana.filter((d) => d.cantidad_ventas > 0);
    if (conVentas.length === 0) return null;
    return [...conVentas].sort((a, b) => b.ingresos - a.ingresos)[0];
  }
}
