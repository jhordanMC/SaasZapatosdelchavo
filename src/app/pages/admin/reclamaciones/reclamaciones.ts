import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EstadoReclamacion,
  ReclamacionRead,
  ReclamacionesService,
} from '../../../services/reclamaciones';

const ETIQUETAS_ESTADO: Record<EstadoReclamacion, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
};

const COLORES_ESTADO: Record<EstadoReclamacion, string> = {
  pendiente: '#e65100',
  en_revision: '#1565c0',
  respondido: '#2e7d32',
  cerrado: '#546e7a',
};

@Component({
  selector: 'app-admin-reclamaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reclamaciones.html',
  styleUrls: ['./reclamaciones.css'],
})
export class ReclamacionesAdminComponent implements OnInit {
  constructor(private reclamacionesService: ReclamacionesService) {}

  readonly ETIQUETAS_ESTADO = ETIQUETAS_ESTADO;
  readonly COLORES_ESTADO = COLORES_ESTADO;
  readonly ESTADOS: EstadoReclamacion[] = ['pendiente', 'en_revision', 'respondido', 'cerrado'];

  reclamaciones = signal<ReclamacionRead[]>([]);
  cargando = signal(false);
  error = signal('');

  filtroEstado = signal<EstadoReclamacion | null>(null);

  seleccionada = signal<ReclamacionRead | null>(null);
  guardandoEstado = signal(false);
  nuevoEstado: EstadoReclamacion = 'pendiente';
  notasInternas = '';

  ngOnInit(): void {
    this.cargarLista();
  }

  filtrarPor(estado: EstadoReclamacion | null): void {
    this.filtroEstado.set(estado);
    this.cargarLista();
  }

  cargarLista(): void {
    this.cargando.set(true);
    this.error.set('');
    this.reclamacionesService.listar(this.filtroEstado()).subscribe({
      next: (lista) => {
        this.reclamaciones.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las reclamaciones.');
        this.cargando.set(false);
      },
    });
  }

  abrirDetalle(r: ReclamacionRead): void {
    this.seleccionada.set(r);
    this.nuevoEstado = r.estado;
    this.notasInternas = r.notas_internas ?? '';
  }

  cerrarDetalle(): void {
    this.seleccionada.set(null);
  }

  guardarEstado(): void {
    const r = this.seleccionada();
    if (!r || this.guardandoEstado()) return;
    this.guardandoEstado.set(true);
    this.reclamacionesService
      .actualizarEstado(r.id_reclamacion, {
        estado: this.nuevoEstado,
        notas_internas: this.notasInternas.trim() || null,
      })
      .subscribe({
        next: (actualizado) => {
          this.seleccionada.set(actualizado);
          this.guardandoEstado.set(false);
          this.cargarLista();
        },
        error: () => {
          this.guardandoEstado.set(false);
        },
      });
  }

  etiquetaEstado(estado: EstadoReclamacion): string {
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  colorEstado(estado: EstadoReclamacion): string {
    return COLORES_ESTADO[estado] ?? '#607d8b';
  }

  formatFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
