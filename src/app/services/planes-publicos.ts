import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TipoDescuento, TipoPlan } from './suscripciones';

export interface CaracteristicaPlanPublica {
  id_caracteristica: string;
  id_plan: string;
  texto: string;
  es_positiva: boolean;
  orden: number;
}

export interface DescuentoPlanPublico {
  id_descuento: string;
  id_plan: string;
  etiqueta: string;
  tipo: TipoDescuento;
  valor: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  esta_activo: boolean;
}

export interface PlanPublico {
  id_plan: string;
  nombre: string;
  descripcion: string | null;
  tipo_plan: TipoPlan | null;
  precio: number;
  precio_efectivo: number;
  moneda: string;
  periodo: string;
  es_destacado: boolean;
  orden_visual: number;
  max_usuarios: number | null;
  max_locales: number | null;
  max_ventas_mes: number | null;
  caracteristicas: CaracteristicaPlanPublica[];
  descuento_activo: DescuentoPlanPublico | null;
}

/**
 * Consume el catálogo público de planes (GET /billing/public/planes),
 * sin autenticación — es lo que alimenta la landing /precios. No usa
 * ningún endpoint de /empresas/planes (ese es exclusivo del panel admin).
 */
@Injectable({ providedIn: 'root' })
export class PlanesPublicosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarPlanes(): Observable<PlanPublico[]> {
    return this.http.get<PlanPublico[]>(`${this.apiUrl}/billing/public/planes`);
  }
}
