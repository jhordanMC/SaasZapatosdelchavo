import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoDocumento = 'DNI' | 'CE' | 'Pasaporte';
export type TipoBien = 'producto' | 'servicio';
export type TipoReclamo = 'reclamo' | 'queja';
export type EstadoReclamacion = 'pendiente' | 'en_revision' | 'respondido' | 'cerrado';

export interface ReclamacionCreate {
  nombre: string;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  correo?: string | null;
  telefono?: string | null;
  domicilio?: string | null;
  tipo_bien: TipoBien;
  monto_reclamado?: string | null;
  descripcion_bien?: string | null;
  tipo: TipoReclamo;
  detalle: string;
  pedido?: string | null;
}

export interface ReclamacionCreada {
  numero_correlativo: string;
  mensaje: string;
}

export interface ReclamacionRead {
  id_reclamacion: string;
  numero_correlativo: string;
  nombre: string;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  correo: string | null;
  telefono: string | null;
  domicilio: string | null;
  tipo_bien: TipoBien;
  monto_reclamado: string | null;
  descripcion_bien: string | null;
  tipo: TipoReclamo;
  detalle: string;
  pedido: string | null;
  estado: EstadoReclamacion;
  notas_internas: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface ReclamacionEstadoUpdate {
  estado: EstadoReclamacion;
  notas_internas?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReclamacionesService {
  private readonly base = `${environment.apiUrl}`;
  private readonly publico = `${environment.apiUrl}/publico/reclamaciones`;
  private readonly admin = `${environment.apiUrl}/reclamaciones`;

  constructor(private http: HttpClient) {}

  /** Público: el ciudadano envía el formulario */
  registrar(data: ReclamacionCreate): Observable<ReclamacionCreada> {
    return this.http.post<ReclamacionCreada>(this.publico, data);
  }

  /** Admin: lista paginada de reclamos */
  listar(estado?: EstadoReclamacion | null, limit = 50, offset = 0): Observable<ReclamacionRead[]> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (estado) params = params.set('estado', estado);
    return this.http.get<ReclamacionRead[]>(this.admin, { params });
  }

  /** Admin: detalle de un reclamo */
  obtener(id: string): Observable<ReclamacionRead> {
    return this.http.get<ReclamacionRead>(`${this.admin}/${id}`);
  }

  /** Admin: actualiza estado y/o notas del reclamo */
  actualizarEstado(id: string, data: ReclamacionEstadoUpdate): Observable<ReclamacionRead> {
    return this.http.patch<ReclamacionRead>(`${this.admin}/${id}/estado`, data);
  }
}
