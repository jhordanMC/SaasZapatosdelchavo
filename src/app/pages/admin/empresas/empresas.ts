import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Empresa, EmpresasService, Local, TipoEmpresa } from '../../../services/empresas';

interface NuevaEmpresaForm {
  nombre: string;
  tipo: TipoEmpresa | '';
  plan: 'Básico' | 'Pro';
  locales: number;
}

interface NuevoLocalForm {
  nombre: string;
  direccion: string;
  descripcion: string;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.html',
  styleUrls: ['./empresas.css'],
})
export class EmpresasComponent {
  constructor(private empresasService: EmpresasService, private router: Router) {}

  busqueda = '';
  filtroTipo: TipoEmpresa | 'Todos' = 'Todos';
  fechaDesde = '';
  fechaHasta = '';
  vistaModo: 'cards' | 'tabla' = 'cards';

  tipos: TipoEmpresa[] = ['Banca', 'Seguros', 'Telecomunicaciones', 'Retail', 'Financiero'];

  get todasEmpresas(): Empresa[] {
    return this.empresasService.getEmpresas();
  }

  // ── Modal "Nueva empresa" (3 pasos) ────────────────────
  modalNuevaAbierto = false;
  pasoModal: 1 | 2 | 3 = 1;
  nuevaEmpresa: NuevaEmpresaForm = { nombre: '', tipo: '', plan: 'Básico', locales: 1 };
  modalLogoError = false;

  // ── Paso 3: alta de locales uno a uno ──────────────────
  nuevoLocal: NuevoLocalForm = { nombre: '', direccion: '', descripcion: '' };
  localesCreadosTemp: Local[] = [];

  // ── Modal de confirmación tras crear la empresa ────────
  modalConfirmacionAbierto = false;
  empresaRecienCreada: Empresa | null = null;

  tipoStyle: Record<TipoEmpresa, string> = {
    Banca: 'tipo-banca',
    Seguros: 'tipo-seguros',
    Telecomunicaciones: 'tipo-telco',
    Retail: 'tipo-retail',
    Financiero: 'tipo-financiero',
  };

  get empresasFiltradas(): Empresa[] {
    return this.todasEmpresas.filter((empresa) => {
      if (this.busqueda && !empresa.nombre.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      if (this.filtroTipo !== 'Todos' && empresa.tipo !== this.filtroTipo) return false;
      if (this.fechaDesde && empresa.fechaAlta < this.fechaDesde) return false;
      if (this.fechaHasta && empresa.fechaAlta > this.fechaHasta) return false;
      return true;
    });
  }

  get totalEmpresas(): number {
    return this.todasEmpresas.length;
  }

  get empresasActivas(): number {
    return this.todasEmpresas.filter((empresa) => empresa.estado === 'activo').length;
  }

  get totalIngresos(): number {
    return this.todasEmpresas.reduce((sum, empresa) => sum + empresa.ingresosMes, 0);
  }

  get totalPlanesPro(): number {
    return this.todasEmpresas.filter((empresa) => empresa.plan === 'Pro').length;
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

  fmtUSD(value: number): string {
    return value === 0 ? '—' : `$${value.toLocaleString('en-US')}`;
  }

  scoreLabel(score: number): string {
    return score >= 85 ? 'Alto' : score >= 70 ? 'Medio' : 'Bajo';
  }

  scoreClass(score: number): string {
    return score >= 85 ? 'score-high' : score >= 70 ? 'score-mid' : 'score-low';
  }

  iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  verLocales(empresa: Empresa): void {
    this.router.navigate(['/admin/empresas', empresa.id]);
  }

  // ── Flujo modal "Nueva empresa" ────────────────────────
  abrirModalNueva(): void {
    this.nuevaEmpresa = { nombre: '', tipo: '', plan: 'Básico', locales: 1 };
    this.nuevoLocal = { nombre: '', direccion: '', descripcion: '' };
    this.localesCreadosTemp = [];
    this.pasoModal = 1;
    this.modalNuevaAbierto = true;
  }

  cerrarModalNueva(): void {
    this.modalNuevaAbierto = false;
  }

  get paso1Valido(): boolean {
    return this.nuevaEmpresa.nombre.trim().length > 0 && this.nuevaEmpresa.tipo !== '';
  }

  irAPasoLocales(): void {
    if (!this.paso1Valido) return;
    this.pasoModal = 2;
  }

  volverAPasoDatos(): void {
    this.pasoModal = 1;
  }

  ajustarLocales(delta: number): void {
    const nuevoValor = this.nuevaEmpresa.locales + delta;
    this.nuevaEmpresa.locales = Math.min(99, Math.max(1, nuevoValor));
  }

  irAPasoDatosLocales(): void {
    this.nuevoLocal = { nombre: '', direccion: '', descripcion: '' };
    this.localesCreadosTemp = [];
    this.pasoModal = 3;
  }

  volverAPasoCantidad(): void {
    this.pasoModal = 2;
  }

  // ── Paso 3: alta de locales uno a uno ──────────────────
  get faltanLocales(): number {
    return Math.max(0, this.nuevaEmpresa.locales - this.localesCreadosTemp.length);
  }

  get localesCompletos(): boolean {
    return this.localesCreadosTemp.length >= this.nuevaEmpresa.locales;
  }

  get nuevoLocalValido(): boolean {
    return this.nuevoLocal.nombre.trim().length > 0 && this.nuevoLocal.direccion.trim().length > 0;
  }

  agregarLocalTemp(): void {
    if (!this.nuevoLocalValido || this.localesCompletos) return;

    this.localesCreadosTemp = [
      ...this.localesCreadosTemp,
      {
        id: `tmp-${this.localesCreadosTemp.length}-${Date.now()}`,
        nombre: this.nuevoLocal.nombre.trim(),
        direccion: this.nuevoLocal.direccion.trim(),
        descripcion: this.nuevoLocal.descripcion.trim(),
      },
    ];

    this.nuevoLocal = { nombre: '', direccion: '', descripcion: '' };
  }

  quitarLocalTemp(local: Local): void {
    this.localesCreadosTemp = this.localesCreadosTemp.filter((item) => item.id !== local.id);
  }

  confirmarCrearEmpresa(): void {
    if (!this.paso1Valido || this.localesCreadosTemp.length === 0) return;

    const empresaCreada = this.empresasService.agregarEmpresa({
      nombre: this.nuevaEmpresa.nombre,
      tipo: this.nuevaEmpresa.tipo as TipoEmpresa,
      plan: this.nuevaEmpresa.plan,
      locales: this.localesCreadosTemp.map((local) =>
        this.empresasService.crearLocal(local.nombre, local.direccion, local.descripcion)
      ),
    });

    this.empresaRecienCreada = empresaCreada;
    this.cerrarModalNueva();
    this.modalConfirmacionAbierto = true;
  }

  cerrarModalConfirmacion(): void {
    this.modalConfirmacionAbierto = false;
    this.empresaRecienCreada = null;
  }

  irADetalleDesdeConfirmacion(): void {
    if (!this.empresaRecienCreada) return;
    const id = this.empresaRecienCreada.id;
    this.cerrarModalConfirmacion();
    this.router.navigate(['/admin/empresas', id]);
  }
}