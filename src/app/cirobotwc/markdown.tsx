import { Fragment, type ReactNode } from 'react';

/**
 * Renderer de markdown liviano, escrito a mano a propósito (sin sumar
 * una dependencia nueva como react-markdown/remark solo para esto) —
 * cubre lo que Cirobot realmente necesita: **negrita**, `código inline`,
 * ```bloques de código```, listas con - / 1. y párrafos. Nada de tablas
 * ni links por ahora.
 */

function renderInline(texto: string, keyBase: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+?)`)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[2] !== undefined) {
      partes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      partes.push(
        <code key={`${keyBase}-c${i}`} className="cbot-code-inline">
          {m[3]}
        </code>
      );
    }
    ultimo = regex.lastIndex;
    i++;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function Markdown({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  const bloques: ReactNode[] = [];
  let listaActual: string[] | null = null;
  let listaOrdenada = false;
  let codigoActual: string[] | null = null;

  function cerrarLista(key: string) {
    if (!listaActual) return;
    const Tag = listaOrdenada ? 'ol' : 'ul';
    bloques.push(
      <Tag key={key} className="cbot-md-lista">
        {listaActual.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </Tag>
    );
    listaActual = null;
  }

  lineas.forEach((linea, idx) => {
    const key = `b${idx}`;

    if (linea.trim().startsWith('```')) {
      if (codigoActual === null) {
        cerrarLista(key);
        codigoActual = [];
      } else {
        bloques.push(
          <pre key={key} className="cbot-code-block">
            <code>{codigoActual.join('\n')}</code>
          </pre>
        );
        codigoActual = null;
      }
      return;
    }
    if (codigoActual !== null) {
      codigoActual.push(linea);
      return;
    }

    const bullet = /^\s*[-*]\s+(.*)/.exec(linea);
    const numerada = /^\s*\d+[.)]\s+(.*)/.exec(linea);

    if (bullet || numerada) {
      const esOrdenada = !!numerada;
      if (listaActual && listaOrdenada !== esOrdenada) cerrarLista(key);
      listaOrdenada = esOrdenada;
      listaActual = listaActual ?? [];
      listaActual.push((bullet ?? numerada)![1]);
      return;
    }

    cerrarLista(key);
    if (linea.trim() === '') {
      bloques.push(<div key={key} className="cbot-md-espacio" />);
    } else {
      bloques.push(<p key={key}>{renderInline(linea, key)}</p>);
    }
  });
  cerrarLista('final');

  return <Fragment>{bloques}</Fragment>;
}
