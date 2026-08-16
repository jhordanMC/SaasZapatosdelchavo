import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoTicket, Ticket, TicketConMensajes, TicketsService } from '../../../services/tickets';

const ETIQUETAS_ESTADO: Record<EstadoTicket, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tickets.html',
  styleUrls: ['./tickets.css'],
})
export class TicketsAdminComponent implements OnInit {
  constructor(private ticketsService: TicketsService) {}

  readonly ETIQUETAS_ESTADO = ETIQUETAS_ESTADO;
  readonly ESTADOS: EstadoTicket[] = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];

  tickets: Ticket[] = [];
  cargando = false;
  error = '';
  filtroEstado: EstadoTicket | null = null;

  ticketSeleccionado: TicketConMensajes | null = null;
  cargandoDetalle = false;
  guardandoEstado = false;
  guardandoAsignacion = false;
  asignadoInput = '';
  nuevoMensaje = '';
  enviandoMensaje = false;

  ngOnInit(): void {
    this.cargarLista();
  }

  filtrarPor(estado: EstadoTicket | null): void {
    this.filtroEstado = estado;
    this.cargarLista();
  }

  private cargarLista(): void {
    this.cargando = true;
    this.error = '';
    this.ticketsService.listarSoporte(this.filtroEstado).subscribe({
      next: (lista) => {
        this.tickets = lista;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los tickets.';
        this.cargando = false;
      },
    });
  }

  abrirTicket(ticket: Ticket): void {
    this.cargandoDetalle = true;
    this.ticketSeleccionado = null;
    this.ticketsService.obtenerSoporte(ticket.id_ticket).subscribe({
      next: (detalle) => {
        this.ticketSeleccionado = detalle;
        this.asignadoInput = detalle.asignado_a_alba ?? '';
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
      },
    });
  }

  cerrarDetalle(): void {
    this.ticketSeleccionado = null;
    this.nuevoMensaje = '';
  }

  cambiarEstado(estado: EstadoTicket): void {
    if (!this.ticketSeleccionado || this.guardandoEstado) return;
    this.guardandoEstado = true;
    this.ticketsService.cambiarEstado(this.ticketSeleccionado.id_ticket, estado).subscribe({
      next: (actualizado) => {
        this.guardandoEstado = false;
        if (this.ticketSeleccionado) this.ticketSeleccionado = { ...this.ticketSeleccionado, ...actualizado };
        this.cargarLista();
      },
      error: () => {
        this.guardandoEstado = false;
      },
    });
  }

  guardarAsignacion(): void {
    if (!this.ticketSeleccionado || this.guardandoAsignacion) return;
    this.guardandoAsignacion = true;
    const valor = this.asignadoInput.trim() || null;
    this.ticketsService.asignar(this.ticketSeleccionado.id_ticket, valor).subscribe({
      next: (actualizado) => {
        this.guardandoAsignacion = false;
        if (this.ticketSeleccionado) this.ticketSeleccionado = { ...this.ticketSeleccionado, ...actualizado };
        this.cargarLista();
      },
      error: () => {
        this.guardandoAsignacion = false;
      },
    });
  }

  enviarMensaje(): void {
    const mensaje = this.nuevoMensaje.trim();
    if (!mensaje || !this.ticketSeleccionado || this.enviandoMensaje) return;
    this.enviandoMensaje = true;
    this.ticketsService.responder(this.ticketSeleccionado.id_ticket, mensaje).subscribe({
      next: (detalle) => {
        this.ticketSeleccionado = detalle;
        this.nuevoMensaje = '';
        this.enviandoMensaje = false;
      },
      error: () => {
        this.enviandoMensaje = false;
      },
    });
  }

  nombreAutor(mensaje: TicketConMensajes['mensajes'][number]): string {
    if (mensaje.autor_tipo === 'staff_alba') return mensaje.autor_nombre_alba ?? 'Staff de ALBA';
    if (mensaje.autor_tipo === 'bot') return 'Varian Assist';
    return this.ticketSeleccionado?.nombre_usuario_reporta ?? 'Cliente';
  }
}