import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Empresa,
  EmpresasService,
  Local,
  LocalInput,
  Sector,
  SectorCreateInput,
  SectorUpdateInput,
} from '../../../services/empresas';

type TabEmpresas = 'empresas' | 'sectores';

interface NuevaEmpresaForm {
  nombre: string;
  locales: number;
  idSector: string | null;
}

interface SectorForm {
  nombre: string;
  estaActivo: boolean;
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

  tabActiva: TabEmpresas = 'empresas';

  ngOnInit(): void {
    this.cargarEmpresas();
    this.cargarSectores();
  }

  cambiarTab(tab: TabEmpresas): void {
    this.tabActiva = tab;
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
  nuevaEmpresa: NuevaEmpresaForm = { nombre: '', locales: 1, idSector: null };
  modalLogoError = false;
  guardando = false;

  // ── Sectores (catálogo global) ──────────────────────────
  sectores = signal<Sector[]>([]);
  cargandoSectores = signal(true);

  private cargarSectores(): void {
    this.cargandoSectores.set(true);
    this.empresasService.listarSectores(true).subscribe({
      next: (sectores) => {
        this.sectores.set(sectores);
        this.cargandoSectores.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de sectores.');
        this.cargandoSectores.set(false);
      },
    });
  }

  /** Solo los activos — para el desplegable de "Nueva empresa". */
  get sectoresActivos(): Sector[] {
    return this.sectores().filter((s) => s.esta_activo);
  }

  modalSectorAbierto = false;
  formSector: SectorForm = this.formularioSectorVacio();
  guardandoSector = false;
  sectorEditando: Sector | null = null;

  private formularioSectorVacio(): SectorForm {
    return { nombre: '', estaActivo: true };
  }

  abrirModalNuevoSector(): void {
    this.sectorEditando = null;
    this.formSector = this.formularioSectorVacio();
    this.modalSectorAbierto = true;
  }

  abrirModalEditarSector(sector: Sector): void {
    this.sectorEditando = sector;
    this.formSector = { nombre: sector.nombre, estaActivo: sector.esta_activo };
    this.modalSectorAbierto = true;
  }

  cerrarModalSector(): void {
    this.modalSectorAbierto = false;
    this.sectorEditando = null;
  }

  get sectorFormValido(): boolean {
    return this.formSector.nombre.trim().length > 0;
  }

  guardarSector(): void {
    if (!this.sectorFormValido || this.guardandoSector) return;
    this.guardandoSector = true;

    if (this.sectorEditando) {
      const payload: SectorUpdateInput = {
        nombre: this.formSector.nombre.trim(),
        esta_activo: this.formSector.estaActivo,
      };
      const idSector = this.sectorEditando.id_sector;
      this.empresasService.actualizarSector(idSector, payload).subscribe({
        next: (actualizado) => {
          this.guardandoSector = false;
          this.sectores.set(this.sectores().map((s) => (s.id_sector === idSector ? actualizado : s)));
          this.cerrarModalSector();
        },
        error: (err) => {
          this.guardandoSector = false;
          this.error.set(err.status === 409 ? 'Ya existe un sector con ese nombre.' : 'No se pudo actualizar el sector.');
        },
      });
      return;
    }

    const payload: SectorCreateInput = { nombre: this.formSector.nombre.trim() };
    this.empresasService.crearSector(payload).subscribe({
      next: (creado) => {
        this.guardandoSector = false;
        this.sectores.set([...this.sectores(), creado]);
        this.cerrarModalSector();
      },
      error: (err) => {
        this.guardandoSector = false;
        this.error.set(err.status === 409 ? 'Ya existe un sector con ese nombre.' : 'No se pudo crear el sector.');
      },
    });
  }

  toggleActivoSector(sector: Sector): void {
    this.empresasService.actualizarSector(sector.id_sector, { esta_activo: !sector.esta_activo }).subscribe({
      next: (actualizado) => {
        this.sectores.set(this.sectores().map((s) => (s.id_sector === sector.id_sector ? actualizado : s)));
      },
      error: () => this.error.set('No se pudo cambiar el estado del sector.'),
    });
  }

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
    this.nuevaEmpresa = { nombre: '', locales: 1, idSector: null };
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
    this.empresasService.crearEmpresa(this.nuevaEmpresa.nombre.trim(), this.nuevaEmpresa.idSector).subscribe({
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
