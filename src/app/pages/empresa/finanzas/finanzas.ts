import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FinanzasService,
  Frecuencia,
  GastoOperativoCreate,
  GastoRecurrenteCreate,
  TIPOS_GASTO_SUGERIDOS,
} from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finanzas.html',
  styleUrls: ['./finanzas.css'],
})
export class FinanzasComponent implements OnInit {
  constructor(public finanzasService: FinanzasService, private inventarioService: InventarioService) {}

  tiposGastoSugeridos = TIPOS_GASTO_SUGERIDOS;
  productosRentabilidad: ProductoListItem[] = [];

  mostrarModalRecurrente = false;
  mostrarModalUnico = false;

  formRecurrente: GastoRecurrenteCreate = this.formRecurrenteVacio();
  formUnico: GastoOperativoCreate = this.formUnicoVacio();

  ngOnInit(): void {
    this.finanzasService.recargarTodo();
    this.inventarioService.listarProductos({}, 0, 10, 'margen_desc').subscribe((pagina) => {
      this.productosRentabilidad = pagina.items;
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
    this.finanzasService.crearGastoRecurrente(this.formRecurrente).subscribe(() => {
      this.mostrarModalRecurrente = false;
      this.finanzasService.recargarTodo();
    });
  }

  eliminarGastoRecurrente(idGastoRecurrente: string): void {
    this.finanzasService.eliminarGastoRecurrente(idGastoRecurrente).subscribe(() => {
      this.finanzasService.recargarTodo();
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
    this.finanzasService.crearGastoOperativo(this.formUnico).subscribe(() => {
      this.mostrarModalUnico = false;
      this.finanzasService.recargarTodo();
    });
  }

  eliminarGastoOperativo(idGasto: string): void {
    this.finanzasService.eliminarGastoOperativo(idGasto).subscribe(() => {
      this.finanzasService.recargarTodo();
    });
  }

  cargarMasGastosOperativos(): void {
    this.finanzasService.cargarGastosOperativos(this.finanzasService.gastosOperativos().length);
  }
}
