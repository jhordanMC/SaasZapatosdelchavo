/**
 * Set de íconos SVG (mismo lenguaje visual — trazo, lucide-style — que
 * ya usa toda la app Angular) en vez de emojis, para que Cirobot se vea
 * como parte del producto y no como un chat genérico.
 */
import type { ReactElement } from 'react';

type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconoBot({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

export function IconoEnviar({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function IconoAdjuntar({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function IconoMicrofono({ size = 15, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

export function IconoMinimizar({ size = 14, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconoExpandir({ size = 14, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function IconoCerrar({ size = 14, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconoIngresos({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function IconoVentas({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

export function IconoTicket({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z" />
      <circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function IconoUtilidad({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

export function IconoMargen({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

export function IconoInventario({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function IconoAlerta({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconoGrafico({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

export function IconoTabla({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3v18" />
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  );
}

/** Ícono por clave de KPI (ver mcp/analitica.py) — usado por panel-inteligente.tsx. */
export const ICONO_POR_KPI: Record<string, (props: Props) => ReactElement> = {
  ingresos_periodo: IconoIngresos,
  cantidad_ventas: IconoVentas,
  ticket_promedio: IconoTicket,
  utilidad_neta_periodo: IconoUtilidad,
  margen_neto_pct: IconoMargen,
  valor_inventario_costo: IconoInventario,
  productos_en_riesgo_merma: IconoAlerta,
};
