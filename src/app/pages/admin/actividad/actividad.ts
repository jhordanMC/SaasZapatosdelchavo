import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { Empresa, EmpresasService } from '../../../services/empresas';
import { AuditoriaService, RegistroAuditoria } from '../../../services/auditoria';

@Component({
  selector: 'app-actividad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './actividad.html',
  styleUrls: ['./actividad.css'],
})
export class ActividadComponent implements OnInit {
  constructor(private auditoriaService: AuditoriaService, private empresasService: EmpresasService) {}

  readonly Math = Math;

  empresas = signal<Empresa[]>([]);
  empresaSeleccionadaId: string | null = null;

  registros = signal<RegistroAuditoria[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  accion = '';
  tablaAfectada = '';
  fechaDesde = '';
  fechaHasta = '';

  // ── Paginación numerada ────────────────────────────────
  // El backend ahora devuelve `total` (COUNT(*) apoyado en el índice
  // ix_auditorias_empresa_fecha, acotado a la empresa — no es un scan de
  // toda la tabla), así que ya no hace falta el truco de pedir
  // limit+1 para adivinar si hay página siguiente.
  readonly tamanosPagina = [10, 25, 50, 100];
  tamanoPagina = 10;
  pagina = 0;
  totalRegistros = signal(0);

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalRegistros() / this.tamanoPagina)));

  hayPaginaSiguiente = computed(() => this.pagina + 1 < this.totalPaginas());

  /** Números de página a mostrar, con "…" cuando hay demasiadas para listarlas todas. */
  paginasVisibles = computed<(number | '…')[]>(() => {
    const total = this.totalPaginas();
    const actual = this.pagina + 1; // 1-based para mostrar
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const paginas = new Set<number>([1, total, actual - 1, actual, actual + 1]);
    const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

    const resultado: (number | '…')[] = [];
    let anterior = 0;
    for (const p of ordenadas) {
      if (anterior && p - anterior > 1) resultado.push('…');
      resultado.push(p);
      anterior = p;
    }
    return resultado;
  });

  ngOnInit(): void {
    this.empresasService.listarEmpresas().subscribe({
      next: (empresas) => {
        this.empresas.set(empresas);
        if (empresas.length > 0) {
          this.empresaSeleccionadaId = empresas[0].id_empresa;
          this.cargarRegistros();
        } else {
          this.cargando.set(false);
        }
      },
      error: () => {
        this.error.set('No se pudieron cargar las empresas.');
        this.cargando.set(false);
      },
    });
  }

  /** Cualquier cambio de contexto (empresa, filtros, tamaño de página) reinicia a la página 0. */
  aplicarCambio(): void {
    this.pagina = 0;
    this.cargarRegistros();
  }

  cargarRegistros(): void {
    if (!this.empresaSeleccionadaId) return;
    this.cargando.set(true);
    this.error.set(null);
    this.auditoriaService
      .listar(this.empresaSeleccionadaId, {
        limit: this.tamanoPagina,
        offset: this.pagina * this.tamanoPagina,
        accion: this.accion.trim() || undefined,
        tabla_afectada: this.tablaAfectada.trim() || undefined,
        desde: this.fechaDesde ? `${this.fechaDesde}T00:00:00` : undefined,
        hasta: this.fechaHasta ? `${this.fechaHasta}T23:59:59` : undefined,
      })
      .subscribe({
        next: (lista) => {
          this.totalRegistros.set(lista.total);
          this.registros.set(lista.items);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar la actividad.');
          this.cargando.set(false);
        },
      });
  }

  paginaAnterior(): void {
    if (this.pagina === 0) return;
    this.pagina -= 1;
    this.cargarRegistros();
  }

  paginaSiguiente(): void {
    if (!this.hayPaginaSiguiente()) return;
    this.pagina += 1;
    this.cargarRegistros();
  }

  irAPagina(pagina: number): void {
    if (pagina === this.pagina + 1) return;
    this.pagina = pagina - 1;
    this.cargarRegistros();
  }

  get hayFiltros(): boolean {
    return !!(this.accion || this.tablaAfectada || this.fechaDesde || this.fechaHasta);
  }

  limpiarFiltros(): void {
    this.accion = '';
    this.tablaAfectada = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.aplicarCambio();
  }

  iniciales(nombre: string | null): string {
    if (!nombre) return '·';
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  fechaHora(iso: string): string {
    const fecha = new Date(iso);
    return fecha.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  detalleTexto(registro: RegistroAuditoria): string {
    return registro.detalle || 'Sin detalle registrado (evento anterior a esta función).';
  }

  // ── Modal "Ver detalle" (datos_anteriores / datos_nuevos) ──
  modalDetalleAbierto = false;
  registroViendo: RegistroAuditoria | null = null;

  abrirDetalle(registro: RegistroAuditoria): void {
    this.registroViendo = registro;
    this.modalDetalleAbierto = true;
  }

  cerrarDetalle(): void {
    this.modalDetalleAbierto = false;
    this.registroViendo = null;
  }

  formatearJson(valor: Record<string, unknown> | null): string {
    if (!valor) return '—';
    return JSON.stringify(valor, null, 2);
  }

  /** Exporta los registros de la página actual (lo único que hay cargado en memoria) a Excel. */
  exportarExcel(): void {
    const filas = this.registros().map((r) => ({
      Fecha: this.fechaHora(r.creado_en),
      Usuario: r.nombre_usuario || 'Sistema',
      Acción: r.accion,
      Detalle: this.detalleTexto(r),
      'Tabla afectada': r.tabla_afectada || '',
      'IP de origen': r.ip_origen || '',
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Actividad');
    XLSX.writeFile(libro, `actividad-pagina-${this.pagina + 1}.xlsx`);
  }

  // ── KPIs de la página actual ─────────────────────────────
  // Honestos a propósito: sin COUNT(*) en el backend (ver nota en
  // cargarRegistros) no hay forma de mostrar un total real ni una
  // comparación "vs. ayer" — mostramos lo que sí sabemos con certeza
  // sobre los registros ya cargados, y lo dejamos explícito en el label.
  totalPagina = computed(() => this.registros().length);

  usuariosDistintos = computed(() => {
    const nombres = this.registros().map((r) => r.nombre_usuario || 'Sistema');
    return new Set(nombres).size;
  });

  cambiosDeDatos = computed(
    () => this.registros().filter((r) => r.datos_anteriores || r.datos_nuevos).length,
  );

  accionesDeSeguridad = computed(
    () => this.registros().filter((r) => this.categoriaAccion(r.accion) === 'seguridad').length,
  );

  /** Serie muy simple para el mini-gráfico: cuenta de eventos repartida en tramos de la página cargada, del más antiguo al más reciente. */
  sparklinePuntos = computed(() => {
    const regs = [...this.registros()].reverse();
    const tramos = 8;
    if (regs.length === 0) return Array(tramos).fill(0);
    const porTramo = Math.max(1, Math.ceil(regs.length / tramos));
    const puntos: number[] = [];
    for (let i = 0; i < regs.length; i += porTramo) {
      puntos.push(regs.slice(i, i + porTramo).length);
    }
    return puntos;
  });

  sparklineMax = computed(() => Math.max(1, ...this.sparklinePuntos()));

  // ── Categorización visual de acciones (ícono + color del timeline) ──
  categoriaAccion(accion: string): 'seguridad' | 'crear' | 'actualizar' | 'eliminar' | 'otro' {
    const a = accion.toLowerCase();
    if (a.includes('login') || a.includes('2fa') || a.includes('password') || a.includes('sesion')) return 'seguridad';
    if (a.includes('eliminad') || a.includes('borrad')) return 'eliminar';
    if (a.includes('actualizad') || a.includes('editad') || a.includes('modificad')) return 'actualizar';
    if (a.includes('cread') || a.includes('registrad') || a.includes('alta')) return 'crear';
    return 'otro';
  }

  iconoAccion(accion: string): 'login' | 'escudo' | 'mas' | 'lapiz' | 'papelera' | 'punto' {
    const a = accion.toLowerCase();
    if (a.includes('2fa') || a.includes('password')) return 'escudo';
    if (a.includes('login') || a.includes('sesion')) return 'login';
    switch (this.categoriaAccion(accion)) {
      case 'crear': return 'mas';
      case 'actualizar': return 'lapiz';
      case 'eliminar': return 'papelera';
      default: return 'punto';
    }
  }
}
