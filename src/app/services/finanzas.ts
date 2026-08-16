/**
 * Servicio Angular del módulo Finanzas — HTTP real contra /finanzas.
 *
 * Reemplaza los mocks anteriores (gastos en memoria, ingresos inventados).
 * El backend expone un único endpoint de resumen con todos los KPIs ya
 * calculados (ver ResumenFinanciero en el backend) para que el dashboard
 * se pinte con una sola petición, más los CRUD de gastos recurrentes y
 * gastos únicos/extraordinarios.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MetodoPago } from './ventas';

export type Frecuencia = 'diario' | 'semanal' | 'mensual';

export interface GastoRecurrenteRead {
  id_gasto_recurrente: string;
  concepto: string;
  tipo_gasto: string;
  monto: number;
  frecuencia: Frecuencia;
  fecha_inicio: string;
  fecha_fin: string | null;
  id_local: string | null;
  nombre_local: string | null;
  id_almacen: string | null;
  nombre_almacen: string | null;
  notas: string | null;
  creado_en: string;
}

export interface GastoRecurrenteCreate {
  concepto: string;
  tipo_gasto: string;
  monto: number;
  frecuencia: Frecuencia;
  fecha_inicio: string;
  fecha_fin?: string | null;
  id_local?: string | null;
  id_almacen?: string | null;
  notas?: string | null;
}

export interface GastoOperativoRead {
  id_gasto: string;
  concepto: string;
  tipo_gasto: string;
  monto: number;
  fecha: string;
  id_local: string | null;
  nombre_local: string | null;
  id_almacen: string | null;
  nombre_almacen: string | null;
  notas: string | null;
  creado_en: string;
}

export interface GastoOperativoCreate {
  concepto: string;
  tipo_gasto: string;
  monto: number;
  fecha: string;
  id_local?: string | null;
  id_almacen?: string | null;
  notas?: string | null;
}

export interface GastosOperativosPaginados {
  items: GastoOperativoRead[];
  hay_mas: boolean;
  siguiente_offset: number;
}

export interface PuntoSemana {
  etiqueta: string;
  total: number;
}

export interface VentasPorMetodoPago {
  metodo: MetodoPago;
  cantidad: number;
  monto: number;
}

export interface ResumenFinanciero {
  desde: string;
  hasta: string;
  ingresos_periodo: number;
  cantidad_ventas: number;
  ticket_promedio: number;
  gasto_operativo_periodo: number;
  margen_bruto_periodo: number;
  ingresos_con_costo_periodo: number;
  ganancia_neta_periodo: number;
  esta_generando_ganancia: boolean;
  hay_gastos_unicos_periodo: boolean;
  hay_gastos_recurrentes_periodo: boolean;
  margen_promedio_pct: number;
  margen_basado_en_ventas_reales: boolean;
  punto_equilibrio_periodo: number | null;
  progreso_punto_equilibrio_pct: number;
  proyeccion_cierre_periodo: number | null;
  crecimiento_vs_periodo_anterior_pct: number;
  producto_estrella: string | null;
  producto_estrella_unidades: number | null;
  producto_mas_rentable: string | null;
  alertas_stock_bajo: number;
  recomendacion: string;
}

export interface StatsProveedor {
  id_proveedor: string;
  nombre: string;
  total_productos: number;
  unidades_vendidas: number;
  inversion_estimada: number;
}

export interface StatsProveedoresResponse {
  proveedores: StatsProveedor[];
}

export interface MensajeResponse {
  mensaje: string;
}

/** Sugerencias de tipo de gasto — texto libre, no un catálogo cerrado. */
export const TIPOS_GASTO_SUGERIDOS = [
  'Alquiler de local',
  'Sueldo de trabajador',
  'Servicios (luz, agua, internet)',
  'Publicidad',
  'Mantenimiento',
  'Impuestos',
  'Otro',
];

@Injectable({ providedIn: 'root' })
export class FinanzasService {
  private readonly base = `${environment.apiUrl}/finanzas`;

  readonly resumen = signal<ResumenFinanciero | null>(null);
  readonly ingresosPorSemana = signal<PuntoSemana[]>([]);
  readonly gastosRecurrentes = signal<GastoRecurrenteRead[]>([]);
  readonly gastosOperativos = signal<GastoOperativoRead[]>([]);
  readonly hayMasGastosOperativos = signal(false);

  constructor(private http: HttpClient) {}

  /** Carga el resumen (KPIs), la serie semanal y ambas listas de gastos. */
  recargarTodo(): void {
    this.cargarResumen();
    this.cargarIngresosPorSemana();
    this.cargarGastosRecurrentes();
    this.cargarGastosOperativos();
  }

  cargarResumen(desde?: string, hasta?: string): void {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    this.http
      .get<ResumenFinanciero>(`${this.base}/resumen`, { params })
      .subscribe((resumen) => this.resumen.set(resumen));
  }

  /**
   * Igual que cargarResumen, pero sin tocar el signal `resumen` — pensado
   * para reportes por rango arbitrario (p. ej. el resumen mensual de
   * compras y ventas) que no deben pisar el período que se ve en pantalla.
   */
  obtenerResumenPeriodo(desde: string, hasta: string): Observable<ResumenFinanciero> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<ResumenFinanciero>(`${this.base}/resumen`, { params });
  }

  cargarIngresosPorSemana(semanas = 4): void {
    const params = new HttpParams().set('semanas', semanas);
    this.http
      .get<PuntoSemana[]>(`${this.base}/ingresos-por-semana`, { params })
      .subscribe((puntos) => this.ingresosPorSemana.set(puntos));
  }

  /** Ventas agrupadas por método de pago en el período (mismo desde/hasta que el resto del dashboard). */
  obtenerVentasPorMetodoPago(desde: string, hasta: string): Observable<VentasPorMetodoPago[]> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<VentasPorMetodoPago[]>(`${this.base}/ventas-por-metodo-pago`, { params });
  }

  obtenerStatsProveedores(): Observable<StatsProveedoresResponse> {
    return this.http.get<StatsProveedoresResponse>(`${this.base}/proveedores-stats`);
  }

  // ── Gastos recurrentes ──────────────────────────────────────────────────

  cargarGastosRecurrentes(): void {
    this.http
      .get<GastoRecurrenteRead[]>(`${this.base}/gastos-recurrentes`)
      .subscribe((gastos) => this.gastosRecurrentes.set(gastos));
  }

  crearGastoRecurrente(data: GastoRecurrenteCreate): Observable<GastoRecurrenteRead> {
    return this.http.post<GastoRecurrenteRead>(`${this.base}/gastos-recurrentes`, data);
  }

  eliminarGastoRecurrente(idGastoRecurrente: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/gastos-recurrentes/${idGastoRecurrente}`);
  }

  // ── Gastos únicos / extraordinarios ─────────────────────────────────────

  cargarGastosOperativos(offset = 0, limit = 30): void {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    this.http
      .get<GastosOperativosPaginados>(`${this.base}/gastos`, { params })
      .subscribe((pagina) => {
        this.gastosOperativos.set(offset === 0 ? pagina.items : [...this.gastosOperativos(), ...pagina.items]);
        this.hayMasGastosOperativos.set(pagina.hay_mas);
      });
  }

  crearGastoOperativo(data: GastoOperativoCreate): Observable<GastoOperativoRead> {
    return this.http.post<GastoOperativoRead>(`${this.base}/gastos`, data);
  }

  eliminarGastoOperativo(idGasto: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/gastos/${idGasto}`);
  }
}
