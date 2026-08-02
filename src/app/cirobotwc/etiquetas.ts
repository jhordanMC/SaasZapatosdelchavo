/** Nombre de tool (backend, ver app/modules/chatbot/mcp/*.py) → texto para el feed "✓ ..." durante la ejecución. */
const ETIQUETAS_HERRAMIENTA: Record<string, string> = {
  consultar_inventario: 'Inventario consultado',
  consultar_stock: 'Stock consultado',
  consultar_kpis: 'KPIs analizados',
  crear_ticket: 'Ticket creado',
  consultar_mis_tickets: 'Tickets consultados',
};

export function etiquetaHerramienta(nombre: string): string {
  if (nombre.startsWith('abrir_')) return 'Navegando…';
  return ETIQUETAS_HERRAMIENTA[nombre] ?? nombre.replace(/_/g, ' ');
}

export const ETIQUETA_PROVEEDOR: Record<'gemini' | 'grok', string> = {
  gemini: 'Conectado a Gemini',
  grok: 'Conectado a Grok',
};
