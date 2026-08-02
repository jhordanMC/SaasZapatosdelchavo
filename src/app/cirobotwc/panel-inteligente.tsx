import { useMemo, useState } from 'react';
import { ICONO_POR_KPI, IconoCerrar, IconoGrafico, IconoTabla } from './iconos';
import type { PanelInteligente as PanelInteligenteTipo } from './tipos';

/**
 * Panel derecho del copiloto — v1 con SOLO 2 tipos (tabla genérica +
 * tarjetas KPI), decidido por el orquestador del backend (nunca por el
 * LLM). El resto (timelines, calendarios, más tipos) queda para más
 * adelante. Vive dentro del mismo árbol de React que el chat (no son
 * componentes Angular reales embebidos) — decisión deliberada: el
 * resultado visual es indistinguible, y un puente React↔Angular por
 * cada tipo de panel sería mucho trabajo de arquitectura para el mismo
 * resultado que ya se logra acá.
 */

const ETIQUETAS_KPI: Record<string, string> = {
  ingresos_periodo: 'Ingresos',
  cantidad_ventas: 'Ventas',
  ticket_promedio: 'Ticket promedio',
  utilidad_neta_periodo: 'Utilidad neta',
  margen_neto_pct: 'Margen neto',
  valor_inventario_costo: 'Valor de inventario',
  productos_en_riesgo_merma: 'Productos en riesgo',
};

// Único delta REAL disponible hoy en el backend (ver mcp/analitica.py) —
// ingresos de esta semana vs. la semana pasada. No se inventa ningún
// otro porcentaje: si no hay dato real, la tarjeta simplemente no
// muestra tendencia, en vez de fabricar una.
const CLAVE_DELTA_INGRESOS = 'crecimiento_semanal_pct';

function formatearValorKpi(clave: string, valor: unknown): string {
  if (typeof valor !== 'number') return String(valor);
  if (clave.endsWith('_pct')) return `${valor.toFixed(1)}%`;
  if (clave === 'cantidad_ventas' || clave === 'productos_en_riesgo_merma') return String(valor);
  return `S/ ${valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type OrdenColumna = { columna: string; asc: boolean } | null;

function TablaGenerica({ filas }: { filas: Record<string, unknown>[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<OrdenColumna>(null);

  const columnas = filas.length > 0 ? Object.keys(filas[0]) : [];

  const filtradas = useMemo(() => {
    let resultado = filas;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      resultado = resultado.filter((f) => columnas.some((c) => String(f[c] ?? '').toLowerCase().includes(q)));
    }
    if (orden) {
      resultado = [...resultado].sort((a, b) => {
        const va = a[orden.columna];
        const vb = b[orden.columna];
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''));
        return orden.asc ? cmp : -cmp;
      });
    }
    return resultado;
  }, [filas, busqueda, orden, columnas]);

  function alternarOrden(columna: string) {
    setOrden((prev) => (prev?.columna === columna ? { columna, asc: !prev.asc } : { columna, asc: true }));
  }

  if (filas.length === 0) {
    return <p className="cbot-panel-vacio">Sin resultados.</p>;
  }

  return (
    <div className="cbot-datagrid">
      <input
        className="cbot-datagrid-buscar"
        placeholder="Buscar…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <div className="cbot-datagrid-scroll">
        <table className="cbot-datagrid-tabla">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c} onClick={() => alternarOrden(c)}>
                  {c.replace(/_/g, ' ')}
                  {orden?.columna === c && <span className="cbot-datagrid-flecha">{orden.asc ? ' ▲' : ' ▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((fila, i) => (
              <tr key={i}>
                {columnas.map((c) => (
                  <td key={c}>{String(fila[c] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="cbot-panel-vacio">Nada coincide con "{busqueda}".</p>}
      </div>
    </div>
  );
}

function TarjetaKpi({ clave, valor, delta }: { clave: string; valor: unknown; delta?: number }) {
  const Icono = ICONO_POR_KPI[clave] ?? IconoGrafico;
  return (
    <div className="cbot-kpi-card">
      <span className="cbot-kpi-icono"><Icono size={18} /></span>
      <span className="cbot-kpi-label">{ETIQUETAS_KPI[clave] ?? clave.replace(/_/g, ' ')}</span>
      <span className="cbot-kpi-valor">{formatearValorKpi(clave, valor)}</span>
      {delta !== undefined && (
        <span className={`cbot-kpi-delta ${delta >= 0 ? 'cbot-kpi-delta-pos' : 'cbot-kpi-delta-neg'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% esta semana
        </span>
      )}
    </div>
  );
}

function TarjetasKpi({ datos }: { datos: Record<string, unknown> }) {
  const entradas = Object.entries(datos).filter(([clave]) => clave !== CLAVE_DELTA_INGRESOS);
  const deltaIngresos = typeof datos[CLAVE_DELTA_INGRESOS] === 'number' ? (datos[CLAVE_DELTA_INGRESOS] as number) : undefined;

  if (entradas.length === 0) {
    return <p className="cbot-panel-vacio">Sin datos.</p>;
  }
  return (
    <div className="cbot-kpi-grid">
      {entradas.map(([clave, valor]) => (
        <TarjetaKpi key={clave} clave={clave} valor={valor} delta={clave === 'ingresos_periodo' ? deltaIngresos : undefined} />
      ))}
    </div>
  );
}

export function PanelInteligente({ panel, onCerrar }: { panel: PanelInteligenteTipo; onCerrar: () => void }) {
  const IconoPanel = panel.tipo === 'kpis' ? IconoGrafico : IconoTabla;
  const subtitulo = panel.tipo === 'kpis' ? 'Indicadores del período' : `${Array.isArray(panel.datos) ? panel.datos.length : 1} resultado(s)`;

  return (
    <div className="cbot-panel-inteligente">
      <div className="cbot-pi-header">
        <span className="cbot-pi-header-icono"><IconoPanel size={17} /></span>
        <div className="cbot-pi-header-textos">
          <span className="cbot-pi-header-titulo">{panel.titulo}</span>
          <span className="cbot-pi-header-sub">{subtitulo}</span>
        </div>
        <button className="cbot-pi-cerrar" onClick={onCerrar} aria-label="Cerrar panel">
          <IconoCerrar size={11} />
        </button>
      </div>
      <div className="cbot-pi-cuerpo">
        {panel.tipo === 'tabla' ? (
          <TablaGenerica filas={Array.isArray(panel.datos) ? panel.datos : [panel.datos]} />
        ) : (
          <TarjetasKpi datos={Array.isArray(panel.datos) ? {} : panel.datos} />
        )}
      </div>
    </div>
  );
}
