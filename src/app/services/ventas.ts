import { Injectable, signal } from '@angular/core';
import { ProductosService } from './productos';

export type MetodoPago = 'yape' | 'plin' | 'efectivo' | 'transferencia';
export type TipoDescuento = 'producto' | 'unidad';

/** Métodos de pago que exigen adjuntar una foto del comprobante (transacción/transferencia). */
export function requiereComprobante(metodo: MetodoPago): boolean {
  return metodo === 'yape' || metodo === 'plin' || metodo === 'transferencia';
}

export interface ItemCarrito {
  productoId: string;
  varianteId: string;
  nombre: string;
  talla: string;
  fotoUrl: string | null;
  precioUnitario: number;
  cantidad: number;
  descuento: number;
  tipoDescuento: TipoDescuento;
}

export interface Venta {
  id: string;
  fecha: string;
  items: ItemCarrito[];
  metodoPago: MetodoPago;
  montoPagado: number;
  vuelto: number;
  total: number;
  vendedor: string;
  /** Foto del comprobante de pago (Yape/Plin/Transferencia) o del efectivo contado, si se adjuntó. */
  fotoUrl: string | null;
}

let autoId = 0;
function nuevoId(): string {
  autoId += 1;
  return `venta-${autoId}`;
}

@Injectable({ providedIn: 'root' })
export class VentasService {
  constructor(private productosService: ProductosService) {}

  carrito = signal<ItemCarrito[]>([]);
  historial = signal<Venta[]>([]);

  agregarAlCarrito(item: ItemCarrito): void {
    this.carrito.update((lista) => {
      const existente = lista.find((i) => i.varianteId === item.varianteId);
      if (existente) {
        return lista.map((i) =>
          i.varianteId === item.varianteId ? { ...i, cantidad: i.cantidad + item.cantidad } : i
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
    cambios: Partial<Pick<ItemCarrito, 'cantidad' | 'descuento' | 'tipoDescuento'>>
  ): void {
    this.carrito.update((lista) =>
      lista.map((i) => (i.varianteId === varianteId ? { ...i, ...cambios } : i))
    );
  }

  vaciarCarrito(): void {
    this.carrito.set([]);
  }

  totalCarrito(): number {
    return this.carrito().reduce((acc, i) => acc + this.totalItem(i), 0);
  }

  totalItem(i: ItemCarrito): number {
    const subtotal = i.precioUnitario * i.cantidad;
    const descuentoTotal = i.tipoDescuento === 'unidad' ? i.descuento * i.cantidad : i.descuento;
    return Math.max(0, subtotal - descuentoTotal);
  }

  confirmarVenta(
    metodoPago: MetodoPago,
    montoPagado: number,
    vendedor: string,
    fotoUrl: string | null = null
  ): Venta {
    const items = this.carrito();
    const total = this.totalCarrito();

    // Regla de negocio: Yape, Plin y Transferencia siempre deben quedar respaldados con una foto.
    if (requiereComprobante(metodoPago) && !fotoUrl) {
      throw new Error('Esta venta requiere una foto del comprobante de pago.');
    }
    if (metodoPago === 'efectivo' && montoPagado < total) {
      throw new Error('El monto pagado es menor al total de la venta.');
    }

    for (const item of items) {
      this.productosService.actualizarStockVariante(item.productoId, item.varianteId, -item.cantidad);
    }

    const venta: Venta = {
      id: nuevoId(),
      fecha: new Date().toISOString(),
      items,
      metodoPago,
      montoPagado,
      vuelto: metodoPago === 'efectivo' ? Math.max(0, montoPagado - total) : 0,
      total,
      vendedor,
      fotoUrl,
    };

    this.historial.update((lista) => [venta, ...lista]);
    this.vaciarCarrito();
    return venta;
  }

  registrarDevolucion(ventaId: string, varianteId: string): void {
    this.historial.update((lista) =>
      lista.map((v) => {
        if (v.id !== ventaId) return v;
        return { ...v, items: v.items.filter((i) => i.varianteId !== varianteId) };
      })
    );
  }

  ingresosPeriodo(dias: number): number {
    const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
    return this.historial()
      .filter((v) => new Date(v.fecha).getTime() >= desde)
      .reduce((acc, v) => acc + v.total, 0);
  }

  /** Ventas registradas entre hace `desdeDias` y hace `hastaDias` (ambos en días atrás desde ahora). */
  ventasEnRango(desdeDias: number, hastaDias: number): Venta[] {
    const ahora = Date.now();
    const inicio = ahora - desdeDias * 24 * 60 * 60 * 1000;
    const fin = ahora - hastaDias * 24 * 60 * 60 * 1000;
    return this.historial().filter((v) => {
      const t = new Date(v.fecha).getTime();
      return t >= inicio && t < fin;
    });
  }

  cantidadVentasPeriodo(dias: number): number {
    const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
    return this.historial().filter((v) => new Date(v.fecha).getTime() >= desde).length;
  }

  unidadesVendidasPorProducto(): { productoId: string; nombre: string; unidades: number }[] {
    const mapa = new Map<string, { productoId: string; nombre: string; unidades: number }>();
    for (const venta of this.historial()) {
      for (const item of venta.items) {
        const actual = mapa.get(item.productoId) ?? { productoId: item.productoId, nombre: item.nombre, unidades: 0 };
        actual.unidades += item.cantidad;
        mapa.set(item.productoId, actual);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => b.unidades - a.unidades);
  }
}
