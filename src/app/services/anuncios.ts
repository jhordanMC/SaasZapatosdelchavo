import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoAnuncio = 'anuncio' | 'encuesta';

export interface OpcionEncuesta {
  id_opcion: string;
  texto: string;
  // null = todavía no corresponde mostrar el conteo (usuario final que aún
  // no votó una encuesta vigente) — ver AnuncioParaUsuario.
  votos: number | null;
}

export interface Anuncio {
  id_anuncio: string;
  tipo: TipoAnuncio;
  titulo: string;
  mensaje: string;
  imagen_url: string | null;
  esta_activo: boolean;
  expira_en: string | null;
  opciones: OpcionEncuesta[];
  // Histórico: encuestas de satisfacción creadas antes de que "Califícanos"
  // (topbar, ver services/satisfaccion.ts) pasara a ser el único canal
  // oficial. Ya no se puede crear una encuesta nueva marcada así.
  es_satisfaccion: boolean;
  creado_en: string;
}

/** Vista de usuario final (campana del topbar): agrega si ya lo vio y votó. */
export interface AnuncioParaUsuario {
  id_anuncio: string;
  tipo: TipoAnuncio;
  titulo: string;
  mensaje: string;
  imagen_url: string | null;
  expira_en: string | null;
  // Para renderizar estrellas clickeables en vez de opciones de texto libre.
  es_satisfaccion: boolean;
  opciones: OpcionEncuesta[];
  visto: boolean;
  id_opcion_votada: string | null;
  creado_en: string;
}

export interface AnuncioCreateInput {
  tipo: TipoAnuncio;
  titulo: string;
  mensaje: string;
  imagen_url?: string | null;
  expira_en?: string | null;
  // Requerido (mínimo 2) si tipo === 'encuesta'.
  opciones?: string[];
}

export interface AnuncioUpdateInput {
  titulo?: string;
  mensaje?: string;
  imagen_url?: string | null;
  expira_en?: string | null;
  esta_activo?: boolean;
}

/**
 * Catálogo 100% global (sin id_empresa) — los anuncios/encuestas que
 * publica el staff de ALBA son visibles para todos los tenants vía la
 * campana del topbar (compartida por /admin/* y /empresa/*).
 */
@Injectable({ providedIn: 'root' })
export class AnunciosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Administración (staff de ALBA) ──────────────────────
  listarAnuncios(incluirInactivos = false): Observable<Anuncio[]> {
    return this.http.get<Anuncio[]>(`${this.apiUrl}/anuncios`, {
      params: { incluir_inactivos: String(incluirInactivos) },
    });
  }

  crearAnuncio(datos: AnuncioCreateInput): Observable<Anuncio> {
    return this.http.post<Anuncio>(`${this.apiUrl}/anuncios`, datos);
  }

  actualizarAnuncio(idAnuncio: string, datos: AnuncioUpdateInput): Observable<Anuncio> {
    return this.http.put<Anuncio>(`${this.apiUrl}/anuncios/${idAnuncio}`, datos);
  }

  /** Sube la imagen a disco local del servidor y devuelve la ruta a guardar en imagen_url. */
  subirImagen(archivo: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<{ url: string }>(`${this.apiUrl}/anuncios/upload-imagen`, formData);
  }

  // ── Usuario final (campana del topbar) ──────────────────
  listarAnunciosActivos(): Observable<AnuncioParaUsuario[]> {
    return this.http.get<AnuncioParaUsuario[]>(`${this.apiUrl}/anuncios/activos`);
  }

  marcarVisto(idAnuncio: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/anuncios/${idAnuncio}/marcar-visto`, {});
  }

  votar(idAnuncio: string, idOpcion: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/anuncios/${idAnuncio}/votar`, { id_opcion: idOpcion });
  }
}
