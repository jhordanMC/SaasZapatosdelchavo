import { Injectable, signal } from '@angular/core';

export type Sexo = 'Hombre' | 'Mujer' | 'Niño' | 'Niña' | 'Unisex';
export type Categoria = 'Deportivos' | 'Casuales' | 'Formales' | 'Botines' | 'Sandalias' | 'Escolares' | 'Textiles';

export interface VarianteProducto {
  id: string;
  talla: string;
  stock: number;
  local: string;
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: Categoria;
  sexo: Sexo;
  fotoUrl: string | null;
  costoCompra: number;
  precioVenta: number;
  variantes: VarianteProducto[];
}

let autoId = 0;
function nuevoId(prefijo: string): string {
  autoId += 1;
  return `${prefijo}-${autoId}`;
}

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private productos = signal<Producto[]>([
    {
      id: nuevoId('prod'),
      nombre: 'Zapatos Ejecutivos Confort',
      categoria: 'Formales',
      sexo: 'Hombre',
      fotoUrl: null,
      costoCompra: 85,
      precioVenta: 146,
      variantes: [
        { id: nuevoId('var'), talla: '39', stock: 4, local: 'Almacén Trujillo' },
        { id: nuevoId('var'), talla: '40', stock: 5, local: 'Almacén Trujillo' },
        { id: nuevoId('var'), talla: '41', stock: 3, local: 'Almacén Gamarra' },
      ],
    },
    {
      id: nuevoId('prod'),
      nombre: 'Zapatillas Sport Adidas',
      categoria: 'Deportivos',
      sexo: 'Unisex',
      fotoUrl: null,
      costoCompra: 95,
      precioVenta: 150,
      variantes: [
        { id: nuevoId('var'), talla: '37', stock: 2, local: 'Almacén Gamarra' },
        { id: nuevoId('var'), talla: '38', stock: 4, local: 'Almacén Gamarra' },
        { id: nuevoId('var'), talla: '39', stock: 2, local: 'Almacén Trujillo' },
      ],
    },
    {
      id: nuevoId('prod'),
      nombre: 'Zapatillas Ejecutivos Confort',
      categoria: 'Casuales',
      sexo: 'Mujer',
      fotoUrl: null,
      costoCompra: 80,
      precioVenta: 146,
      variantes: [
        { id: nuevoId('var'), talla: '36', stock: 3, local: 'Almacén Trujillo' },
        { id: nuevoId('var'), talla: '37', stock: 5, local: 'Almacén Trujillo' },
      ],
    },
    {
      id: nuevoId('prod'),
      nombre: 'Zapatillas Sport Adidas Kids',
      categoria: 'Escolares',
      sexo: 'Niño',
      fotoUrl: null,
      costoCompra: 60,
      precioVenta: 98,
      variantes: [
        { id: nuevoId('var'), talla: '32', stock: 6, local: 'Almacén Gamarra' },
        { id: nuevoId('var'), talla: '33', stock: 2, local: 'Almacén Gamarra' },
      ],
    },
  ]);

  getProductos() {
    return this.productos.asReadonly();
  }

  getProductoById(id: string): Producto | undefined {
    return this.productos().find((p) => p.id === id);
  }

  stockTotal(producto: Producto): number {
    return producto.variantes.reduce((acc, v) => acc + v.stock, 0);
  }

  margen(producto: Producto): number {
    return producto.precioVenta - producto.costoCompra;
  }

  agregarProducto(datos: Omit<Producto, 'id'>): Producto {
    const nuevo: Producto = { ...datos, id: nuevoId('prod') };
    this.productos.update((lista) => [nuevo, ...lista]);
    return nuevo;
  }

  actualizarProducto(id: string, datos: Partial<Omit<Producto, 'id'>>): void {
    this.productos.update((lista) =>
      lista.map((p) => (p.id === id ? { ...p, ...datos } : p))
    );
  }

  eliminarProducto(id: string): void {
    this.productos.update((lista) => lista.filter((p) => p.id !== id));
  }

  agregarVariante(productoId: string, talla: string, stock: number, local: string): void {
    this.productos.update((lista) =>
      lista.map((p) =>
        p.id === productoId
          ? { ...p, variantes: [...p.variantes, { id: nuevoId('var'), talla, stock, local }] }
          : p
      )
    );
  }

  actualizarStockVariante(productoId: string, varianteId: string, delta: number): boolean {
    let ok = false;
    this.productos.update((lista) =>
      lista.map((p) => {
        if (p.id !== productoId) return p;
        return {
          ...p,
          variantes: p.variantes.map((v) => {
            if (v.id !== varianteId) return v;
            const nuevoStock = v.stock + delta;
            if (nuevoStock < 0) return v;
            ok = true;
            return { ...v, stock: nuevoStock };
          }),
        };
      })
    );
    return ok;
  }

  productosBajoStock(minimo = 3): { producto: Producto; variante: VarianteProducto }[] {
    const resultado: { producto: Producto; variante: VarianteProducto }[] = [];
    for (const p of this.productos()) {
      for (const v of p.variantes) {
        if (v.stock <= minimo) resultado.push({ producto: p, variante: v });
      }
    }
    return resultado;
  }
}
