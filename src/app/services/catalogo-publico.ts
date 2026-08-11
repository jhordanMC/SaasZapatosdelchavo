/**
 * Servicio Angular para la vista pública del catálogo (/c/<slug>).
 *
 * A diferencia de CatalogoService, este NO pasa por el interceptor de auth
 * (no hay JWT: lo consume un visitante anónimo) y apunta a /public/catalogos,
 * el router sin auth del backend (ver router_publico en el módulo catalogos).
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductoPublico {
  nombre: string;
  precio_venta: number;
  imagen_url: string | null;
}

export interface CatalogoPublico {
  nombre: string;
  color_diseno: string;
  productos: ProductoPublico[];
}

@Injectable({ providedIn: 'root' })
export class CatalogoPublicoService {
  private readonly base = `${environment.apiUrl}/public/catalogos`;

  constructor(private http: HttpClient) {}

  obtenerPorSlug(slug: string): Observable<CatalogoPublico> {
    return this.http.get<CatalogoPublico>(`${this.base}/${slug}`);
  }
}