import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CalificacionTopbarInput {
  calificacion: number; // 1-5
  comentario: string | null;
}

/** Score de satisfacción (0-100) de una empresa — panel /admin/dashboard. */
export interface EmpresaScoreSatisfaccion {
  id_empresa: string;
  score_promedio: number;
}

/**
 * `existen_calificaciones=false` = todavía nadie calificó nunca desde el
 * topbar (distinto de "hay calificaciones pero de otras empresas"). Una
 * empresa ausente de `scores` significa que sus usuarios todavía no
 * calificaron.
 */
export interface ScoreSatisfaccionResponse {
  existen_calificaciones: boolean;
  scores: EmpresaScoreSatisfaccion[];
}

/**
 * "Califícanos" del topbar: único canal oficial de satisfacción de
 * usuarios (reemplaza a la vieja encuesta `es_satisfaccion` de
 * anuncios.ts, que queda solo como historial). Widget siempre disponible
 * desde el menú de perfil, sin encuesta ni vencimiento — el score por
 * empresa de /admin/dashboard es el promedio histórico completo de todas
 * las calificaciones.
 */
@Injectable({ providedIn: 'root' })
export class SatisfaccionService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  enviarCalificacionTopbar(datos: CalificacionTopbarInput): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/satisfaccion/topbar`, datos);
  }

  /** Score de satisfacción (0-100) por empresa — panel /admin/dashboard. */
  obtenerScorePorEmpresa(): Observable<ScoreSatisfaccionResponse> {
    return this.http.get<ScoreSatisfaccionResponse>(`${this.apiUrl}/satisfaccion/por-empresa`);
  }
}
