import { Injectable, signal } from '@angular/core';
import { ProductosService } from './productos';

export type MetodoPago = 'yape' | 'efectivo' | 'transferencia';

export interface ItemCarrito {
  productoId: string;
  varianteId: string;
  nombre: string;
  talla: string;
  precioUnitario: number;
  cantidad: number;
  descuento: number;
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

  vaciarCarrito(): void {
    this.carrito.set([]);
  }

  totalCarrito(): number {
    return this.carrito().reduce(
      (acc, i) => acc + (i.precioUnitario * i.cantidad - i.descuento),
      0
    );
  }

  confirmarVenta(metodoPago: MetodoPago, montoPagado: number, vendedor: string): Venta {
    const items = this.carrito();
    const total = this.totalCarrito();

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
}
