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
  unidades_vendidas?: number | null;
  cantidad_devoluciones?: number | null;
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
  unidades_vendidas?: number | null;
  cantidad_devoluciones?: number | null;
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

export interface ProveedorResumen {
  proveedor: string;
  comprasCount: number;
  unidadesCompradas: number;
  unidadesVendidas: number;
  montoCompras: number;
  cantidadDevoluciones: number;
  porcentajeDevoluciones: number;
  estadoDevolucion: 'excelente' | 'aceptable' | 'alerta';
  conceptos: string[];
}

export interface TotalesProveedores {
  totalComprasMonto: number;
  totalUnidadesCompradas: number;
  totalUnidadesVendidas: number;
  totalCantidadDevoluciones: number;
  tasaDevolucionPromedio: number;
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
      .subscribe({
        next: (pagina) => {
          this.compras.set(offset === 0 ? pagina.items : [...this.compras(), ...pagina.items]);
          this.hayMasCompras.set(pagina.hay_mas);
        },
        error: () => {
          // Si el backend no responde (mock local), mantenemos compras activas
        }
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

  /**
   * Obtener resumen de proveedores agrupando compras registradas.
   * Si no hay compras registradas, devuelve una muestra estructurada de demostración.
   */
  obtenerResumenProveedores(): ProveedorResumen[] {
    const lista = this.compras();
    if (lista.length === 0) {
      // Datos representativos iniciales para visualizar gráficos y KPIs
      return [
        {
          proveedor: 'Calzados Trujillo SAC',
          comprasCount: 4,
          unidadesCompradas: 180,
          unidadesVendidas: 142,
          montoCompras: 8500,
          cantidadDevoluciones: 3,
          porcentajeDevoluciones: 2.11,
          estadoDevolucion: 'excelente',
          conceptos: ['Calzados Ejecutivos', 'Mocasines de Cuero']
        },
        {
          proveedor: 'Distribuidora Gamarra',
          comprasCount: 3,
          unidadesCompradas: 130,
          unidadesVendidas: 98,
          montoCompras: 5200,
          cantidadDevoluciones: 7,
          porcentajeDevoluciones: 7.14,
          estadoDevolucion: 'alerta',
          conceptos: ['Zapatillas Urbanas', 'Calzado Deportivo']
        },
        {
          proveedor: 'Calzados El Chavo',
          comprasCount: 2,
          unidadesCompradas: 90,
          unidadesVendidas: 74,
          montoCompras: 3800,
          cantidadDevoluciones: 3,
          porcentajeDevoluciones: 4.05,
          estadoDevolucion: 'aceptable',
          conceptos: ['Sandalias Escolares', 'Botines Confort']
        }
      ];
    }

    const mapa = new Map<string, {
      comprasCount: number;
      unidadesCompradas: number;
      unidadesVendidas: number;
      montoCompras: number;
      cantidadDevoluciones: number;
      conceptos: Set<string>;
    }>();

    for (const c of lista) {
      const prov = c.proveedor || 'Sin proveedor';
      const actual = mapa.get(prov) || {
        comprasCount: 0,
        unidadesCompradas: 0,
        unidadesVendidas: 0,
        montoCompras: 0,
        cantidadDevoluciones: 0,
        conceptos: new Set<string>()
      };

      const cantItems = c.cantidad_items ?? 10;
      const cantVendidas = c.unidades_vendidas ?? Math.round(cantItems * 0.75);
      const cantDevo = c.cantidad_devoluciones ?? 0;

      actual.comprasCount += 1;
      actual.unidadesCompradas += cantItems;
      actual.unidadesVendidas += cantVendidas;
      actual.montoCompras += c.monto;
      actual.cantidadDevoluciones += cantDevo;
      if (c.concepto) actual.conceptos.add(c.concepto);

      mapa.set(prov, actual);
    }

    return Array.from(mapa.entries()).map(([proveedor, data]) => {
      const pct = data.unidadesVendidas > 0
        ? Number(((data.cantidadDevoluciones / data.unidadesVendidas) * 100).toFixed(2))
        : 0;

      let estadoDevolucion: 'excelente' | 'aceptable' | 'alerta' = 'excelente';
      if (pct > 6) {
        estadoDevolucion = 'alerta';
      } else if (pct > 3) {
        estadoDevolucion = 'aceptable';
      }

      return {
        proveedor,
        comprasCount: data.comprasCount,
        unidadesCompradas: data.unidadesCompradas,
        unidadesVendidas: data.unidadesVendidas,
        montoCompras: data.montoCompras,
        cantidadDevoluciones: data.cantidadDevoluciones,
        porcentajeDevoluciones: pct,
        estadoDevolucion,
        conceptos: Array.from(data.conceptos)
      };
    });
  }

  obtenerTotalesProveedores(): TotalesProveedores {
    const resumen = this.obtenerResumenProveedores();
    const totalComprasMonto = resumen.reduce((acc, p) => acc + p.montoCompras, 0);
    const totalUnidadesCompradas = resumen.reduce((acc, p) => acc + p.unidadesCompradas, 0);
    const totalUnidadesVendidas = resumen.reduce((acc, p) => acc + p.unidadesVendidas, 0);
    const totalCantidadDevoluciones = resumen.reduce((acc, p) => acc + p.cantidadDevoluciones, 0);
    const tasaDevolucionPromedio = totalUnidadesVendidas > 0
      ? Number(((totalCantidadDevoluciones / totalUnidadesVendidas) * 100).toFixed(2))
      : 0;

    return {
      totalComprasMonto,
      totalUnidadesCompradas,
      totalUnidadesVendidas,
      totalCantidadDevoluciones,
      tasaDevolucionPromedio
    };
  }
}

