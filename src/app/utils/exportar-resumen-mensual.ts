/**
 * Exportación del resumen mensual de compras y ventas a PDF y Excel.
 *
 * Todo se genera en el navegador (sin backend): jsPDF + jspdf-autotable
 * arman el PDF, y ExcelJS arma el libro de Excel con dos hojas
 * (Resumen y Detalle de compras), con estilos, colores, bordes y el
 * logo de VILCAS incrustado.
 *
 * ExcelJS se importa de forma DIFERIDA (dynamic import) dentro de
 * exportarResumenMensualExcel(), en vez de importarse arriba de forma
 * estática. Así el bundle no lo incluye en la carga inicial de la app
 * (~1MB+), sino que Angular lo separa en un chunk aparte que solo se
 * descarga cuando el usuario efectivamente hace clic en "Descargar Excel".
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type ExcelJS from 'exceljs';
import { ResumenFinanciero } from '../services/finanzas';
import { CompraRead } from '../services/compras';

export interface ResumenMensualCompras {
  total: number;
  cantidad: number;
  porProveedor: { proveedor: string; total: number }[];
  detalle: CompraRead[];
}

export interface ResumenMensual {
  /** "2026-07" */
  mes: string;
  /** "Julio 2026" */
  etiquetaMes: string;
  desde: string;
  hasta: string;
  ventas: ResumenFinanciero;
  compras: ResumenMensualCompras;
  /** Ingresos del mes − compras de mercadería − gasto operativo del mes. */
  balanceNeto: number;
}

function moneda(valor: number): string {
  return `S/ ${valor.toFixed(2)}`;
}

function nombreArchivo(r: ResumenMensual, extension: string): string {
  return `resumen-compras-ventas-${r.mes}.${extension}`;
}

// ---------------------------------------------------------------------------
// Helpers de mes (fijos a hora de Lima, no a la timezone del dispositivo,
// formato "YYYY-MM" para el <input type="month">)
// ---------------------------------------------------------------------------

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Zona horaria del negocio (Perú, UTC-5 fijo, sin horario de verano).
 * Debe coincidir con TZ_NEGOCIO en app/core/tiempo.py del backend —
 * si no, "el mes actual" acá puede desalinearse con lo que el backend
 * considera "hoy" para sus propios reportes. */
const TZ_NEGOCIO = 'America/Lima';

/** "Ahora", pero con año/mes/día correspondientes a la hora de Lima,
 * sin importar la timezone configurada en el dispositivo del usuario. */
function ahoraEnLima(): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtener = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day') };
}

export function mesActualISO(): string {
  const { anio, mes } = ahoraEnLima();
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" de hoy en hora de Lima. */
export function hoyISO(): string {
  const { anio, mes, dia } = ahoraEnLima();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** A partir de "2026-07" devuelve el primer y último día de ese mes (YYYY-MM-DD). */
export function rangoMes(mesISO: string): { desde: string; hasta: string } {
  const [anio, mes] = mesISO.split('-').map(Number);
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { desde, hasta };
}

export function etiquetaMes(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number);
  return `${MESES_ES[mes - 1]} ${anio}`;
}

/** Arma el objeto ResumenMensual combinando el resumen de ventas (finanzas) y la lista de compras del rango. */
export function construirResumenMensual(
  mesISO: string,
  desde: string,
  hasta: string,
  ventas: ResumenFinanciero,
  compras: CompraRead[] = []
): ResumenMensual {
  const comprasSeguras = Array.isArray(compras) ? compras : [];
  const totalCompras = comprasSeguras.reduce((acc, c) => acc + (c?.monto || 0), 0);

  const acumPorProveedor = new Map<string, number>();
  for (const c of comprasSeguras) {
    if (!c) continue;
    const prov = c.proveedor || 'Sin proveedor';
    acumPorProveedor.set(prov, (acumPorProveedor.get(prov) ?? 0) + (c.monto || 0));
  }
  const porProveedor = [...acumPorProveedor.entries()]
    .map(([proveedor, total]) => ({ proveedor, total }))
    .sort((a, b) => b.total - a.total);

  const ventasSeguras = ventas || {
    desde,
    hasta,
    ingresos_periodo: 0,
    cantidad_ventas: 0,
    ticket_promedio: 0,
    gasto_operativo_periodo: 0,
    margen_bruto_periodo: 0,
    ingresos_con_costo_periodo: 0,
    ganancia_neta_periodo: 0,
    esta_generando_ganancia: false,
    margen_promedio_pct: 0,
    margen_basado_en_ventas_reales: false,
    punto_equilibrio_periodo: null,
    progreso_punto_equilibrio_pct: 0,
    proyeccion_cierre_periodo: null,
    crecimiento_vs_periodo_anterior_pct: 0,
    producto_estrella: null,
    producto_estrella_unidades: null,
    producto_mas_rentable: null,
    alertas_stock_bajo: 0,
    recomendacion: '',
  };

  const ingresosVentas = ventasSeguras.ingresos_periodo || 0;
  const gastoOperativo = ventasSeguras.gasto_operativo_periodo || 0;

  return {
    mes: mesISO,
    etiquetaMes: etiquetaMes(mesISO),
    desde,
    hasta,
    ventas: ventasSeguras,
    compras: {
      total: totalCompras,
      cantidad: comprasSeguras.length,
      porProveedor,
      detalle: [...comprasSeguras].sort((a, b) => ((a?.fecha || '') < (b?.fecha || '') ? 1 : -1)),
    },
    balanceNeto: ingresosVentas - totalCompras - gastoOperativo,
  };
}

export interface OpcionesBrandingReporte {
  nombreEmpresa?: string | null;
  clienteFotoUrl?: string | null;
}

// ---------------------------------------------------------------------------
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
// PDF
// ---------------------------------------------------------------------------

export async function exportarResumenMensualPDF(
  r: ResumenMensual,
  opciones?: OpcionesBrandingReporte
): Promise<void> {
  const doc = new jsPDF();
  const margenIzq = 14;
  let y = 14;

  const clienteFotoDataUrl = opciones?.clienteFotoUrl ? await imagenADataUrl(opciones.clienteFotoUrl) : null;
  const logoVilcasDataUrl = await imagenADataUrl('/vilcas.png');
  const logoAlbaDataUrl = await imagenADataUrl('/Logoalbasinfondo.png');

  // Cabecera institucional
  doc.setFillColor(2, 75, 64); // #024b40
  doc.rect(0, 0, 210, 36, 'F');

  let posXTexto = margenIzq;

  // Foto de la marca / perfil del CLIENTE (GRANDE)
  if (clienteFotoDataUrl) {
    try {
      doc.addImage(clienteFotoDataUrl, formatoDesdeDataUrl(clienteFotoDataUrl), margenIzq, 6, 24, 24);
      posXTexto = margenIzq + 28;
    } catch {
      posXTexto = margenIzq;
    }
  }

  // Nombre de la marca del CLIENTE en grande
  const nombreEmpresa = (opciones?.nombreEmpresa || 'Mi Empresa').toUpperCase();
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(nombreEmpresa, posXTexto, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 225, 215);
  doc.text('Resumen mensual de compras y ventas', posXTexto, 24);

  // Logo de VILCAS (PEQUEÑO) en la esquina superior derecha
  if (logoVilcasDataUrl) {
    try {
      doc.addImage(logoVilcasDataUrl, 'PNG', 186, 6, 10, 10);
    } catch {
      // Ignorar si no carga
    }
  }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 230, 220);
  doc.text('Plataforma VILCAS', 184, 12, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(`${r.etiquetaMes}  ·  ${r.desde} al ${r.hasta}`, 196, 28, { align: 'right' });

  y = 46;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 75, 64);
  doc.text('Ventas', margenIzq, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    theme: 'grid',
    styles: { fontSize: 9.5, textColor: [31, 64, 52] },
    headStyles: { fillColor: [2, 75, 64], textColor: 255, fontStyle: 'bold' },
    head: [['Indicador', 'Valor']],
    body: [
      ['Ingresos del mes', moneda(r.ventas.ingresos_periodo)],
      ['Cantidad de ventas', String(r.ventas.cantidad_ventas)],
      ['Ticket promedio', moneda(r.ventas.ticket_promedio)],
      ['Margen bruto del mes', moneda(r.ventas.margen_bruto_periodo)],
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 75, 64);
  doc.text('Compras', margenIzq, y);

  autoTable(doc, {
    startY: y + 2,
    theme: 'grid',
    styles: { fontSize: 9.5, textColor: [31, 64, 52] },
    headStyles: { fillColor: [2, 75, 64], textColor: 255, fontStyle: 'bold' },
    head: [['Indicador', 'Valor']],
    body: [
      ['Total comprado', moneda(r.compras.total)],
      ['Cantidad de compras', String(r.compras.cantidad)],
      ['Gasto operativo del mes', moneda(r.ventas.gasto_operativo_periodo)],
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 64, 52);
  doc.text('Balance neto del mes (ventas − compras − gasto operativo)', margenIzq, y);
  y += 8;
  doc.setFontSize(14);
  doc.setTextColor(r.balanceNeto >= 0 ? 29 : 178, r.balanceNeto >= 0 ? 122 : 58, r.balanceNeto >= 0 ? 76 : 58);
  doc.text(moneda(r.balanceNeto), margenIzq, y);

  if (r.compras.detalle.length > 0) {
    y += 10;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 75, 64);
    doc.text('Detalle de compras del mes', margenIzq, y);

    autoTable(doc, {
      startY: y + 2,
      theme: 'striped',
      styles: { fontSize: 8.5, textColor: [31, 64, 52] },
      headStyles: { fillColor: [2, 75, 64], textColor: 255, fontStyle: 'bold' },
      head: [['Fecha', 'Proveedor', 'Concepto', 'Monto']],
      body: r.compras.detalle.map((c) => [c.fecha, c.proveedor, c.concepto, moneda(c.monto)]),
    });
  }

  // Pie de página - Powered by ALBA
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (doc as any).internal.getNumberOfPages();
  const albaLink = 'https://www.linkedin.com/in/alba-engineering-development-42a3493ab?utm_source=share_via&utm_content=profile&utm_medium=member_android';

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(220, 230, 225);
    doc.line(margenIzq, 280, 196, 280);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 130, 120);
    doc.text('Powered by ALBA · Engineering & Development', margenIzq, 286);

    doc.setTextColor(2, 75, 64);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink('Ver perfil de ALBA', 196, 286, { url: albaLink, align: 'right' });

    if (logoAlbaDataUrl) {
      try {
        doc.addImage(logoAlbaDataUrl, 'PNG', margenIzq + 68, 282, 10, 5);
      } catch {
        // Ignorar si falla
      }
    }
  }

  doc.save(nombreArchivo(r, 'pdf'));
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

// Paleta institucional VILCAS (misma que el PDF).
const VILCAS_VERDE = 'FF024B40';
const VILCAS_VERDE_700 = 'FF013830';
const VILCAS_TEXTO_CLARO = 'FFE6F3EF';
const VILCAS_BORDE = 'FFD7E4E0';
const VILCAS_POSITIVO = 'FF1D7A4C';
const VILCAS_NEGATIVO = 'FFB23A3A';
const FILA_ALTERNA = 'FFF3F8F6';

const FORMATO_SOLES = '"S/" #,##0.00';

/** Descarga el Blob del workbook generado por ExcelJS en el navegador. */
function descargarWorkbook(buffer: ArrayBuffer, nombreArchivo: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Cabecera institucional VILCAS: fondo verde + logo + nombre de empresa, en las columnas indicadas. */
function dibujarCabeceraHoja(
  hoja: ExcelJS.Worksheet,
  logoId: number | null,
  nombreEmpresa: string,
  subtitulo: string,
  ultimaColumnaLetra: string,
): void {
  hoja.mergeCells(`A1:${ultimaColumnaLetra}3`);
  const celdaCabecera = hoja.getCell('A1');
  celdaCabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VILCAS_VERDE } };
  hoja.getRow(1).height = 24;
  hoja.getRow(2).height = 20;
  hoja.getRow(3).height = 18;

  for (let f = 1; f <= 3; f++) {
    for (let c = 1; c <= hoja.columnCount; c++) {
      const celda = hoja.getRow(f).getCell(c);
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VILCAS_VERDE } };
    }
  }

  const celdaNombre = hoja.getCell('B1');
  celdaNombre.value = nombreEmpresa;
  celdaNombre.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  celdaNombre.alignment = { vertical: 'middle', horizontal: 'left' };

  const celdaSub = hoja.getCell('B2');
  celdaSub.value = subtitulo;
  celdaSub.font = { name: 'Calibri', size: 10.5, color: { argb: VILCAS_TEXTO_CLARO } };
  celdaSub.alignment = { vertical: 'middle', horizontal: 'left' };

  const celdaMarca = hoja.getCell(`${ultimaColumnaLetra}2`);
  celdaMarca.value = 'Plataforma VILCAS';
  celdaMarca.font = { name: 'Calibri', size: 9, bold: true, color: { argb: VILCAS_TEXTO_CLARO } };
  celdaMarca.alignment = { vertical: 'middle', horizontal: 'right' };

  if (logoId !== null) {
    hoja.addImage(logoId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 46, height: 46 },
    });
  }
}

function estiloEncabezadoSeccion(celda: ExcelJS.Cell): void {
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VILCAS_VERDE } };
  celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  celda.alignment = { vertical: 'middle', horizontal: 'left' };
  celda.border = {
    top: { style: 'thin', color: { argb: VILCAS_VERDE_700 } },
    bottom: { style: 'thin', color: { argb: VILCAS_VERDE_700 } },
  };
}

function estiloFilaDato(fila: ExcelJS.Row, colorFondo?: string): void {
  fila.eachCell({ includeEmpty: true }, (celda) => {
    celda.border = {
      top: { style: 'thin', color: { argb: VILCAS_BORDE } },
      bottom: { style: 'thin', color: { argb: VILCAS_BORDE } },
      left: { style: 'thin', color: { argb: VILCAS_BORDE } },
      right: { style: 'thin', color: { argb: VILCAS_BORDE } },
    };
    if (colorFondo) {
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } };
    }
  });
}

export async function exportarResumenMensualExcel(
  r: ResumenMensual,
  opciones?: OpcionesBrandingReporte
): Promise<void> {
  // Import diferido: exceljs solo se descarga cuando el usuario pide el Excel.
  const { default: ExcelJSRuntime } = await import('exceljs');
  const libro = new ExcelJSRuntime.Workbook();
  libro.creator = 'VILCAS';
  libro.created = new Date();

  const nombreEmpresa = (opciones?.nombreEmpresa || 'Mi Empresa').toUpperCase();
  const subtitulo = `Resumen mensual de compras y ventas · ${r.etiquetaMes} · del ${r.desde} al ${r.hasta}`;

  const logoDataUrl = await imagenADataUrl('/vilcas.png');
  const logoId = logoDataUrl
    ? libro.addImage({ base64: logoDataUrl, extension: 'png' })
    : null;

  // ── Hoja 1: Resumen ────────────────────────────────────────────────
  const hojaResumen = libro.addWorksheet('Resumen', {
    views: [{ showGridLines: false }],
  });
  hojaResumen.columns = [
    { key: 'a', width: 42 },
    { key: 'b', width: 22 },
  ];

  dibujarCabeceraHoja(hojaResumen, logoId, nombreEmpresa, subtitulo, 'B');
  hojaResumen.addRow([]);

  const filaVentasTitulo = hojaResumen.addRow(['RESUMEN DE VENTAS', 'MONTO / CANTIDAD']);
  filaVentasTitulo.eachCell((c) => estiloEncabezadoSeccion(c));

  const datosVentas: [string, number | string][] = [
    ['Ingresos del mes', r.ventas.ingresos_periodo],
    ['Cantidad de ventas', r.ventas.cantidad_ventas],
    ['Ticket promedio', r.ventas.ticket_promedio],
    ['Margen bruto del mes', r.ventas.margen_bruto_periodo],
  ];
  datosVentas.forEach(([label, valor], i) => {
    const fila = hojaResumen.addRow([label, valor]);
    if (label !== 'Cantidad de ventas') fila.getCell(2).numFmt = FORMATO_SOLES;
    estiloFilaDato(fila, i % 2 === 0 ? FILA_ALTERNA : undefined);
  });

  hojaResumen.addRow([]);

  const filaComprasTitulo = hojaResumen.addRow(['RESUMEN DE COMPRAS', 'MONTO / CANTIDAD']);
  filaComprasTitulo.eachCell((c) => estiloEncabezadoSeccion(c));

  const datosCompras: [string, number | string][] = [
    ['Total comprado', r.compras.total],
    ['Cantidad de compras', r.compras.cantidad],
    ['Gasto operativo del mes', r.ventas.gasto_operativo_periodo],
  ];
  datosCompras.forEach(([label, valor], i) => {
    const fila = hojaResumen.addRow([label, valor]);
    if (label !== 'Cantidad de compras') fila.getCell(2).numFmt = FORMATO_SOLES;
    estiloFilaDato(fila, i % 2 === 0 ? FILA_ALTERNA : undefined);
  });

  hojaResumen.addRow([]);

  const filaBalance = hojaResumen.addRow(['BALANCE NETO DEL MES (Ventas − Compras − Gastos)', r.balanceNeto]);
  filaBalance.font = { bold: true, size: 12 };
  filaBalance.getCell(2).font = {
    bold: true,
    size: 12,
    color: { argb: r.balanceNeto >= 0 ? VILCAS_POSITIVO : VILCAS_NEGATIVO },
  };
  filaBalance.getCell(2).numFmt = FORMATO_SOLES;
  estiloFilaDato(filaBalance, 'FFEFF7F4');

  // ── Hoja 2: Detalle de compras ─────────────────────────────────────
  if (r.compras.detalle.length > 0) {
    const hojaDetalle = libro.addWorksheet('Detalle de compras', {
      views: [{ showGridLines: false }],
    });
    hojaDetalle.columns = [
      { key: 'fecha', width: 14 },
      { key: 'proveedor', width: 28 },
      { key: 'concepto', width: 32 },
      { key: 'cantidad', width: 18 },
      { key: 'monto', width: 16 },
      { key: 'notas', width: 32 },
    ];

    dibujarCabeceraHoja(
      hojaDetalle,
      logoId,
      `${nombreEmpresa} · Detalle de compras`,
      `Período: ${r.etiquetaMes}`,
      'F',
    );
    hojaDetalle.addRow([]);

    const filaCabecera = hojaDetalle.addRow(['Fecha', 'Proveedor', 'Concepto', 'Cantidad de ítems', 'Monto (S/)', 'Notas']);
    filaCabecera.eachCell((c) => estiloEncabezadoSeccion(c));

    r.compras.detalle.forEach((c, i) => {
      const fila = hojaDetalle.addRow([c.fecha, c.proveedor, c.concepto, c.cantidad_items ?? '', c.monto, c.notas ?? '']);
      fila.getCell(5).numFmt = FORMATO_SOLES;
      estiloFilaDato(fila, i % 2 === 0 ? FILA_ALTERNA : undefined);
    });
  }

  const buffer = await libro.xlsx.writeBuffer();
  descargarWorkbook(buffer as ArrayBuffer, nombreArchivo(r, 'xlsx'));
}