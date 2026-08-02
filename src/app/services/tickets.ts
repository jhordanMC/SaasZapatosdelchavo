import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoTicket = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';
export type CategoriaTicket = 'bug' | 'pregunta' | 'facturacion' | 'solicitud' | 'otro';
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'urgente';
export type AutorTipoMensaje = 'staff_tenant' | 'staff_alba' | 'bot';

export interface MensajeTicket {
  id_mensaje: string;
  autor_tipo: AutorTipoMensaje;
  id_usuario: string | null;
  autor_nombre_alba: string | null;
  contenido: string;
  creado_en: string;
}

export interface Ticket {
  id_ticket: string;
  id_empresa: string;
  id_usuario: string;
  id_conversacion: string | null;
  asunto: string;
  descripcion: string;
  categoria: CategoriaTicket;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  asignado_a_alba: string | null;
  creado_en: string;
  actualizado_en: string;
  cerrado_en: string | null;
  nombre_empresa: string | null;
  nombre_usuario_reporta: string | null;
}

export interface TicketConMensajes extends Ticket {
  mensajes: MensajeTicket[];
}

/** Centro de Soporte (admin) — cross-tenant, ver /tickets/soporte/* en el backend. */
@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly base = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  listarSoporte(estado?: EstadoTicket | null): Observable<Ticket[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http.get<Ticket[]>(`${this.base}/soporte`, { params });
  }

  obtenerSoporte(idTicket: string): Observable<TicketConMensajes> {
    return this.http.get<TicketConMensajes>(`${this.base}/soporte/${idTicket}`);
  }

  cambiarEstado(idTicket: string, estado: EstadoTicket): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.base}/soporte/${idTicket}/estado`, { estado });
  }

  asignar(idTicket: string, asignadoAAlba: string | null): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.base}/soporte/${idTicket}/asignar`, { asignado_a_alba: asignadoAAlba });
  }

  responder(idTicket: string, mensaje: string): Observable<TicketConMensajes> {
    return this.http.post<TicketConMensajes>(`${this.base}/soporte/${idTicket}/mensajes`, { mensaje });
  }
}
