import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CIROBOT_CSS } from './cirobot-estilos';
import type { CirobotCallbacks } from './tipos';

const roots = new WeakMap<HTMLElement, Root>();
let estilosInyectados = false;

function inyectarEstilos(): void {
  if (estilosInyectados || document.getElementById('cirobot-estilos')) return;
  const style = document.createElement('style');
  style.id = 'cirobot-estilos';
  style.textContent = CIROBOT_CSS;
  document.head.appendChild(style);
  estilosInyectados = true;
}

/**
 * Monta Cirobot en `element`. A propósito, `cirobot-app.tsx` (y todo lo
 * que arrastra: react-three-fiber/drei/three) se carga con `import()`
 * dinámico ACÁ ADENTRO, no como import estático arriba del archivo —
 * así queda en un chunk separado que solo se descarga cuando el usuario
 * realmente usa Cirobot, no en el bundle inicial de la app.
 */
export async function mountCirobot(element: HTMLElement, callbacks: CirobotCallbacks): Promise<void> {
  inyectarEstilos();
  const { CirobotApp } = await import('./cirobot-app');

  const root = createRoot(element);
  roots.set(element, root);
  root.render(React.createElement(CirobotApp, { callbacks }));
}

export function unmountCirobot(element: HTMLElement): void {
  const root = roots.get(element);
  if (root) {
    root.unmount();
    roots.delete(element);
  }
}
