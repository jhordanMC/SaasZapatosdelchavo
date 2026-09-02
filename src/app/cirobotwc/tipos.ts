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
  // Grok (xAI) queda fuera de la cadena de fallback del backend por ahora
  // (ver GROK_HABILITADO en config.py) — solo Gemini/Groq responden hoy.
  proveedor: 'gemini' | 'groq' | null;
  herramientas: string[];
}

// Mismo shape que UsoIAEmpresa en el backend (schemas.py). limite_tokens/
// porcentaje = null cuando el plan de la empresa es ilimitado.
export interface UsoIAEmpresa {
  tokens_usados: number;
  limite_tokens: number | null;
  porcentaje: number | null;
  periodo: string;
}

export type ContextoCirobot = 'empresa' | 'admin';

export interface CirobotCallbacks {
  contexto: ContextoCirobot;
  onEnviarMensaje: (texto: string) => Promise<AsistenteRespuesta>;
  onNavegar: (vista: string) => void;
  // Opcional a propósito: si el host (Angular) no lo pasa, ChatPanel
  // simplemente no muestra la barra de uso en vez de romper.
  onObtenerUsoIA?: () => Promise<UsoIAEmpresa>;
}