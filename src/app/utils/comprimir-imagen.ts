/**
 * Reduce una foto ANTES de subirla al backend (comprobantes de pago, etc.).
 *
 * Una foto de celular pesa 3-10 MB. Subirla cruda es lento con datos móviles y
 * cualquier proxy con tope de body chico (nginx trae 1 MB por defecto) la
 * rechaza con un 413 en HTML que ni siquiera llega a FastAPI. El backend igual
 * la vuelve a comprimir a WEBP (max. 1000 px), así que mandar 1600 px de ancho
 * no pierde calidad útil.
 *
 * Nunca falla: si el navegador no puede decodificar el archivo (HEIC fuera de
 * Safari, RAW/DNG, formato raro) o el resultado no es más chico, devuelve el
 * original y el backend lo decodifica como siempre.
 */
const NO_TOCAR = ['image/heic', 'image/heif', 'image/gif', 'image/x-adobe-dng', 'image/dng'];
const UMBRAL_BYTES = 600 * 1024; // por debajo de esto no vale la pena recomprimir

export async function comprimirImagenParaSubir(
  archivo: File,
  anchoMaxPx = 1600,
  calidad = 0.82
): Promise<File> {
  try {
    if (!archivo.type.startsWith('image/') || NO_TOCAR.includes(archivo.type)) return archivo;
    if (archivo.size <= UMBRAL_BYTES) return archivo;
    if (typeof createImageBitmap !== 'function') return archivo;

    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, anchoMaxPx / bitmap.width);
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return archivo;
    }
    // Fondo blanco: JPEG no tiene transparencia (una captura PNG saldría negra).
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', calidad));
    if (!blob || blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, '') || 'comprobante';
    return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' });
  } catch {
    return archivo;
  }
}