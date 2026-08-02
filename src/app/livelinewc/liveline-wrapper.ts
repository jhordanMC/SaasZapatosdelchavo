import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Liveline } from 'liveline';
import type { LivelinePoint, ThemeMode } from 'liveline';

export interface LivelineHandle {
  /** Empuja un valor real nuevo al gráfico (reemplaza el random-walk viejo). */
  push: (value: number) => void;
}

const roots = new WeakMap<HTMLElement, Root>();

/** ThemeService (Angular) escribe data-theme en <html> — este wrapper de
 *  React no tiene DI, así que lee esa misma fuente de verdad en vez de
 *  duplicar el estado del tema. */
function leerTema(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Verde oscuro de marca (bueno sobre fondo claro) vs. mint claro (bueno sobre fondo oscuro) — mismo criterio que --brand-wordmark/--brand-mint en tokens.css. */
const COLOR_POR_TEMA: Record<ThemeMode, string> = { light: '#024B40', dark: '#64D59C' };

function LivelineChart({ onReady }: { onReady: (handle: LivelineHandle) => void }): React.ReactElement {
  const [data, setData] = React.useState<LivelinePoint[]>([{ time: Date.now() / 1000, value: 0 }]);
  const [value, setValue] = React.useState<number>(0);
  const [tema, setTema] = React.useState<ThemeMode>(leerTema());

  React.useEffect(() => {
    onReady({
      push: (v: number) => {
        const point = { time: Date.now() / 1000, value: v };
        setData((prev) => [...prev.slice(-59), point]);
        setValue(v);
      },
    });
    // onReady es estable (mountLiveline la arma una sola vez) — solo debe
    // registrarse al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const observer = new MutationObserver(() => setTema(leerTema()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return React.createElement(
    'div',
    { style: { height: '100%', minHeight: '220px', width: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(
      'div',
      { style: { flex: '1 1 auto', minHeight: 0 } },
      React.createElement(Liveline, {
        data,
        value,
        color: COLOR_POR_TEMA[tema],
        theme: tema,
        grid: true,
        fill: true,
        pulse: true,
        scrub: true,
        exaggerate: true,
        badge: true,
        badgeVariant: 'minimal',
        window: 120,
        formatValue: (v: number) => `${Math.round(v)} usuarios`,
        windows: [
          { label: '1m', secs: 60 },
          { label: '2m', secs: 120 },
          { label: '5m', secs: 300 },
        ],
        windowStyle: 'rounded',
      })
    )
  );
}

export function mountLiveline(element: HTMLElement): LivelineHandle {
  const root = createRoot(element);
  roots.set(element, root);

  // El handle real solo existe después del primer render (useEffect de
  // LivelineChart) — este proxy delega a él en cuanto esté listo, así
  // mountLiveline puede devolver un handle utilizable de inmediato sin
  // que el caller tenga que esperar un ciclo de render.
  let handleReal: LivelineHandle | null = null;
  const pendientes: number[] = [];
  const proxy: LivelineHandle = {
    push: (v: number) => {
      if (handleReal) handleReal.push(v);
      else pendientes.push(v);
    },
  };

  root.render(
    React.createElement(LivelineChart, {
      onReady: (h: LivelineHandle) => {
        handleReal = h;
        pendientes.splice(0).forEach((v) => h.push(v));
      },
    })
  );

  return proxy;
}

export function unmountLiveline(element: HTMLElement): void {
  const root = roots.get(element);
  if (root) {
    root.unmount();
    roots.delete(element);
  }
}
