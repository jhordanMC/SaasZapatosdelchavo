import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Liveline } from 'liveline';
import type { LivelinePoint } from 'liveline';

const roots = new WeakMap<HTMLElement, Root>();

function buildInitialData(): LivelinePoint[] {
  let agentes = 72;
  return Array.from({ length: 30 }, () => {
    const f = Math.floor(Math.random() * 10) - 5;
    agentes = Math.max(30, Math.min(120, agentes + f));
    return { time: Date.now() / 1000, value: agentes };
  });
}

function LivelineChart(): React.ReactElement {
  const [data, setData] = React.useState<LivelinePoint[]>(() => buildInitialData());
  const [value, setValue] = React.useState<number>(data.at(-1)?.value ?? 0);

  React.useEffect(() => {
    let agentes = data.at(-1)?.value ?? 72;
    const interval = window.setInterval(() => {
      const f = Math.floor(Math.random() * 8) - 4;
      agentes = Math.max(30, Math.min(120, agentes + f));
      const point = { time: Date.now() / 1000, value: agentes };
      setData(prev => [...prev.slice(-59), point]);
      setValue(agentes);
    }, 3000);

    return () => window.clearInterval(interval);
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
        color: '#024B40',
        theme: 'light',
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

export function mountLiveline(element: HTMLElement): void {
  const root = createRoot(element);
  roots.set(element, root);
  root.render(React.createElement(LivelineChart));
}

export function unmountLiveline(element: HTMLElement): void {
  const root = roots.get(element);
  if (root) {
    root.unmount();
    roots.delete(element);
  }
}
