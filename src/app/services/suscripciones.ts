import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoSuscripcion = 'trial' | 'activa' | 'vencida' | 'cancelada';
export type EstadoPago = 'pendiente' | 'pagado' | 'fallido' | 'reembolsado';

export type PeriodoPlan = 'mensual' | 'anual';

export interface Plan {
  id_plan: string;
  nombre: string;
  precio: number;
  moneda: string;
  periodo: string;
  max_usuarios: number | null;
  max_locales: number | null;
  max_ventas_mes: number | null;
  /** Beneficio: acceso a conectar marketplaces (Falabella, Ripley, Mercado Libre). */
  integraciones_omnicanal: boolean;
  esta_activo: boolean;
}

export interface PlanCreateInput {
  nombre: string;
  precio: number;
  moneda?: string;
  periodo?: PeriodoPlan;
  max_usuarios?: number | null;
  max_locales?: number | null;
  max_ventas_mes?: number | null;
  integraciones_omnicanal?: boolean;
}

export interface PlanUpdateInput {
  nombre?: string;
  precio?: number;
  moneda?: string;
  periodo?: PeriodoPlan;
  max_usuarios?: number | null;
  max_locales?: number | null;
  max_ventas_mes?: number | null;
  integraciones_omnicanal?: boolean;
  esta_activo?: boolean;
}

export interface Suscripcion {
  id_suscripcion: string;
  id_empresa: string;
  id_plan: string;
  plan: string;
  monto_mensual: number;
  descuento_monto: number;
  estado: EstadoSuscripcion;
  fecha_inicio: string;
  fecha_vencimiento: string | null;
  creado_en: string;
}

/** Suscripcion + nombre de empresa, para el panel centralizado /admin/suscripciones. */
export interface SuscripcionListItem extends Suscripcion {
  empresa: string;
}

export interface Pago {
  id_pago: string;
  id_suscripcion: string;
  monto: number;
  estado: EstadoPago;
  fecha_pago: string | null;
  numero_comprobante: string | null;
  url_comprobante: string | null;
  creado_en: string;
}

export interface SuscripcionCreateInput {
  id_plan: string;
  precio_acordado: number;
  descuento_monto?: number;
  estado?: EstadoSuscripcion;
  fecha_fin?: string | null;
}

export interface SuscripcionUpdateInput {
  id_plan?: string;
  precio_acordado?: number;
  descuento_monto?: number;
  estado?: EstadoSuscripcion;
  fecha_fin?: string | null;
}

export interface PagoInput {
  monto: number;
  estado: EstadoPago;
  fecha_pago?: string | null;
  numero_comprobante?: string | null;
}

/**
 * Cross-tenant, exclusivo del staff de ALBA: administra el plan y el
 * historial de pagos/facturas de cualquier empresa-cliente.
 */
@Injectable({ providedIn: 'root' })
export class SuscripcionesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarPlanes(incluirInactivos = false): Observable<Plan[]> {
    const params: Record<string, string> = incluirInactivos ? { incluir_inactivos: 'true' } : {};
    return this.http.get<Plan[]>(`${this.apiUrl}/empresas/planes`, { params });
  }

  crearPlan(datos: PlanCreateInput): Observable<Plan> {
    return this.http.post<Plan>(`${this.apiUrl}/empresas/planes`, datos);
  }

  actualizarPlan(idPlan: string, datos: PlanUpdateInput): Observable<Plan> {
    return this.http.put<Plan>(`${this.apiUrl}/empresas/planes/${idPlan}`, datos);
  }

  /** Cross-tenant: todas las suscripciones de todas las empresas, para el panel centralizado. */
  listarTodas(): Observable<SuscripcionListItem[]> {
    return this.http.get<SuscripcionListItem[]>(`${this.apiUrl}/empresas/suscripciones`);
  }

  obtenerSuscripcion(idEmpresa: string): Observable<Suscripcion> {
    return this.http.get<Suscripcion>(`${this.apiUrl}/empresas/${idEmpresa}/suscripcion`);
  }

  crearSuscripcion(idEmpresa: string, datos: SuscripcionCreateInput): Observable<Suscripcion> {
    return this.http.post<Suscripcion>(`${this.apiUrl}/empresas/${idEmpresa}/suscripcion`, datos);
  }

  actualizarSuscripcion(idEmpresa: string, datos: SuscripcionUpdateInput): Observable<Suscripcion> {
    return this.http.put<Suscripcion>(`${this.apiUrl}/empresas/${idEmpresa}/suscripcion`, datos);
  }

  listarPagos(idEmpresa: string): Observable<Pago[]> {
    return this.http.get<Pago[]>(`${this.apiUrl}/empresas/${idEmpresa}/suscripcion/pagos`);
  }

  registrarPago(idEmpresa: string, datos: PagoInput): Observable<Pago> {
    return this.http.post<Pago>(`${this.apiUrl}/empresas/${idEmpresa}/suscripcion/pagos`, datos);
  }
}
