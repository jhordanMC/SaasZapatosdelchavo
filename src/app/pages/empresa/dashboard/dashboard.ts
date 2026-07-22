import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Producto, ProductosService } from '../../../services/productos';
import { VentasService } from '../../../services/ventas';
import { FinanzasService, GastoOperativo } from '../../../services/finanzas';
import { TPipe } from '../../../core/t.pipe';

/** Ventana de análisis para velocidad de venta / rotación de inventario. */
const DIAS_ANALISIS_ROTACION = 30;

interface RankingProducto {
  productoId: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  participacionPct: number;
}

type EstadoRotacion = 'saludable' | 'lenta' | 'riesgo' | 'sin-movimiento';

interface FilaRotacion {
  producto: Producto;
  stockActual: number;
  unidadesPeriodo: number;
  velocidadDiaria: number;
  diasParaAgotar: number | null; // null = sin movimiento (no se agota nunca al ritmo actual)
  estado: EstadoRotacion;
}

interface PuntoTemporal {
  etiqueta: string;
  ingresos: number;
}

interface FilaGasto {
  tipo: string;
  montoMensual: number;
  pct: number;
}

interface FilaDiaSemana {
  dia: string;
  ingresos: number;
  ventas: number;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

@Component({
  selector: 'app-empresa-dashboard',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class EmpresaDashboardComponent {
  constructor(
    private productosService: ProductosService,
    public ventasService: VentasService,
    public finanzasService: FinanzasService
  ) { }

  // ═══════════════════════════════════════════════════════════
  // Datos base
  // ═══════════════════════════════════════════════════════════

  get productos(): Producto[] {
    return this.productosService.getProductos()();
  }

  get historial(): any[] {
    return this.ventasService.historial();
  }

  get stockTotalInventario(): number {
    return this.productos.reduce((acc, p) => acc + this.productosService.stockTotal(p), 0);
  }

  get productosBajoStock() {
    return this.productosService.productosBajoStock(5);
  }

  get ventasCompletadas(): number {
    return this.historial.length;
  }

  // ═══════════════════════════════════════════════════════════
  // 1) Resumen ejecutivo del mes: ingresos, costos reales, utilidad
  // ═══════════════════════════════════════════════════════════

  get ingresosMes(): number {
    return this.ventasService.ingresosPeriodo(30);
  }

  /** Costo de mercadería vendida (COGS): lo que realmente costó comprar lo que se vendió este mes. */
  get costoMercaderiaVendidaMes(): number {
    const desde = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let costo = 0;
    for (const venta of this.historial) {
      const tiempoVenta = new Date(venta?.fecha).getTime();
      if (Number.isNaN(tiempoVenta) || tiempoVenta < desde) continue;
      for (const item of venta?.items ?? []) {
        const producto = this.productosService.getProductoById(item.productoId);
        if (producto) costo += producto.costoCompra * item.cantidad;
      }
    }
    return costo;
  }

  get utilidadBrutaMes(): number {
    return this.ingresosMes - this.costoMercaderiaVendidaMes;
  }

  get margenBrutoPct(): number {
    if (this.ingresosMes <= 0) return 0;
    return (this.utilidadBrutaMes / this.ingresosMes) * 100;
  }

  get gastosOperativosMes(): number {
    return this.finanzasService.gastoOperativoMensualEstimado();
  }

  get utilidadNetaMes(): number {
    return this.utilidadBrutaMes - this.gastosOperativosMes;
  }

  get margenNetoPct(): number {
    if (this.ingresosMes <= 0) return 0;
    return (this.utilidadNetaMes / this.ingresosMes) * 100;
  }

  get ticketPromedio(): number {
    return this.finanzasService.ticketPromedio();
  }

  // ═══════════════════════════════════════════════════════════
  // 2) Ranking de productos: más vendido / menos vendido
  // ═══════════════════════════════════════════════════════════

  get rankingProductos(): RankingProducto[] {
    const mapa = new Map<string, RankingProducto>();
    let totalUnidades = 0;

    for (const venta of this.historial) {
      for (const item of venta?.items ?? []) {
        const producto = this.productosService.getProductoById(item.productoId);
        const nombre = producto?.nombre ?? item.nombre;
        const actual = mapa.get(item.productoId) ?? {
          productoId: item.productoId,
          nombre,
          unidades: 0,
          ingresos: 0,
          participacionPct: 0,
        };
        actual.unidades += item.cantidad;
        actual.ingresos += this.ventasService.totalItem(item);
        mapa.set(item.productoId, actual);
        totalUnidades += item.cantidad;
      }
    }

    const lista = Array.from(mapa.values());
    for (const fila of lista) {
      fila.participacionPct = totalUnidades > 0 ? (fila.unidades / totalUnidades) * 100 : 0;
    }
    return lista.sort((a, b) => b.unidades - a.unidades);
  }

  get productoMasVendido(): RankingProducto | null {
    return this.rankingProductos[0] ?? null;
  }

  get productoMenosVendido(): RankingProducto | null {
    const lista = this.rankingProductos;
    return lista.length > 0 ? lista[lista.length - 1] : null;
  }

  get productosSinVentas(): Producto[] {
    const idsConVenta = new Set(this.rankingProductos.map((r) => r.productoId));
    return this.productos.filter((p) => !idsConVenta.has(p.id));
  }

  // ═══════════════════════════════════════════════════════════
  // 3) Rotación de inventario y riesgo de merma
  //    velocidad = unidades vendidas en 30 días / 30
  //    días para agotar stock = stock actual / velocidad diaria
  // ═══════════════════════════════════════════════════════════

  get analisisRotacion(): FilaRotacion[] {
    const unidadesPorProducto = new Map<string, number>();
    const desde = Date.now() - DIAS_ANALISIS_ROTACION * 24 * 60 * 60 * 1000;
    for (const venta of this.historial) {
      const tiempoVenta = new Date(venta?.fecha).getTime();
      if (Number.isNaN(tiempoVenta) || tiempoVenta < desde) continue;
      for (const item of venta?.items ?? []) {
        unidadesPorProducto.set(item.productoId, (unidadesPorProducto.get(item.productoId) ?? 0) + item.cantidad);
      }
    }

    const filas: FilaRotacion[] = [];
    for (const producto of this.productos) {
      const stockActual = this.productosService.stockTotal(producto);
      if (stockActual === 0) continue; // sin stock no hay capital inmovilizado que arriesgar

      const unidadesPeriodo = unidadesPorProducto.get(producto.id) ?? 0;
      const velocidadDiaria = unidadesPeriodo / DIAS_ANALISIS_ROTACION;
      const diasParaAgotar = velocidadDiaria > 0 ? stockActual / velocidadDiaria : null;

      let estado: EstadoRotacion;
      if (diasParaAgotar === null) estado = 'sin-movimiento';
      else if (diasParaAgotar > 90) estado = 'riesgo';
      else if (diasParaAgotar > 45) estado = 'lenta';
      else estado = 'saludable';

      filas.push({ producto, stockActual, unidadesPeriodo, velocidadDiaria, diasParaAgotar, estado });
    }

    const pesoEstado: Record<EstadoRotacion, number> = { 'sin-movimiento': 3, riesgo: 2, lenta: 1, saludable: 0 };
    return filas.sort((a, b) => {
      const diff = pesoEstado[b.estado] - pesoEstado[a.estado];
      if (diff !== 0) return diff;
      return (b.diasParaAgotar ?? 9999) - (a.diasParaAgotar ?? 9999);
    });
  }

  get productoMayorMerma(): FilaRotacion | null {
    return this.analisisRotacion[0] ?? null;
  }

  get productosEnRiesgo(): FilaRotacion[] {
    return this.analisisRotacion.filter((f) => f.estado === 'riesgo' || f.estado === 'sin-movimiento');
  }

  // ═══════════════════════════════════════════════════════════
  // 4) Inventario por talla y por modelo
  // ═══════════════════════════════════════════════════════════

  get inventarioPorTalla(): { talla: string; stock: number }[] {
    const mapa = new Map<string, number>();
    for (const p of this.productos) {
      for (const v of p.variantes) {
        mapa.set(v.talla, (mapa.get(v.talla) ?? 0) + v.stock);
      }
    }
    return Array.from(mapa.entries())
      .map(([talla, stock]) => ({ talla, stock }))
      .sort((a, b) => b.stock - a.stock);
  }

  get inventarioPorModelo(): { nombre: string; stock: number; valorCosto: number }[] {
    return this.productos
      .map((p) => ({
        nombre: p.nombre,
        stock: this.productosService.stockTotal(p),
        valorCosto: this.productosService.stockTotal(p) * p.costoCompra,
      }))
      .sort((a, b) => b.stock - a.stock);
  }

  get valorTotalInventarioCosto(): number {
    return this.inventarioPorModelo.reduce((acc, m) => acc + m.valorCosto, 0);
  }

  get maxStockTalla(): number {
    return Math.max(1, ...this.inventarioPorTalla.map((t) => t.stock));
  }

  // ═══════════════════════════════════════════════════════════
  // 5) Comparativos temporales: semana a semana / mes a mes
  // ═══════════════════════════════════════════════════════════

  get ingresosPorSemana(): PuntoTemporal[] {
    const n = 6;
    const puntos: PuntoTemporal[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const total = this.ventasService.ventasEnRango((i + 1) * 7, i * 7).reduce((acc, v) => acc + v.total, 0);
      puntos.push({ etiqueta: i === 0 ? 'Esta semana' : `Sem. -${i}`, ingresos: total });
    }
    return puntos;
  }

  get ingresosPorMes(): PuntoTemporal[] {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hoy = new Date();
    const buckets = new Map<string, number>();
    const orden: string[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, 0);
      orden.push(key);
    }

    for (const venta of this.historial) {
      const f = new Date(venta?.fecha);
      const key = `${f.getFullYear()}-${f.getMonth()}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (Number(venta?.total) || 0));
    }

    return orden.map((key) => {
      const mesIdx = Number(key.split('-')[1]);
      return { etiqueta: meses[mesIdx], ingresos: buckets.get(key) ?? 0 };
    });
  }

  get maxIngresosSemana(): number {
    return Math.max(1, ...this.ingresosPorSemana.map((p) => p.ingresos));
  }

  get maxIngresosMes(): number {
    return Math.max(1, ...this.ingresosPorMes.map((p) => p.ingresos));
  }

  alturaBarra(valor: number, max: number): number {
    return Math.round((valor / max) * 100);
  }

  get crecimientoSemanal(): number {
    return this.finanzasService.crecimientoSemanal();
  }

  // ═══════════════════════════════════════════════════════════
  // 6) Gastos operativos de mayor impacto
  // ═══════════════════════════════════════════════════════════

  private mensualizarGasto(g: GastoOperativo): number {
    if (g.periodo === 'mensual') return g.monto;
    if (g.periodo === 'semanal') return g.monto * 4.33;
    return g.monto * 30; // diario
  }

  get gastosPorTipo(): FilaGasto[] {
    const mapa = new Map<string, number>();
    for (const g of this.finanzasService.gastos()) {
      mapa.set(g.tipo, (mapa.get(g.tipo) ?? 0) + this.mensualizarGasto(g));
    }
    const total = Array.from(mapa.values()).reduce((acc, v) => acc + v, 0);
    return Array.from(mapa.entries())
      .map(([tipo, montoMensual]) => ({ tipo, montoMensual, pct: total > 0 ? (montoMensual / total) * 100 : 0 }))
      .sort((a, b) => b.montoMensual - a.montoMensual);
  }

  // ═══════════════════════════════════════════════════════════
  // 7) Días de mayor foco de venta (patrón semanal)
  // ═══════════════════════════════════════════════════════════

  get ventasPorDiaSemana(): FilaDiaSemana[] {
    const acumulado = DIAS_SEMANA.map((dia) => ({ dia, ingresos: 0, ventas: 0 }));
    for (const venta of this.historial) {
      const fecha = new Date(venta?.fecha);
      const idx = fecha.getDay();
      // venta.fecha ausente/mal formada (NaN) o venta sin total: se descarta la fila
      // en lugar de tumbar el render completo del dashboard.
      if (Number.isNaN(idx)) continue;
      acumulado[idx].ingresos += Number(venta?.total) || 0;
      acumulado[idx].ventas += 1;
    }
    // Reordenar para que la semana empiece en lunes, más natural de leer
    return [...acumulado.slice(1), acumulado[0]];
  }

  get maxIngresosDia(): number {
    return Math.max(1, ...this.ventasPorDiaSemana.map((d) => d.ingresos));
  }

  get mejorDiaVenta(): FilaDiaSemana | null {
    const conVentas = this.ventasPorDiaSemana.filter((d) => d.ventas > 0);
    if (conVentas.length === 0) return null;
    return [...conVentas].sort((a, b) => b.ingresos - a.ingresos)[0];
  }
}
