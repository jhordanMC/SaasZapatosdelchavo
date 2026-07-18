import { Injectable, signal } from '@angular/core';
import { VentasService } from './ventas';
import { ProductosService } from './productos';

export type TipoGasto =
  | 'Pago de local'
  | 'Seguridad local'
  | 'Pago trabajador'
  | 'Almuerzo trabajador'
  | 'Pasajes trabajador'
  | 'SaaS Vilcas';

export interface GastoOperativo {
  id: string;
  tipo: TipoGasto;
  monto: number;
  periodo: 'diario' | 'semanal' | 'mensual';
  fecha: string;
}

export interface PuntoSemana {
  etiqueta: string;
  total: number;
}

let autoId = 0;
function nuevoId(): string {
  autoId += 1;
  return `gasto-${autoId}`;
}

const COSTO_SAAS_DIARIO = 3.33;

@Injectable({ providedIn: 'root' })
export class FinanzasService {
  constructor(private ventasService: VentasService, private productosService: ProductosService) {}

  gastos = signal<GastoOperativo[]>([
    { id: nuevoId(), tipo: 'Pago de local', monto: 900, periodo: 'mensual', fecha: new Date().toISOString() },
    { id: nuevoId(), tipo: 'Pago trabajador', monto: 280, periodo: 'semanal', fecha: new Date().toISOString() },
    { id: nuevoId(), tipo: 'SaaS Vilcas', monto: COSTO_SAAS_DIARIO, periodo: 'diario', fecha: new Date().toISOString() },
  ]);

  agregarGasto(datos: Omit<GastoOperativo, 'id' | 'fecha'>): void {
    this.gastos.update((lista) => [
      { ...datos, id: nuevoId(), fecha: new Date().toISOString() },
      ...lista,
    ]);
  }

  eliminarGasto(id: string): void {
    this.gastos.update((lista) => lista.filter((g) => g.id !== id));
  }

  gastoOperativoMensualEstimado(): number {
    return this.gastos().reduce((acc, g) => {
      if (g.periodo === 'mensual') return acc + g.monto;
      if (g.periodo === 'semanal') return acc + g.monto * 4.33;
      if (g.periodo === 'diario') return acc + g.monto * 30;
      return acc;
    }, 0);
  }

  ingresosMes(): number {
    return this.ventasService.ingresosPeriodo(30);
  }

  ingresosSemana(): number {
    return this.ventasService.ingresosPeriodo(7);
  }

  gananciaNetaMensual(): number {
    return this.ingresosMes() - this.gastoOperativoMensualEstimado();
  }

  estaGenerandoGanancia(): boolean {
    return this.gananciaNetaMensual() > 0;
  }

  // ── Panel de decisiones (analítica para el dueño del negocio) ──────────────

  /** Valor promedio de cada venta registrada en los últimos 30 días. */
  ticketPromedio(): number {
    const cantidad = this.ventasService.cantidadVentasPeriodo(30);
    if (cantidad === 0) return 0;
    return this.ingresosMes() / cantidad;
  }

  /** Margen promedio (en %) considerando todo el catálogo actual. */
  margenPromedioPorcentaje(): number {
    const productos = this.productosService.getProductos()();
    if (productos.length === 0) return 0;
    const margenes = productos
      .filter((p) => p.precioVenta > 0)
      .map((p) => (this.productosService.margen(p) / p.precioVenta) * 100);
    if (margenes.length === 0) return 0;
    return margenes.reduce((acc, m) => acc + m, 0) / margenes.length;
  }

  /**
   * Ingresos mensuales que necesitas para cubrir tus costos operativos (punto de equilibrio),
   * estimado a partir del margen promedio de tu catálogo.
   */
  puntoEquilibrioMensual(): number {
    const margenRatio = this.margenPromedioPorcentaje() / 100;
    if (margenRatio <= 0) return 0;
    return this.gastoOperativoMensualEstimado() / margenRatio;
  }

  /** Qué tan cerca estás de cubrir tus costos este mes (0-100+, puede superar 100%). */
  progresoPuntoEquilibrio(): number {
    const equilibrio = this.puntoEquilibrioMensual();
    if (equilibrio <= 0) return 0;
    return Math.min(999, (this.ingresosMes() / equilibrio) * 100);
  }

  /** Proyección de cierre de mes según el ritmo de ventas actual (regla de tres simple sobre el día del mes). */
  proyeccionCierreMes(): number {
    const hoy = new Date();
    const diaDelMes = hoy.getDate();
    const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    if (diaDelMes === 0) return 0;
    return (this.ingresosMes() / diaDelMes) * diasEnMes;
  }

  /** % de crecimiento de ingresos de esta semana vs. la semana anterior. */
  crecimientoSemanal(): number {
    const actual = this.ingresosSemana();
    const anterior = this.ventasService.ventasEnRango(14, 7).reduce((acc, v) => acc + v.total, 0);
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return ((actual - anterior) / anterior) * 100;
  }

  /** Ingresos de las últimas `n` semanas (incluyendo la actual), de la más antigua a la más reciente. */
  ingresosPorSemana(n = 4): PuntoSemana[] {
    const puntos: PuntoSemana[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const total = this.ventasService.ventasEnRango((i + 1) * 7, i * 7).reduce((acc, v) => acc + v.total, 0);
      puntos.push({ etiqueta: i === 0 ? 'Esta semana' : `Hace ${i} sem.`, total });
    }
    return puntos;
  }

  /** Producto más vendido en unidades (útil para saber qué reponer primero). */
  productoEstrella(): { nombre: string; unidades: number } | null {
    const ranking = this.ventasService.unidadesVendidasPorProducto();
    return ranking.length > 0 ? { nombre: ranking[0].nombre, unidades: ranking[0].unidades } : null;
  }

  /** Producto más rentable del catálogo (mayor margen unitario), útil para priorizar promoción. */
  productoMasRentable(): { nombre: string; margen: number } | null {
    const productos = this.productosService.getProductos()();
    if (productos.length === 0) return null;
    const top = [...productos].sort((a, b) => this.productosService.margen(b) - this.productosService.margen(a))[0];
    return { nombre: top.nombre, margen: this.productosService.margen(top) };
  }

  /** Cantidad de variantes con stock crítico (bajo mínimo), señal de riesgo de quiebre de stock. */
  alertasStockBajo(): number {
    return this.productosService.productosBajoStock(3).length;
  }

  /**
   * Recomendación breve y accionable en base a las métricas actuales, pensada para
   * alguien sin experiencia en finanzas: una sola frase, clara y directa.
   */
  recomendacion(): string {
    const progreso = this.progresoPuntoEquilibrio();
    const alertas = this.alertasStockBajo();
    const crecimiento = this.crecimientoSemanal();

    if (progreso < 100) {
      const faltante = Math.max(0, this.puntoEquilibrioMensual() - this.ingresosMes());
      return `Te faltan S/${faltante.toFixed(0)} en ventas este mes para cubrir tus costos operativos.`;
    }
    if (alertas > 0) {
      return `Ya cubriste tus costos del mes. Tienes ${alertas} talla(s) con stock bajo, revisa tu inventario antes de que se agoten.`;
    }
    if (crecimiento > 5) {
      return `Vas muy bien: tus ventas de esta semana crecieron ${crecimiento.toFixed(0)}% frente a la anterior.`;
    }
    return 'Estás cubriendo tus costos operativos este mes. Sigue así y revisa tu producto estrella para reforzarlo.';
  }
}
