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

export type SexoProducto = 'hombre' | 'mujer' | 'unisex' | 'nino' | 'nina';

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

/**
 * Almacén: entidad separada de Local (depósito/bodega de stock, no vende
 * directamente ni emite comprobantes). Se gestiona desde el panel
 * "Almacenes" del módulo Inventario — no se usa en el resto del frontend
 * (POS/ventas sigue trabajando solo con Locales).
 */
export interface AlmacenRead {
  id_almacen: string;
  id_empresa: string;
  nombre: string;
  direccion: string | null;
  descripcion: string | null;
  esta_activo: boolean;
  creado_en: string;
}

export interface StockVarianteRead {
  id_stock: string;
  id_local: string | null;
  nombre_local: string | null;
  id_almacen: string | null;
  nombre_almacen: string | null;
  cantidad: number;
  cantidad_minima: number;
}

export interface VarianteRead {
  id_variante: string;
  id_producto: string;
  talla: string | null;
  color: string | null;
  modelo: string | null;
  sku: string | null;
  codigo_barras?: string | null;
  esta_activo: boolean;
  stock: StockVarianteRead[];
}

/** Resumen para el listado de tarjetas del inventario. */
export interface ProductoListItem {
  id_producto: string;
  nombre: string;
  id_categoria: string | null;
  nombre_categoria: string | null;
  id_proveedor?: string | null;
  nombre_proveedor?: string | null;
  sexo: SexoProducto | null;
  precio_venta: number;
  costo_compra: number;
  margen: number;
  stock_total: number;
  imagen_url: string | null;
  esta_activo: boolean;
}

/** Detalle completo con variantes y stock. Usado en el modal de edición. */
export interface ProductoRead extends ProductoListItem {
  id_empresa: string;
  creado_en: string;
  actualizado_en: string;
  variantes: VarianteRead[];
}

/**
 * Envoltorio de paginación del catálogo (scroll infinito).
 * hay_mas indica si existe una página más; siguiente_offset ya viene listo
 * para pedirla sin que el frontend tenga que calcularlo.
 */
export interface ProductosPaginados {
  items: ProductoListItem[];
  hay_mas: boolean;
  siguiente_offset: number;
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export interface ProveedorRead {
  id_proveedor: string;
  id_empresa: string;
  razon_social: string;
  ruc: string | null;
  contacto_nombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  esta_activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface ProveedorCreateInput {
  razon_social: string;
  ruc?: string | null;
  contacto_nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

export interface ProveedorUpdateInput {
  razon_social?: string | null;
  ruc?: string | null;
  contacto_nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  esta_activo?: boolean | null;
}

// ---------------------------------------------------------------------------
// Payloads de escritura — espejean los schemas *Create y *Update del backend
// ---------------------------------------------------------------------------

export interface VarianteStockInput {
  talla: string;
  cantidad: number;
  sku?: string | null;
  codigo_barras?: string | null;
  id_local?: string | null;
  id_almacen?: string | null;
}

export interface ProductoCreateInput {
  nombre: string;
  id_categoria: string | null;
  id_proveedor?: string | null;
  sexo: SexoProducto | null;
  costo_compra: number;
  precio_venta: number;
  imagen_url?: string | null;
  variantes: VarianteStockInput[];
}

export interface ProductoUpdateInput {
  nombre?: string;
  id_categoria?: string | null;
  id_proveedor?: string | null;
  sexo?: SexoProducto | null;
  costo_compra?: number;
  precio_venta?: number;
  imagen_url?: string | null;
  esta_activo?: boolean;
  variantes?: VarianteStockInput[];
}

export interface SubirImagenResponse {
  url: string;
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

export interface AlmacenCreateInput {
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

/**
 * Tamaño de página del catálogo (scroll infinito). Único lugar donde se
 * define — cambiarlo acá es todo lo que hace falta para ajustarlo.
 */
export const TAMANO_PAGINA_CATALOGO = 30;

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

  // ── Proveedores ─────────────────────────────────────────────────────────

  listarProveedores(): Observable<ProveedorRead[]> {
    return this.http.get<ProveedorRead[]>(`${this.base}/proveedores`);
  }

  crearProveedor(datos: ProveedorCreateInput): Observable<ProveedorRead> {
    return this.http.post<ProveedorRead>(`${this.base}/proveedores`, datos);
  }

  actualizarProveedor(idProveedor: string, datos: ProveedorUpdateInput): Observable<ProveedorRead> {
    return this.http.patch<ProveedorRead>(`${this.base}/proveedores/${idProveedor}`, datos);
  }

  eliminarProveedor(idProveedor: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/proveedores/${idProveedor}`);
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

  // ── Almacenes (entidad separada de Locales) ────────────────────────────

  listarAlmacenes(): Observable<AlmacenRead[]> {
    return this.http.get<AlmacenRead[]>(`${this.base}/almacenes`);
  }

  crearAlmacen(datos: AlmacenCreateInput): Observable<AlmacenRead> {
    return this.http.post<AlmacenRead>(`${this.base}/almacenes`, datos);
  }

  actualizarAlmacen(idAlmacen: string, datos: Partial<AlmacenCreateInput>): Observable<AlmacenRead> {
    return this.http.patch<AlmacenRead>(`${this.base}/almacenes/${idAlmacen}`, datos);
  }

  eliminarAlmacen(idAlmacen: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/almacenes/${idAlmacen}`);
  }

  // ── Productos ────────────────────────────────────────────────────────────

  /**
   * Página del catálogo, ordenada por el backend (recientes + más
   * vendidos primero). `offset` avanza de TAMANO_PAGINA_CATALOGO en
   * TAMANO_PAGINA_CATALOGO para el scroll infinito.
   */
  listarProductos(
    filtros: FiltrosProducto = {},
    offset = 0,
    limit = TAMANO_PAGINA_CATALOGO,
    orden: 'ranking' | 'margen_desc' = 'ranking'
  ): Observable<ProductosPaginados> {
    let params = new HttpParams().set('limit', limit).set('offset', offset).set('orden', orden);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.id_categoria) params = params.set('id_categoria', filtros.id_categoria);
    if (filtros.sexo) params = params.set('sexo', filtros.sexo);
    return this.http.get<ProductosPaginados>(`${this.base}/productos`, { params });
  }

  obtenerProducto(idProducto: string): Observable<ProductoRead> {
    return this.http.get<ProductoRead>(`${this.base}/productos/${idProducto}`);
  }

  /** Sube y comprime la foto de un producto; devuelve la URL ya lista para guardar en imagen_url. */
  subirImagenProducto(archivo: File): Observable<SubirImagenResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<SubirImagenResponse>(`${this.base}/productos/upload-imagen`, formData);
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
