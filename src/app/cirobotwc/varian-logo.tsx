/**
 * Logo de Varian Assist (la "V" con destello de IA) con sus 4 estados.
 * Adaptado del diseño original: mismos colores, misma geometría de la V y
 * del destello. Cambios respecto al código base:
 *  - `size` en vez de 180px fijos (header = 38, barra minimizada = 28).
 *  - El radio de esquina vive DENTRO del SVG (rx) para que escale con el
 *    tamaño; un borderRadius fijo de 12px se veía redondísimo a 38px.
 *  - El indicador de estado (check / alerta) es una insignia sobre la
 *    esquina del logo, como en el mockup. El "punto en línea" ya lo pinta
 *    el subtítulo del header, así que no se duplica acá.
 */
export type EstadoVarian = 'online' | 'thinking' | 'success' | 'error';

const COLORES: Record<EstadoVarian, string> = {
  online: '#117b3d', // Verde oscuro
  thinking: '#85d2a6', // Verde claro
  success: '#117b3d', // Verde oscuro
  error: '#d29337', // Mostaza/naranja
};

export function VarianLogo({
  status = 'online',
  size = 38,
  className,
}: {
  status?: EstadoVarian;
  size?: number;
  className?: string;
}) {
  const badge = Math.max(12, Math.round(size * 0.42));
  return (
    <span
      className={`cbot-varian-logo cbot-varian-${status} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Varian Assist: ${status}`}
    >
      <svg viewBox="0 0 180 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect
          width="180"
          height="180"
          rx="40"
          fill={COLORES[status]}
          style={{ transition: 'fill 0.3s ease' }}
        />
        {/* Destello: estrella de 4 puntas con curvas cuadráticas */}
        <path fill="#ffffff" d="M90 35 Q90 55 110 55 Q90 55 90 75 Q90 55 70 55 Q90 55 90 35 Z" />
        {/* La V: trazo grueso con puntas redondeadas */}
        <path
          d="M 50 85 L 90 135 L 130 85"
          fill="none"
          stroke="#ffffff"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pliegue 3D en el brazo derecho de la V */}
        <path d="M 90 135 L 115 104" fill="none" stroke="#000000" strokeOpacity="0.1" strokeWidth="24" strokeLinecap="butt" />
      </svg>

      {status === 'success' && (
        <span className="cbot-varian-badge cbot-varian-badge-ok" style={{ width: badge, height: badge }}>
          <svg viewBox="0 0 24 24" width="65%" height="65%" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
      )}
      {status === 'error' && (
        <span className="cbot-varian-badge cbot-varian-badge-error" style={{ width: badge, height: badge }}>
          <svg viewBox="0 0 24 24" width="65%" height="65%" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
            <path d="M12 6v7" />
            <path d="M12 18h.01" />
          </svg>
        </span>
      )}
    </span>
  );
}