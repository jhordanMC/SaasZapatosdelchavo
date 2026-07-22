/**
 * Servicio Angular para el módulo inventario.
 *
 * Encapsula todas las llamadas HTTP al backend (/inventario/*).
 * El interceptor de autenticación añade el Bearer token automáticamente.
 *
 * Convenciones de nombres espejean el backend (snake_case en la API,
 * camelCase solo en interfaces internas donde aplica).
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ---------------------------------------------------------------------------
// Tipos de dominio — espejean los schemas Pydantic del backend
// ---------------------------------------------------------------------------

export type SexoProducto = 'hombre' | 'mujer' | 'unisex' | 'nino';

export interface CategoriaRead {
  id_categoria: string;
  id_empresa: string;
  id_categoria_padre: string | null;
  nombre: string;
  esta_activo: boolean;
  creado_en: string;
}

export interface LocalRead {
  id_local: string;
  id_empresa: string;
  nombre: string;
  direccion: string | null;
  descripcion: string | null;
  esta_activo: boolean;
  creado_en: string;
}

export interface StockVarianteRead {
  id_stock: string;
  id_local: string;
  nombre_local: string | null;
  cantidad: number;
  cantidad_minima: number;
}

export interface VarianteRead {
  id_variante: string;
  id_producto: string;
  talla: string | null;
  color: string | null;
  modelo: string | null;
  sku: string;
  esta_activo: boolean;
  stock: StockVarianteRead[];
}

/** Resumen para el listado de tarjetas del inventario. */
export interface ProductoListItem {
  id_producto: string;
  nombre: string;
  id_categoria: string | null;
  nombre_categoria: string | null;
  sexo: SexoProducto | null;
  precio_venta: number;
  costo_compra: number;
  margen: number;
  stock_total: number;
  esta_activo: boolean;
}

/** Detalle completo con variantes y stock. Usado en el modal de edición. */
export interface ProductoRead extends ProductoListItem {
  id_empresa: string;
  creado_en: string;
  actualizado_en: string;
  variantes: VarianteRead[];
}

// ---------------------------------------------------------------------------
// Payloads de escritura — espejean los schemas *Create y *Update del backend
// ---------------------------------------------------------------------------

export interface VarianteStockInput {
  talla: string;
  cantidad: number;
  id_local: string;
}

export interface ProductoCreateInput {
  nombre: string;
  id_categoria: string | null;
  sexo: SexoProducto | null;
  costo_compra: number;
  precio_venta: number;
  variantes: VarianteStockInput[];
}

export interface ProductoUpdateInput {
  nombre?: string;
  id_categoria?: string | null;
  sexo?: SexoProducto | null;
  costo_compra?: number;
  precio_venta?: number;
  esta_activo?: boolean;
  variantes?: VarianteStockInput[];
}

export interface CategoriaCreateInput {
  nombre: string;
  id_categoria_padre?: string | null;
}

export interface LocalCreateInput {
  nombre: string;
  direccion?: string | null;
  descripcion?: string | null;
}

export interface MensajeResponse {
  mensaje: string;
}

// ---------------------------------------------------------------------------
// Filtros para el listado de productos
// ---------------------------------------------------------------------------

export interface FiltrosProducto {
  busqueda?: string;
  id_categoria?: string;
  sexo?: SexoProducto;
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly base = `${environment.apiUrl}/inventario`;

  constructor(private http: HttpClient) {}

  // ── Categorías ──────────────────────────────────────────────────────────

  listarCategorias(): Observable<CategoriaRead[]> {
    return this.http.get<CategoriaRead[]>(`${this.base}/categorias`);
  }

  crearCategoria(datos: CategoriaCreateInput): Observable<CategoriaRead> {
    return this.http.post<CategoriaRead>(`${this.base}/categorias`, datos);
  }

  actualizarCategoria(idCategoria: string, datos: Partial<CategoriaCreateInput>): Observable<CategoriaRead> {
    return this.http.patch<CategoriaRead>(`${this.base}/categorias/${idCategoria}`, datos);
  }

  eliminarCategoria(idCategoria: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/categorias/${idCategoria}`);
  }

  // ── Locales ─────────────────────────────────────────────────────────────

  listarLocales(): Observable<LocalRead[]> {
    return this.http.get<LocalRead[]>(`${this.base}/locales`);
  }

  crearLocal(datos: LocalCreateInput): Observable<LocalRead> {
    return this.http.post<LocalRead>(`${this.base}/locales`, datos);
  }

  actualizarLocal(idLocal: string, datos: Partial<LocalCreateInput>): Observable<LocalRead> {
    return this.http.patch<LocalRead>(`${this.base}/locales/${idLocal}`, datos);
  }

  eliminarLocal(idLocal: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/locales/${idLocal}`);
  }

  // ── Productos ────────────────────────────────────────────────────────────

  listarProductos(filtros: FiltrosProducto = {}): Observable<ProductoListItem[]> {
    let params = new HttpParams();
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.id_categoria) params = params.set('id_categoria', filtros.id_categoria);
    if (filtros.sexo) params = params.set('sexo', filtros.sexo);
    return this.http.get<ProductoListItem[]>(`${this.base}/productos`, { params });
  }

  obtenerProducto(idProducto: string): Observable<ProductoRead> {
    return this.http.get<ProductoRead>(`${this.base}/productos/${idProducto}`);
  }

  crearProducto(datos: ProductoCreateInput): Observable<ProductoRead> {
    return this.http.post<ProductoRead>(`${this.base}/productos`, datos);
  }

  actualizarProducto(idProducto: string, datos: ProductoUpdateInput): Observable<ProductoRead> {
    return this.http.patch<ProductoRead>(`${this.base}/productos/${idProducto}`, datos);
  }

  eliminarProducto(idProducto: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/productos/${idProducto}`);
  }
}
