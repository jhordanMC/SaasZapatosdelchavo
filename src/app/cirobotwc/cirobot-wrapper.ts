import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CIROBOT_CSS } from './cirobot-estilos';
import type { CirobotCallbacks } from './tipos';

const roots = new WeakMap<HTMLElement, Root>();
let estilosInyectados = false;
let observerModals: MutationObserver | null = null;

function inyectarEstilos(): void {
  if (estilosInyectados || document.getElementById('cirobot-estilos')) return;
  const style = document.createElement('style');
  style.id = 'cirobot-estilos';
  style.textContent = CIROBOT_CSS;
  document.head.appendChild(style);
  estilosInyectados = true;
}

/**
 * Cirobot vive en un stacking context propio con z-index:9999 (necesario
 * para flotar sobre el contenido normal de la app), pero eso mismo hace
 * que su hotspot clickeable (.cbot-mascota-click) quede POR ENCIMA de
 * cualquier modal (.modal-overlay), que en toda la app usa z-index entre
 * 1000 y 3000. En mobile esto tapaba los botones Guardar/Cancelar de los
 * modals (inventario, ventas, finanzas, etc.) porque terminan cayendo en
 * la misma esquina inferior-derecha donde vive el hotspot del bot.
 *
 * En vez de que cada uno de los ~14 componentes con modal tenga que
 * "avisarle" a Cirobot al abrirse (frágil: cualquier modal nuevo que se
 * agregue en el futuro se olvidaría de hacerlo), Cirobot vigila el DOM
 * él solo con un MutationObserver y se oculta por completo (mascota +
 * chat, si estaba abierto) mientras exista algún `.modal-overlay` en la
 * página. Barato de correr: solo mira childList/subtree en <body>.
 */
function iniciarVigilanciaDeModals(): void {
  if (observerModals) return;

  const sincronizar = () => {
    const hayModalAbierto = document.body.querySelector('.modal-overlay') !== null;
    document.body.classList.toggle('cbot-oculto-por-modal', hayModalAbierto);
  };

  observerModals = new MutationObserver(sincronizar);
  observerModals.observe(document.body, { childList: true, subtree: true });
  sincronizar();
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
  iniciarVigilanciaDeModals();
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
  if (observerModals) {
    observerModals.disconnect();
    observerModals = null;
  }
}