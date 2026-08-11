/**
 * Servicio Angular para el módulo catalogos.
 *
 * Encapsula las llamadas HTTP a /catalogos/* (panel del dueño, con JWT).
 * El interceptor de autenticación añade el Bearer token automáticamente.
 *
 * Regla de negocio que refleja el backend: una empresa puede GUARDAR varios
 * catálogos (estado='borrador'), pero solo puede tener UNO 'publicado' a la
 * vez — publicar uno despublica automáticamente cualquier otro (lo hace el
 * backend, esto solo dispara el PATCH).
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ---------------------------------------------------------------------------
// Tipos de dominio — espejean los schemas Pydantic del backend
// ---------------------------------------------------------------------------

export type EstadoCatalogo = 'publicado' | 'borrador';

export interface CatalogoRead {
  id_catalogo: string;
  nombre: string;
  slug: string;
  enlace: string; // URL pública completa, ya armada por el backend
  estado: EstadoCatalogo;
  color_diseno: string;
  visitas: number;
  productos_count: number;
  creado_en: string;
  actualizado_en: string;
}

/** Producto tal como aparece en el picker del dueño al elegir qué mostrar. */
export interface CatalogoProductoRead {
  id_producto: string;
  nombre: string;
  precio_venta: number;
  imagen_url: string | null;
  stock_total: number;
  en_catalogo: boolean; // true si ya está agregado a ESE catálogo
}

export interface CatalogoCreateInput {
  nombre: string;
  color_diseno?: string;
}

export interface CatalogoUpdateInput {
  nombre?: string;
  color_diseno?: string;
  estado?: EstadoCatalogo;
}

export interface MensajeResponse {
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly base = `${environment.apiUrl}/catalogos`;

  constructor(private http: HttpClient) {}

  /** Todos los catálogos guardados de la empresa (el publicado, si hay uno, primero). */
  listarMios(): Observable<CatalogoRead[]> {
    return this.http.get<CatalogoRead[]>(this.base);
  }

  crear(datos: CatalogoCreateInput): Observable<CatalogoRead> {
    return this.http.post<CatalogoRead>(this.base, datos);
  }

  actualizar(idCatalogo: string, datos: CatalogoUpdateInput): Observable<CatalogoRead> {
    return this.http.patch<CatalogoRead>(`${this.base}/${idCatalogo}`, datos);
  }

  /** Atajo para publicar (despublica cualquier otro automáticamente en el backend). */
  publicar(idCatalogo: string): Observable<CatalogoRead> {
    return this.actualizar(idCatalogo, { estado: 'publicado' });
  }

  /** Atajo para pasar a borrador (deja de estar visible en /c/<slug>). */
  despublicar(idCatalogo: string): Observable<CatalogoRead> {
    return this.actualizar(idCatalogo, { estado: 'borrador' });
  }

  eliminar(idCatalogo: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/${idCatalogo}`);
  }

  // ── Productos del catálogo (picker) ──────────────────────────────────────

  /** Productos activos de la empresa marcando cuáles ya están en ESE catálogo. */
  listarProductosSeleccionables(idCatalogo: string): Observable<CatalogoProductoRead[]> {
    return this.http.get<CatalogoProductoRead[]>(`${this.base}/${idCatalogo}/productos`);
  }

  agregarProductos(idCatalogo: string, idsProducto: string[]): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.base}/${idCatalogo}/productos`, {
      ids_producto: idsProducto,
    });
  }

  quitarProducto(idCatalogo: string, idProducto: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/${idCatalogo}/productos/${idProducto}`);
  }
}