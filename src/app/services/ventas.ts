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
  /**
   * Foto del comprobante de ESTE pago (yape/plin/transferencia), como data
   * URL base64 — mismo patrón que las evidencias de devolución.
   * NOTA PARA BACKEND: campo nuevo. En pago único, hoy el comprobante se
   * capturaba en el formulario pero nunca se enviaba al backend — con esto
   * queda corregido, y además soporta 1 comprobante por línea en pago mixto.
   */
  foto_comprobante?: string | null;
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
  estado: string;
  creado_en: string;
}

export interface VentaRead {
  id_venta: string;
  id_empresa: string;
  id_local: string;
  id_usuario: string;
  id_cliente: string | null;
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

/** Vendedor distinto encontrado en el historial de ventas — no es "usuarios con rol vendedor/dueño". */
export interface VendedorHistorial {
  id_usuario: string;
  nombre_vendedor: string;
}

export interface EliminarVentaRequest {
  /** true (default) = devuelve el stock al local/almacén de origen. false = no lo devuelve. */
  restaurar_stock: boolean;
}

// ── Devoluciones parciales (o totales) de una venta ─────────────────────────

/** Categorías fijas de motivo — mismas que el CHECK de la tabla real en BD. */
export type MotivoDevolucion = 'producto_defectuoso' | 'talla_incorrecta' | 'arrepentimiento' | 'otro';
export type EstadoDevolucion = 'pendiente' | 'procesada' | 'rechazada';

/**
 * Cómo se le devuelve el dinero/valor al cliente.
 * - efectivo / yape / plin: se le entrega el monto por ese medio.
 * - cambio_producto: no sale plata, se lleva otro(s) producto(s) del catálogo
 *   (mismo valor, mayor o menor — ver `monto_efectivo_ajuste`).
 *
 * NOTA PARA BACKEND: campo nuevo `metodo_reembolso` en la tabla de
 * devoluciones (mismo dominio que MetodoPago pero sin 'tarjeta'/'transferencia',
 * ya que una devolución no revierte un cobro con tarjeta, se paga aparte).
 */
export type MetodoReembolso = 'efectivo' | 'yape' | 'plin' | 'cambio_producto';

/**
 * Tipo de devolución — se calcula en el frontend a partir de lo registrado,
 * no es un campo que el usuario elige directamente:
 * - 'total': se devolvieron todas las unidades de todas las líneas de la venta.
 * - 'cambio_producto': el reembolso fue 100% con producto(s) de reemplazo.
 * - 'cambio_con_ajuste': cambio de producto + diferencia en efectivo/yape/plin.
 * - 'parcial': cualquier otro caso (se devolvió solo una parte de la venta en dinero).
 */
export type TipoDevolucion = 'parcial' | 'total' | 'cambio_producto' | 'cambio_con_ajuste';

export interface ItemDevolucionRequest {
  id_detalle_venta: string;
  cantidad: number;
  /** true (default) = esa cantidad vuelve al stock. false = se dio de baja (dañada/perdida). Es por línea. */
  restaurar_stock: boolean;
  /**
   * Proveedor al que corresponde este producto — para poder medir tasa de
   * devolución por proveedor en el dashboard. Texto libre (mismo dominio que
   * CompraRead.proveedor); null/omitido si no se conoce.
   */
  id_proveedor?: string | null;
  /** Motivo puntual de esta línea, si es distinto al motivo general de la devolución. */
  motivo_linea?: MotivoDevolucion | null;
}

/** Producto de reemplazo elegido cuando el reembolso es por cambio de producto. */
export interface ItemCambioProducto {
  id_variante: string;
  nombre: string;
  talla: string | null;
  cantidad: number;
  precio_unitario: number;
  id_ubicacion_origen: string;
}

export interface DevolucionRequest {
  motivo: MotivoDevolucion;
  notas?: string | null;
  items: ItemDevolucionRequest[];
  /** Forma en la que se le devuelve el valor al cliente. */
  metodo_reembolso: MetodoReembolso;
  /**
   * Fotos de evidencia (producto defectuoso, etiqueta, etc.) como data URL
   * base64 — mismo patrón que la foto de comprobante del checkout de venta.
   */
  evidencias?: string[];
  /** Solo si metodo_reembolso === 'cambio_producto': producto(s) que se lleva el cliente. */
  productos_cambio?: ItemCambioProducto[];
  /**
   * Solo relevante junto con productos_cambio: diferencia en efectivo/yape/plin
   * entre lo devuelto y el valor del producto de cambio.
   * Positivo = el cliente paga esa diferencia. Negativo = se le devuelve esa diferencia.
   */
  monto_efectivo_ajuste?: number;
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
  id_proveedor: string | null;
  motivo_linea: MotivoDevolucion | null;
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
  metodo_reembolso: MetodoReembolso;
  evidencias: string[];
  productos_cambio: ItemCambioProducto[];
  monto_efectivo_ajuste: number;
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
  metodo_reembolso: MetodoReembolso;
  /** Proveedor predominante de la devolución (el de mayor monto en sus líneas), para la columna del historial. */
  nombre_proveedor: string | null;
}

/** Deriva el tipo de devolución a partir de lo registrado — usado en historial y dashboard. */
export function tipoDevolucion(d: Pick<DevolucionListItem, 'metodo_reembolso' | 'total_venta' | 'total_devuelto'>): TipoDevolucion {
  if (d.metodo_reembolso === 'cambio_producto') {
    return 'cambio_producto';
  }
  if (d.total_devuelto >= d.total_venta) return 'total';
  return 'parcial';
}

export const ETIQUETAS_TIPO_DEVOLUCION: Record<TipoDevolucion, string> = {
  parcial: 'Devolución parcial',
  total: 'Devolución total',
  cambio_producto: 'Cambio de producto',
  cambio_con_ajuste: 'Cambio + ajuste en efectivo',
};

export const ETIQUETAS_METODO_REEMBOLSO: Record<MetodoReembolso, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  cambio_producto: 'Cambio de producto',
};

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

/** Usuario distinto que registró una devolución — no es "usuarios con rol X". */
export interface UsuarioDevolucionHistorial {
  id_usuario: string;
  nombre_usuario: string;
}

/** Resultado agregado para la mini-tarjeta de devoluciones del Dashboard. */
export interface ResumenDevolucionesDashboard {
  cantidadDevoluciones: number;
  unidadesDevueltas: number;
  porProveedor: { proveedor: string; cantidad: number }[];
  porTipo: Record<TipoDevolucion, number>;
  /** Suma de lo que sí salió como plata real (excluye cambios de producto puros). */
  impactoGanancia: number;
}

export interface ListaVentas {
  total: number;
  items: VentaListItem[];
}

export interface ListaDevoluciones {
  total: number;
  items: DevolucionListItem[];
}

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

  /** Página del historial de ventas del tenant, más reciente primero — con total real (COUNT) para paginación numerada. */
  listarVentas(
    filtros: FiltrosHistorialVentas = {},
    offset = 0,
    limit = TAMANO_PAGINA_HISTORIAL_VENTAS
  ): Observable<ListaVentas> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.id_usuario) params = params.set('id_usuario', filtros.id_usuario);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<ListaVentas>(`${this.base}`, { params });
  }

  /** Vendedores distintos con ventas registradas — para poblar el filtro del historial (todos los roles). */
  listarVendedoresDeVentas(): Observable<VendedorHistorial[]> {
    return this.http.get<VendedorHistorial[]>(`${this.base}/vendedores`);
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

  /** Página del historial de devoluciones del tenant (todas las ventas), más reciente primero — con total real (COUNT). */
  listarDevoluciones(
    filtros: FiltrosHistorialDevoluciones = {},
    offset = 0,
    limit = TAMANO_PAGINA_HISTORIAL_DEVOLUCIONES
  ): Observable<ListaDevoluciones> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.id_usuario) params = params.set('id_usuario', filtros.id_usuario);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<ListaDevoluciones>(`${this.base}/devoluciones`, { params });
  }

  /** Usuarios distintos que registraron devoluciones — para poblar el filtro del historial. */
  listarUsuariosDeDevoluciones(): Observable<UsuarioDevolucionHistorial[]> {
    return this.http.get<UsuarioDevolucionHistorial[]>(`${this.base}/devoluciones/usuarios`);
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
   * Resumen de devoluciones de un rango de fechas para la mini-tarjeta del
   * Dashboard: cuántas unidades se devolvieron, agrupadas por proveedor y
   * por tipo (parcial/total/cambio), y cuánto de eso impacta la ganancia
   * del período (solo cuenta como salida de dinero real — un cambio de
   * producto sin ajuste en efectivo no saca plata de caja).
   *
   * Trae TODAS las devoluciones 'procesada' del rango (sin paginar, tamaño
   * de página grande) porque es para agregación, no para listar en tabla.
   */
  resumenDevolucionesDashboard(desde: string, hasta: string): Observable<ResumenDevolucionesDashboard> {
    return new Observable((observer) => {
      this.listarDevoluciones({ estado: 'procesada', desde, hasta }, 0, 1000).subscribe({
        next: (lista) => {
          const items = lista.items;
          const porProveedor = new Map<string, number>();
          const porTipo: Record<TipoDevolucion, number> = { parcial: 0, total: 0, cambio_producto: 0, cambio_con_ajuste: 0 };
          let impactoGanancia = 0;
          let unidadesDevueltas = 0;

          for (const d of items) {
            const tipo = tipoDevolucion(d);
            porTipo[tipo] += 1;
            const prov = d.nombre_proveedor || 'Sin proveedor';
            porProveedor.set(prov, (porProveedor.get(prov) ?? 0) + 1);
            // Salida de dinero real: todo lo que no fue 100% cambio de producto.
            if (d.metodo_reembolso !== 'cambio_producto') {
              impactoGanancia += d.total_devuelto;
            }
          }
          unidadesDevueltas = items.length;

          observer.next({
            cantidadDevoluciones: items.length,
            unidadesDevueltas,
            porProveedor: Array.from(porProveedor.entries())
              .map(([proveedor, cantidad]) => ({ proveedor, cantidad }))
              .sort((a, b) => b.cantidad - a.cantidad),
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
        return lista.map((i) =>
          i.varianteId === item.varianteId
            ? { ...i, cantidad: i.cantidad + item.cantidad }
            : i
        );
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
      lista.map((i) => (i.varianteId === varianteId ? { ...i, ...cambios } : i))
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
