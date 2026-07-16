import { Injectable, signal } from '@angular/core';
import { VentasService } from './ventas';

export type TipoGasto =
  | 'Pago de local'
  | 'Seguridad local'
  | 'Pago trabajador'
  | 'Almuerzo trabajador'
  | 'Pasajes trabajador'
  | 'SaaS Vilcas';

export interface GastoOperativo {
  id: string;
  tipo: TipoGasto;
  monto: number;
  periodo: 'diario' | 'semanal' | 'mensual';
  fecha: string;
}

let autoId = 0;
function nuevoId(): string {
  autoId += 1;
  return `gasto-${autoId}`;
}

const COSTO_SAAS_DIARIO = 3.33;

@Injectable({ providedIn: 'root' })
export class FinanzasService {
  constructor(private ventasService: VentasService) {}

  gastos = signal<GastoOperativo[]>([
    { id: nuevoId(), tipo: 'Pago de local', monto: 900, periodo: 'mensual', fecha: new Date().toISOString() },
    { id: nuevoId(), tipo: 'Pago trabajador', monto: 280, periodo: 'semanal', fecha: new Date().toISOString() },
    { id: nuevoId(), tipo: 'SaaS Vilcas', monto: COSTO_SAAS_DIARIO, periodo: 'diario', fecha: new Date().toISOString() },
  ]);

  agregarGasto(datos: Omit<GastoOperativo, 'id' | 'fecha'>): void {
    this.gastos.update((lista) => [
      { ...datos, id: nuevoId(), fecha: new Date().toISOString() },
      ...lista,
    ]);
  }

  eliminarGasto(id: string): void {
    this.gastos.update((lista) => lista.filter((g) => g.id !== id));
  }

  gastoOperativoMensualEstimado(): number {
    return this.gastos().reduce((acc, g) => {
      if (g.periodo === 'mensual') return acc + g.monto;
      if (g.periodo === 'semanal') return acc + g.monto * 4.33;
      if (g.periodo === 'diario') return acc + g.monto * 30;
      return acc;
    }, 0);
  }

  ingresosMes(): number {
    return this.ventasService.ingresosPeriodo(30);
  }

  ingresosSemana(): number {
    return this.ventasService.ingresosPeriodo(7);
  }

  gananciaNetaMensual(): number {
    return this.ingresosMes() - this.gastoOperativoMensualEstimado();
  }

  estaGenerandoGanancia(): boolean {
    return this.gananciaNetaMensual() > 0;
  }
}
