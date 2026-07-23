import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CalificacionTopbarInput {
  calificacion: number; // 1-5
  comentario: string | null;
}

/**
 * "Califícanos" del toolbar (topbar): distinto del sistema de encuestas de
 * anuncios.ts (que depende de que ALBA publique una encuesta). Este es un
 * widget siempre disponible desde el menú de perfil del usuario.
 *
 * TODO(backend): el endpoint POST /satisfaccion/topbar todavía NO existe
 * en backendsaasalba — hay que coordinarlo con el equipo de backend para
 * que:
 *   1) reciba { calificacion: number (1-5), comentario: string | null }
 *   2) guarde id_usuario / id_empresa del token igual que el resto de
 *      endpoints autenticados (ver interceptor en core/auth.interceptor.ts)
 *   3) exponga un GET (ej. /admin/satisfaccion) para que el panel
 *      /admin/actividad (o una sección nueva) pueda listarlas
 * Mientras ese endpoint no exista, esta llamada devolverá 404 y el topbar
 * mostrará el mensaje de error ya contemplado en la UI.
 */
@Injectable({ providedIn: 'root' })
export class SatisfaccionService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  enviarCalificacionTopbar(datos: CalificacionTopbarInput): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/satisfaccion/topbar`, datos);
  }
}
