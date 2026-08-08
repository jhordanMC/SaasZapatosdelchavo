/**
 * Exportación del resumen mensual de compras y ventas a PDF y Excel.
 *
 * Todo se genera en el navegador (sin backend): jsPDF + jspdf-autotable
 * arman el PDF, y SheetJS (xlsx) arma el libro de Excel con dos hojas
 * (Resumen y Detalle de compras).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
// Helpers de mes (todo en hora local, formato "YYYY-MM" para el <input type="month">)
// ---------------------------------------------------------------------------

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function mesActualISO(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
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

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function exportarResumenMensualPDF(r: ResumenMensual): Promise<void> {
  const doc = new jsPDF();
  const margenIzq = 14;
  let y = 14;

  const logoVilcasDataUrl = await imagenADataUrl('/vilcas.png');
  const logoAlbaDataUrl = await imagenADataUrl('/Logoalbasinfondo.png');

  // Cabecera institucional VILCAS
  doc.setFillColor(2, 75, 64); // #024b40
  doc.rect(0, 0, 210, 32, 'F');

  if (logoVilcasDataUrl) {
    try {
      doc.addImage(logoVilcasDataUrl, 'PNG', margenIzq, 6, 20, 20);
    } catch {
      // Ignorar si no carga
    }
  }

  const posXTexto = logoVilcasDataUrl ? margenIzq + 24 : margenIzq;
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('VILCAS', posXTexto, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 225, 215);
  doc.text('Resumen mensual de compras y ventas', posXTexto, 24);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`${r.etiquetaMes}  ·  ${r.desde} al ${r.hasta}`, 196, 18, { align: 'right' });

  y = 42;

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

export function exportarResumenMensualExcel(r: ResumenMensual): void {
  const libro = XLSX.utils.book_new();

  const albaLink = 'https://www.linkedin.com/in/alba-engineering-development-42a3493ab?utm_source=share_via&utm_content=profile&utm_medium=member_android';

  const filasResumen = [
    ['VILCAS - Sistema de Gestión'],
    ['Resumen mensual de compras y ventas'],
    [r.etiquetaMes, `del ${r.desde} al ${r.hasta}`],
    [],
    ['Ventas', ''],
    ['Ingresos del mes', r.ventas.ingresos_periodo],
    ['Cantidad de ventas', r.ventas.cantidad_ventas],
    ['Ticket promedio', r.ventas.ticket_promedio],
    ['Margen bruto del mes', r.ventas.margen_bruto_periodo],
    [],
    ['Compras', ''],
    ['Total comprado', r.compras.total],
    ['Cantidad de compras', r.compras.cantidad],
    ['Gasto operativo del mes', r.ventas.gasto_operativo_periodo],
    [],
    ['Balance neto (ventas - compras - gasto operativo)', r.balanceNeto],
    [],
    ['Powered by ALBA - Engineering & Development'],
    [albaLink],
  ];
  const hojaResumen = XLSX.utils.aoa_to_sheet(filasResumen);
  hojaResumen['!cols'] = [{ wch: 45 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

  if (r.compras.porProveedor.length > 0) {
    const filasProveedor = [
      ['VILCAS - Compras por proveedor'],
      ['Proveedor', 'Total comprado'],
      ...r.compras.porProveedor.map((p) => [p.proveedor, p.total]),
      [],
      ['Powered by ALBA - Engineering & Development'],
      [albaLink],
    ];
    const hojaProveedor = XLSX.utils.aoa_to_sheet(filasProveedor);
    hojaProveedor['!cols'] = [{ wch: 35 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(libro, hojaProveedor, 'Por proveedor');
  }

  const filasDetalle = [
    ['VILCAS - Detalle de compras'],
    ['Fecha', 'Proveedor', 'Concepto', 'Cantidad de ítems', 'Monto', 'Notas'],
    ...r.compras.detalle.map((c) => [c.fecha, c.proveedor, c.concepto, c.cantidad_items ?? '', c.monto, c.notas ?? '']),
    [],
    ['Powered by ALBA - Engineering & Development'],
    [albaLink],
  ];
  const hojaDetalle = XLSX.utils.aoa_to_sheet(filasDetalle);
  hojaDetalle['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(libro, hojaDetalle, 'Detalle de compras');

  XLSX.writeFile(libro, nombreArchivo(r, 'xlsx'));
}
