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
  variantes: VariantePOSRead[];
}

// ── Filtros para el catálogo POS ────────────────────────────────────────────

export interface FiltrosPOS {
  busqueda?: string;
  id_categoria?: string;
  sexo?: SexoProducto;
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
  nombre_producto: string | null;
  talla: string | null;
  sku: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento_monto: number;
  subtotal: number;
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
  estado: string;
  detalles: DetalleVentaRead[];
  pagos: PagoRead[];
  creado_en: string;
  actualizado_en: string | null;
}

export interface MensajeResponse {
  mensaje: string;
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

  /** Productos para la pantalla POS, filtrados por sede activa (si existe). */
  listarProductosPOS(idUbicacionFiltro?: string | null, filtros: FiltrosPOS = {}): Observable<ProductoPOSRead[]> {
    let params = new HttpParams();
    if (idUbicacionFiltro) params = params.set('id_ubicacion_filtro', idUbicacionFiltro);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.id_categoria) params = params.set('id_categoria', filtros.id_categoria);
    if (filtros.sexo) params = params.set('sexo', filtros.sexo);
    return this.http.get<ProductoPOSRead[]>(`${this.base}/pos/productos`, { params });
  }

  /** Confirma la venta: envía el carrito completo al backend. */
  confirmarVenta(payload: VentaCreate): Observable<VentaRead> {
    return this.http.post<VentaRead>(`${this.base}/pos/confirmar`, payload);
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

