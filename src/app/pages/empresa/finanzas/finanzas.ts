import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  FinanzasService,
  Frecuencia,
  GastoOperativoCreate,
  GastoRecurrenteCreate,
  ResumenFinanciero,
  TIPOS_GASTO_SUGERIDOS,
} from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';
import {
  ResumenMensual,
  construirResumenMensual,
  exportarResumenMensualExcel,
  exportarResumenMensualPDF,
  mesActualISO,
  rangoMes,
} from '../../../utils/exportar-resumen-mensual';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "completos": ingresos brutos de las ventas, sin descontar el costo de la
 * mercadería vendida — útil para ver el flujo de caja del período.
 * "margen": ingresos ya descontado ese costo — la ganancia real del
 * negocio, la que se compara contra el punto de equilibrio.
 */
type VistaIngresos = 'completos' | 'margen';

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finanzas.html',
  styleUrls: ['./finanzas.css'],
})
export class FinanzasComponent implements OnInit {
  constructor(
    public finanzasService: FinanzasService,
    private inventarioService: InventarioService
  ) {}

  tiposGastoSugeridos = TIPOS_GASTO_SUGERIDOS;
  productosRentabilidad: ProductoListItem[] = [];

  mostrarModalRecurrente = false;
  mostrarModalUnico = false;
  guardandoRecurrente = false;
  guardandoUnico = false;
  eliminandoId = signal<string | null>(null);
  gastoAEliminar: { id: string, tipo: 'recurrente' | 'unico' } | null = null;

  formRecurrente: GastoRecurrenteCreate = this.formRecurrenteVacio();
  formUnico: GastoOperativoCreate = this.formUnicoVacio();

  readonly vistaIngresos = signal<VistaIngresos>('completos');

  cambiarVista(vista: VistaIngresos): void {
    this.vistaIngresos.set(vista);
  }

  /** Tarjeta 1: ingresos brutos o margen bruto, según la vista activa. */
  etiquetaIngresos(): string {
    return this.vistaIngresos() === 'completos' ? 'Ingresos totales del período' : 'Margen generado del período';
  }

  valorIngresos(r: ResumenFinanciero): number {
    return this.vistaIngresos() === 'completos' ? r.ingresos_periodo : r.margen_bruto_periodo;
  }

  /** Tarjeta 4: flujo de caja (sin descontar costo) o ganancia neta real. */
  etiquetaResultado(): string {
    return this.vistaIngresos() === 'completos' ? 'Flujo de caja del período' : 'Ganancia neta real';
  }

  valorResultado(r: ResumenFinanciero): number {
    return this.vistaIngresos() === 'completos'
      ? r.ingresos_periodo - r.gasto_operativo_periodo
      : r.ganancia_neta_periodo;
  }

  resultadoEsPositivo(r: ResumenFinanciero): boolean {
    return this.valorResultado(r) > 0;
  }

  abs(val: number): number {
    return Math.abs(val);
  }

  /**
   * true si "Margen generado"/"Ganancia neta real" todavía no cubren todo
   * el período — porque parte de las ventas no tiene costo_unitario
   * registrado (ventas de prueba o anteriores a esta funcionalidad).
   */
  margenEsParcial(r: ResumenFinanciero): boolean {
    return this.vistaIngresos() === 'margen' && r.ingresos_con_costo_periodo < r.ingresos_periodo;
  }

  ngOnInit(): void {
    this.finanzasService.recargarTodo();
    this.inventarioService.listarProductos({}, 0, 10, 'margen_desc').subscribe((pagina) => {
      this.productosRentabilidad = pagina.items;
    });
    this.finanzasService.obtenerStatsProveedores().subscribe((res) => {
      this.proveedoresStats = res.proveedores;
    });
  }

  get resumen() {
    return this.finanzasService.resumen();
  }

  get maxSemana(): number {
    const puntos = this.finanzasService.ingresosPorSemana();
    return Math.max(1, ...puntos.map((p) => p.total));
  }

  alturaBarra(total: number): number {
    return Math.round((total / this.maxSemana) * 100);
  }

  // ── Gasto recurrente ─────────────────────────────────────────────────────

  private formRecurrenteVacio(): GastoRecurrenteCreate {
    return { concepto: '', tipo_gasto: '', monto: 0, frecuencia: 'mensual' as Frecuencia, fecha_inicio: hoyISO() };
  }

  abrirModalRecurrente(): void {
    this.formRecurrente = this.formRecurrenteVacio();
    this.mostrarModalRecurrente = true;
  }

  cerrarModalRecurrente(): void {
    this.mostrarModalRecurrente = false;
  }

  guardarGastoRecurrente(): void {
    if (!this.formRecurrente.concepto.trim() || !this.formRecurrente.tipo_gasto.trim() || this.formRecurrente.monto <= 0) {
      return;
    }
    this.guardandoRecurrente = true;
    this.finanzasService.crearGastoRecurrente(this.formRecurrente).subscribe({
      next: () => {
        this.mostrarModalRecurrente = false;
        this.guardandoRecurrente = false;
        this.finanzasService.recargarTodo();
      },
      error: () => {
        this.guardandoRecurrente = false;
      }
    });
  }

  abrirModalEliminar(id: string, tipo: 'recurrente' | 'unico'): void {
    this.gastoAEliminar = { id, tipo };
  }

  cerrarModalEliminar(): void {
    if (this.eliminandoId()) return; // Prevenir cierre si está cargando
    this.gastoAEliminar = null;
  }

  confirmarEliminacion(): void {
    if (!this.gastoAEliminar) return;
    const { id, tipo } = this.gastoAEliminar;
    this.eliminandoId.set(id);

    const request$ =
      tipo === 'recurrente'
        ? this.finanzasService.eliminarGastoRecurrente(id)
        : this.finanzasService.eliminarGastoOperativo(id);

    request$.subscribe({
      next: () => {
        this.eliminandoId.set(null);
        this.gastoAEliminar = null;
        this.finanzasService.recargarTodo();
      },
      error: () => this.eliminandoId.set(null)
    });
  }

  // ── Gasto único / extraordinario ────────────────────────────────────────

  private formUnicoVacio(): GastoOperativoCreate {
    return { concepto: '', tipo_gasto: '', monto: 0, fecha: hoyISO() };
  }

  abrirModalUnico(): void {
    this.formUnico = this.formUnicoVacio();
    this.mostrarModalUnico = true;
  }

  cerrarModalUnico(): void {
    this.mostrarModalUnico = false;
  }

  guardarGastoUnico(): void {
    if (!this.formUnico.concepto.trim() || !this.formUnico.tipo_gasto.trim() || this.formUnico.monto <= 0) {
      return;
    }
    this.guardandoUnico = true;
    this.finanzasService.crearGastoOperativo(this.formUnico).subscribe({
      next: () => {
        this.mostrarModalUnico = false;
        this.guardandoUnico = false;
        this.finanzasService.recargarTodo();
      },
      error: () => {
        this.guardandoUnico = false;
      }
    });
  }

  // Eliminar movido a confirmarEliminacion()

  cargarMasGastosOperativos(): void {
    this.finanzasService.cargarGastosOperativos(this.finanzasService.gastosOperativos().length);
  }

  // ── Proveedores (KPIs reales) ───────────────────────────────────────────────

  proveedoresStats: any[] = []; // Se carga en ngOnInit desde el backend

  get maxUnidadesVendidasProveedor(): number {
    return Math.max(1, ...this.proveedoresStats.map((p) => p.unidades_vendidas));
  }

  alturaBarraVendidas(unidades: number): number {
    return Math.round((unidades / this.maxUnidadesVendidasProveedor) * 100);
  }

  // ── Resumen mensual de compras y ventas (descargable) ───────────────────

  mesSeleccionado: string = mesActualISO();
  resumenMensual: ResumenMensual | null = null;
  generandoResumenMensual = false;
  errorResumenMensual = false;

  generarResumenMensual(): void {
    this.generandoResumenMensual = true;
    this.errorResumenMensual = false;
    this.resumenMensual = null;
    const { desde, hasta } = rangoMes(this.mesSeleccionado);

    forkJoin({
      ventas: this.finanzasService.obtenerResumenPeriodo(desde, hasta),
    }).subscribe({
      next: ({ ventas }) => {
        this.resumenMensual = construirResumenMensual(this.mesSeleccionado, desde, hasta, ventas, []);
        this.generandoResumenMensual = false;
      },
      error: () => {
        this.generandoResumenMensual = false;
        this.errorResumenMensual = true;
      },
    });
  }

  descargarResumenPDF(): void {
    if (this.resumenMensual) exportarResumenMensualPDF(this.resumenMensual);
  }

  descargarResumenExcel(): void {
    if (this.resumenMensual) exportarResumenMensualExcel(this.resumenMensual);
  }
}
