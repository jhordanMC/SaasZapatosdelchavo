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
}
