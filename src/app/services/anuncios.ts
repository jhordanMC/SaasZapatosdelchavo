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
  // Solo aplica a tipo === 'encuesta' — si está en true, esta es (candidata
  // a ser) la encuesta que alimenta el "Score global de satisfacción" del
  // dashboard. Ver AnunciosService (backend).
  es_satisfaccion: boolean;
  creado_en: string;
}

/** Score de satisfacción (0-100) de una empresa — panel /admin/dashboard. */
export interface EmpresaScoreSatisfaccion {
  id_empresa: string;
  score_promedio: number;
}

/**
 * `existe_encuesta_vigente=false` = no hay ninguna encuesta de satisfacción
 * creada (distinto de "hay encuesta pero nadie votó todavía", donde viene
 * en true y `scores` vacío). Una empresa ausente de `scores` significa que
 * sus usuarios aún no votaron esa encuesta.
 */
export interface ScoreSatisfaccionResponse {
  existe_encuesta_vigente: boolean;
  scores: EmpresaScoreSatisfaccion[];
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
  es_satisfaccion?: boolean;
}

export interface AnuncioUpdateInput {
  titulo?: string;
  mensaje?: string;
  imagen_url?: string | null;
  expira_en?: string | null;
  esta_activo?: boolean;
  es_satisfaccion?: boolean;
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

  /** Score de satisfacción (0-100) por empresa, de la encuesta de satisfacción vigente. */
  obtenerScoreSatisfaccionPorEmpresa(): Observable<ScoreSatisfaccionResponse> {
    return this.http.get<ScoreSatisfaccionResponse>(`${this.apiUrl}/anuncios/satisfaccion/por-empresa`);
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
