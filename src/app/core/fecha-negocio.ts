/**
 * Helper de fecha "de hoy" en huso horario del negocio (Perú), no del
 * dispositivo del usuario ni del navegador.
 *
 * Espejo en el frontend de app/core/tiempo.py del backend (TZ_NEGOCIO):
 * si `new Date()` se formatea directo con getFullYear()/getMonth()/getDate(),
 * el resultado depende de la timezone configurada en el dispositivo, y con
 * `toISOString()` depende de UTC — ninguna de las dos coincide de forma
 * confiable con "hoy" en Perú (UTC-5 fijo, sin horario de verano). Esto
 * puede desalinear fechas de gastos, pagos, filtros de dashboard, etc.
 * respecto a lo que el backend considera "hoy" para sus propios reportes.
 */

/** Zona horaria del negocio (Perú, UTC-5 fijo, sin horario de verano). */
export const TZ_NEGOCIO = 'America/Lima';

/** "Ahora", con año/mes/día correspondientes a la hora de Lima, sin
 * importar la timezone configurada en el dispositivo del usuario. */
export function ahoraEnLima(): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtener = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day') };
}

/** "YYYY-MM-DD" de hoy en hora de Lima. */
export function hoyISO(): string {
  const { anio, mes, dia } = ahoraEnLima();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** "YYYY-MM" del mes actual en hora de Lima. */
export function mesActualISO(): string {
  const { anio, mes } = ahoraEnLima();
  return `${anio}-${String(mes).padStart(2, '0')}`;
}