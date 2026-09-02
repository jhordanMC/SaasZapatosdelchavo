import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AccionAsistente {
  tipo: 'navegar';
  vista: string;
}

export interface PanelInteligente {
  tipo: 'tabla' | 'kpis';
  titulo: string;
  datos: Record<string, unknown>[] | Record<string, unknown>;
}

export interface AsistenteRespuesta {
  respuesta: string;
  accion: AccionAsistente | null;
  panel: PanelInteligente | null;
  sugerencias: string[];
  // Grok (xAI) queda fuera de la cadena de fallback del backend por ahora
  // (ver GROK_HABILITADO en config.py) — solo Gemini/Groq responden hoy.
  proveedor: 'gemini' | 'groq' | null;
  herramientas: string[];
}

export interface UsoIAEmpresa {
  tokens_usados: number;
  limite_tokens: number | null;
  porcentaje: number | null;
  periodo: string;
}

/** Cliente HTTP de Cirobot — el componente React nunca llama esto directo, ver shared/cirobot/cirobot.ts. */
@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private readonly base = `${environment.apiUrl}/chatbot/asistente`;

  constructor(private http: HttpClient) {}

  enviarMensaje(mensaje: string): Observable<AsistenteRespuesta> {
    return this.http.post<AsistenteRespuesta>(`${this.base}/mensaje`, { mensaje });
  }

  obtenerUsoIA(): Observable<UsoIAEmpresa> {
    return this.http.get<UsoIAEmpresa>(`${this.base}/uso-ia`);
  }
}