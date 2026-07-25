/**
 * Servicio de Proformas (cotizaciones para clientes) — módulo Ventas.
 *
 * No hay backend de proformas todavía, así que esto vive 100% en el
 * navegador: se guarda en localStorage, separado por empresa (id_empresa)
 * para no mezclar cotizaciones de distintos tenants en el mismo navegador
 * (ej. una laptop compartida por varias empresas del SaaS).
 *
 * El número correlativo (COT-0001, COT-0002, ...) se calcula localmente a
 * partir de lo ya guardado. Si en el futuro se agrega backend, esta es la
 * capa a reemplazar por llamadas HTTP — la interfaz pública (listar, obtener,
 * crear, actualizar, eliminar, cálculos) puede quedarse igual.
 */
import { Injectable, signal } from '@angular/core';
import { AuthService } from '../core/auth';

// ---------------------------------------------------------------------------
// Tipos de dominio
// ---------------------------------------------------------------------------

export interface ClienteProforma {
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
}

export interface ItemProforma {
  /** Id de línea (no confundir con el id del producto): permite repetir un producto con otra talla. */
  id: string;
  productoId: string;
  nombre: string;
  talla?: string | null;
  sku?: string | null;
  /** Ruta relativa (igual que en el catálogo POS); se resuelve con environment.apiUrl al mostrar/imprimir. */
  imagenUrl: string | null;
  precioUnitario: number;
  cantidad: number;
  /** Descuento en S/ absolutos aplicado a esta línea (no porcentaje). */
  descuentoMonto: number;
}

export type EstadoProforma = 'vigente' | 'vencida';

export interface Proforma {
  id: string;
  numero: string;
  cliente: ClienteProforma;
  items: ItemProforma[];
  /** Descuento en S/ absolutos aplicado al total (además de los descuentos por línea). */
  descuentoGlobal: number;
  notas: string;
  /** Fecha de emisión, formato YYYY-MM-DD. */
  fechaEmision: string;
  /** Días de vigencia desde la fecha de emisión. */
  validoHastaDias: number;
  creadoEn: string;
  actualizadoEn: string;
}

export type ProformaCreate = Omit<Proforma, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn'>;
export type ProformaUpdate = Partial<Omit<Proforma, 'id' | 'numero' | 'creadoEn'>>;

const STORAGE_PREFIX = 'zdc_proformas__';

@Injectable({ providedIn: 'root' })
export class ProformasService {
  private readonly proformasSig = signal<Proforma[]>([]);
  readonly proformas = this.proformasSig.asReadonly();

  constructor(private authService: AuthService) {
    this.cargarDesdeStorage();
  }

  private storageKey(): string {
    const empresaId = this.authService.usuarioActual()?.empresaId ?? 'sin-empresa';
    return `${STORAGE_PREFIX}${empresaId}`;
  }

  private cargarDesdeStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      this.proformasSig.set(raw ? (JSON.parse(raw) as Proforma[]) : []);
    } catch {
      // localStorage bloqueado (modo privado) o JSON corrupto: se arranca vacío.
      this.proformasSig.set([]);
    }
  }

  private guardarEnStorage(): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.proformasSig()));
    } catch {
      // Almacenamiento lleno o no disponible: los datos siguen en memoria
      // para esta sesión, pero no persisten. No es un error bloqueante.
    }
  }

  /** Vuelve a leer del storage — útil si cambió la sesión (otra empresa/usuario). */
  recargar(): void {
    this.cargarDesdeStorage();
  }

  // ── Listado / lectura ────────────────────────────────────────────────────

  listar(): Proforma[] {
    return [...this.proformasSig()].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  obtener(id: string): Proforma | undefined {
    return this.proformasSig().find((p) => p.id === id);
  }

  private siguienteNumero(): string {
    const numeros = this.proformasSig()
      .map((p) => parseInt(p.numero.replace(/\D/g, ''), 10))
      .filter((n) => !Number.isNaN(n));
    const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
    return `COT-${String(siguiente).padStart(4, '0')}`;
  }

  // ── Escritura ────────────────────────────────────────────────────────────

  crear(data: ProformaCreate): Proforma {
    const ahora = new Date().toISOString();
    const nueva: Proforma = {
      ...data,
      id: crypto.randomUUID(),
      numero: this.siguienteNumero(),
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    this.proformasSig.update((lista) => [...lista, nueva]);
    this.guardarEnStorage();
    return nueva;
  }

  actualizar(id: string, cambios: ProformaUpdate): void {
    this.proformasSig.update((lista) =>
      lista.map((p) => (p.id === id ? { ...p, ...cambios, actualizadoEn: new Date().toISOString() } : p))
    );
    this.guardarEnStorage();
  }

  eliminar(id: string): void {
    this.proformasSig.update((lista) => lista.filter((p) => p.id !== id));
    this.guardarEnStorage();
  }

  // ── Cálculos (compartidos entre editor, listado e impresión) ────────────

  totalItem(item: Pick<ItemProforma, 'precioUnitario' | 'cantidad' | 'descuentoMonto'>): number {
    return Math.max(0, item.precioUnitario * item.cantidad - item.descuentoMonto);
  }

  subtotal(proforma: Pick<Proforma, 'items'>): number {
    return proforma.items.reduce((acc, i) => acc + this.totalItem(i), 0);
  }

  total(proforma: Pick<Proforma, 'items' | 'descuentoGlobal'>): number {
    return Math.max(0, this.subtotal(proforma) - (proforma.descuentoGlobal || 0));
  }

  fechaVencimiento(proforma: Pick<Proforma, 'fechaEmision' | 'validoHastaDias'>): string {
    const vencimiento = new Date(`${proforma.fechaEmision}T00:00:00`);
    vencimiento.setDate(vencimiento.getDate() + proforma.validoHastaDias);
    return vencimiento.toISOString().slice(0, 10);
  }

  estado(proforma: Pick<Proforma, 'fechaEmision' | 'validoHastaDias'>): EstadoProforma {
    const vencimiento = new Date(`${this.fechaVencimiento(proforma)}T23:59:59`);
    return vencimiento.getTime() < Date.now() ? 'vencida' : 'vigente';
  }
}
