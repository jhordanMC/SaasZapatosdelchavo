import { Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenStore } from '../core/token-store';
import { MarketplaceProveedor } from './marketplace-integraciones';

// ═══════════════════════════════════════════════════════════════════════
// PAYLOAD — contrato exacto que el frontend espera recibir del backend
// cuando termina de procesar un webhook de marketplace. Ver también
// "Directrices de backend" (sección aparte) para el lado que arma esto.
// ═══════════════════════════════════════════════════════════════════════

export type TipoEventoMarketplace =
  | 'venta_marketplace_confirmada'
  | 'sincronizacion_error'
  | 'token_vencido';

/** Una línea del pedido — 1 SKU/talla + cantidad. */
export interface ProductoEventoVenta {
  id_producto: string;
  id_variante: string;
  nombre: string;
  talla: string | null;
  cantidad: number;
  precio_unitario: number;
}

/** Efecto ya aplicado sobre el stock — el frontend solo pinta esto, no vuelve a calcular. */
export interface InventarioEventoVenta {
  variantes_actualizadas: {
    id_variante: string;
    /** Stock resultante DESPUÉS de descontar — lo que debe mostrar la grilla de Inventario. */
    stock_nuevo: number;
  }[];
}

/**
 * Estado real de la plata — separa "se vendió" de "ya tengo el dinero",
 * que es justo lo que pidió el cliente para que Finanzas refleje el flujo
 * de caja real y no un ingreso que en realidad el marketplace retiene.
 */
export type EstadoCobroMarketplace = 'pendiente_desembolso' | 'cobrado' | 'rechazado';

export interface FinanzasEventoVenta {
  id_movimiento: string;
  monto_bruto: number;
  comision_marketplace: number;
  /** monto_bruto - comision_marketplace, lo que realmente entra a caja. */
  monto_neto_a_recibir: number;
  estado_cobro: EstadoCobroMarketplace;
  /** Fecha en la que el marketplace desembolsa (null si aún no está confirmada). */
  fecha_estimada_desembolso: string | null;
}

/** Evento principal: se confirmó una venta en un marketplace. */
export interface EventoVentaMarketplace {
  tipo: 'venta_marketplace_confirmada';
  /** Idempotencia también en el frontend — evita alertas duplicadas si el stream reconecta. */
  id_evento: string;
  id_empresa: string;
  proveedor: MarketplaceProveedor;
  id_orden_marketplace: string;
  fecha: string; // ISO 8601
  productos: ProductoEventoVenta[];
  inventario: InventarioEventoVenta;
  finanzas: FinanzasEventoVenta;
}

/** La sincronización con el marketplace falló (credenciales, timeout, etc). */
export interface EventoErrorSincronizacion {
  tipo: 'sincronizacion_error';
  id_evento: string;
  id_empresa: string;
  proveedor: MarketplaceProveedor;
  mensaje: string;
}

/** El token OAuth de ese marketplace venció — hay que reconectar desde Detalle de empresa. */
export interface EventoTokenVencido {
  tipo: 'token_vencido';
  id_evento: string;
  id_empresa: string;
  proveedor: MarketplaceProveedor;
}

export type EventoMarketplace =
  | EventoVentaMarketplace
  | EventoErrorSincronizacion
  | EventoTokenVencido;

// ═══════════════════════════════════════════════════════════════════════
// SERVICIO — escucha el stream (Server-Sent Events) y expone un Observable.
//
// Se eligió SSE (EventSource nativo del navegador) en vez de WebSocket:
//   - El frontend solo RECIBE eventos acá; para actuar (ej. reconectar una
//     integración) igual usa HTTP normal — no hace falta full-duplex.
//   - EventSource reconecta solo ante cortes de red, sin código extra.
//   - Evita configurar "Web Sockets: On" en Azure App Service.
// Si más adelante se necesita bidireccional de verdad, este servicio es el
// único punto a cambiar por un WebSocket — el resto de la app ya consume
// esto como un Observable, agnóstico del transporte.
// ═══════════════════════════════════════════════════════════════════════

/**
 * TODO(backend): el endpoint SSE `/marketplace/eventos/stream` todavía NO
 * existe. Debe:
 *   1) Validar el token recibido por query param `?token=` (EventSource no
 *      soporta headers custom) — mismo Bearer que usa el resto de la API.
 *   2) Filtrar por id_empresa del token — cada tenant solo ve sus eventos.
 *   3) Mandar un evento SSE por línea `data: {...}\n\n` con el JSON de
 *      arriba (`EventoMarketplace`), apenas el procesamiento en background
 *      del webhook (ver directrices de backend) termine.
 *   4) Mandar un comentario `: ping\n\n` cada ~20s para mantener viva la
 *      conexión detrás de proxies/load balancers que cierran conexiones
 *      idle.
 */
@Injectable({ providedIn: 'root' })
export class MarketplaceRealtimeService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private reintentoTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly idsEventosVistos = new Set<string>();
  private readonly eventos$ = new Subject<EventoMarketplace>();

  /** Para mostrar un puntito "en vivo" en la UI si se quiere. */
  readonly conectado = signal(false);

  constructor(private zone: NgZone, private tokenStore: TokenStore) {}

  /** Llamar una sola vez al iniciar sesión (ver AdminLayoutComponent / EmpresaLayoutComponent). */
  conectar(): void {
    if (this.eventSource) return;
    this.abrirConexion();
  }

  desconectar(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.conectado.set(false);
    if (this.reintentoTimeout) {
      clearTimeout(this.reintentoTimeout);
      this.reintentoTimeout = null;
    }
  }

  /** Stream ya deduplicado — de acá se suscriben el toast global y el topbar. */
  escuchar(): Observable<EventoMarketplace> {
    return this.eventos$.asObservable();
  }

  private abrirConexion(): void {
    const token = this.tokenStore.accessToken();
    if (!token) return;

    const url = `${environment.apiUrl}/marketplace/eventos/stream?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.zone.run(() => this.conectado.set(true));
    };

    this.eventSource.onmessage = (mensaje: MessageEvent) => {
      this.zone.run(() => this.procesarMensaje(mensaje.data));
    };

    this.eventSource.onerror = () => {
      this.zone.run(() => this.conectado.set(false));
      this.eventSource?.close();
      this.eventSource = null;
      // El token pudo haber expirado — se reabre con uno fresco tras un respiro.
      this.reintentoTimeout = setTimeout(() => this.abrirConexion(), 5000);
    };
  }

  private procesarMensaje(data: string): void {
    let evento: EventoMarketplace;
    try {
      evento = JSON.parse(data) as EventoMarketplace;
    } catch {
      return; // mensaje malformado — se ignora, no debe tumbar la conexión
    }
    if (this.idsEventosVistos.has(evento.id_evento)) return; // dedup ante reconexiones
    this.idsEventosVistos.add(evento.id_evento);
    this.eventos$.next(evento);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
