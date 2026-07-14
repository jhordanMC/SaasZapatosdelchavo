import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { mountLiveline, unmountLiveline } from '../../../livelinewc/liveline-wrapper';

/* ── Tipos ── */
type TipoEmpresa = 'Banca' | 'Seguros' | 'Telecomunicaciones' | 'Retail' | 'Financiero';

interface Empresa {
  nombre: string;
  tipo: TipoEmpresa;
  asesores: number;
  entrenadores: number;
  scorePromedio: number;
  plan: string;
  estado: 'activo' | 'inactivo';
  fechaAlta: string;
  ingresosMes: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardAdminComponent implements AfterViewInit, OnDestroy {

  @ViewChild('liveChartHost', { static: true }) liveChartHost!: ElementRef<HTMLDivElement>;

  showLogoFallback = false;
  showTip: string | null = null;

  /* ── Datos de empresas (mock, reemplazar luego por servicio real) ── */
  todasEmpresas: Empresa[] = [
    { nombre: 'Banco Continental', tipo: 'Banca',              asesores: 24, entrenadores: 3, scorePromedio: 84, plan: 'Pro',    estado: 'activo',   fechaAlta: '2026-01-05', ingresosMes: 4800 },
    { nombre: 'Seguros del Sur',   tipo: 'Seguros',            asesores: 12, entrenadores: 2, scorePromedio: 77, plan: 'Básico', estado: 'activo',   fechaAlta: '2026-01-20', ingresosMes: 1200 },
    { nombre: 'Telco Express',     tipo: 'Telecomunicaciones', asesores: 31, entrenadores: 4, scorePromedio: 91, plan: 'Pro',    estado: 'activo',   fechaAlta: '2026-02-03', ingresosMes: 6200 },
    { nombre: 'Retail Max',        tipo: 'Retail',             asesores: 8,  entrenadores: 1, scorePromedio: 68, plan: 'Básico', estado: 'inactivo', fechaAlta: '2026-02-15', ingresosMes: 0    },
    { nombre: 'Financiera Norte',  tipo: 'Financiero',         asesores: 19, entrenadores: 3, scorePromedio: 80, plan: 'Pro',    estado: 'activo',   fechaAlta: '2026-03-01', ingresosMes: 3800 },
  ];

  tipos: TipoEmpresa[] = ['Banca', 'Seguros', 'Telecomunicaciones', 'Retail', 'Financiero'];

  tipoStyle: Record<TipoEmpresa, string> = {
    Banca: 'tipo-banca',
    Seguros: 'tipo-seguros',
    Telecomunicaciones: 'tipo-telco',
    Retail: 'tipo-retail',
    Financiero: 'tipo-financiero',
  };

  /* ── Estado de filtros ── */
  busqueda = '';
  filtroTipo: TipoEmpresa | 'Todos' = 'Todos';
  fechaDesde = '';
  fechaHasta = '';

  /* ── Fecha de hoy formateada ── */
  capitalizedDate = '';

  /* ── Realtime chart ── */
  private liveInterval?: ReturnType<typeof setInterval>;
  liveValueActual = 0;

  constructor() {
    const today = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    this.capitalizedDate = today.charAt(0).toUpperCase() + today.slice(1);
  }

  ngAfterViewInit(): void {
    mountLiveline(this.liveChartHost.nativeElement);
    this.initRealtimeValue();
  }

  ngOnDestroy(): void {
    if (this.liveInterval) clearInterval(this.liveInterval);
    unmountLiveline(this.liveChartHost.nativeElement);
  }

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  /* ── KPIs calculados ── */
  get totalAsesores(): number {
    return this.todasEmpresas.reduce((a, e) => a + e.asesores, 0);
  }
  get totalEntrenadores(): number {
    return this.todasEmpresas.reduce((a, e) => a + e.entrenadores, 0);
  }
  get scoreGlobal(): number {
    return Math.round(this.todasEmpresas.reduce((a, e) => a + e.scorePromedio, 0) / this.todasEmpresas.length);
  }
  get empresasActivas(): number {
    return this.todasEmpresas.filter(e => e.estado === 'activo').length;
  }
  get ingresosTotal(): number {
    return this.todasEmpresas.reduce((a, e) => a + e.ingresosMes, 0);
  }

  /* ── Filtro de tabla ── */
  get empresasFiltradas(): Empresa[] {
    return this.todasEmpresas.filter(e => {
      if (this.busqueda && !e.nombre.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      if (this.filtroTipo !== 'Todos' && e.tipo !== this.filtroTipo) return false;
      if (this.fechaDesde && e.fechaAlta < this.fechaDesde) return false;
      if (this.fechaHasta && e.fechaAlta > this.fechaHasta) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroTipo !== 'Todos' || this.fechaDesde || this.fechaHasta);
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroTipo = 'Todos';
    this.fechaDesde = '';
    this.fechaHasta = '';
  }

  /* ── Ingresos por empresa (ordenados, para barra lateral) ── */
  get ingresosOrdenados(): Empresa[] {
    return [...this.empresasFiltradas].sort((a, b) => b.ingresosMes - a.ingresosMes);
  }
  get ingresosMax(): number {
    return Math.max(...this.empresasFiltradas.map(e => e.ingresosMes), 1);
  }

  /* ── Helpers de formato ── */
  fmtUSD(n: number): string {
    return n === 0 ? '—' : `$${n.toLocaleString('en-US')}`;
  }
  scoreColorClass(s: number): string {
    return s >= 85 ? 'score-high' : s >= 70 ? 'score-mid' : 'score-low';
  }
  scoreBarClass(s: number): string {
    return s >= 85 ? 'bar-high' : s >= 70 ? 'bar-mid' : 'bar-low';
  }
  scoreStars(s: number): number {
    return Math.max(1, Math.min(5, Math.round(s / 20)));
  }
  starArray(count: number): number[] {
    return Array(count).fill(0);
  }
  tipoAbrev(t: TipoEmpresa): string {
    return t.slice(0, 3).toUpperCase();
  }

  private initRealtimeValue(): void {
    let agentes = 72;
    this.liveValueActual = agentes;

    this.liveInterval = setInterval(() => {
      const f = Math.floor(Math.random() * 8) - 4;
      agentes = Math.max(30, Math.min(120, agentes + f));
      this.liveValueActual = agentes;
    }, 3000);
  }
}