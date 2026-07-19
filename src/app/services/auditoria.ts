import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RegistroAuditoria {
  id_auditoria: string;
  id_empresa: string;
  id_usuario: string | null;
  nombre_usuario: string | null;
  accion: string;
  tabla_afectada: string | null;
  id_registro_afectado: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  ip_origen: string | null;
  creado_en: string;
}

export interface FiltrosAuditoria {
  limit?: number;
  offset?: number;
  accion?: string;
  tabla_afectada?: string;
  desde?: string;
  hasta?: string;
}

/**
 * Cross-tenant, como EmpresasService/UsuariosService: el staff de ALBA
 * puede revisar la actividad de cualquier empresa-cliente.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listar(idEmpresa: string, filtros: FiltrosAuditoria = {}): Observable<RegistroAuditoria[]> {
    let params = new HttpParams();
    if (filtros.limit != null) params = params.set('limit', filtros.limit);
    if (filtros.offset != null) params = params.set('offset', filtros.offset);
    if (filtros.accion) params = params.set('accion', filtros.accion);
    if (filtros.tabla_afectada) params = params.set('tabla_afectada', filtros.tabla_afectada);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);

    return this.http.get<RegistroAuditoria[]>(`${this.apiUrl}/empresas/${idEmpresa}/auditoria`, { params });
  }
}
