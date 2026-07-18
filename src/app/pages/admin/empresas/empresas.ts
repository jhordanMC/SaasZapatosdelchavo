import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Empresa, EmpresasService, Local, LocalInput } from '../../../services/empresas';

interface NuevaEmpresaForm {
  nombre: string;
  locales: number;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.html',
  styleUrls: ['./empresas.css'],
})
export class EmpresasComponent implements OnInit {
  constructor(private empresasService: EmpresasService, private router: Router) {}

  empresas = signal<Empresa[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  busqueda = '';
  fechaDesde = '';
  fechaHasta = '';
  vistaModo: 'cards' | 'tabla' = 'cards';

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  private cargarEmpresas(): void {
    this.cargando.set(true);
    this.empresasService.listarEmpresas().subscribe({
      next: (empresas) => {
        this.empresas.set(empresas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de empresas.');
        this.cargando.set(false);
      },
    });
  }

  // ── Modal "Nueva empresa" (2 pasos: datos + locales) ────
  modalNuevaAbierto = false;
  pasoModal: 1 | 2 | 3 = 1;
  nuevaEmpresa: NuevaEmpresaForm = { nombre: '', locales: 1 };
  modalLogoError = false;
  guardando = false;

  // ── Paso 3: alta de locales uno a uno ──────────────────
  nuevoLocal: LocalInput = { nombre: '', direccion: '', descripcion: '' };
  localesCreadosTemp: (LocalInput & { id: string })[] = [];

  // ── Modal de confirmación tras crear la empresa ────────
  modalConfirmacionAbierto = false;
  empresaRecienCreada: Empresa | null = null;
  localesRecienCreados: Local[] = [];

  get empresasFiltradas(): Empresa[] {
    return this.empresas().filter((empresa) => {
      if (this.busqueda && !empresa.nombre.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      const fechaAlta = empresa.creado_en.slice(0, 10);
      if (this.fechaDesde && fechaAlta < this.fechaDesde) return false;
      if (this.fechaHasta && fechaAlta > this.fechaHasta) return false;
      return true;
    });
  }

  get totalEmpresas(): number {
    return this.empresas().length;
  }

  get empresasActivas(): number {
    return this.empresas().filter((empresa) => empresa.estado === 'activa').length;
  }

  get empresasSuspendidas(): number {
    return this.empresas().filter((empresa) => empresa.estado !== 'activa').length;
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.fechaDesde || this.fechaHasta);
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
  }

  fechaAlta(empresa: Empresa): string {
    return empresa.creado_en.slice(0, 10);
  }

  iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  verLocales(empresa: Empresa): void {
    this.router.navigate(['/admin/empresas', empresa.id_empresa]);
  }

  // ── Flujo modal "Nueva empresa" ────────────────────────
  abrirModalNueva(): void {
    this.nuevaEmpresa = { nombre: '', locales: 1 };
    this.nuevoLocal = { nombre: '', direccion: '', descripcion: '' };
    this.localesCreadosTemp = [];
    this.pasoModal = 1;
    this.modalNuevaAbierto = true;
  }

  cerrarModalNueva(): void {
    this.modalNuevaAbierto = false;
  }

  get paso1Valido(): boolean {
    return this.nuevaEmpresa.nombre.trim().length > 0;
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

  quitarLocalTemp(local: { id: string }): void {
    this.localesCreadosTemp = this.localesCreadosTemp.filter((item) => item.id !== local.id);
  }

  confirmarCrearEmpresa(): void {
    if (!this.paso1Valido || this.localesCreadosTemp.length === 0 || this.guardando) return;

    this.guardando = true;
    this.empresasService.crearEmpresa(this.nuevaEmpresa.nombre.trim()).subscribe({
      next: (empresaCreada) => {
        const creaciones = this.localesCreadosTemp.map((local) =>
          this.empresasService.crearLocal(empresaCreada.id_empresa, local)
        );
        forkJoin(creaciones).subscribe({
          next: (locales) => {
            this.guardando = false;
            this.empresas.set([empresaCreada, ...this.empresas()]);
            this.empresaRecienCreada = empresaCreada;
            this.localesRecienCreados = locales;
            this.cerrarModalNueva();
            this.modalConfirmacionAbierto = true;
          },
          error: () => {
            this.guardando = false;
            this.error.set('La empresa se creó, pero hubo un error al registrar sus locales.');
            this.cerrarModalNueva();
          },
        });
      },
      error: () => {
        this.guardando = false;
        this.error.set('No se pudo crear la empresa.');
      },
    });
  }

  cerrarModalConfirmacion(): void {
    this.modalConfirmacionAbierto = false;
    this.empresaRecienCreada = null;
    this.localesRecienCreados = [];
  }

  irADetalleDesdeConfirmacion(): void {
    if (!this.empresaRecienCreada) return;
    const id = this.empresaRecienCreada.id_empresa;
    this.cerrarModalConfirmacion();
    this.router.navigate(['/admin/empresas', id]);
  }
}
