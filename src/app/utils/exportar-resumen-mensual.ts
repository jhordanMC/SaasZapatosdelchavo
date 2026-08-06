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
// PDF
// ---------------------------------------------------------------------------

export function exportarResumenMensualPDF(r: ResumenMensual): void {
  const doc = new jsPDF();
  const margenIzq = 14;
  let y = 18;

  doc.setFontSize(16);
  doc.setTextColor(2, 75, 64); // #024b40
  doc.text('Resumen mensual de compras y ventas', margenIzq, y);

  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(90, 138, 120); // #5a8a78
  doc.text(`${r.etiquetaMes}  ·  del ${r.desde} al ${r.hasta}`, margenIzq, y);

  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(31, 64, 52); // #1f4034
  doc.text('Ventas', margenIzq, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    theme: 'grid',
    styles: { fontSize: 9.5, textColor: [31, 64, 52] },
    headStyles: { fillColor: [2, 75, 64], textColor: 255 },
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
  doc.setFontSize(12);
  doc.text('Compras', margenIzq, y);

  autoTable(doc, {
    startY: y + 2,
    theme: 'grid',
    styles: { fontSize: 9.5, textColor: [31, 64, 52] },
    headStyles: { fillColor: [2, 75, 64], textColor: 255 },
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
  doc.text('Balance neto del mes (ventas − compras − gasto operativo)', margenIzq, y);
  y += 8;
  doc.setFontSize(14);
  doc.setTextColor(r.balanceNeto >= 0 ? 29 : 178, r.balanceNeto >= 0 ? 122 : 58, r.balanceNeto >= 0 ? 76 : 58);
  doc.text(moneda(r.balanceNeto), margenIzq, y);

  if (r.compras.detalle.length > 0) {
    y += 10;
    doc.setFontSize(12);
    doc.setTextColor(31, 64, 52);
    doc.text('Detalle de compras del mes', margenIzq, y);

    autoTable(doc, {
      startY: y + 2,
      theme: 'striped',
      styles: { fontSize: 8.5, textColor: [31, 64, 52] },
      headStyles: { fillColor: [2, 75, 64], textColor: 255 },
      head: [['Fecha', 'Proveedor', 'Concepto', 'Monto']],
      body: r.compras.detalle.map((c) => [c.fecha, c.proveedor, c.concepto, moneda(c.monto)]),
    });
  }

  doc.save(nombreArchivo(r, 'pdf'));
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

export function exportarResumenMensualExcel(r: ResumenMensual): void {
  const libro = XLSX.utils.book_new();

  const filasResumen = [
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
  ];
  const hojaResumen = XLSX.utils.aoa_to_sheet(filasResumen);
  hojaResumen['!cols'] = [{ wch: 42 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

  if (r.compras.porProveedor.length > 0) {
    const filasProveedor = [
      ['Proveedor', 'Total comprado'],
      ...r.compras.porProveedor.map((p) => [p.proveedor, p.total]),
    ];
    const hojaProveedor = XLSX.utils.aoa_to_sheet(filasProveedor);
    hojaProveedor['!cols'] = [{ wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(libro, hojaProveedor, 'Por proveedor');
  }

  const filasDetalle = [
    ['Fecha', 'Proveedor', 'Concepto', 'Cantidad de ítems', 'Monto', 'Notas'],
    ...r.compras.detalle.map((c) => [c.fecha, c.proveedor, c.concepto, c.cantidad_items ?? '', c.monto, c.notas ?? '']),
  ];
  const hojaDetalle = XLSX.utils.aoa_to_sheet(filasDetalle);
  hojaDetalle['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(libro, hojaDetalle, 'Detalle de compras');

  XLSX.writeFile(libro, nombreArchivo(r, 'xlsx'));
}
