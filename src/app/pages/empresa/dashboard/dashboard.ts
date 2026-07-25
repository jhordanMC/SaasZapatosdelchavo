import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, FilaRotacion } from '../../../services/dashboard';
import { FinanzasService, GastoRecurrenteRead, ResumenFinanciero } from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';
import { TPipe } from '../../../core/t.pipe';

/** Período del panel "Tu avance" — 'personalizado' deja que el usuario elija el rango a mano. */
type PeriodoAvance = 'dia' | 'semana' | 'mes' | 'personalizado';

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
  imports: [CommonModule, FormsModule, TPipe],
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
    this.cambiarPeriodoAvance('dia');
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
  // 0) Tu avance — ventas / ganancia / gastos, filtrable por período
  // ═══════════════════════════════════════════════════════════
  // Reutiliza FinanzasService.obtenerResumenPeriodo(desde, hasta), que ya
  // existe para el reporte mensual — no toca el signal `resumen` global,
  // así que este panel puede pedir cualquier rango sin pisar el resto del
  // dashboard (que sigue mostrando el mes actual como siempre).

  periodoAvance: PeriodoAvance = 'dia';
  avanceDesde = this.hoyISO();
  avanceHasta = this.hoyISO();
  avanceResumen = signal<ResumenFinanciero | null>(null);
  avanceCargando = signal(false);
  avanceError = signal<string | null>(null);

  private hoyISO(): string {
    return this.formatearISO(new Date());
  }

  private formatearISO(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private lunesDeEstaSemanaISO(): string {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, ...
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diasDesdeElLunes);
    return this.formatearISO(lunes);
  }

  private primerDiaDeEsteMesISO(): string {
    const hoy = new Date();
    return this.formatearISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  cambiarPeriodoAvance(periodo: PeriodoAvance): void {
    this.periodoAvance = periodo;
    if (periodo === 'dia') {
      this.avanceDesde = this.hoyISO();
      this.avanceHasta = this.hoyISO();
    } else if (periodo === 'semana') {
      this.avanceDesde = this.lunesDeEstaSemanaISO();
      this.avanceHasta = this.hoyISO();
    } else if (periodo === 'mes') {
      this.avanceDesde = this.primerDiaDeEsteMesISO();
      this.avanceHasta = this.hoyISO();
    }
    // 'personalizado' deja las fechas tal como estén — el usuario las edita con los inputs.
    if (periodo !== 'personalizado') {
      this.cargarAvance();
    }
  }

  /** Se llama al editar las fechas del filtro personalizado. */
  onFechaAvancePersonalizadaChange(): void {
    if (!this.avanceDesde || !this.avanceHasta) return;
    if (this.avanceDesde > this.avanceHasta) return; // rango inválido: se espera a que el usuario lo corrija
    this.cargarAvance();
  }

  private cargarAvance(): void {
    this.avanceCargando.set(true);
    this.avanceError.set(null);
    this.finanzasService.obtenerResumenPeriodo(this.avanceDesde, this.avanceHasta).subscribe({
      next: (r) => {
        this.avanceResumen.set(r);
        this.avanceCargando.set(false);
      },
      error: () => {
        this.avanceError.set('No se pudo cargar el avance de este período.');
        this.avanceCargando.set(false);
      },
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
