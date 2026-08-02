import { useState } from 'react';
import { Mascota3D } from './mascota-3d';
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

  // La mascota tiene 3 estados posibles a resolver con un solo click:
  // cerrado -> abre; abierto-pero-minimizado -> restaura (NO cierra, para
  // no perder la conversación); abierto y visible -> cierra. Antes de este
  // fix, la mascota no sabía que existía "minimizado" (vivía solo dentro
  // de ChatPanel) y un click ahí simplemente cerraba todo sin querer.
  function alClickearMascota() {
    if (!abierto) {
      setAbierto(true);
      setMinimizado(false);
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
        />
      )}

      <div className={`cbot-mascota-wrap ${abierto && !minimizado ? 'cbot-mascota-acercada' : ''}`}>
        <Mascota3D />
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
