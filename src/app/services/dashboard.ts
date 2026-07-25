/**
 * Servicio Angular del módulo Dashboard — HTTP real contra /dashboard.
 *
 * Reemplaza los mocks anteriores (ProductosService/VentasService con datos
 * inventados). El backend expone un resumen de KPIs (que internamente
 * reutiliza el mismo cálculo de ganancia real que Finanzas, para que ambas
 * pantallas nunca muestren números distintos del mismo hecho) más listas
 * específicas para cada panel (ranking, rotación, talla, día de semana).
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoRotacion = 'saludable' | 'lenta' | 'riesgo' | 'sin-movimiento';

export interface ResumenDashboard {
  ingresos_periodo: number;
  cantidad_ventas: number;
  ticket_promedio: number;
  costo_mercaderia_periodo: number;
  ingresos_con_costo_periodo: number;
  utilidad_bruta_periodo: number;
  margen_bruto_pct: number;
  margen_basado_en_ventas_reales: boolean;
  gasto_operativo_periodo: number;
  utilidad_neta_periodo: number;
  margen_neto_pct: number;
  valor_inventario_costo: number;
  productos_en_riesgo_merma: number;
  crecimiento_semanal_pct: number;
}

export interface ProductoRanking {
  id_producto: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  participacion_pct: number;
}

export interface ProductoSinVentas {
  id_producto: string;
  nombre: string;
}

export interface FilaRotacion {
  id_producto: string;
  nombre: string;
  stock_actual: number;
  unidades_periodo: number;
  velocidad_diaria: number;
  dias_para_agotar: number | null;
  estado: EstadoRotacion;
}

export interface TallaStock {
  talla: string;
  stock: number;
}

export interface VentasPorDiaSemana {
  dia_semana: string;
  ingresos: number;
  cantidad_ventas: number;
}

export interface PuntoMes {
  etiqueta: string;
  ingresos: number;
}

/**
 * Avance de ventas/ganancia/gastos por local, para un rango de fechas.
 *
 * TODAVÍA NO HAY ENDPOINT EN EL BACKEND para esto — ver `cargarAvancePorLocal`
 * más abajo, que por ahora arma datos de ejemplo. Contrato propuesto para
 * cuando se implemente:
 *
 *   GET /dashboard/avance-por-local?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *   → 200 OK: AvancePorLocal[]  (uno por cada local con al menos una venta
 *     en el rango, o todos los locales activos con 0 si no vendieron)
 *
 * `ingresos`, `gasto_operativo` y `ganancia_neta` deberían calcularse igual
 * que en ResumenFinanciero (mismo criterio de costo real de ventas), solo
 * que agrupado por id_local en vez de para toda la empresa.
 */
export interface AvancePorLocal {
  id_local: string;
  nombre_local: string;
  ingresos: number;
  cantidad_ventas: number;
  gasto_operativo: number;
  ganancia_neta: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly base = `${environment.apiUrl}/dashboard`;

  readonly resumen = signal<ResumenDashboard | null>(null);
  readonly rankingProductos = signal<ProductoRanking[]>([]);
  readonly productosSinVentas = signal<ProductoSinVentas[]>([]);
  readonly rotacionInventario = signal<FilaRotacion[]>([]);
  readonly inventarioPorTalla = signal<TallaStock[]>([]);
  readonly ventasPorDiaSemana = signal<VentasPorDiaSemana[]>([]);
  readonly ingresosPorMes = signal<PuntoMes[]>([]);

  constructor(private http: HttpClient) {}

  /** Carga todo lo que necesita la pantalla de Dashboard con una sola llamada por panel. */
  recargarTodo(): void {
    this.cargarResumen();
    this.cargarRankingProductos();
    this.cargarProductosSinVentas();
    this.cargarRotacionInventario();
    this.cargarInventarioPorTalla();
    this.cargarVentasPorDiaSemana();
    this.cargarIngresosPorMes();
  }

  cargarResumen(): void {
    this.http.get<ResumenDashboard>(`${this.base}/resumen`).subscribe((r) => this.resumen.set(r));
  }

  cargarRankingProductos(limit = 10): void {
    const params = new HttpParams().set('limit', limit);
    this.http
      .get<ProductoRanking[]>(`${this.base}/ranking-productos`, { params })
      .subscribe((lista) => this.rankingProductos.set(lista));
  }

  cargarProductosSinVentas(limit = 20): void {
    const params = new HttpParams().set('limit', limit);
    this.http
      .get<ProductoSinVentas[]>(`${this.base}/productos-sin-ventas`, { params })
      .subscribe((lista) => this.productosSinVentas.set(lista));
  }

  cargarRotacionInventario(dias = 30, limit = 20): void {
    const params = new HttpParams().set('dias', dias).set('limit', limit);
    this.http
      .get<FilaRotacion[]>(`${this.base}/rotacion-inventario`, { params })
      .subscribe((lista) => this.rotacionInventario.set(lista));
  }

  cargarInventarioPorTalla(): void {
    this.http
      .get<TallaStock[]>(`${this.base}/inventario-por-talla`)
      .subscribe((lista) => this.inventarioPorTalla.set(lista));
  }

  cargarVentasPorDiaSemana(): void {
    this.http
      .get<VentasPorDiaSemana[]>(`${this.base}/ventas-por-dia-semana`)
      .subscribe((lista) => this.ventasPorDiaSemana.set(lista));
  }

  cargarIngresosPorMes(meses = 6): void {
    const params = new HttpParams().set('meses', meses);
    this.http
      .get<PuntoMes[]>(`${this.base}/ingresos-por-mes`, { params })
      .subscribe((lista) => this.ingresosPorMes.set(lista));
  }

  /**
   * Ranking completo (o casi) de productos, para poder calcular en el
   * frontend el "menos vendido (con ventas)" y el top de categorías —
   * cosas que `cargarRankingProductos` (pensado para mostrar solo el
   * top 10) no cubre. Mismo endpoint, solo que con un límite más alto.
   */
  obtenerRankingProductosAmpliado(limit = 300): Observable<ProductoRanking[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<ProductoRanking[]>(`${this.base}/ranking-productos`, { params });
  }

  /**
   * Avance por local — ver el comentario de `AvancePorLocal` más arriba:
   * todavía no hay endpoint, así que este método arma datos de EJEMPLO a
   * partir de los locales reales de la empresa (nombres reales, montos
   * inventados repartidos de forma pareja). El componente que lo llama
   * marca visualmente que son datos de ejemplo.
   *
   * Cuando exista el endpoint, reemplazar el cuerpo de este método por:
   *   const params = new HttpParams().set('desde', desde).set('hasta', hasta);
   *   return this.http.get<AvancePorLocal[]>(`${this.base}/avance-por-local`, { params });
   * (no hay que tocar nada más: el componente ya consume este método tal cual).
   */
  cargarAvancePorLocal(
    desde: string,
    hasta: string,
    locales: { id_local: string; nombre: string }[],
    ingresosTotalPeriodo: number,
    gastoTotalPeriodo: number
  ): Observable<AvancePorLocal[]> {
    if (locales.length === 0) return of([]);

    // Reparto de ejemplo: no es real, solo para poder ver el diseño del
    // panel mientras no exista el endpoint. Pesos fijos decrecientes para
    // que no todos los locales muestren el mismo número.
    const pesos = locales.map((_, i) => 1 / (i + 1));
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);

    const datosEjemplo: AvancePorLocal[] = locales.map((local, i) => {
      const proporcion = sumaPesos > 0 ? pesos[i] / sumaPesos : 1 / locales.length;
      const ingresos = Math.round(ingresosTotalPeriodo * proporcion * 100) / 100;
      const gasto = Math.round(gastoTotalPeriodo * proporcion * 100) / 100;
      return {
        id_local: local.id_local,
        nombre_local: local.nombre,
        ingresos,
        cantidad_ventas: Math.round(proporcion * 40),
        gasto_operativo: gasto,
        ganancia_neta: Math.round((ingresos - gasto) * 100) / 100,
      };
    });

    return of(datosEjemplo);
  }
}
