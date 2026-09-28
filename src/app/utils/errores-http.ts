/**
 * Convierte cualquier error HTTP en un mensaje claro para el usuario.
 *
 * Cubre: sin conexión (status 0), `detail` en texto (HTTPException del
 * backend), `detail` como lista (422 de validación de Pydantic) y los códigos
 * típicos (401/403/404/413/429/5xx). Leer solo `err.error.detail` fallaba en
 * tres casos: sin red (mensaje genérico engañoso), 422 ("[object Object]") y
 * respuestas que no son JSON (p. ej. un 502 del proxy con HTML).
 */
export function mensajeErrorHttp(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: unknown } | null;
  const status = e?.status ?? -1;

  if (status === 0) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }

  const cuerpo = e?.error;
  const detail =
    cuerpo && typeof cuerpo === 'object' ? (cuerpo as { detail?: unknown }).detail : undefined;

  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const mensajes = detail.map((d) => traducirErrorValidacion(d)).filter((m) => !!m);
    if (mensajes.length > 0) return mensajes.slice(0, 3).join(' ');
  }

  switch (status) {
    case 401: return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 403: return 'No tienes permiso para realizar esta acción.';
    case 404: return 'No se encontró el registro. Puede que ya se haya eliminado; recarga la página.';
    case 413: return 'El archivo es demasiado grande.';
    case 429: return 'Demasiados intentos seguidos. Espera un momento e inténtalo otra vez.';
  }
  if (status >= 500) return 'Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.';
  return porDefecto;
}

/** Un ítem del `detail` de un 422 de FastAPI → frase en español. */
function traducirErrorValidacion(d: unknown): string {
  const item = d as { msg?: string; type?: string; loc?: unknown[]; ctx?: { max_length?: number } } | null;
  const msg = String(item?.msg ?? '').replace(/^Value error,\s*/i, '');
  const tipo = String(item?.type ?? '');
  // Los value_error ya vienen redactados en español desde el backend.
  if (tipo === 'value_error') return msg;

  const loc = item?.loc ?? [];
  const campo = String(loc[loc.length - 1] ?? '');
  const etiquetas: Record<string, string> = {
    nombre: 'Nombre', talla: 'Talla', cantidad: 'Cantidad', sku: 'SKU',
    codigo_barras: 'Código de barras', costo_compra: 'Costo de compra',
    precio_venta: 'Precio de venta', monto: 'Monto', descuento_monto: 'Descuento',
    id_ubicacion_origen: 'Sede de origen', id_local: 'Caja (local)', motivo: 'Motivo',
  };
  const etiqueta = etiquetas[campo];
  if (!etiqueta) return msg;
  if (tipo === 'string_too_long') return `${etiqueta}: es demasiado largo (máximo ${item?.ctx?.max_length ?? '?'} caracteres).`;
  if (tipo === 'greater_than_equal' || tipo === 'greater_than') return `${etiqueta}: el valor no es válido (no puede ser negativo o cero).`;
  if (tipo === 'missing' || tipo === 'string_too_short') return `${etiqueta}: es obligatorio.`;
  return `${etiqueta}: el valor no es válido.`;
}