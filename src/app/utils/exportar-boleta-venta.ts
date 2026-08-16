/**
 * Utilidad para emisión e impresión de Boletas de Venta:
 *   1. Formato 80 mm (Ticket Térmico) para impresoras de punto de venta.
 *   2. Formato Normal (A4 / Boleta Corporativa) para impresión estándar o envío en PDF.
 *   3. Boleta Simple (Comprobante simplificado A4).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VentaRead } from '../services/ventas';
import { OpcionesBrandingReporte } from './exportar-resumen-mensual';

function moneda(valor: number): string {
  return `S/ ${valor.toFixed(2)}`;
}

async function imagenADataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
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

function formatoDesdeDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const ext = (match?.[1] ?? 'jpeg').toUpperCase();
  return ext === 'JPG' ? 'JPEG' : ext;
}

// ---------------------------------------------------------------------------
// 1. FORMATO 80 MM (TICKET TÉRMICO)
// ---------------------------------------------------------------------------

export async function exportarBoletaVenta80mm(
  venta: VentaRead,
  opciones?: OpcionesBrandingReporte
): Promise<void> {
  // Calculamos una altura aproximada según la cantidad de productos y pagos
  const cantItems = venta.detalles.length;
  const cantPagos = venta.pagos.length;
  const altoMm = Math.max(140, 90 + cantItems * 12 + cantPagos * 8);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, altoMm],
  });

  const centro = 40;
  let y = 8;

  // Foto de marca si existe
  if (opciones?.clienteFotoUrl) {
    const fotoData = await imagenADataUrl(opciones.clienteFotoUrl);
    if (fotoData) {
      try {
        doc.addImage(fotoData, formatoDesdeDataUrl(fotoData), centro - 8, y, 16, 16);
        y += 18;
      } catch {
        // Ignorar
      }
    }
  }

  // Nombre de Empresa
  const empresa = (opciones?.nombreEmpresa || 'MI TIENDA').toUpperCase();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(empresa, centro, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('BOLETA DE VENTA SIMPLE', centro, y, { align: 'center' });
  y += 4;

  const correlativo = `B001-${venta.id_venta.slice(-6).toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.text(`N° ${correlativo}`, centro, y, { align: 'center' });
  y += 6;

  // Línea separadora
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 5;

  // Fecha y Cliente
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const fechaStr = new Date(venta.creado_en).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Fecha: ${fechaStr}`, 4, y);
  y += 4;

  const clienteNombre = venta.nombre_cliente || 'CLIENTE VARIOS';
  doc.text(`Cliente: ${clienteNombre}`, 4, y);
  y += 4;
  if (venta.documento_cliente) {
    doc.text(`Doc: ${venta.documento_cliente}`, 4, y);
    y += 4;
  }

  doc.line(4, y, 76, y);
  y += 5;

  // Encabezado de Ítems
  doc.setFont('helvetica', 'bold');
  doc.text('CANT  PRODUCTO', 4, y);
  doc.text('TOTAL', 76, y, { align: 'right' });
  y += 4;
  doc.line(4, y, 76, y);
  y += 4;

  // Lista de Ítems
  doc.setFont('helvetica', 'normal');
  for (const d of venta.detalles) {
    const nombreProd = d.nombre_producto || 'Producto';
    const tallaStr = d.talla ? ` (T: ${d.talla})` : '';
    const descProd = `${nombreProd}${tallaStr}`;

    // Dividir texto si es largo
    const lineas = doc.splitTextToSize(descProd, 46);
    doc.text(`${d.cantidad}x`, 4, y);
    doc.text(lineas[0], 12, y);
    doc.text(moneda(d.subtotal), 76, y, { align: 'right' });
    y += 4;

    for (let i = 1; i < lineas.length; i++) {
      doc.text(lineas[i], 12, y);
      y += 4;
    }

    if (d.descuento_monto > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`   (Desc: -${moneda(d.descuento_monto)})`, 12, y);
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      y += 3.5;
    }
  }

  y += 2;
  doc.line(4, y, 76, y);
  y += 5;

  // Totales
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 4, y);
  doc.text(moneda(venta.total), 76, y, { align: 'right' });
  y += 6;

  // Pagos
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  for (const p of venta.pagos) {
    const metodoNombre = p.metodo.toUpperCase();
    doc.text(`Pago (${metodoNombre}):`, 4, y);
    doc.text(moneda(p.monto), 76, y, { align: 'right' });
    y += 4;

    if (p.vuelto && p.vuelto > 0) {
      doc.text('Vuelto:', 4, y);
      doc.text(moneda(p.vuelto), 76, y, { align: 'right' });
      y += 4;
    }
  }

  y += 4;
  doc.line(4, y, 76, y);
  y += 5;

  // Pie
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('¡Gracias por su preferencia!', centro, y, { align: 'center' });
  y += 4;
  doc.text('Conserve este ticket para cualquier cambio', centro, y, { align: 'center' });

  const nombrePdf = `ticket-80mm-${correlativo}.pdf`;
  doc.save(nombrePdf);
}

// ---------------------------------------------------------------------------
// 2. FORMATO NORMAL (A4 / BOLETA CORPORATIVA)
// ---------------------------------------------------------------------------

export async function exportarBoletaVentaNormal(
  venta: VentaRead,
  opciones?: OpcionesBrandingReporte
): Promise<void> {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const margenIzq = 14;
  let y = 14;

  const clienteFotoDataUrl = opciones?.clienteFotoUrl ? await imagenADataUrl(opciones.clienteFotoUrl) : null;
  const logoVilcasDataUrl = await imagenADataUrl('/vilcas.png');

  // Cabecera institucional
  doc.setFillColor(2, 75, 64); // #024b40
  doc.rect(0, 0, 210, 34, 'F');

  let posXTexto = margenIzq;

  if (clienteFotoDataUrl) {
    try {
      doc.addImage(clienteFotoDataUrl, formatoDesdeDataUrl(clienteFotoDataUrl), margenIzq, 5, 24, 24);
      posXTexto = margenIzq + 28;
    } catch {
      posXTexto = margenIzq;
    }
  }

  const nombreEmpresa = (opciones?.nombreEmpresa || 'Mi Empresa').toUpperCase();
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(nombreEmpresa, posXTexto, 16);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 225, 215);
  doc.text('Boleta de Venta Simple / Comprobante de Pago', posXTexto, 23);

  // Recadro N° Boleta a la derecha
  const correlativo = `B001-${venta.id_venta.slice(-6).toUpperCase()}`;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(138, 5, 58, 24, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 75, 64);
  doc.text('BOLETA DE VENTA', 167, 12, { align: 'center' });
  doc.setFontSize(11);
  doc.text(correlativo, 167, 21, { align: 'center' });

  y = 42;

  // Bloque Cliente y Venta Info
  doc.setDrawColor(215, 225, 220);
  doc.setFillColor(248, 250, 249);
  doc.roundedRect(margenIzq, y, 182, 24, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 64, 52);
  doc.text('DATOS DEL CLIENTE Y EMISIÓN', margenIzq + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);

  const clienteNombre = venta.nombre_cliente || 'Cliente Varios / Público General';
  const fechaStr = new Date(venta.creado_en).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.text(`Cliente: ${clienteNombre}`, margenIzq + 4, y + 13);
  if (venta.documento_cliente) {
    doc.text(`Doc / DNI / RUC: ${venta.documento_cliente}`, margenIzq + 4, y + 19);
  }

  doc.text(`Fecha: ${fechaStr}`, margenIzq + 100, y + 13);
  doc.text(`Forma de pago: ${venta.pagos.map(p => p.metodo.toUpperCase()).join(', ')}`, margenIzq + 100, y + 19);

  y += 30;

  // Tabla de Productos
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 75, 64);
  doc.text('Detalle de Productos', margenIzq, y);

  const filasBody = venta.detalles.map((d, index) => [
    String(index + 1),
    d.nombre_producto || 'Producto',
    d.talla || '—',
    d.sku || '—',
    String(d.cantidad),
    moneda(d.precio_unitario),
    d.descuento_monto > 0 ? `-${moneda(d.descuento_monto)}` : 'S/ 0.00',
    moneda(d.subtotal),
  ]);

  autoTable(doc, {
    startY: y + 4,
    theme: 'grid',
    styles: { fontSize: 8.5, textColor: [31, 64, 52] },
    headStyles: { fillColor: [2, 75, 64], textColor: 255, fontStyle: 'bold' },
    head: [['N°', 'Producto', 'Talla', 'SKU', 'Cant.', 'P. Unit', 'Descuento', 'Subtotal']],
    body: filasBody,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Bloque de Totales a la derecha
  const posXResumen = 124;
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(215, 225, 220);
  doc.roundedRect(posXResumen, y, 72, 32, 2, 2, 'FD');

  const subtotalNeto = venta.detalles.reduce((acc, d) => acc + d.subtotal, 0);
  const igv = subtotalNeto * 0.18;
  const opGravada = subtotalNeto - igv;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Op. Gravada:', posXResumen + 4, y + 8);
  doc.text(moneda(opGravada), posXResumen + 68, y + 8, { align: 'right' });

  doc.text('IGV (18%):', posXResumen + 4, y + 15);
  doc.text(moneda(igv), posXResumen + 68, y + 15, { align: 'right' });

  doc.setLineWidth(0.3);
  doc.line(posXResumen + 4, y + 18, posXResumen + 68, y + 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 75, 64);
  doc.text('TOTAL:', posXResumen + 4, y + 26);
  doc.text(moneda(venta.total), posXResumen + 68, y + 26, { align: 'right' });

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 230, 225);
  doc.line(margenIzq, pageHeight - 16, 196, pageHeight - 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 130, 120);
  doc.text('Comprobante emitido mediante Plataforma VILCAS · Powered by ALBA', margenIzq, pageHeight - 10);

  if (logoVilcasDataUrl) {
    try {
      doc.addImage(logoVilcasDataUrl, 'PNG', 186, pageHeight - 14, 8, 8);
    } catch {
      // Ignorar
    }
  }

  const nombrePdf = `boleta-${correlativo}.pdf`;
  doc.save(nombrePdf);
}

// ---------------------------------------------------------------------------
// 3. BOLETA SIMPLE
// ---------------------------------------------------------------------------

export async function exportarBoletaSimple(
  venta: VentaRead,
  opciones?: OpcionesBrandingReporte
): Promise<void> {
  return exportarBoletaVentaNormal(venta, opciones);
}
