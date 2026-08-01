/**
 * Historial de ventas — vista administrativa dentro del módulo Ventas.
 *
 * Tiene 2 vistas conmutables con un selector tipo pestaña (mismo patrón que
 * el interruptor "Ingresos completos/con margen" de Finanzas): "Ventas" y
 * "Devoluciones". Cada una es su propia tabla paginada con botón "Cargar
 * más" — igual criterio en las dos, y en general en todas las listas tipo
 * tabla de este sistema (a diferencia del scroll infinito con
 * IntersectionObserver que usa el catálogo del POS).
 *
 * "Ver detalle" (de una venta o de una devolución) pide su propio GET al
 * abrir el modal — no viene precargado en la lista, para no traer todos
 * los ítems/fotos solo para pintar la tabla.
 *
 * "Eliminar" de una venta es anular_venta en el backend (pregunta si se
 * debe devolver el stock). "Eliminar" de una devolución es un DESHACER:
 * reintegra el monto a la venta y revierte el stock si esa devolución lo
 * había restaurado — no es un simple borrado de fila.
 *
 * La edición de ventas queda para una próxima etapa (no hay botón/flujo de
 * editar todavía).
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalBrandHeaderComponent } from '../../../../shared/modal-brand-header/modal-brand-header';
import { AuthService } from '../../../../core/auth';
import { environment } from '../../../../../environments/environment';
import {
  DetalleVentaRead,
  DevolucionListItem,
  DevolucionRead,
  EstadoDevolucion,
  EstadoVenta,
  FiltrosHistorialDevoluciones,
  FiltrosHistorialVentas,
  MotivoDevolucion,
  TAMANO_PAGINA_HISTORIAL_DEVOLUCIONES,
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

const ETIQUETAS_MOTIVO_DEVOLUCION: Record<MotivoDevolucion, string> = {
  producto_defectuoso: 'Producto defectuoso',
  talla_incorrecta: 'Talla incorrecta',
  arrepentimiento: 'Arrepentimiento del cliente',
  otro: 'Otro',
};

const ETIQUETAS_ESTADO_DEVOLUCION: Record<EstadoDevolucion, string> = {
  pendiente: 'Pendiente',
  procesada: 'Procesada',
  rechazada: 'Eliminada',
};

/** Estado editable en el modal de registrar devolución: una fila por línea de la venta. */
interface LineaDevolucion {
  detalle: DetalleVentaRead;
  disponible: number;
  cantidad: number;
  restaurarStock: boolean;
}

type Vista = 'ventas' | 'devoluciones';

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalBrandHeaderComponent],
  templateUrl: './historial-ventas.html',
  styleUrls: ['./historial-ventas.css'],
})
export class HistorialVentasComponent implements OnInit {
  constructor(private ventasService: VentasService, private authService: AuthService) {}

  // ── Selector de vista ────────────────────────────────────────────────────
  vista = signal<Vista>('ventas');
  private devolucionesYaCargadas = false;

  // ── Listado de ventas ────────────────────────────────────────────────────
  ventas = signal<VentaListItem[]>([]);
  cargando = signal(true);
  cargandoMas = signal(false);
  hayMas = signal(true);
  error = signal<string | null>(null);
  private offset = 0;

  filtroEstado: EstadoVenta | '' = '';

  // ── Listado de devoluciones ──────────────────────────────────────────────
  devoluciones = signal<DevolucionListItem[]>([]);
  cargandoDevoluciones = signal(true);
  cargandoMasDevoluciones = signal(false);
  hayMasDevoluciones = signal(true);
  errorDevoluciones = signal<string | null>(null);
  private offsetDevoluciones = 0;

  filtroEstadoDevolucion: EstadoDevolucion | '' = '';

  // ── Modal de detalle de venta ────────────────────────────────────────────
  ventaDetalle = signal<VentaRead | null>(null);
  cargandoDetalle = signal(false);
  errorDetalle = signal<string | null>(null);

  // ── Modal de detalle de devolución ───────────────────────────────────────
  devolucionDetalle = signal<DevolucionRead | null>(null);
  cargandoDetalleDevolucion = signal(false);
  errorDetalleDevolucion = signal<string | null>(null);

  // ── Modal de eliminar venta ──────────────────────────────────────────────
  ventaAEliminar = signal<VentaListItem | null>(null);
  restaurarStock = true;
  eliminando = signal(false);
  errorEliminar = signal<string | null>(null);

  // ── Modal de eliminar (deshacer) devolución ──────────────────────────────
  devolucionAEliminar = signal<DevolucionListItem | null>(null);
  eliminandoDevolucion = signal(false);
  errorEliminarDevolucion = signal<string | null>(null);

  // ── Modal de registrar devolución ────────────────────────────────────────
  ventaADevolver = signal<VentaRead | null>(null);
  cargandoVentaADevolver = signal(false);
  lineasDevolucion: LineaDevolucion[] = [];
  motivoDevolucion: MotivoDevolucion = 'producto_defectuoso';
  notasDevolucion = '';
  registrandoDevolucion = signal(false);
  errorDevolucion = signal<string | null>(null);

  readonly motivosDevolucion: { valor: MotivoDevolucion; etiqueta: string }[] = [
    { valor: 'producto_defectuoso', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.producto_defectuoso },
    { valor: 'talla_incorrecta', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.talla_incorrecta },
    { valor: 'arrepentimiento', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.arrepentimiento },
    { valor: 'otro', etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION.otro },
  ];

  ngOnInit(): void {
    this.cargarPrimeraPagina();
  }

  puedeEliminar(): boolean {
    return this.authService.tieneRol('dueño');
  }

  /** Registrar/eliminar una devolución usa el mismo permiso que eliminar una venta (solo Dueño). */
  puedeDevolver(): boolean {
    return this.authService.tieneRol('dueño');
  }

  nombreCliente(v: VentaListItem): string {
    return v.nombre_cliente ?? 'Cliente genérico';
  }

  etiquetaEstado(estado: EstadoVenta): string {
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  /** Arma la URL absoluta de una foto de producto (imagen_url guarda solo la ruta relativa). */
  imagenSrc(imagenUrl: string | null): string | null {
    return imagenUrl ? `${environment.apiUrl}${imagenUrl}` : null;
  }

  etiquetaMotivoDevolucion(motivo: MotivoDevolucion): string {
    return ETIQUETAS_MOTIVO_DEVOLUCION[motivo] ?? motivo;
  }

  etiquetaEstadoDevolucion(estado: EstadoDevolucion): string {
    return ETIQUETAS_ESTADO_DEVOLUCION[estado] ?? estado;
  }

  // ── Selector de vista ────────────────────────────────────────────────────

  cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    if (vista === 'devoluciones' && !this.devolucionesYaCargadas) {
      this.devolucionesYaCargadas = true;
      this.cargarPrimeraPaginaDevoluciones();
    }
  }

  // ── Ventas: carga / paginación ───────────────────────────────────────────

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

  // ── Devoluciones: carga / paginación ─────────────────────────────────────

  cargarPrimeraPaginaDevoluciones(): void {
    this.offsetDevoluciones = 0;
    this.hayMasDevoluciones.set(true);
    this.cargandoDevoluciones.set(true);
    this.errorDevoluciones.set(null);
    this.cargarPaginaDevoluciones(true);
  }

  cargarMasDevoluciones(): void {
    if (this.cargandoMasDevoluciones() || !this.hayMasDevoluciones()) return;
    this.cargandoMasDevoluciones.set(true);
    this.cargarPaginaDevoluciones(false);
  }

  onFiltroEstadoDevolucionChange(valor: EstadoDevolucion | ''): void {
    this.filtroEstadoDevolucion = valor;
    this.cargarPrimeraPaginaDevoluciones();
  }

  private cargarPaginaDevoluciones(reiniciar: boolean): void {
    const filtros: FiltrosHistorialDevoluciones = this.filtroEstadoDevolucion
      ? { estado: this.filtroEstadoDevolucion }
      : {};
    this.ventasService
      .listarDevoluciones(filtros, this.offsetDevoluciones, TAMANO_PAGINA_HISTORIAL_DEVOLUCIONES)
      .subscribe({
        next: (pagina) => {
          this.devoluciones.set(reiniciar ? pagina : [...this.devoluciones(), ...pagina]);
          this.hayMasDevoluciones.set(pagina.length === TAMANO_PAGINA_HISTORIAL_DEVOLUCIONES);
          this.offsetDevoluciones += pagina.length;
          this.cargandoDevoluciones.set(false);
          this.cargandoMasDevoluciones.set(false);
        },
        error: () => {
          this.errorDevoluciones.set('No se pudo cargar el historial de devoluciones. Intenta de nuevo.');
          this.cargandoDevoluciones.set(false);
          this.cargandoMasDevoluciones.set(false);
        },
      });
  }

  // ── Detalle de venta ─────────────────────────────────────────────────────

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

  // ── Detalle de devolución ────────────────────────────────────────────────

  abrirDetalleDevolucion(item: DevolucionListItem): void {
    this.devolucionDetalle.set(null);
    this.errorDetalleDevolucion.set(null);
    this.cargandoDetalleDevolucion.set(true);
    this.ventasService.obtenerDevolucion(item.id_devolucion).subscribe({
      next: (devolucion) => {
        this.devolucionDetalle.set(devolucion);
        this.cargandoDetalleDevolucion.set(false);
      },
      error: () => {
        this.errorDetalleDevolucion.set('No se pudo cargar el detalle de esta devolución.');
        this.cargandoDetalleDevolucion.set(false);
      },
    });
  }

  cerrarDetalleDevolucion(): void {
    this.devolucionDetalle.set(null);
    this.errorDetalleDevolucion.set(null);
  }

  // ── Eliminar venta ───────────────────────────────────────────────────────

  abrirEliminar(item: VentaListItem): void {
    this.ventaAEliminar.set(item);
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
    this.eliminando.set(true);
    this.errorEliminar.set(null);
    this.ventasService
      .eliminarVenta(venta.id_venta, { restaurar_stock: this.restaurarStock })
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

  // ── Eliminar (deshacer) devolución ───────────────────────────────────────

  abrirEliminarDevolucion(item: DevolucionListItem): void {
    this.devolucionAEliminar.set(item);
    this.errorEliminarDevolucion.set(null);
  }

  cerrarEliminarDevolucion(): void {
    if (this.eliminandoDevolucion()) return;
    this.devolucionAEliminar.set(null);
  }

  confirmarEliminarDevolucion(): void {
    const devolucion = this.devolucionAEliminar();
    if (!devolucion) return;
    this.eliminandoDevolucion.set(true);
    this.errorEliminarDevolucion.set(null);
    this.ventasService
      .eliminarDevolucion(devolucion.id_devolucion)
      .subscribe({
        next: () => {
          this.eliminandoDevolucion.set(false);
          this.devolucionAEliminar.set(null);
          this.cargarPrimeraPaginaDevoluciones();
        },
        error: (err) => {
          this.eliminandoDevolucion.set(false);
          this.errorEliminarDevolucion.set(err?.error?.detail ?? 'No se pudo eliminar la devolución.');
        },
      });
  }

  // ── Registrar devolución ─────────────────────────────────────────────────

  /**
   * Pide el detalle completo de la venta (para conocer cantidad_devuelta
   * por línea) y arma una fila editable por cada línea activa.
   */
  abrirDevolucion(item: VentaListItem): void {
    this.ventaADevolver.set(null);
    this.lineasDevolucion = [];
    this.motivoDevolucion = 'producto_defectuoso';
    this.notasDevolucion = '';
    this.errorDevolucion.set(null);
    this.cargandoVentaADevolver.set(true);

    this.ventasService.obtenerVenta(item.id_venta).subscribe({
      next: (venta) => {
        this.ventaADevolver.set(venta);
        this.lineasDevolucion = venta.detalles.map((detalle) => ({
          detalle,
          disponible: detalle.cantidad - detalle.cantidad_devuelta,
          cantidad: 0,
          restaurarStock: true,
        }));
        this.cargandoVentaADevolver.set(false);
      },
      error: () => {
        this.errorDevolucion.set('No se pudo cargar la venta para registrar la devolución.');
        this.cargandoVentaADevolver.set(false);
      },
    });
  }

  cerrarDevolucion(): void {
    if (this.registrandoDevolucion()) return;
    this.ventaADevolver.set(null);
    this.lineasDevolucion = [];
  }

  cambiarCantidadDevolucion(linea: LineaDevolucion, valor: number): void {
    const cantidad = Math.max(0, Math.min(valor || 0, linea.disponible));
    linea.cantidad = cantidad;
  }

  confirmarDevolucion(): void {
    const venta = this.ventaADevolver();
    if (!venta) return;

    const items = this.lineasDevolucion
      .filter((l) => l.cantidad > 0)
      .map((l) => ({
        id_detalle_venta: l.detalle.id_detalle_venta,
        cantidad: l.cantidad,
        restaurar_stock: l.restaurarStock,
      }));

    if (items.length === 0) {
      this.errorDevolucion.set('Indica al menos una cantidad a devolver en alguna línea.');
      return;
    }

    this.registrandoDevolucion.set(true);
    this.errorDevolucion.set(null);
    this.ventasService
      .registrarDevolucion(venta.id_venta, {
        motivo: this.motivoDevolucion,
        notas: this.notasDevolucion.trim() || null,
        items,
      })
      .subscribe({
        next: () => {
          this.registrandoDevolucion.set(false);
          this.ventaADevolver.set(null);
          this.lineasDevolucion = [];
          this.cargarPrimeraPagina();
          this.devolucionesYaCargadas = false; // refresca la próxima vez que se abra la pestaña
          // Si el detalle de esta venta está abierto, refresca para ver el nuevo total.
          if (this.ventaDetalle()?.id_venta === venta.id_venta) {
            this.abrirDetalle({ id_venta: venta.id_venta } as VentaListItem);
          }
        },
        error: (err) => {
          this.registrandoDevolucion.set(false);
          this.errorDevolucion.set(err?.error?.detail ?? 'No se pudo registrar la devolución.');
        },
      });
  }
}
