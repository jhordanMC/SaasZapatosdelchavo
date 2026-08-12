import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, FilaRotacion, PuntoVentaGanancia, TopCategoria } from '../../../services/dashboard';
import { FinanzasService, GastoRecurrenteRead, ResumenFinanciero, VentasPorMetodoPago } from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';
import { ETIQUETAS_TIPO_DEVOLUCION, MetodoPago, ResumenDevolucionesDashboard, TipoDevolucion, VentasService } from '../../../services/ventas';

/** Período del filtro único del dashboard — 'personalizado' deja que el usuario elija el rango a mano. */
type PeriodoAvance = 'dia' | 'semana' | 'mes' | 'anio' | 'personalizado';

const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

interface FilaGasto {
  tipo: string;
  montoMensual: number;
  pct: number;
}

interface TallaRota {
  producto: string;
  talla: string;
}

@Component({
  selector: 'app-empresa-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class EmpresaDashboardComponent implements OnInit {
  /** Expuesto al template para Math.max(...) en anchos mínimos de barras. */
  readonly Math = Math;

  constructor(
    public dashboardService: DashboardService,
    public finanzasService: FinanzasService,
    private inventarioService: InventarioService,
    private ventasService: VentasService
  ) {}

  /** id_producto → costo_compra, para calcular capital atrapado a costo real. */
  private costoPorProducto = new Map<string, number>();

  ngOnInit(): void {
    this.dashboardService.cargarResumen();
    this.finanzasService.recargarTodo();

    this.inventarioService.listarProductos({}, 0, 300).subscribe({
      next: (pagina) => {
        this.costoPorProducto.clear();
        for (const p of pagina.items) {
          this.costoPorProducto.set(p.id_producto, p.costo_compra);
        }
      },
      error: (err) => console.error('No se pudo cargar el catálogo para cruzar costos.', err),
    });

    // Rotación/ranking del período se piden una sola vez acá (cambiarPeriodo los
    // recarga en cada cambio de filtro) — antes había una llamada extra sin
    // desde/hasta que competía en una carrera con la del período real.
    this.cambiarPeriodo('dia');
  }

  // ═══════════════════════════════════════════════════════════
  // Barra superior de control: período + canal
  // ═══════════════════════════════════════════════════════════

  periodoAvance: PeriodoAvance = 'dia';
  avanceDesde = this.hoyISO();
  avanceHasta = this.hoyISO();
  avanceResumen = signal<ResumenFinanciero | null>(null);
  avanceCargando = signal(false);
  avanceError = signal<string | null>(null);

  metodosPago = signal<VentasPorMetodoPago[]>([]);

  etiquetaMetodoPago(metodo: MetodoPago): string {
    return ETIQUETAS_METODO_PAGO[metodo] ?? metodo;
  }

  get totalMetodosPago(): number {
    return this.metodosPago().reduce((acc, m) => acc + m.monto, 0);
  }

  /** Frase para las cards "Top" que dependen del período elegido arriba (Hoy/Esta semana/etc). */
  get etiquetaPeriodoActual(): string {
    switch (this.periodoAvance) {
      case 'dia': return 'hoy';
      case 'semana': return 'esta semana';
      case 'mes': return 'este mes';
      case 'anio': return 'este año';
      default: return `del ${this.avanceDesde} al ${this.avanceHasta}`;
    }
  }

  /** El sistema todavía no distingue ventas al por menor de al por mayor
   * (no hay un campo "canal"/tipo de venta en el modelo de datos) — el
   * selector queda visible para que se note el hueco, pero no filtra nada
   * todavía. Necesitaría un campo nuevo en Venta + este endpoint filtrando por él. */
  canal: 'todos' | 'menor' | 'mayor' = 'todos';

  /** Zona horaria del negocio (Perú, UTC-5 fijo, sin horario de verano).
   * Debe coincidir con TZ_NEGOCIO en app/core/tiempo.py del backend —
   * si no, el "hoy" del dashboard puede desalinearse con el "hoy" que
   * usa el backend para sus propios reportes (Dashboard/Finanzas). */
  private static readonly TZ_NEGOCIO = 'America/Lima';

  /** "Ahora", pero con año/mes/día correspondientes a la hora de Lima,
   * sin importar la timezone configurada en el dispositivo del usuario. */
  private ahoraEnLima(): Date {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: EmpresaDashboardComponent.TZ_NEGOCIO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const obtener = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
    return new Date(Number(obtener('year')), Number(obtener('month')) - 1, Number(obtener('day')));
  }

  private hoyISO(): string {
    return this.formatearISO(this.ahoraEnLima());
  }

  private formatearISO(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private lunesDeEstaSemanaISO(): string {
    const hoy = this.ahoraEnLima();
    const diaSemana = hoy.getDay();
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diasDesdeElLunes);
    return this.formatearISO(lunes);
  }

  private primerDiaDeEsteMesISO(): string {
    const hoy = this.ahoraEnLima();
    return this.formatearISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  private primerDiaDeEsteAnioISO(): string {
    const hoy = this.ahoraEnLima();
    return this.formatearISO(new Date(hoy.getFullYear(), 0, 1));
  }

  cambiarPeriodo(periodo: PeriodoAvance): void {
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
    } else if (periodo === 'anio') {
      this.avanceDesde = this.primerDiaDeEsteAnioISO();
      this.avanceHasta = this.hoyISO();
    }
    if (periodo !== 'personalizado') {
      this.cargarAvance();
      this.cargarTopCategorias();
      this.cargarRotacion();
      this.cargarResumenDevoluciones();
      this.cargarTopDevueltos();
    }
  }

  onFechaPersonalizadaChange(): void {
    if (!this.avanceDesde || !this.avanceHasta) return;
    if (this.avanceDesde > this.avanceHasta) return;
    this.cargarAvance();
    this.cargarTopCategorias();
    this.cargarRotacion();
    this.cargarResumenDevoluciones();
    this.cargarTopDevueltos();
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
    this.finanzasService.obtenerVentasPorMetodoPago(this.avanceDesde, this.avanceHasta).subscribe({
      next: (lista) => this.metodosPago.set(lista),
      error: () => this.metodosPago.set([]),
    });
    this.cargarVentasGanancia();
  }

  private cargarTopCategorias(): void {
    this.cargandoTopCategorias.set(true);
    this.dashboardService.obtenerTopCategorias(this.avanceDesde, this.avanceHasta, 5).subscribe({
      next: (lista) => {
        this.topCategorias.set(lista);
        this.cargandoTopCategorias.set(false);
      },
      error: () => {
        this.topCategorias.set([]);
        this.cargandoTopCategorias.set(false);
      },
    });
  }

  private cargarRotacion(): void {
    this.dashboardService.obtenerRotacionInventario(this.avanceDesde, this.avanceHasta, 40).subscribe({
      next: (lista) => {
        this.dashboardService.rotacionInventario.set(lista);
      },
      error: () => this.dashboardService.rotacionInventario.set([]),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // KPIs "actuales" (no varían por período)
  // ═══════════════════════════════════════════════════════════

  get valorInventario(): number {
    return this.dashboardService.resumen()?.valor_inventario_costo ?? 0;
  }

  get productosEnRiesgoMerma(): number {
    return this.dashboardService.resumen()?.productos_en_riesgo_merma ?? 0;
  }

  // ═══════════════════════════════════════════════════════════
  // Ventas vs. ganancia real por semana (ya no es estimación:
  // GET /dashboard/ventas-ganancia-por-periodo calcula costo real por
  // semana, mismo criterio que FinanzasService.calcular_kpis_financieros).
  // ═══════════════════════════════════════════════════════════

  ventasGanancia = signal<PuntoVentaGanancia[]>([]);
  cargandoVentasGanancia = signal(false);

  private cargarVentasGanancia(): void {
    this.cargandoVentasGanancia.set(true);
    this.dashboardService.obtenerVentasGananciaPorPeriodo(this.avanceDesde, this.avanceHasta).subscribe({
      next: (lista) => {
        this.ventasGanancia.set(lista);
        this.cargandoVentasGanancia.set(false);
      },
      error: () => {
        this.ventasGanancia.set([]);
        this.cargandoVentasGanancia.set(false);
      },
    });
  }

  /**
   * Escala del gráfico "Ventas y ganancias" — antes solo se escalaba por
   * `ingresos` (siempre positivo). Ahora `ganancia_neta` puede ser negativa
   * (semana con pérdida), así que la escala cubre [min, max] de AMBAS series
   * y las barras se dibujan desde una línea de cero real, no desde el piso.
   */
  private nicerStepEvolucion(rango: number): number {
    if (rango <= 0) return 100;
    const bruto = rango / 4;
    const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / magnitud;
    const normLindo = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return normLindo * magnitud;
  }

  get escalaEvolucion(): { max: number; min: number; ticks: number[] } {
    const valores = this.ventasGanancia().flatMap((p) => [p.ingresos, p.ganancia_neta]);
    const rawMax = Math.max(0, ...valores, 1);
    const rawMin = Math.min(0, ...valores);
    const step = this.nicerStepEvolucion(rawMax - rawMin);
    const max = Math.ceil(rawMax / step) * step || step;
    const min = Math.floor(rawMin / step) * step;
    const ticks: number[] = [];
    for (let t = max; t >= min - 0.01; t -= step) ticks.push(Math.round(t));
    return { max, min, ticks };
  }

  /** Posición (% desde abajo del área del gráfico) que corresponde a un valor dado. */
  pctEvolucion(v: number): number {
    const { max, min } = this.escalaEvolucion;
    const rango = max - min || 1;
    return ((v - min) / rango) * 100;
  }

  get zeroLinePctEvolucion(): number {
    return this.pctEvolucion(0);
  }

  /** Alto de la barra (%) — desde la línea de cero hasta el valor, sea positivo o negativo. */
  alturaBarraEvolucion(v: number): number {
    const { max, min } = this.escalaEvolucion;
    const rango = max - min || 1;
    return (Math.abs(v) / rango) * 100;
  }

  /** Punto de apoyo (% desde abajo) donde empieza a dibujarse la barra. */
  basePctBarraEvolucion(v: number): number {
    return v >= 0 ? this.zeroLinePctEvolucion : this.zeroLinePctEvolucion - this.alturaBarraEvolucion(v);
  }

  // ═══════════════════════════════════════════════════════════
  // Producto más / menos vendido, top 5 y top de categorías
  // ═══════════════════════════════════════════════════════════

  /** Categorías con más ingresos del período — agregado en SQL (ver DashboardService.top_categorias). */
  topCategorias = signal<TopCategoria[]>([]);
  cargandoTopCategorias = signal(false);

  get maxIngresosCategoria(): number {
    return Math.max(1, ...this.topCategorias().map((c) => c.ingresos));
  }

  // ═══════════════════════════════════════════════════════════
  // Rotación de inventario — fuente única para "Top vendidos",
  // "Riesgo de merma" y las alertas ámbar/verde (mismos datos, coherentes).
  // ═══════════════════════════════════════════════════════════

  get analisisRotacion(): FilaRotacion[] {
    return this.dashboardService.rotacionInventario();
  }

  get top5MasVendidos(): FilaRotacion[] {
    return [...this.analisisRotacion]
      .filter((f) => f.unidades_periodo > 0)
      .sort((a, b) => b.unidades_periodo - a.unidades_periodo)
      .slice(0, 5);
  }

  get top5RiesgoMerma(): FilaRotacion[] {
    return [...this.analisisRotacion]
      .filter((f) => f.estado === 'sin-movimiento' || f.estado === 'riesgo')
      .sort((a, b) => a.unidades_periodo - b.unidades_periodo)
      .slice(0, 5);
  }

  get maxUnidadesTop5(): number {
    return Math.max(1, ...this.top5MasVendidos.map((f) => f.unidades_periodo));
  }

  get maxDiasMerma(): number {
    return Math.max(1, ...this.top5RiesgoMerma.map((f) => f.dias_para_agotar ?? f.stock_actual));
  }

  // ── Alerta ámbar: capital atrapado (productos sin movimiento, a costo real) ──

  get capitalAtrapado(): { cantidad: number; monto: number; ejemplo: FilaRotacion | null } {
    const sinMovimiento = this.analisisRotacion.filter((f) => f.estado === 'sin-movimiento');
    const monto = sinMovimiento.reduce((acc, f) => acc + f.stock_actual * (this.costoPorProducto.get(f.id_producto) ?? 0), 0);
    return { cantidad: sinMovimiento.length, monto, ejemplo: sinMovimiento[0] ?? null };
  }

  // ── Alerta verde: sugerencia de reabastecimiento ──

  get sugerenciaReabastecimiento(): FilaRotacion[] {
    return this.analisisRotacion
      .filter((f) => f.stock_actual < 10)
      .sort((a, b) => a.stock_actual - b.stock_actual)
      .slice(0, 3);
  }

  // ── Alerta roja: Productos más devueltos (Riesgo de venta perdida) ──

  topDevueltos = signal<import('../../../services/dashboard').ProductoDevuelto[]>([]);
  cargandoTopDevueltos = signal(false);

  private cargarTopDevueltos(): void {
    this.cargandoTopDevueltos.set(true);
    // Para que sirva como alerta útil, miramos los últimos 30 días en lugar de solo el día de hoy
    const hoy = this.ahoraEnLima();
    const hace30Dias = new Date(hoy);
    hace30Dias.setDate(hoy.getDate() - 30);
    const desde = this.formatearISO(hace30Dias);
    const hasta = this.formatearISO(hoy);

    this.dashboardService.obtenerTopProductosDevueltos(desde, hasta, 3).subscribe({
      next: (lista) => {
        this.topDevueltos.set(lista);
        this.cargandoTopDevueltos.set(false);
      },
      error: () => {
        this.topDevueltos.set([]);
        this.cargandoTopDevueltos.set(false);
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Gastos operativos de mayor impacto
  // ═══════════════════════════════════════════════════════════

  private mensualizarGasto(g: GastoRecurrenteRead): number {
    if (g.frecuencia === 'mensual') return g.monto;
    if (g.frecuencia === 'semanal') return g.monto * 4.33;
    return g.monto * 30;
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
  // Mini-tarjeta de Devoluciones — mismo período elegido arriba
  // (Hoy/Esta semana/Este mes/Este año/Personalizado).
  // ═══════════════════════════════════════════════════════════

  resumenDevoluciones = signal<ResumenDevolucionesDashboard | null>(null);
  cargandoDevoluciones = signal(false);

  private cargarResumenDevoluciones(): void {
    this.cargandoDevoluciones.set(true);
    this.ventasService
      .resumenDevolucionesDashboard(`${this.avanceDesde}T00:00:00`, `${this.avanceHasta}T23:59:59`)
      .subscribe({
        next: (r) => {
          this.resumenDevoluciones.set(r);
          this.cargandoDevoluciones.set(false);
        },
        error: () => {
          this.resumenDevoluciones.set(null);
          this.cargandoDevoluciones.set(false);
        },
      });
  }

  /** Proveedor con más devoluciones del período (para el titular de la tarjeta). */
  get proveedorConMasDevoluciones(): { proveedor: string; cantidad: number } | null {
    return this.resumenDevoluciones()?.porProveedor[0] ?? null;
  }

  etiquetaTipoDevolucion(tipo: TipoDevolucion): string {
    return ETIQUETAS_TIPO_DEVOLUCION[tipo];
  }

  /** % que representa el impacto de las devoluciones sobre la ganancia neta del período. */
  get pctImpactoDevolucionesEnGanancia(): number {
    const ganancia = this.avanceResumen()?.ganancia_neta_periodo ?? 0;
    const impacto = this.resumenDevoluciones()?.impactoGanancia ?? 0;
    if (ganancia <= 0) return 0;
    return Math.min(100, (impacto / ganancia) * 100);
  }
}