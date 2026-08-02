// Mismo shape que AsistenteRespuesta en el backend (app/modules/chatbot/schemas/schemas.py).
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
  proveedor: 'gemini' | 'grok' | null;
  herramientas: string[];
}

export type ContextoCirobot = 'empresa' | 'admin';

export interface CirobotCallbacks {
  contexto: ContextoCirobot;
  onEnviarMensaje: (texto: string) => Promise<AsistenteRespuesta>;
  onNavegar: (vista: string) => void;
}
