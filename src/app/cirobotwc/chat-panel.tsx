import { useEffect, useRef, useState } from 'react';
import { Markdown } from './markdown';
import { PanelInteligente } from './panel-inteligente';
import { etiquetaHerramienta, ETIQUETA_PROVEEDOR } from './etiquetas';
import { IconoAdjuntar, IconoBot, IconoCerrar, IconoEnviar, IconoExpandir, IconoMicrofono, IconoMinimizar } from './iconos';
import type { CirobotCallbacks, PanelInteligente as PanelInteligenteTipo } from './tipos';

interface Mensaje {
  rol: 'usuario' | 'bot';
  texto: string;
  herramientas?: string[];
}

type ModoVentana = 'flotante' | 'fullscreen';

// Distintos según contexto — un admin no tiene tools de inventario/KPIs/ventas
// (ver ChatbotService._tool_servers_para en el backend), así que ofrecerle esos
// chips sería un callejón sin salida: Gemini respondería "no tengo acceso".
const CHIPS_INICIALES_EMPRESA = ['Inventario', 'KPIs', 'Ventas', 'Dashboard', 'Ticket', 'Finanzas', 'Productos'];
const CHIPS_INICIALES_ADMIN = ['Ver empresas', 'Suscripciones', 'Actividad', 'Anuncios', 'Dashboard', 'Tickets'];

/**
 * Ventana de chat de Cirobot. Mensajes tipo ChatGPT/Claude (burbuja verde
 * usuario, card gris muy claro IA — nunca oscuro), el Panel Inteligente
 * vive aparte (nunca tablas/JSON dentro del chat). Sin streaming real
 * (HTTP simple) — el feed de "✓ tool usada" se pinta junto con la
 * respuesta final, no en vivo mientras se ejecuta.
 */
export function ChatPanel({
  callbacks,
  modo,
  onCambiarModo,
  minimizado,
  onMinimizar,
  onRestaurar,
  onClose,
}: {
  callbacks: CirobotCallbacks;
  modo: ModoVentana;
  onCambiarModo: (modo: ModoVentana) => void;
  minimizado: boolean;
  onMinimizar: () => void;
  onRestaurar: () => void;
  onClose: () => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [panelActual, setPanelActual] = useState<PanelInteligenteTipo | null>(null);
  const [proveedorActual, setProveedorActual] = useState<'gemini' | 'groq' | 'grok' | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (!minimizado) inputRef.current?.focus();
  }, [minimizado]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || cargando) return;

    setMensajes((prev) => [...prev, { rol: 'usuario', texto: limpio }]);
    setInput('');
    setSugerencias([]);
    setCargando(true);

    try {
      const respuesta = await callbacks.onEnviarMensaje(limpio);
      setMensajes((prev) => [...prev, { rol: 'bot', texto: respuesta.respuesta, herramientas: respuesta.herramientas }]);
      setSugerencias(respuesta.sugerencias ?? []);
      setPanelActual(respuesta.panel ?? null);
      if (respuesta.proveedor) setProveedorActual(respuesta.proveedor);
      if (respuesta.accion?.tipo === 'navegar') {
        callbacks.onNavegar(respuesta.accion.vista);
      }
    } catch {
      setMensajes((prev) => [
        ...prev,
        { rol: 'bot', texto: 'No pude conectarme ahora mismo. Intenta de nuevo en un momento.' },
      ]);
    } finally {
      setCargando(false);
    }
  }

  const huboConversacion = mensajes.length > 0;
  const chipsIniciales = callbacks.contexto === 'admin' ? CHIPS_INICIALES_ADMIN : CHIPS_INICIALES_EMPRESA;
  const estadoTexto = cargando
    ? 'Analizando empresa…'
    : proveedorActual
      ? ETIQUETA_PROVEEDOR[proveedorActual]
      : 'Copiloto Inteligente de VILCAS';

  if (minimizado) {
    return (
      <button className="cbot-mini-barra" onClick={onRestaurar} aria-label="Restaurar Cirobot">
        <span className="cbot-avatar cbot-avatar-mini"><IconoBot size={14} /></span>
        <span className="cbot-mini-texto">Cirobot</span>
        <span className={`cbot-estado-dot ${cargando ? 'cbot-estado-dot-activo' : ''}`} />
      </button>
    );
  }

  return (
    <div className={`cbot-panel cbot-panel-${modo} ${panelActual ? 'cbot-con-panel-lateral' : ''}`}>
      <header className="cbot-header">
        <div className="cbot-avatar"><IconoBot size={19} className="cbot-avatar-icono" /></div>
        <div className="cbot-header-info">
          <span className="cbot-header-titulo">Cirobot</span>
          <span className="cbot-header-sub">
            <span className={`cbot-estado-dot ${cargando ? 'cbot-estado-dot-activo' : ''}`} />
            {estadoTexto}
          </span>
        </div>
        <div className="cbot-header-acciones">
          <button className="cbot-icon-btn" onClick={onMinimizar} title="Minimizar" aria-label="Minimizar">
            <IconoMinimizar />
          </button>
          <button
            className={`cbot-icon-btn ${modo === 'fullscreen' ? 'activo' : ''}`}
            onClick={() => onCambiarModo(modo === 'fullscreen' ? 'flotante' : 'fullscreen')}
            title={modo === 'fullscreen' ? 'Restaurar' : 'Expandir'}
            aria-label="Expandir"
          >
            <IconoExpandir />
          </button>
          <button className="cbot-icon-btn" onClick={onClose} title="Cerrar" aria-label="Cerrar Cirobot">
            <IconoCerrar />
          </button>
        </div>
      </header>

      <div className="cbot-cuerpo">
        <div className="cbot-columna-chat">
          <div className="cbot-mensajes">
            {!huboConversacion && (
              <div className="cbot-bienvenida">
                <p className="cbot-bienvenida-titulo">¿En qué te ayudo hoy?</p>
                <p className="cbot-bienvenida-sub">Pregúntame cualquier cosa sobre tu empresa.</p>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={`cbot-msg cbot-msg-${m.rol}`}>
                {m.rol === 'bot' && m.herramientas && m.herramientas.length > 0 && (
                  <div className="cbot-tool-feed">
                    {m.herramientas.map((h, j) => (
                      <span key={j} className="cbot-tool-feed-item">
                        <span className="cbot-tool-check">✓</span> {etiquetaHerramienta(h)}
                      </span>
                    ))}
                  </div>
                )}
                {m.rol === 'bot' ? <Markdown texto={m.texto} /> : m.texto}
              </div>
            ))}

            {cargando && (
              <div className="cbot-msg cbot-msg-bot cbot-pensando">
                <span className="cbot-pensando-texto">Cirobot está pensando</span>
                <span className="cbot-pensando-barra"><span /></span>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {!huboConversacion && !cargando && (
            <div className="cbot-chips">
              {chipsIniciales.map((s) => (
                <button key={s} className="cbot-chip" onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {huboConversacion && sugerencias.length > 0 && !cargando && (
            <div className="cbot-chips">
              {sugerencias.map((s) => (
                <button key={s} className="cbot-chip" onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form 
            className="cbot-input-area"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(input);
            }}
          >
            <input
              ref={inputRef}
              className="cbot-input"
              placeholder="Pregúntame cualquier cosa sobre tu empresa…"
              value={input}
              disabled={cargando}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="button" className="cbot-input-icon" disabled title="Adjuntar (próximamente)" aria-label="Adjuntar">
              <IconoAdjuntar />
            </button>
            <button type="button" className="cbot-input-icon" disabled title="Micrófono (próximamente)" aria-label="Micrófono">
              <IconoMicrofono />
            </button>
            <button
              type="submit"
              className="cbot-enviar"
              disabled={cargando || !input.trim()}
              aria-label="Enviar"
            >
              <IconoEnviar />
            </button>
          </form>
        </div>

        {panelActual && (
          <div className="cbot-columna-panel">
            <PanelInteligente panel={panelActual} onCerrar={() => setPanelActual(null)} />
          </div>
        )}
      </div>
    </div>
  );
}