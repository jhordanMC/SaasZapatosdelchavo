import { useState } from 'react';
import { Mascota3D, type EstadoMascota } from './mascota-3d';
import { ChatPanel } from './chat-panel';
import type { CirobotCallbacks } from './tipos';

type ModoVentana = 'flotante' | 'fullscreen';

/**
 * Raíz de Cirobot — flotante (ventana premium esquina inferior derecha)
 * o fullscreen (chat + Panel Inteligente ocupando toda la pantalla, para
 * análisis largos) + minimizado (colapsa a una barra chica, ver chat-panel.tsx).
 */
export function CirobotApp({ callbacks }: { callbacks: CirobotCallbacks }) {
  const [abierto, setAbierto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [modo, setModo] = useState<ModoVentana>('flotante');
  const [estadoMascota, setEstadoMascota] = useState<EstadoMascota>('reposo');
  // Contador: cada apertura del chat dispara una vez el clip de saludo.
  const [saludo, setSaludo] = useState(0);

  // La mascota tiene 3 estados posibles a resolver con un solo click:
  // cerrado -> abre; abierto-pero-minimizado -> restaura (NO cierra, para
  // no perder la conversación); abierto y visible -> cierra. Antes de este
  // fix, la mascota no sabía que existía "minimizado" (vivía solo dentro
  // de ChatPanel) y un click ahí simplemente cerraba todo sin querer.
  function alClickearMascota() {
    if (!abierto) {
      setAbierto(true);
      setMinimizado(false);
      setSaludo((n) => n + 1);
    } else if (minimizado) {
      setMinimizado(false);
    } else {
      setAbierto(false);
    }
  }

  return (
    <div className="cbot-raiz">
      {abierto && (
        <ChatPanel
          callbacks={callbacks}
          modo={modo}
          onCambiarModo={setModo}
          minimizado={minimizado}
          onMinimizar={() => setMinimizado(true)}
          onRestaurar={() => setMinimizado(false)}
          onClose={() => setAbierto(false)}
          onEstadoMascota={setEstadoMascota}
        />
      )}

      <div className="cbot-mascota-wrap">
        <div className={`cbot-mascota-visual ${abierto && !minimizado ? 'cbot-mascota-acercada' : ''}`}>
          <Mascota3D estado={estadoMascota} saludo={saludo} onListo={callbacks.onModeloListo} />
        </div>
        <div
          className="cbot-mascota-click"
          onClick={alClickearMascota}
          role="button"
          aria-label={abierto && !minimizado ? 'Cerrar Cirobot' : 'Abrir Cirobot'}
        />
      </div>
    </div>
  );
}