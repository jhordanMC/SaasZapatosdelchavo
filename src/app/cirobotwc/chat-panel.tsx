import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Markdown } from './markdown';
import { PanelInteligente } from './panel-inteligente';
import { etiquetaHerramienta, ETIQUETA_PROVEEDOR } from './etiquetas';
import {
  IconoActividad, IconoAdjuntar, IconoAnuncios, IconoCatalogo, IconoCerrar, IconoDashboard, IconoNavEmpresas,
  IconoEnviar, IconoExpandir, IconoFinanzas, IconoHistorial, IconoNavInventario, IconoKpis, IconoMicrofono,
  IconoMinimizar, IconoProductos, IconoProforma, IconoReclamaciones, IconoSuscripciones, IconoTickets, IconoNavVentas,
} from './iconos';
import { VarianLogo, type EstadoVarian } from './varian-logo';
import { useDictado } from './dictado';
import type { CirobotCallbacks, PanelInteligente as PanelInteligenteTipo, UsoIAEmpresa } from './tipos';

interface Mensaje {
  rol: 'usuario' | 'bot';
  texto: string;
  herramientas?: string[];
}

type ModoVentana = 'flotante' | 'fullscreen';

// Distintos según contexto — un admin no tiene tools de inventario/KPIs/ventas
// (ver ChatbotService._tool_servers_para en el backend), así que ofrecerle esos
// chips sería un callejón sin salida: Gemini respondería "no tengo acceso".
// Cada chip lleva su ícono (mockup Varian Assist). El texto que se envía al
// bot sigue siendo `label`, así que el comportamiento no cambia.
type ChipInicial = { label: string; icono: (p: { size?: number }) => ReactElement };
const chip = (label: string, icono: ChipInicial['icono']): ChipInicial => ({ label, icono });

const CHIPS_INICIALES_EMPRESA: ChipInicial[] = [
  chip('Inventario', IconoNavInventario), chip('KPIs', IconoKpis), chip('Ventas', IconoNavVentas), chip('Dashboard', IconoDashboard),
  chip('Ticket', IconoTickets), chip('Finanzas', IconoFinanzas), chip('Productos', IconoProductos), chip('Catálogos', IconoCatalogo),
];
// El vendedor no tiene Dashboard, Finanzas, Catálogos ni KPIs (ver chatbot/mcp/permisos.py en el backend).
const CHIPS_INICIALES_VENDEDOR: ChipInicial[] = [
  chip('Inventario', IconoNavInventario), chip('Ventas', IconoNavVentas), chip('Historial de ventas', IconoHistorial),
  chip('Proformas', IconoProforma), chip('Ticket', IconoTickets), chip('Productos', IconoProductos),
];
const CHIPS_INICIALES_ADMIN: ChipInicial[] = [
  chip('Ver empresas', IconoNavEmpresas), chip('Suscripciones', IconoSuscripciones), chip('Actividad', IconoActividad), chip('Anuncios', IconoAnuncios),
  chip('Dashboard', IconoDashboard), chip('Tickets', IconoTickets), chip('Reclamaciones', IconoReclamaciones),
];

// Las sugerencias que llegan DESPUÉS de cada respuesta vienen del backend como
// texto suelto ("Ver Ventas", "Analizar KPIs"...). Se les asigna el mismo
// ícono que a los chips iniciales según la palabra clave; el orden importa
// ("historial de ventas" antes que "ventas"). Sin coincidencia = sin ícono.
const ICONOS_POR_TEXTO: Array<[RegExp, ChipInicial['icono']]> = [
  [/historial/, IconoHistorial],
  [/proforma/, IconoProforma],
  [/kpi|analiz|indicador|m[eé]trica/, IconoKpis],
  [/inventario|stock/, IconoNavInventario],
  [/venta/, IconoNavVentas],
  [/dashboard|panel/, IconoDashboard],
  [/finanza|ingreso|utilidad|margen/, IconoFinanzas],
  [/cat[aá]logo/, IconoCatalogo],
  [/ticket/, IconoTickets],
  [/producto/, IconoProductos],
  [/suscripci/, IconoSuscripciones],
  [/actividad/, IconoActividad],
  [/anuncio/, IconoAnuncios],
  [/reclamaci/, IconoReclamaciones],
  [/empresa/, IconoNavEmpresas],
];
function iconoParaTexto(texto: string): ChipInicial['icono'] | null {
  const t = texto.toLowerCase();
  return ICONOS_POR_TEXTO.find(([re]) => re.test(t))?.[1] ?? null;
}

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
  const [proveedorActual, setProveedorActual] = useState<'gemini' | 'groq' | null>(null);
  const [usoIA, setUsoIA] = useState<UsoIAEmpresa | null>(null);
  // Estado visual del logo: thinking mientras espera, success/error ~2.5s
  // tras la respuesta y luego vuelve a online.
  const [resultado, setResultado] = useState<'success' | 'error' | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dictado por voz: el texto reconocido se escribe en el input (se ve mientras
  // hablas) y se le antepone lo que ya estaba escrito. NO se envía solo: el
  // usuario lo revisa y da Enter, por si el reconocimiento se equivoca.
  const baseDictadoRef = useRef('');
  const { soportado: vozSoportada, escuchando, error: errorVoz, iniciar, detener, limpiarError } = useDictado((texto) => {
    const base = baseDictadoRef.current;
    setInput(base ? `${base} ${texto}` : texto);
  });

  function alternarMicrofono() {
    if (escuchando) {
      detener();
      return;
    }
    baseDictadoRef.current = input.trim();
    iniciar();
  }

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (!minimizado) inputRef.current?.focus();
    else detener(); // minimizado: no dejar el micrófono abierto en segundo plano
  }, [minimizado, detener]);

  useEffect(() => {
    if (!escuchando) inputRef.current?.focus();
  }, [escuchando]);

  useEffect(() => {
    if (!resultado) return;
    const id = window.setTimeout(() => setResultado(null), 2500);
    return () => window.clearTimeout(id);
  }, [resultado]);

  // Carga el cupo al abrir el chat (una vez), sin bloquear la UI si falla
  // o si el host (Angular) no pasó el callback — la barra simplemente no
  // se muestra en ese caso, ver JSX abajo.
  useEffect(() => {
    if (!callbacks.onObtenerUsoIA) return;
    callbacks.onObtenerUsoIA().then(setUsoIA).catch(() => {});
  }, [callbacks]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || cargando) return;
    detener();

    setMensajes((prev) => [...prev, { rol: 'usuario', texto: limpio }]);
    setInput('');
    setSugerencias([]);
    setResultado(null);
    setCargando(true);

    try {
      const respuesta = await callbacks.onEnviarMensaje(limpio);
      setResultado('success');
      setMensajes((prev) => [...prev, { rol: 'bot', texto: respuesta.respuesta, herramientas: respuesta.herramientas }]);
      setSugerencias(respuesta.sugerencias ?? []);
      setPanelActual(respuesta.panel ?? null);
      if (respuesta.proveedor) setProveedorActual(respuesta.proveedor);
      if (respuesta.accion?.tipo === 'navegar') {
        callbacks.onNavegar(respuesta.accion.vista);
      }
      // El mensaje que se acaba de responder ya gastó tokens — se refresca
      // el cupo aparte (no bloquea el chat si esto falla).
      if (callbacks.onObtenerUsoIA) {
        callbacks.onObtenerUsoIA().then(setUsoIA).catch(() => {});
      }
    } catch {
      setResultado('error');
      setMensajes((prev) => [
        ...prev,
        { rol: 'bot', texto: 'No pude conectarme ahora mismo. Intenta de nuevo en un momento.' },
      ]);
    } finally {
      setCargando(false);
    }
  }

  const huboConversacion = mensajes.length > 0;
  const chipsIniciales =
    callbacks.contexto === 'admin'
      ? CHIPS_INICIALES_ADMIN
      : callbacks.rol === 'vendedor'
        ? CHIPS_INICIALES_VENDEDOR
        : CHIPS_INICIALES_EMPRESA;
  const estadoLogo: EstadoVarian = cargando ? 'thinking' : (resultado ?? 'online');
  const estadoTexto = cargando
    ? 'Analizando empresa…'
    : proveedorActual
      ? ETIQUETA_PROVEEDOR[proveedorActual]
      : 'Copiloto Inteligente de VILCAS';

  if (minimizado) {
    return (
      <button className="cbot-mini-barra" onClick={onRestaurar} aria-label="Restaurar Varian Assist">
        <VarianLogo status={estadoLogo} size={28} />
        <span className="cbot-mini-texto">Varian Assist</span>
        <span className={`cbot-estado-dot ${cargando ? 'cbot-estado-dot-activo' : ''}`} />
      </button>
    );
  }

  return (
    <div className={`cbot-panel cbot-panel-${modo} ${panelActual ? 'cbot-con-panel-lateral' : ''}`}>
      <header className="cbot-header">
        <VarianLogo status={estadoLogo} size={42} />
        <div className="cbot-header-info">
          <span className="cbot-header-titulo">Varian Assist</span>
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
          <button className="cbot-icon-btn" onClick={onClose} title="Cerrar" aria-label="Cerrar Varian Assist">
            <IconoCerrar />
          </button>
        </div>
      </header>

      <div className="cbot-cuerpo">
        <div className="cbot-columna-chat">
          <div className="cbot-mensajes">
            {!huboConversacion && (
              <div className="cbot-bienvenida">
                <div className="cbot-bienvenida-mascota" aria-hidden="true">
                  <svg className="cbot-destellos" viewBox="0 0 200 120">
                    <path d="M28 40 L40 48" /><path d="M20 66 L34 66" /><path d="M28 92 L40 84" />
                    <path d="M172 40 L160 48" /><path d="M180 66 L166 66" /><path d="M172 92 L160 84" />
                  </svg>
                  <img src="/varian-mascota.png" alt="" width="132" height="123" draggable={false} />
                </div>
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
                <span className="cbot-pensando-texto">Varian Assist está pensando</span>
                <span className="cbot-pensando-barra"><span /></span>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {!huboConversacion && !cargando && (
            <div className="cbot-chips">
              {chipsIniciales.map(({ label, icono: Icono }) => (
                <button key={label} className="cbot-chip cbot-chip-icono" onClick={() => enviar(label)}>
                  <Icono size={15} />
                  {label}
                </button>
              ))}
            </div>
          )}
          {huboConversacion && sugerencias.length > 0 && !cargando && (
            <div className="cbot-chips">
              {sugerencias.map((s) => {
                const Icono = iconoParaTexto(s);
                return (
                  <button key={s} className={`cbot-chip ${Icono ? 'cbot-chip-icono' : ''}`} onClick={() => enviar(s)}>
                    {Icono && <Icono size={15} />}
                    {s}
                  </button>
                );
              })}
            </div>
          )}

          {usoIA && usoIA.limite_tokens != null && usoIA.porcentaje != null && (
            <div className="cbot-uso-ia">
              <div className="cbot-uso-ia-fila">
                <span>Uso de IA este mes</span>
                <span>{usoIA.porcentaje}%</span>
              </div>
              <div className="cbot-uso-ia-pista">
                <div
                  className={`cbot-uso-ia-relleno ${
                    usoIA.porcentaje >= 100 ? 'cbot-uso-ia-critico' : usoIA.porcentaje >= 80 ? 'cbot-uso-ia-advertencia' : ''
                  }`}
                  style={{ width: `${Math.min(usoIA.porcentaje, 100)}%` }}
                />
              </div>
            </div>
          )}

          {errorVoz && (
            <div className="cbot-voz-aviso" role="status" onClick={limpiarError}>
              {errorVoz}
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
              placeholder={escuchando ? 'Escuchando… habla ahora' : 'Pregúntame cualquier cosa sobre tu empresa…'}
              value={input}
              disabled={cargando}
              onChange={(e) => {
                if (escuchando) detener(); // si el usuario escribe a mano, se corta el dictado
                setInput(e.target.value);
              }}
            />
            <button type="button" className="cbot-input-icon" disabled title="Adjuntar (próximamente)" aria-label="Adjuntar">
              <IconoAdjuntar />
            </button>
            <button
              type="button"
              className={`cbot-input-icon cbot-mic ${escuchando ? 'cbot-mic-activo' : ''}`}
              disabled={!vozSoportada || cargando}
              onClick={alternarMicrofono}
              title={!vozSoportada ? 'Tu navegador no soporta dictado por voz (prueba Chrome o Edge)' : escuchando ? 'Detener dictado' : 'Dictar por voz'}
              aria-label={escuchando ? 'Detener dictado' : 'Dictar por voz'}
              aria-pressed={escuchando}
            >
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