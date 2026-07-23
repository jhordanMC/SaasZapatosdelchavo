import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenStore } from '../core/token-store';

/**
 * Servicio para la pantalla "Integraciones" (self-service, del lado del
 * DUEÑO de la empresa): conecta sus propios marketplaces desde
 * /empresa/integraciones.
 *
 * OJO: esto es DISTINTO del MarketplaceIntegracionesService que ya usa el
 * panel de ADMIN en empresa-detalle (ese es client_id/client_secret,
 * gestionado por el staff de ALBA). Acá el dueño pega su propio
 * Seller ID + API Key, tal como lo definió el equipo de backend.
 */

export type ProveedorConCredenciales = 'falabella' | 'ripley';

/** Lo que el dueño copia y pega desde el panel de su marketplace. */
export interface CredencialesTiendaInput {
  seller_id: string;
  api_key: string;
}

/**
 * TODO(backend): confirmar el shape exacto que devuelve
 * POST /integrations/{proveedor}/config — se asume que trae el estado
 * resultante para poder refrescar la tarjeta sin golpear otro endpoint.
 * El api_key NUNCA debería volver en la respuesta (ni acá ni en un futuro
 * GET de estado): con saber que quedó "conectado" y desde cuándo alcanza.
 */
export interface ConfigTiendaGuardada {
  proveedor: ProveedorConCredenciales;
  estado: 'conectado' | 'error_credenciales';
  seller_id: string;
  conectado_en: string | null;
}

export type EstadoConexionTienda = 'no_conectado' | 'conectado' | 'error_credenciales';

@Injectable({ providedIn: 'root' })
export class IntegracionesTenantService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private tokenStore: TokenStore) {}

  /**
   * URL a la que se manda el navegador de frente (no es un fetch — es una
   * navegación completa) para arrancar el login OAuth de Mercado Libre. El
   * backend hace el intercambio de código con Mercado Libre y, al terminar,
   * redirige de vuelta a /empresa/integraciones.
   *
   * TODO(backend): confirmar el path exacto de este endpoint
   * (`/integrations/mercadolibre/login`) y que acepte el access token por
   * query param `?token=` — igual que ya se hace para el stream SSE, porque
   * una navegación de navegador no puede mandar un header Authorization
   * custom.
   */
  urlLoginMercadoLibre(): string {
    const token = this.tokenStore.accessToken() ?? '';
    return `${this.apiUrl}/integrations/mercadolibre/login?token=${encodeURIComponent(token)}`;
  }

  guardarConfigFalabella(credenciales: CredencialesTiendaInput): Observable<ConfigTiendaGuardada> {
    return this.http.post<ConfigTiendaGuardada>(
      `${this.apiUrl}/integrations/falabella/config`,
      credenciales,
    );
  }

  guardarConfigRipley(credenciales: CredencialesTiendaInput): Observable<ConfigTiendaGuardada> {
    return this.http.post<ConfigTiendaGuardada>(
      `${this.apiUrl}/integrations/ripley/config`,
      credenciales,
    );
  }

  /**
   * TODO(backend): todavía no hay un endpoint de estado/listado para esta
   * pantalla (la tabla tenant_integraciones que están armando en paralelo).
   * Se deja el método listo para conectarlo apenas exista — mientras tanto
   * la página asume "no conectado" para los 3 hasta poder leer el estado
   * real desde acá.
   */
  listarEstado(): Observable<ConfigTiendaGuardada[]> {
    return this.http.get<ConfigTiendaGuardada[]>(`${this.apiUrl}/integrations/status`);
  }
}
