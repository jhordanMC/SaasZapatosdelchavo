import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  empresas = signal<Empresa[]>([]);
  empresaSeleccionadaId: string | null = null;

  registros = signal<RegistroAuditoria[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  accion = '';
  tablaAfectada = '';
  fechaDesde = '';
  fechaHasta = '';

  // ── Paginación Anterior/Siguiente ────────────────────────
  // Sin conteo total: un log de auditoría crece sin parar, así que
  // calcular COUNT(*) en cada carga sería caro y poco útil (el mismo
  // patrón que usan Stripe/AWS CloudTrail para sus logs de eventos).
  // El truco para saber si hay página siguiente sin ese COUNT: pedir
  // un registro de más (limit + 1) y, si llega, hay más — se recorta
  // antes de mostrarlo.
  readonly tamanosPagina = [25, 50, 100];
  tamanoPagina = 25;
  pagina = 0;
  hayPaginaSiguiente = signal(false);

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
        limit: this.tamanoPagina + 1,
        offset: this.pagina * this.tamanoPagina,
        accion: this.accion.trim() || undefined,
        tabla_afectada: this.tablaAfectada.trim() || undefined,
        desde: this.fechaDesde ? `${this.fechaDesde}T00:00:00` : undefined,
        hasta: this.fechaHasta ? `${this.fechaHasta}T23:59:59` : undefined,
      })
      .subscribe({
        next: (registros) => {
          this.hayPaginaSiguiente.set(registros.length > this.tamanoPagina);
          this.registros.set(registros.slice(0, this.tamanoPagina));
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
}
