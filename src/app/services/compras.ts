/**
 * Servicio Angular del módulo Compras — HTTP contra /compras.
 *
 * Registra las compras de mercadería a proveedores (reposición de stock).
 * Sigue el mismo patrón que los gastos operativos de FinanzasService:
 * paginación con "hay_mas"/"siguiente_offset" para el listado, y un
 * endpoint aparte sin paginar para reportes por rango de fechas (usado
 * por el resumen mensual de compras y ventas).
 *
 * NOTA PARA BACKEND: este servicio asume los siguientes endpoints, que
 * todavía no existen en la API (viven en un repo aparte):
 *   GET    /compras?limit=&offset=          -> ComprasPaginadas
 *   GET    /compras/rango?desde=&hasta=     -> CompraRead[]  (sin paginar, para reportes)
 *   POST   /compras                          -> CompraRead
 *   DELETE /compras/{id_compra}              -> MensajeResponse
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CompraRead {
  id_compra: string;
  proveedor: string;
  concepto: string;
  monto: number;
  cantidad_items: number | null;
  fecha: string;
  id_local: string | null;
  nombre_local: string | null;
  id_almacen: string | null;
  nombre_almacen: string | null;
  notas: string | null;
  creado_en: string;
}

export interface CompraCreate {
  proveedor: string;
  concepto: string;
  monto: number;
  cantidad_items?: number | null;
  fecha: string;
  id_local?: string | null;
  id_almacen?: string | null;
  notas?: string | null;
}

export interface ComprasPaginadas {
  items: CompraRead[];
  hay_mas: boolean;
  siguiente_offset: number;
}

export interface MensajeResponse {
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private readonly base = `${environment.apiUrl}/compras`;

  readonly compras = signal<CompraRead[]>([]);
  readonly hayMasCompras = signal(false);

  constructor(private http: HttpClient) {}

  cargarCompras(offset = 0, limit = 30): void {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    this.http
      .get<ComprasPaginadas>(this.base, { params })
      .subscribe((pagina) => {
        this.compras.set(offset === 0 ? pagina.items : [...this.compras(), ...pagina.items]);
        this.hayMasCompras.set(pagina.hay_mas);
      });
  }

  crearCompra(data: CompraCreate): Observable<CompraRead> {
    return this.http.post<CompraRead>(this.base, data);
  }

  eliminarCompra(idCompra: string): Observable<MensajeResponse> {
    return this.http.delete<MensajeResponse>(`${this.base}/${idCompra}`);
  }

  /**
   * Todas las compras dentro de un rango de fechas (sin paginar) — pensado
   * para el resumen mensual descargable, no para el listado en pantalla.
   */
  listarComprasEnRango(desde: string, hasta: string): Observable<CompraRead[]> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<CompraRead[]>(`${this.base}/rango`, { params });
  }
}
