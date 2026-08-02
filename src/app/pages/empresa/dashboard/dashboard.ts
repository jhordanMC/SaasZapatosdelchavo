import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, FilaRotacion, TopCategoria } from '../../../services/dashboard';
import { FinanzasService, GastoRecurrenteRead, PuntoSemana, ResumenFinanciero, VentasPorMetodoPago } from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';
import { MetodoPago } from '../../../services/ventas';

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

interface PuntoEvolucion {
  etiqueta: string;
  ingresos: number;
  gananciaEstimada: number;
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
    private inventarioService: InventarioService
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
    const diaSemana = hoy.getDay();
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diasDesdeElLunes);
    return this.formatearISO(lunes);
  }

  private primerDiaDeEsteMesISO(): string {
    const hoy = new Date();
    return this.formatearISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  private primerDiaDeEsteAnioISO(): string {
    const hoy = new Date();
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
    }
  }

  onFechaPersonalizadaChange(): void {
    if (!this.avanceDesde || !this.avanceHasta) return;
    if (this.avanceDesde > this.avanceHasta) return;
    this.cargarAvance();
    this.cargarTopCategorias();
    this.cargarRotacion();
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
        this.cargarTallasRotasDelMasVendido();
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
  // Evolución de ventas vs. ganancia real (últimas semanas)
  // ═══════════════════════════════════════════════════════════
  // El backend expone ingresos reales por semana, pero no un desglose de
  // ganancia por semana — así que la ganancia de cada punto es una
  // ESTIMACIÓN: ingresos de esa semana × tu margen promedio del período
  // filtrado arriba. Se muestra clarísimo en el HTML que es estimado.

  get evolucion(): PuntoEvolucion[] {
    const margenFrac = (this.avanceResumen()?.margen_promedio_pct ?? 0) / 100;
    return this.finanzasService.ingresosPorSemana().map((p: PuntoSemana) => ({
      etiqueta: p.etiqueta,
      ingresos: p.total,
      gananciaEstimada: Math.max(0, p.total * margenFrac),
    }));
  }

  get maxIngresoEvolucion(): number {
    return Math.max(1, ...this.evolucion.map((p) => p.ingresos));
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
  // Asume un tiempo de reposición de 15 días (ajustable) — el backend no
  // tiene todavía un "lead time" configurable por proveedor.

  private readonly DIAS_REPOSICION_ASUMIDOS = 15;

  get sugerenciaReabastecimiento(): { producto: FilaRotacion; pares: number } | null {
    const candidatos = this.analisisRotacion
      .filter((f) => (f.estado === 'saludable' || f.estado === 'lenta') && f.dias_para_agotar !== null && f.dias_para_agotar <= 10)
      .sort((a, b) => (a.dias_para_agotar ?? 0) - (b.dias_para_agotar ?? 0));
    const producto = candidatos[0];
    if (!producto) return null;
    const pares = Math.max(1, Math.ceil(producto.velocidad_diaria * this.DIAS_REPOSICION_ASUMIDOS));
    return { producto, pares };
  }

  // ── Alerta roja: tallas rotas del producto más vendido (datos reales, cruzando catálogo) ──

  tallasRotas = signal<TallaRota[]>([]);
  productoTopNombre = signal<string | null>(null);

  private cargarTallasRotasDelMasVendido(): void {
    const top = this.top5MasVendidos[0];
    if (!top) {
      this.tallasRotas.set([]);
      this.productoTopNombre.set(null);
      return;
    }
    this.productoTopNombre.set(top.nombre);
    this.inventarioService.obtenerProducto(top.id_producto).subscribe((detalle) => {
      const rotas: TallaRota[] = [];
      for (const variante of detalle.variantes) {
        if (!variante.esta_activo || !variante.talla) continue;
        const stockTotal = variante.stock.reduce((acc, s) => acc + s.cantidad, 0);
        if (stockTotal === 0) rotas.push({ producto: top.nombre, talla: variante.talla });
      }
      this.tallasRotas.set(rotas);
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
}