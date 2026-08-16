/**
 * Historial de ventas — vista administrativa dentro del módulo Ventas.
 *
 * Tiene 2 vistas conmutables con un selector tipo pestaña: "Ventas" y
 * "Devoluciones". Cada una tiene su propia tabla con scroll infinito
 * ("Cargar más") y filtros por fecha, texto y estado.
 *
 * "Ver detalle" (de una venta o de una devolución) pide su propio GET al
 * abrir el modal — no viene precargado en la lista, para no traer todos
 * los ítems/fotos solo para pintar la tabla.
 *
 * "Eliminar" de una venta es anular_venta en el backend (pregunta si se
 * debe devolver el stock). "Eliminar" de una devolución es un DESHACER:
 * reintegra el monto a la venta y revierte el stock si esa devolución lo
 * había restaurado — no es un simple borrado de fila.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ModalBrandHeaderComponent } from '../../../../shared/modal-brand-header/modal-brand-header';
import { AuthService } from '../../../../core/auth';
import { environment } from '../../../../../environments/environment';
import {
  exportarBoletaSimple,
  exportarBoletaVenta80mm,
  exportarBoletaVentaNormal,
} from '../../../../utils/exportar-boleta-venta';
import {
  DetalleVentaRead,
  DevolucionListItem,
  DevolucionRead,
  EstadoDevolucion,
  EstadoVenta,
  FiltrosHistorialDevoluciones,
  FiltrosHistorialVentas,
  MotivoDevolucion,
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
  constructor(
    private ventasService: VentasService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  // ── Selector de vista ────────────────────────────────────────────────────
  vista = signal<Vista>('ventas');
  private devolucionesYaCargadas = false;

  // ── Listado de ventas ────────────────────────────────────────────────────
  ventas = signal<VentaListItem[]>([]);
  cargando = signal(true);
  cargandoMas = signal(false);
  hayMasVentas = signal(true);
  error = signal<string | null>(null);
  private offsetVentas = 0;

  filtroEstado: EstadoVenta | '' = '';
  busqueda = '';
  fechaDesde = '';
  fechaHasta = '';

  // ── Listado de devoluciones ──────────────────────────────────────────────
  devoluciones = signal<DevolucionListItem[]>([]);
  cargandoDevoluciones = signal(true);
  cargandoMasDevoluciones = signal(false);
  hayMasDevoluciones = signal(true);
  errorDevoluciones = signal<string | null>(null);
  private offsetDevoluciones = 0;

  filtroEstadoDevolucion: EstadoDevolucion | '' = '';
  busquedaDevoluciones = '';
  fechaDesdeDevoluciones = '';
  fechaHastaDevoluciones = '';

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
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'devoluciones') {
      this.cambiarVista('devoluciones');
    }
    this.cargarPrimeraVentas();
  }

  puedeEliminar(): boolean {
    return this.authService.tieneRol('dueño');
  }

  /** Registrar/eliminar una devolución usa el mismo permiso que eliminar una venta (solo Dueño). */
  puedeDevolver(): boolean {
    return this.authService.tieneRol('dueño');
  }

  get hayFiltros(): boolean {
    return !!this.filtroEstado || !!this.busqueda || !!this.fechaDesde || !!this.fechaHasta;
  }

  limpiarFiltros(): void {
    this.filtroEstado = '';
    this.busqueda = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.aplicarCambio();
  }

  get hayFiltrosDevoluciones(): boolean {
    return (
      !!this.filtroEstadoDevolucion ||
      !!this.busquedaDevoluciones ||
      !!this.fechaDesdeDevoluciones ||
      !!this.fechaHastaDevoluciones
    );
  }

  limpiarFiltrosDevoluciones(): void {
    this.filtroEstadoDevolucion = '';
    this.busquedaDevoluciones = '';
    this.fechaDesdeDevoluciones = '';
    this.fechaHastaDevoluciones = '';
    this.aplicarCambioDevoluciones();
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

  fechaHora(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  iniciales(nombre: string | null): string {
    if (!nombre) return '·';
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  // ── Selector de vista ────────────────────────────────────────────────────

  cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    if (vista === 'devoluciones' && !this.devolucionesYaCargadas) {
      this.devolucionesYaCargadas = true;
      this.cargarPrimeraDevoluciones();
    }
  }

  // ── Ventas: filtros / carga ──────────────────────────────────────────────

  /** Cualquier cambio de filtro reinicia la lista desde cero. */
  aplicarCambio(): void {
    this.offsetVentas = 0;
    this.ventas.set([]);
    this.hayMasVentas.set(true);
    this.cargarPrimeraVentas();
  }

  onFiltroEstadoChange(valor: EstadoVenta | ''): void {
    this.filtroEstado = valor;
    this.aplicarCambio();
  }

  onFiltroFechaChange(): void {
    this.aplicarCambio();
  }

  onBusquedaChange(valor: string): void {
    this.busqueda = valor;
    // Pequeño debounce manual: el ngModel ya disparó el cambio
  }

  onBusquedaKeyup(): void {
    this.aplicarCambio();
  }

  cargarPrimeraVentas(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.offsetVentas = 0;
    const filtros = this.buildFiltrosVentas();
    this.ventasService.listarVentas(filtros, 0).subscribe({
      next: (lista) => {
        this.ventas.set(lista);
        this.hayMasVentas.set(lista.length >= 30);
        this.offsetVentas = lista.length;
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de ventas. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  cargarMasVentas(): void {
    if (this.cargandoMas() || !this.hayMasVentas()) return;
    this.cargandoMas.set(true);
    const filtros = this.buildFiltrosVentas();
    this.ventasService.listarVentas(filtros, this.offsetVentas).subscribe({
      next: (lista) => {
        this.ventas.update((actual) => [...actual, ...lista]);
        this.hayMasVentas.set(lista.length >= 30);
        this.offsetVentas += lista.length;
        this.cargandoMas.set(false);
      },
      error: () => {
        this.cargandoMas.set(false);
      },
    });
  }

  private buildFiltrosVentas(): FiltrosHistorialVentas {
    const filtros: FiltrosHistorialVentas = {};
    if (this.filtroEstado) filtros.estado = this.filtroEstado;
    if (this.busqueda.trim()) filtros.busqueda = this.busqueda.trim();
    if (this.fechaDesde) filtros.desde = `${this.fechaDesde}T00:00:00`;
    if (this.fechaHasta) filtros.hasta = `${this.fechaHasta}T23:59:59`;
    return filtros;
  }

  // ── Devoluciones: filtros / carga ────────────────────────────────────────

  aplicarCambioDevoluciones(): void {
    this.offsetDevoluciones = 0;
    this.devoluciones.set([]);
    this.hayMasDevoluciones.set(true);
    this.cargarPrimeraDevoluciones();
  }

  onFiltroEstadoDevolucionChange(valor: EstadoDevolucion | ''): void {
    this.filtroEstadoDevolucion = valor;
    this.aplicarCambioDevoluciones();
  }

  onFiltroFechaDevolucionesChange(): void {
    this.aplicarCambioDevoluciones();
  }

  onBusquedaDevolucionesKeyup(): void {
    this.aplicarCambioDevoluciones();
  }

  cargarPrimeraDevoluciones(): void {
    this.cargandoDevoluciones.set(true);
    this.errorDevoluciones.set(null);
    this.offsetDevoluciones = 0;
    const filtros = this.buildFiltrosDevoluciones();
    this.ventasService.listarDevoluciones(filtros, 0).subscribe({
      next: (lista) => {
        this.devoluciones.set(lista);
        this.hayMasDevoluciones.set(lista.length >= 30);
        this.offsetDevoluciones = lista.length;
        this.cargandoDevoluciones.set(false);
      },
      error: () => {
        this.errorDevoluciones.set('No se pudo cargar el historial de devoluciones. Intenta de nuevo.');
        this.cargandoDevoluciones.set(false);
      },
    });
  }

  cargarMasDevoluciones(): void {
    if (this.cargandoMasDevoluciones() || !this.hayMasDevoluciones()) return;
    this.cargandoMasDevoluciones.set(true);
    const filtros = this.buildFiltrosDevoluciones();
    this.ventasService.listarDevoluciones(filtros, this.offsetDevoluciones).subscribe({
      next: (lista) => {
        this.devoluciones.update((actual) => [...actual, ...lista]);
        this.hayMasDevoluciones.set(lista.length >= 30);
        this.offsetDevoluciones += lista.length;
        this.cargandoMasDevoluciones.set(false);
      },
      error: () => {
        this.cargandoMasDevoluciones.set(false);
      },
    });
  }

  private buildFiltrosDevoluciones(): FiltrosHistorialDevoluciones {
    const filtros: FiltrosHistorialDevoluciones = {};
    if (this.filtroEstadoDevolucion) filtros.estado = this.filtroEstadoDevolucion;
    if (this.busquedaDevoluciones.trim()) filtros.busqueda = this.busquedaDevoluciones.trim();
    if (this.fechaDesdeDevoluciones) filtros.desde = `${this.fechaDesdeDevoluciones}T00:00:00`;
    if (this.fechaHastaDevoluciones) filtros.hasta = `${this.fechaHastaDevoluciones}T23:59:59`;
    return filtros;
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

  private opcionesBranding() {
    const u = this.authService.usuarioActual();
    const topbarImg = document.querySelector('img.avatar-img') as HTMLImageElement | null;
    let fotoUrl: string | null = (topbarImg && topbarImg.src && !topbarImg.src.includes('data:image/svg')) ? topbarImg.src : null;

    if (!fotoUrl && u?.avatarUrl) {
      if (u.avatarUrl.startsWith('http') || u.avatarUrl.startsWith('data:')) {
        fotoUrl = u.avatarUrl;
      } else {
        const path = u.avatarUrl.startsWith('/') ? u.avatarUrl : `/${u.avatarUrl}`;
        const hostBase = environment.apiUrl.replace(/\/api\/v\d+.*$/, '');
        fotoUrl = `${hostBase}${path}`;
      }
    }

    return {
      nombreEmpresa: u?.nombreEmpresa ?? null,
      nombreUsuario: u?.nombre ?? null,
      clienteFotoUrl: fotoUrl,
    };
  }

  emitirBoletaSimple(venta: VentaRead): void {
    exportarBoletaSimple(venta, this.opcionesBranding());
  }

  imprimirBoleta80mm(venta: VentaRead): void {
    exportarBoletaVenta80mm(venta, this.opcionesBranding());
  }

  imprimirBoletaNormal(venta: VentaRead): void {
    exportarBoletaVentaNormal(venta, this.opcionesBranding());
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
          this.aplicarCambio();
        },
        error: (err: any) => {
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
          this.aplicarCambioDevoluciones();
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
          this.aplicarCambio();
          this.devolucionesYaCargadas = false;
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
