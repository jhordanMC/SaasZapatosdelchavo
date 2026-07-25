import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvancePorLocal, DashboardService, FilaRotacion, ProductoRanking } from '../../../services/dashboard';
import { FinanzasService, GastoRecurrenteRead, ResumenFinanciero } from '../../../services/finanzas';
import { InventarioService, LocalRead, ProductoListItem } from '../../../services/inventario';
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

/** Fila del "Top categorías" — se usa como el sustituto más cercano a "marca",
 * ya que el catálogo no tiene un campo de marca propiamente (solo categoría
 * y, a nivel de variante, modelo). */
interface FilaCategoria {
  nombre: string;
  unidades: number;
  ingresos: number;
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

  /** id_producto → nombre_categoria, para poder agrupar el ranking de ventas por categoría (top "marcas"). */
  private categoriaPorProducto = new Map<string, string>();

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

      this.categoriaPorProducto.clear();
      for (const p of pagina.items) {
        this.categoriaPorProducto.set(p.id_producto, p.nombre_categoria ?? 'Sin categoría');
      }
    });

    this.inventarioService.listarLocales().subscribe((locales) => {
      this.locales.set(locales.filter((l) => l.esta_activo));
      const r = this.avanceResumen();
      if (r) this.cargarAvancePorLocal(r.ingresos_periodo, r.gasto_operativo_periodo);
    });

    this.dashboardService.obtenerRankingProductosAmpliado().subscribe((lista) => {
      this.rankingAmpliado.set(lista);
    });

    this.cambiarPeriodoAvance('dia');
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
        this.cargarAvancePorLocal(r.ingresos_periodo, r.gasto_operativo_periodo);
      },
      error: () => {
        this.avanceError.set('No se pudo cargar el avance de este período.');
        this.avanceCargando.set(false);
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 0-bis) Avance por local/almacén
  // ═══════════════════════════════════════════════════════════
  // NOTA: sin endpoint todavía — ver el comentario de `AvancePorLocal` y
  // `cargarAvancePorLocal` en services/dashboard.ts. Los montos que se ven
  // acá son de EJEMPLO (repartidos a partir del total real del período),
  // no ventas reales por local.

  locales = signal<LocalRead[]>([]);
  avancePorLocal = signal<AvancePorLocal[]>([]);
  avancePorLocalCargando = signal(false);

  private cargarAvancePorLocal(ingresosTotalPeriodo: number, gastoTotalPeriodo: number): void {
    const locales = this.locales();
    if (locales.length === 0) {
      this.avancePorLocal.set([]);
      return;
    }
    this.avancePorLocalCargando.set(true);
    this.dashboardService
      .cargarAvancePorLocal(
        this.avanceDesde,
        this.avanceHasta,
        locales.map((l) => ({ id_local: l.id_local, nombre: l.nombre })),
        ingresosTotalPeriodo,
        gastoTotalPeriodo
      )
      .subscribe((lista) => {
        this.avancePorLocal.set(lista);
        this.avancePorLocalCargando.set(false);
      });
  }

  // ═══════════════════════════════════════════════════════════
  // 0-ter) Producto más / menos vendido, top 5 y top de categorías
  // ═══════════════════════════════════════════════════════════
  // "Top de marcas": el catálogo no tiene un campo de marca — se usa la
  // categoría del producto como el agrupador más cercano disponible.

  rankingAmpliado = signal<ProductoRanking[]>([]);

  get top5Productos(): ProductoRanking[] {
    return this.rankingAmpliado().slice(0, 5);
  }

  /** Menos vendidos, pero solo entre los que sí tuvieron alguna venta (0 ventas ya se muestra en "Sin ventas"). */
  get bottom5Productos(): ProductoRanking[] {
    return [...this.rankingAmpliado()]
      .filter((p) => p.unidades > 0)
      .sort((a, b) => a.unidades - b.unidades)
      .slice(0, 5);
  }

  get topCategorias(): FilaCategoria[] {
    const mapa = new Map<string, FilaCategoria>();
    for (const p of this.rankingAmpliado()) {
      const nombreCategoria = this.categoriaPorProducto.get(p.id_producto) ?? 'Sin categoría';
      const fila = mapa.get(nombreCategoria) ?? { nombre: nombreCategoria, unidades: 0, ingresos: 0 };
      fila.unidades += p.unidades;
      fila.ingresos += p.ingresos;
      mapa.set(nombreCategoria, fila);
    }
    return Array.from(mapa.values())
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 5);
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
