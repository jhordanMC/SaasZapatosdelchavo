/**
 * Historial de ventas — vista administrativa dentro del módulo Ventas.
 *
 * Muestra el historial paginado (offset, botón "Cargar más" — igual
 * criterio que usa Finanzas para listas tipo tabla, a diferencia del
 * scroll infinito con IntersectionObserver que usa el catálogo del POS).
 *
 * "Ver detalle" pide GET /ventas/{id} recién al abrir el modal (no viene
 * precargado en la lista, para no traer todos los ítems/fotos de cada
 * venta solo para pintar la tabla).
 *
 * "Eliminar" es anular_venta en el backend, con una pregunta explícita de
 * si se debe devolver el stock al inventario o no. La edición de ventas
 * queda para una próxima etapa (no hay botón/flujo de editar todavía).
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalBrandHeaderComponent } from '../../../../shared/modal-brand-header/modal-brand-header';
import { AuthService } from '../../../../core/auth';
import {
  EstadoVenta,
  FiltrosHistorialVentas,
  TAMANO_PAGINA_HISTORIAL_VENTAS,
  VentaListItem,
  VentaRead,
  VentasService,
} from '../../../../services/ventas';

const ETIQUETAS_ESTADO: Record<EstadoVenta, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  anulada: 'Eliminada',
  devuelta: 'Devuelta',
};

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalBrandHeaderComponent],
  templateUrl: './historial-ventas.html',
  styleUrls: ['./historial-ventas.css'],
})
export class HistorialVentasComponent implements OnInit {
  constructor(private ventasService: VentasService, private authService: AuthService) {}

  // ── Listado ──────────────────────────────────────────────────────────────
  ventas = signal<VentaListItem[]>([]);
  cargando = signal(true);
  cargandoMas = signal(false);
  hayMas = signal(true);
  error = signal<string | null>(null);
  private offset = 0;

  filtroEstado: EstadoVenta | '' = '';

  // ── Modal de detalle ─────────────────────────────────────────────────────
  ventaDetalle = signal<VentaRead | null>(null);
  cargandoDetalle = signal(false);
  errorDetalle = signal<string | null>(null);

  // ── Modal de eliminar ────────────────────────────────────────────────────
  ventaAEliminar = signal<VentaListItem | null>(null);
  motivoEliminar = '';
  restaurarStock = true;
  eliminando = signal(false);
  errorEliminar = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarPrimeraPagina();
  }

  puedeEliminar(): boolean {
    return this.authService.tieneRol('dueño');
  }

  nombreCliente(v: VentaListItem): string {
    return v.nombre_cliente ?? 'Cliente genérico';
  }

  etiquetaEstado(estado: EstadoVenta): string {
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  // ── Carga / paginación ───────────────────────────────────────────────────

  cargarPrimeraPagina(): void {
    this.offset = 0;
    this.hayMas.set(true);
    this.cargando.set(true);
    this.error.set(null);
    this.cargarPagina(true);
  }

  cargarMas(): void {
    if (this.cargandoMas() || !this.hayMas()) return;
    this.cargandoMas.set(true);
    this.cargarPagina(false);
  }

  onFiltroEstadoChange(valor: EstadoVenta | ''): void {
    this.filtroEstado = valor;
    this.cargarPrimeraPagina();
  }

  private cargarPagina(reiniciar: boolean): void {
    const filtros: FiltrosHistorialVentas = this.filtroEstado ? { estado: this.filtroEstado } : {};
    this.ventasService.listarVentas(filtros, this.offset, TAMANO_PAGINA_HISTORIAL_VENTAS).subscribe({
      next: (pagina) => {
        this.ventas.set(reiniciar ? pagina : [...this.ventas(), ...pagina]);
        this.hayMas.set(pagina.length === TAMANO_PAGINA_HISTORIAL_VENTAS);
        this.offset += pagina.length;
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de ventas. Intenta de nuevo.');
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
    });
  }

  // ── Detalle ──────────────────────────────────────────────────────────────

  abrirDetalle(item: VentaListItem): void {
    this.ventaDetalle.set(null);
    this.errorDetalle.set(null);
    this.cargandoDetalle.set(true);
    this.ventasService.obtenerVenta(item.id_venta).subscribe({
      next: (venta) => {
        this.ventaDetalle.set(venta);
        this.cargandoDetalle.set(false);
      },
      error: () => {
        this.errorDetalle.set('No se pudo cargar el detalle de esta venta.');
        this.cargandoDetalle.set(false);
      },
    });
  }

  cerrarDetalle(): void {
    this.ventaDetalle.set(null);
    this.errorDetalle.set(null);
  }

  totalPagos(venta: VentaRead): number {
    return venta.pagos.reduce((acc, p) => acc + p.monto, 0);
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────

  abrirEliminar(item: VentaListItem): void {
    this.ventaAEliminar.set(item);
    this.motivoEliminar = '';
    this.restaurarStock = true;
    this.errorEliminar.set(null);
  }

  cerrarEliminar(): void {
    if (this.eliminando()) return;
    this.ventaAEliminar.set(null);
  }

  confirmarEliminar(): void {
    const venta = this.ventaAEliminar();
    if (!venta) return;
    if (this.motivoEliminar.trim().length < 5) {
      this.errorEliminar.set('Escribe un motivo de al menos 5 caracteres.');
      return;
    }
    this.eliminando.set(true);
    this.errorEliminar.set(null);
    this.ventasService
      .eliminarVenta(venta.id_venta, { motivo: this.motivoEliminar.trim(), restaurar_stock: this.restaurarStock })
      .subscribe({
        next: () => {
          this.eliminando.set(false);
          this.ventaAEliminar.set(null);
          this.cargarPrimeraPagina();
        },
        error: (err) => {
          this.eliminando.set(false);
          this.errorEliminar.set(err?.error?.detail ?? 'No se pudo eliminar la venta.');
        },
      });
  }
}
