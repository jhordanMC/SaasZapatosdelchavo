/**
 * Servicio Angular para el módulo ventas (POS).
 *
 * Arquitectura de dos capas:
 *   1. Carrito local  — estado en memoria (signal), sin llamadas HTTP.
 *                       El backend no tiene endpoint de carrito intermedio.
 *   2. Backend HTTP   — listar locales, catálogo POS y confirmar/anular ventas.
 *
 * El interceptor de autenticación añade el Bearer token automáticamente.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SexoProducto } from './inventario';

// ---------------------------------------------------------------------------
// Tipos de dominio — espejean los schemas Pydantic del backend
// ---------------------------------------------------------------------------

export type MetodoPago = 'efectivo' | 'tarjeta' | 'yape' | 'plin' | 'transferencia' | 'otro';
export type TipoDescuento = 'producto' | 'unidad';

/** Métodos que exigen adjuntar foto del comprobante. */
export function requiereComprobante(metodo: MetodoPago): boolean {
  return metodo === 'yape' || metodo === 'plin' || metodo === 'transferencia';
}

// ── Schemas del POS (catálogo) ──────────────────────────────────────────────

export interface SedePOSRead {
  id_sede: string;
  nombre: string;
  tipo: string;
}

export interface VariantePOSRead {
  id_variante: string;
  talla: string | null;
  sku: string;
  stock_disponible: number;
  id_ubicacion_origen: string | null;
  nombre_ubicacion: string | null;
}

export interface ProductoPOSRead {
  id_producto: string;
  nombre: string;
  nombre_categoria: string | null;
  sexo: SexoProducto | null;
  precio_venta: number;
  stock_total: number;
  imagen_url: string | null;
  variantes: VariantePOSRead[];
}

/**
 * Envoltorio de paginación del catálogo POS (scroll infinito). Mismo
 * contrato que ProductosPaginados de inventario.
 */
export interface ProductosPOSPaginados {
  items: ProductoPOSRead[];
  hay_mas: boolean;
  siguiente_offset: number;
}

// ── Filtros para el catálogo POS ────────────────────────────────────────────

export interface FiltrosPOS {
  busqueda?: string;
  id_categoria?: string;
  sexo?: SexoProducto;
  talla?: string;
}

// ── Schemas de venta ────────────────────────────────────────────────────────

export interface DetalleVentaCreate {
  id_variante: string;
  id_ubicacion_origen: string;
  cantidad: number;
  /** Descuento en S/ absolutos (por línea). */
  descuento_monto: number;
  id_descuento_aplicado?: string | null;
}

export interface PagoCreate {
  metodo: MetodoPago;
  monto: number;
  /** Solo efectivo: monto entregado por el cliente. */
  monto_recibido?: number | null;
  numero_operacion?: string | null;
  url_comprobante?: string | null;
}

export interface VentaCreate {
  id_local: string | null;
  id_cliente?: string | null;
  detalles: DetalleVentaCreate[];
  pagos: PagoCreate[];
}

export interface DetalleVentaRead {
  id_detalle_venta: string;
  id_variante: string;
  id_local: string | null;
  nombre_local: string | null;
  id_almacen: string | null;
  nombre_almacen: string | null;
  nombre_producto: string | null;
  talla: string | null;
  sku: string | null;
  imagen_url: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento_monto: number;
  subtotal: number;
  /** Suma de todas las devoluciones ya procesadas sobre esta línea. */
  cantidad_devuelta: number;
  creado_en: string;
}

export interface PagoRead {
  id_pago: string;
  metodo: MetodoPago;
  monto: number;
  monto_recibido: number | null;
  vuelto: number;
  numero_operacion: string | null;
  url_comprobante: string | null;
  estado: string;
  creado_en: string;
}

export interface VentaRead {
  id_venta: string;
  id_empresa: string;
  id_local: string;
  id_usuario: string;
  id_cliente: string | null;
  nombre_cliente?: string | null;
  documento_cliente?: string | null;
  total: number;
  estado: EstadoVenta;
  detalles: DetalleVentaRead[];
  pagos: PagoRead[];
  creado_en: string;
  actualizado_en: string | null;
}

export interface MensajeResponse {
  mensaje: string;
}

export interface SubirComprobanteResponse {
  url: string;
}

// ── Historial de ventas ──────────────────────────────────────────────────────

export interface VentaListItem {
  id_venta: string;
  total: number;
  estado: EstadoVenta;
  id_usuario: string;
  nombre_vendedor: string | null;
  id_cliente: string | null;
  nombre_cliente: string | null;
  cantidad_items: number;
  creado_en: string;
}

export type EstadoVenta = 'pendiente' | 'pagada' | 'anulada' | 'devuelta';

export interface FiltrosHistorialVentas {
  estado?: EstadoVenta;
  /** Filtrar por vendedor (id_usuario de la venta). */
  id_usuario?: string;
  /** Buscar por nombre/razón social del cliente. */
  busqueda?: string;
  /** ISO 8601. */
  desde?: string;
  /** ISO 8601. */
  hasta?: string;
}

export interface EliminarVentaRequest {
  /** true (default) = devuelve el stock al local/almacén de origen. false = no lo devuelve. */
  restaurar_stock: boolean;
}

// ── Devoluciones parciales (o totales) de una venta ─────────────────────────

/** Categorías fijas de motivo — mismas que el CHECK de la tabla real en BD. */
export type MotivoDevolucion = 'producto_defectuoso' | 'talla_incorrecta' | 'arrepentimiento' | 'otro';
export type EstadoDevolucion = 'pendiente' | 'procesada' | 'rechazada';

export interface ItemDevolucionRequest {
  id_detalle_venta: string;
  cantidad: number;
  /** true (default) = esa cantidad vuelve al stock. false = se dio de baja (dañada/perdida). Es por línea. */
  restaurar_stock: boolean;
}

export interface DevolucionRequest {
  motivo: MotivoDevolucion;
  notas?: string | null;
  items: ItemDevolucionRequest[];
}

export interface DetalleDevolucionRead {
  id_detalle_devolucion: string;
  id_detalle_venta: string;
  id_variante: string;
  nombre_producto: string | null;
  talla: string | null;
  cantidad: number;
  restaurar_stock: boolean;
  monto_devuelto: number;
}

export interface DevolucionRead {
  id_devolucion: string;
  id_venta: string;
  id_usuario: string;
  nombre_usuario: string | null;
  motivo: MotivoDevolucion;
  notas: string | null;
  total_devuelto: number;
  estado: EstadoDevolucion;
  detalles: DetalleDevolucionRead[];
  creado_en: string;
}

/** Versión resumida (sin líneas) para la tabla de Historial de devoluciones. */
export interface DevolucionListItem {
  id_devolucion: string;
  id_venta: string;
  fecha_venta: string;
  total_venta: number;
  nombre_usuario: string | null;
  motivo: MotivoDevolucion;
  total_devuelto: number;
  estado: EstadoDevolucion;
  creado_en: string;
}

export interface FiltrosHistorialDevoluciones {
  estado?: EstadoDevolucion;
  /** Filtrar por usuario que registró la devolución. */
  id_usuario?: string;
  /** Buscar por nombre/razón social del cliente de la venta original. */
  busqueda?: string;
  /** ISO 8601. */
  desde?: string;
  /** ISO 8601. */
  hasta?: string;
}

// ── Tipos de compatibilidad para el Dashboard ────────────────────────────────
// Estos tipos los usa el dashboard; se mantienen aquí para no romper esa vista.

export type TipoDevolucion = 'parcial' | 'total' | 'cambio_producto' | 'cambio_con_ajuste';

export interface ResumenDevolucionesDashboard {
  cantidadDevoluciones: number;
  unidadesDevueltas: number;
  porProveedor: { proveedor: string; cantidad: number }[];
  porTipo: Record<TipoDevolucion, number>;
  impactoGanancia: number;
}

export const ETIQUETAS_TIPO_DEVOLUCION: Record<TipoDevolucion, string> = {
  parcial: 'Devolución parcial',
  total: 'Devolución total',
  cambio_producto: 'Cambio de producto',
  cambio_con_ajuste: 'Cambio + ajuste en efectivo',
};

// ---------------------------------------------------------------------------
// Carrito local — estado en memoria, no va al backend
// ---------------------------------------------------------------------------

export interface ItemCarrito {
  /** UUID de la variante seleccionada. */
  varianteId: string;
  /** UUID del producto padre (para mostrar info). */
  productoId: string;
  /** Nombre para mostrar: "{nombre} (talla {talla})". */
  nombre: string;
  talla: string | null;
  idUbicacionOrigen: string;
  nombreUbicacion: string | null;
  fotoUrl: string | null;
  precioUnitario: number;
  cantidad: number;
  /** Descuento en S/ que se aplica a la línea (absoluto, no porcentaje). */
  descuentoMonto: number;
  /** Si el descuento aplica por unidad (×cantidad) o al total de la línea. */
  tipoDescuento: TipoDescuento;
  /** Stock máximo disponible. */
  stockMaximo?: number;
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

/**
 * Tamaño de página del catálogo POS (scroll infinito). Único lugar donde
 * se define — cambiarlo acá es todo lo que hace falta para ajustarlo.
 */
export const TAMANO_PAGINA_CATALOGO_POS = 30;

/** Tamaño de página del historial de ventas — cambiarlo acá es todo lo que hace falta. */
export const TAMANO_PAGINA_HISTORIAL_VENTAS = 30;

/** Tamaño de página del historial de devoluciones — cambiarlo acá es todo lo que hace falta. */
export const TAMANO_PAGINA_HISTORIAL_DEVOLUCIONES = 30;

@Injectable({ providedIn: 'root' })
export class VentasService {
  private readonly base = `${environment.apiUrl}/ventas`;

  /** Carrito actual — estado local (reactivo via signal). */
  readonly carrito = signal<ItemCarrito[]>([]);

  constructor(private http: HttpClient) {}

  // ── Catálogo POS (HTTP) ──────────────────────────────────────────────────

  /** Sedes asignadas al vendedor autenticado (locales + almacenes). */
  listarSedes(): Observable<SedePOSRead[]> {
    return this.http.get<SedePOSRead[]>(`${this.base}/pos/mis-sedes`);
  }

  /**
   * Página del catálogo POS, filtrada por sede/talla/búsqueda/categoría/
   * sexo (todo resuelto en el backend) y ordenada por ranking (recientes +
   * más vendidos primero). `offset` avanza para el scroll infinito.
   */
  listarProductosPOS(
    idUbicacionFiltro: string | null | undefined,
    filtros: FiltrosPOS = {},
    offset = 0,
    limit = TAMANO_PAGINA_CATALOGO_POS
  ): Observable<ProductosPOSPaginados> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (idUbicacionFiltro) params = params.set('id_ubicacion_filtro', idUbicacionFiltro);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.id_categoria) params = params.set('id_categoria', filtros.id_categoria);
    if (filtros.sexo) params = params.set('sexo', filtros.sexo);
    if (filtros.talla) params = params.set('talla', filtros.talla);
    return this.http.get<ProductosPOSPaginados>(`${this.base}/pos/productos`, { params });
  }

  /** Confirma la venta: envía el carrito completo al backend. */
  confirmarVenta(payload: VentaCreate): Observable<VentaRead> {
    return this.http.post<VentaRead>(`${this.base}/pos/confirmar`, payload);
  }

  // ── Historial de ventas ──────────────────────────────────────────────────

  /**
   * Página del historial de ventas del tenant, más reciente primero.
   * Sin envoltorio hay_mas/siguiente_offset: el llamador compara
   * `resultado.length < limit` para saber si ya no hay más páginas.
   */
  listarVentas(
    filtros: FiltrosHistorialVentas = {},
    offset = 0,
    limit = TAMANO_PAGINA_HISTORIAL_VENTAS
  ): Observable<VentaListItem[]> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.id_usuario) params = params.set('id_usuario', filtros.id_usuario);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<{ total: number; items: VentaListItem[] }>(`${this.base}`, { params })
      .pipe(map((res) => res.items));
  }

  /** Detalle completo de una venta: ítems (con imagen/talla/precio/descuento) + pagos. */
  obtenerVenta(idVenta: string): Observable<VentaRead> {
    return this.http.get<VentaRead>(`${this.base}/${idVenta}`);
  }

  /**
   * "Eliminar" una venta del historial = anularla en el backend. El
   * usuario decide explícitamente si el stock de los productos vendidos
   * vuelve al inventario o no (ver EliminarVentaRequest.restaurar_stock).
   */
  eliminarVenta(idVenta: string, data: EliminarVentaRequest): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.base}/${idVenta}/anular`, data);
  }

  /** Sube y comprime la foto de comprobante de un pago (yape/plin/transferencia). Reutiliza el mismo mecanismo de disco que Inventario. */
  subirComprobantePago(archivo: File): Observable<SubirComprobanteResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<SubirComprobanteResponse>(`${this.base}/pos/upload-comprobante`, formData);
  }

  /**
   * Registra que el cliente devolvió N unidades de una o más líneas de una
   * venta 'pagada' — a diferencia de eliminarVenta (anula TODO), esto
   * permite devolver solo algunas unidades y sigue vendida el resto.
   */
  registrarDevolucion(idVenta: string, data: DevolucionRequest): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.base}/${idVenta}/devoluciones`, data);
  }

  /** Historial de devoluciones ya procesadas sobre una venta, más recientes primero. */
  listarDevolucionesVenta(idVenta: string): Observable<DevolucionRead[]> {
    return this.http.get<DevolucionRead[]>(`${this.base}/${idVenta}/devoluciones`);
  }

  /** Página del historial de devoluciones del tenant (todas las ventas), más reciente primero. */
  listarDevoluciones(
    filtros: FiltrosHistorialDevoluciones = {},
    offset = 0,
    limit = TAMANO_PAGINA_HISTORIAL_DEVOLUCIONES
  ): Observable<DevolucionListItem[]> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.id_usuario) params = params.set('id_usuario', filtros.id_usuario);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<{ total: number; items: DevolucionListItem[] }>(`${this.base}/devoluciones`, { params })
      .pipe(map((res) => res.items));
  }

  /** Detalle completo (con líneas) de una devolución puntual. */
  obtenerDevolucion(idDevolucion: string): Observable<DevolucionRead> {
    return this.http.get<DevolucionRead>(`${this.base}/devoluciones/${idDevolucion}`);
  }

  /** Elimina (deshace) una devolución: reintegra el monto a la venta y revierte el stock si aplicaba. */
  eliminarDevolucion(idDevolucion: string): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.base}/devoluciones/${idDevolucion}/eliminar`, {});
  }

  /**
   * Resumen de devoluciones del período para la mini-tarjeta del Dashboard.
   * Agrega localmente las devoluciones del rango sin requerir un endpoint
   * dedicado en el backend.
   */
  resumenDevolucionesDashboard(desde: string, hasta: string): Observable<ResumenDevolucionesDashboard> {
    return new Observable((observer) => {
      this.listarDevoluciones({ estado: 'procesada', desde, hasta }, 0, 200).subscribe({
        next: (items) => {
          const porTipo: Record<TipoDevolucion, number> = { parcial: 0, total: 0, cambio_producto: 0, cambio_con_ajuste: 0 };
          let impactoGanancia = 0;
          for (const d of items) {
            const tipo: TipoDevolucion = d.total_devuelto >= d.total_venta ? 'total' : 'parcial';
            porTipo[tipo] += 1;
            impactoGanancia += d.total_devuelto;
          }
          observer.next({
            cantidadDevoluciones: items.length,
            unidadesDevueltas: items.length,
            porProveedor: [],
            porTipo,
            impactoGanancia,
          });
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  // ── Gestión del carrito (local) ──────────────────────────────────────────

  agregarAlCarrito(item: ItemCarrito): void {
    this.carrito.update((lista) => {
      const existente = lista.find((i) => i.varianteId === item.varianteId);
      if (existente) {
        // Si ya está en el carrito, suma la cantidad
        return lista.map((i) => {
          if (i.varianteId === item.varianteId) {
            let sum = i.cantidad + item.cantidad;
            if (i.stockMaximo !== undefined && sum > i.stockMaximo) {
              sum = i.stockMaximo;
            }
            return { ...i, cantidad: sum };
          }
          return i;
        });
      }
      return [...lista, item];
    });
  }

  quitarDelCarrito(varianteId: string): void {
    this.carrito.update((lista) => lista.filter((i) => i.varianteId !== varianteId));
  }

  editarItemCarrito(
    varianteId: string,
    cambios: Partial<Pick<ItemCarrito, 'cantidad' | 'descuentoMonto' | 'tipoDescuento'>>
  ): void {
    this.carrito.update((lista) =>
      lista.map((i) => {
        if (i.varianteId === varianteId) {
          let nuevaCant = cambios.cantidad ?? i.cantidad;
          if (i.stockMaximo !== undefined && nuevaCant > i.stockMaximo) {
            nuevaCant = i.stockMaximo;
          }
          return { ...i, ...cambios, cantidad: nuevaCant };
        }
        return i;
      })
    );
  }

  vaciarCarrito(): void {
    this.carrito.set([]);
  }

  // ── Cálculos de carrito ──────────────────────────────────────────────────

  /**
   * Total de un ítem del carrito con descuento aplicado.
   * - tipoDescuento 'unidad': descuento × cantidad
   * - tipoDescuento 'producto': descuento aplicado una sola vez
   */
  totalItem(item: ItemCarrito): number {
    const subtotal = item.precioUnitario * item.cantidad;
    const descuentoTotal =
      item.tipoDescuento === 'unidad'
        ? item.descuentoMonto * item.cantidad
        : item.descuentoMonto;
    return Math.max(0, subtotal - descuentoTotal);
  }

  totalCarrito(): number {
    return this.carrito().reduce((acc, i) => acc + this.totalItem(i), 0);
  }

  /**
   * Construye el payload VentaCreate a partir del carrito local.
   * El descuento que va al backend siempre es absoluto (S/) por línea.
   * Para tipoDescuento 'unidad' se multiplica × cantidad antes de enviar.
   */
  buildVentaPayload(idLocal: string | null, pagos: PagoCreate[] = [], idCliente?: string): VentaCreate {
    return {
      id_local: idLocal,
      id_cliente: idCliente ?? null,
      detalles: this.carrito().map((c) => ({
        id_variante: c.varianteId,
        id_ubicacion_origen: c.idUbicacionOrigen,
        cantidad: c.cantidad,
        descuento_monto:
          c.tipoDescuento === 'unidad'
            ? c.descuentoMonto * c.cantidad
            : c.descuentoMonto,
      })),
      pagos,
    };
  }

  // ── Mocks para Dashboard y Analítica (Temporal) ──────────────────────────
  // Estos métodos restauran la compilación para los componentes que aún
  // no han sido migrados a llamadas HTTP.

  historial(): any[] {
    return [
      { total: 120, items: [{ productoId: 'mock-1', nombre: 'Zapatos Casuales', cantidad: 1 }] },
      { total: 240, items: [{ productoId: 'mock-2', nombre: 'Zapatos Ejecutivos', cantidad: 2 }] }
    ];
  }

  ingresosPeriodo(dias: number): number {
    return dias * 150; // Mock: S/150 por día
  }

  cantidadVentasPeriodo(dias: number): number {
    return dias * 3; // Mock: 3 ventas por día
  }

  ventasEnRango(diasAtrasInicio: number, diasAtrasFin: number): any[] {
    // Retorna datos mockeados para evitar errores en reduce
    return [{ total: 120, items: [] }, { total: 240, items: [] }];
  }

  unidadesVendidasPorProducto(): { nombre: string; unidades: number }[] {
    return [
      { nombre: 'Zapatos Casuales', unidades: 45 },
      { nombre: 'Zapatos Ejecutivos', unidades: 30 },
      { nombre: 'Zapatillas Deportivas', unidades: 25 },
    ];
  }
}
