/**
 * Exportación de proformas (cotizaciones) a PDF — todo en el navegador,
 * con jsPDF + jspdf-autotable (mismas librerías que exportar-resumen-mensual.ts).
 *
 * Dos variantes, pensadas para lo que pida el vendedor al cotizar:
 *   - Sin imágenes: PDF liviano, rápido de generar y de enviar.
 *   - Con imágenes:  incrusta la foto de cada producto (útil para que el
 *     cliente reconozca el modelo antes de decidir). Requiere descargar
 *     cada foto del backend y convertirla a base64 antes de armar el PDF,
 *     por eso es asíncrona; si una foto no carga (sin conexión, CORS, el
 *     producto no tiene foto) esa fila simplemente queda sin imagen.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { environment } from '../../environments/environment';
import { ItemProforma, Proforma } from '../services/proformas';

function moneda(valor: number): string {
  return `S/ ${valor.toFixed(2)}`;
}

function totalItem(item: ItemProforma): number {
  return Math.max(0, item.precioUnitario * item.cantidad - item.descuentoMonto);
}

function fechaVencimiento(p: Proforma): string {
  const v = new Date(`${p.fechaEmision}T00:00:00`);
  v.setDate(v.getDate() + p.validoHastaDias);
  return v.toISOString().slice(0, 10);
}

function nombreArchivo(p: Proforma, extension: string): string {
  const cliente = (p.cliente.nombre || 'cliente').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${p.numero}-${cliente || 'cliente'}.${extension}`;
}

/** Descarga la imagen del producto y la convierte a dataURL para poder incrustarla en el PDF. */
async function imagenADataUrl(imagenUrl: string | null): Promise<string | null> {
  if (!imagenUrl) return null;
  try {
    const resp = await fetch(`${environment.apiUrl}${imagenUrl}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** jsPDF necesita saber el formato (JPEG/PNG/WEBP) al incrustar la imagen; lo tomamos del dataURL. */
function formatoDesdeDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const ext = (match?.[1] ?? 'jpeg').toUpperCase();
  return ext === 'JPG' ? 'JPEG' : ext;
}

// ---------------------------------------------------------------------------
// Encabezado y pie, compartidos por ambas variantes
// ---------------------------------------------------------------------------

function dibujarEncabezado(doc: jsPDF, p: Proforma, nombreEmpresa: string): number {
  let y = 18;

  doc.setFontSize(16);
  doc.setTextColor(2, 75, 64); // #024b40
  doc.text(nombreEmpresa || 'Cotización', 14, y);

  doc.setFontSize(11);
  doc.setTextColor(90, 138, 120); // #5a8a78
  doc.text(`Proforma ${p.numero}`, 196, y, { align: 'right' });

  y += 6;
  doc.setFontSize(9);
  doc.text(`Emitida: ${p.fechaEmision}`, 196, y, { align: 'right' });
  y += 5;
  doc.text(`Válida hasta: ${fechaVencimiento(p)} (${p.validoHastaDias} días)`, 196, y, { align: 'right' });

  y += 8;
  doc.setDrawColor(216, 230, 221); // #d8e6dd
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFontSize(10.5);
  doc.setTextColor(31, 64, 52); // #1f4034
  doc.text('Cliente', 14, y);
  y += 5;

  doc.setFontSize(9.5);
  doc.text(p.cliente.nombre || 'Cliente sin nombre', 14, y);
  y += 5;
  if (p.cliente.telefono) {
    doc.text(`Tel: ${p.cliente.telefono}`, 14, y);
    y += 5;
  }
  if (p.cliente.correo) {
    doc.text(`Correo: ${p.cliente.correo}`, 14, y);
    y += 5;
  }
  if (p.cliente.direccion) {
    doc.text(`Dirección: ${p.cliente.direccion}`, 14, y);
    y += 5;
  }

  return y + 4;
}

function dibujarTotalesYNotas(doc: jsPDF, p: Proforma, yInicial: number): void {
  const subtotal = p.items.reduce((acc, i) => acc + totalItem(i), 0);
  const total = Math.max(0, subtotal - (p.descuentoGlobal || 0));
  let y = yInicial;

  doc.setFontSize(9.5);
  doc.setTextColor(31, 64, 52);
  doc.text('Subtotal', 150, y);
  doc.text(moneda(subtotal), 196, y, { align: 'right' });
  y += 6;

  if (p.descuentoGlobal > 0) {
    doc.text('Descuento', 150, y);
    doc.text(`- ${moneda(p.descuentoGlobal)}`, 196, y, { align: 'right' });
    y += 6;
  }

  doc.setFontSize(12);
  doc.setTextColor(2, 75, 64);
  doc.text('Total', 150, y);
  doc.text(moneda(total), 196, y, { align: 'right' });
  y += 10;

  if (p.notas) {
    doc.setFontSize(9);
    doc.setTextColor(90, 138, 120);
    const lineas = doc.splitTextToSize(`Notas: ${p.notas}`, 182);
    doc.text(lineas, 14, y);
    y += lineas.length * 4.5 + 4;
  }

  doc.setFontSize(7.5);
  doc.setTextColor(148, 167, 152); // #94a798
  doc.text('Cotización generada digitalmente. Precios sujetos a disponibilidad de stock al momento de la compra.', 14, y);
}

// ---------------------------------------------------------------------------
// Variante sin imágenes
// ---------------------------------------------------------------------------

/** Genera y descarga la proforma en PDF, sin fotos de producto (más liviano y rápido de compartir). */
export function exportarProformaPDFSinImagenes(p: Proforma, nombreEmpresa: string): void {
  const doc = new jsPDF();
  const y = dibujarEncabezado(doc, p, nombreEmpresa);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, textColor: [31, 64, 52] },
    headStyles: { fillColor: [2, 75, 64], textColor: 255 },
    head: [['Producto', 'Talla', 'Cant.', 'P. unit.', 'Desc.', 'Subtotal']],
    body: p.items.map((i) => [
      i.nombre,
      i.talla || '-',
      String(i.cantidad),
      moneda(i.precioUnitario),
      i.descuentoMonto > 0 ? `- ${moneda(i.descuentoMonto)}` : '-',
      moneda(totalItem(i)),
    ]),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yFinal = (doc as any).lastAutoTable.finalY + 10;
  dibujarTotalesYNotas(doc, p, yFinal);
  doc.save(nombreArchivo(p, 'pdf'));
}

// ---------------------------------------------------------------------------
// Variante con imágenes
// ---------------------------------------------------------------------------

/** Genera y descarga la proforma en PDF incluyendo la foto de cada producto. */
export async function exportarProformaPDFConImagenes(p: Proforma, nombreEmpresa: string): Promise<void> {
  const doc = new jsPDF();
  const y = dibujarEncabezado(doc, p, nombreEmpresa);

  // Se precargan todas las fotos como dataURL antes de armar la tabla:
  // los hooks de dibujo de autoTable son síncronos y no pueden esperar promesas.
  const imagenes = await Promise.all(p.items.map((i) => imagenADataUrl(i.imagenUrl)));

  const ALTO_FILA = 20;
  const TAMANO_FOTO = 14;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, textColor: [31, 64, 52], minCellHeight: ALTO_FILA, valign: 'middle' },
    headStyles: { fillColor: [2, 75, 64], textColor: 255 },
    columnStyles: { 0: { cellWidth: 22 } },
    head: [['Foto', 'Producto', 'Talla', 'Cant.', 'P. unit.', 'Desc.', 'Subtotal']],
    body: p.items.map((i) => [
      '',
      i.nombre,
      i.talla || '-',
      String(i.cantidad),
      moneda(i.precioUnitario),
      i.descuentoMonto > 0 ? `- ${moneda(i.descuentoMonto)}` : '-',
      moneda(totalItem(i)),
    ]),
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const dataUrl = imagenes[data.row.index];
      if (!dataUrl) return;
      const x = data.cell.x + (data.cell.width - TAMANO_FOTO) / 2;
      const yImg = data.cell.y + (data.cell.height - TAMANO_FOTO) / 2;
      try {
        doc.addImage(dataUrl, formatoDesdeDataUrl(dataUrl), x, yImg, TAMANO_FOTO, TAMANO_FOTO);
      } catch {
        // Formato de imagen no soportado por jsPDF: la celda queda vacía para esa fila.
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yFinal = (doc as any).lastAutoTable.finalY + 10;
  dibujarTotalesYNotas(doc, p, yFinal);
  doc.save(nombreArchivo(p, 'pdf'));
}
