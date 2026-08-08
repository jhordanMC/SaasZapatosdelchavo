/**
 * Validación de archivos de imagen en el cliente, alineada con
 * app/core/imagenes.py del backend: acepta cualquier formato de imagen de
 * celular o compu (JPEG, PNG, WEBP, GIF, HEIC/HEIF de iPhone, AVIF de
 * Android, DNG-RAW de iPhone ProRAW, etc.), no solo los 3-4 formatos
 * "de toda la vida".
 *
 * La validación fuerte (que el archivo realmente sea una imagen válida) la
 * hace el backend al decodificarlo — esto de acá es solo para dar feedback
 * rápido en el navegador antes de subir.
 */

/** RAW de cámara — DNG es el que usa iPhone en modo ProRAW, el resto por si suben fotos de otras cámaras. */
const EXTENSIONES_RAW = ['.dng', '.raw', '.cr2', '.cr3', '.nef', '.arw', '.rw2', '.orf'];

/** Formatos de imagen que la mayoría de navegadores NO pueden pintar directo en un <img>/data: URL. */
const EXTENSIONES_NO_PREVISUALIZABLES = ['.heic', '.heif', ...EXTENSIONES_RAW];

const EXTENSIONES_IMAGEN_CONOCIDAS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif',
  '.heic', '.heif', '.avif',
  ...EXTENSIONES_RAW,
];

function tieneExtension(nombreArchivo: string, extensiones: string[]): boolean {
  const nombre = nombreArchivo.toLowerCase();
  return extensiones.some((ext) => nombre.endsWith(ext));
}

/**
 * ¿Es un archivo de imagen válido para subir? Acepta por `type` (MIME) si el
 * navegador lo reconoció, y si no (pasa seguido con HEIC en Android/Chrome
 * viejo y casi siempre con DNG/RAW, donde `archivo.type` llega vacío o
 * "application/octet-stream"), cae a validar por extensión del nombre.
 */
export function esArchivoDeImagen(archivo: File): boolean {
  if (archivo.type.startsWith('image/')) return true;
  if (archivo.type && archivo.type !== 'application/octet-stream') return false;
  return tieneExtension(archivo.name, EXTENSIONES_IMAGEN_CONOCIDAS);
}

/**
 * ¿El navegador puede mostrar una preview directa de este archivo (vía
 * FileReader + <img>)? HEIC/HEIF (salvo Safari) y cualquier RAW (DNG y
 * similares) no se pueden previsualizar así, aunque la subida al backend
 * funcione perfecto igual — el backend los decodifica y los convierte a
 * WEBP del lado del servidor. Usar esto para decidir si mostrar la imagen
 * o un placeholder tipo "Foto cargada" mientras se sube.
 */
export function esPrevisualizableEnNavegador(archivo: File): boolean {
  if (tieneExtension(archivo.name, EXTENSIONES_NO_PREVISUALIZABLES)) return false;
  if (archivo.type === 'image/heic' || archivo.type === 'image/heif') return false;
  return true;
}