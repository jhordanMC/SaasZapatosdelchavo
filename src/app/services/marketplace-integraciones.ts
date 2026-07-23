import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type MarketplaceProveedor = 'falabella' | 'ripley' | 'mercado_libre';

export const MARKETPLACES_DISPONIBLES: { id: MarketplaceProveedor; nombre: string }[] = [
  { id: 'falabella', nombre: 'Falabella' },
  { id: 'ripley', nombre: 'Ripley' },
  { id: 'mercado_libre', nombre: 'Mercado Libre' },
];

export type EstadoConexionMarketplace =
  | 'no_conectado'
  | 'conectado'
  | 'error_credenciales'
  | 'token_vencido';

export interface IntegracionMarketplace {
  id_integracion: string;
  id_empresa: string;
  proveedor: MarketplaceProveedor;
  estado: EstadoConexionMarketplace;
  /** Identificador de tienda/seller en el marketplace (dato no sensible, sí se muestra en UI). */
  tienda_id: string | null;
  conectado_en: string | null;
  ultima_sincronizacion_en: string | null;
  ultimo_error: string | null;
}

/**
 * Credenciales que pide cada marketplace para autenticar sus webhooks/API.
 * Los 3 marketplaces (Falabella, Ripley, Mercado Libre) exponen APIs tipo
 * OAuth2 (client_id/client_secret + a veces un seller/tienda id) — se deja
 * un shape genérico; el backend es quien sabe el detalle fino de cada uno
 * (algunos piden refresh_token manual, Mercado Libre usa OAuth con
 * redirect, etc.) — ver directrices de backend para el detalle por proveedor.
 */
export interface CredencialesMarketplaceInput {
  client_id: string;
  client_secret: string;
  /** Seller ID / código de tienda en el marketplace. */
  tienda_id: string;
}

/**
 * TODO(backend): estos 4 endpoints todavía NO existen — hay que coordinarlos
 * con el equipo de backend. Las credenciales (client_secret) NUNCA deben
 * volver en las respuestas GET, solo en el POST de conectar. Ver
 * "Diseño técnico — Integraciones Omnicanal" para el detalle de guardado
 * cifrado (at-rest) y verificación de webhooks por proveedor.
 */
@Injectable({ providedIn: 'root' })
export class MarketplaceIntegracionesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarIntegraciones(idEmpresa: string): Observable<IntegracionMarketplace[]> {
    return this.http.get<IntegracionMarketplace[]>(
      `${this.apiUrl}/empresas/${idEmpresa}/integraciones-marketplace`,
    );
  }

  conectarIntegracion(
    idEmpresa: string,
    proveedor: MarketplaceProveedor,
    credenciales: CredencialesMarketplaceInput,
  ): Observable<IntegracionMarketplace> {
    return this.http.post<IntegracionMarketplace>(
      `${this.apiUrl}/empresas/${idEmpresa}/integraciones-marketplace/${proveedor}/conectar`,
      credenciales,
    );
  }

  desconectarIntegracion(idEmpresa: string, idIntegracion: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/empresas/${idEmpresa}/integraciones-marketplace/${idIntegracion}`,
    );
  }

  /** Fuerza una prueba de conexión (ping a la API del marketplace) sin esperar al próximo webhook. */
  probarConexion(idEmpresa: string, idIntegracion: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.post<{ ok: boolean; mensaje: string }>(
      `${this.apiUrl}/empresas/${idEmpresa}/integraciones-marketplace/${idIntegracion}/probar`,
      {},
    );
  }
}
