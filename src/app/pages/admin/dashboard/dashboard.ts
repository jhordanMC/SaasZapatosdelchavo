import { Component, AfterViewInit, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { LivelineHandle, mountLiveline, unmountLiveline } from '../../../livelinewc/liveline-wrapper';
import { Empresa as EmpresaReal, EmpresasService } from '../../../services/empresas';
import { SuscripcionesService, SuscripcionListItem } from '../../../services/suscripciones';
import { UsuariosService } from '../../../services/usuarios';

/**
 * Tipo/score/asesores NO existen en el backend real (la tabla `empresas`
 * solo tiene nombre/slug/estado/creado_en — ver services/empresas.ts) —
 * son datos de negocio que llegarán con los módulos de sectores/
 * satisfacción, todavía no construidos. Mientras tanto se generan de
 * forma ESTÁTICA (determinística por índice, no aleatoria en cada
 * render) a partir de la empresa real.
 *
 * `plan` e `ingresosMes` SÍ son reales desde acá: vienen del módulo de
 * billing (GET /empresas/suscripciones — misma fuente que usa
 * /admin/suscripciones). Una empresa solo cuenta ingresos si tanto ella
 * como su suscripción están en estado 'activa'.
 *
 * "Usuarios activos"/"retirados" también son reales: GET
 * /empresas/usuarios/resumen (conteo cross-tenant por estado). Distinto
 * de "Usuarios en la plataforma" (antes "Asesores"), que sigue fake.
 *
 * "Actividad en tiempo real" también es real: GET /empresas/usuarios/
 * en-linea, basado en presencia trackeada en Redis (ver
 * app/core/presencia.py en el backend) — reemplaza el random-walk
 * viejo. Este SaaS no tiene el concepto de "entrenadores" — se sacó
 * del todo (campo, getter y texto de KPI).
 */
type TipoEmpresa = 'Banca' | 'Seguros' | 'Telecomunicaciones' | 'Retail' | 'Financiero';

interface Empresa {
  nombre: string;
  tipo: TipoEmpresa;
  asesores: number;
  scorePromedio: number;
  plan: string;
  estado: 'activo' | 'inactivo';
  fechaAlta: string;
  ingresosMes: number;
}

interface FilaTipo {
  tipo: TipoEmpresa;
  cantidad: number;
  ingresos: number;
  scorePromedio: number;
}

interface FilaPlan {
  plan: string;
  cantidad: number;
  ingresos: number;
  pct: number;
}

interface PuntoMes {
  etiqueta: string;
  altas: number;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TIPOS_ESTATICOS: TipoEmpresa[] = ['Banca', 'Seguros', 'Telecomunicaciones', 'Retail', 'Financiero'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardAdminComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('liveChartHost', { static: true }) liveChartHost!: ElementRef<HTMLDivElement>;

  showLogoFallback = false;
  showTip: string | null = null;

  /** Empresas reales (GET /empresas), enriquecidas con los campos
   *  estáticos de negocio que el backend aún no tiene — ver nota arriba. */
  todasEmpresas: Empresa[] = [];

  tipos: TipoEmpresa[] = TIPOS_ESTATICOS;

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

  constructor(
    private empresasService: EmpresasService,
    private suscripcionesService: SuscripcionesService,
    private usuariosService: UsuariosService
  ) {
    const today = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    this.capitalizedDate = today.charAt(0).toUpperCase() + today.slice(1);
  }

  ngOnInit(): void {
    forkJoin({
      empresas: this.empresasService.listarEmpresas(),
      suscripciones: this.suscripcionesService.listarTodas(),
    }).subscribe({
      next: ({ empresas, suscripciones }) => {
        const suscripcionPorEmpresa = new Map(suscripciones.map((s) => [s.id_empresa, s]));
        this.todasEmpresas = empresas.map((e, i) =>
          this.enriquecerEmpresa(e, i, suscripcionPorEmpresa.get(e.id_empresa))
        );
      },
      error: () => {
        this.todasEmpresas = [];
      },
    });

    this.usuariosService.obtenerResumenUsuarios().subscribe({
      next: (resumen) => {
        this.usuariosActivosReal = resumen.activos;
        this.usuariosRetiradosReal = resumen.inactivos + resumen.suspendidos;
      },
      error: () => {
        this.usuariosActivosReal = 0;
        this.usuariosRetiradosReal = 0;
      },
    });
  }

  private enriquecerEmpresa(empresa: EmpresaReal, index: number, suscripcion?: SuscripcionListItem): Empresa {
    const activa = empresa.estado === 'activa';
    const facturando = activa && suscripcion?.estado === 'activa';
    return {
      nombre: empresa.nombre,
      tipo: TIPOS_ESTATICOS[index % TIPOS_ESTATICOS.length],
      asesores: 5 + ((index * 3) % 18),
      scorePromedio: activa ? 65 + ((index * 7) % 30) : 0,
      plan: suscripcion?.plan ?? 'Sin plan',
      estado: activa ? 'activo' : 'inactivo',
      fechaAlta: empresa.creado_en.slice(0, 10),
      ingresosMes: facturando ? Math.max(0, suscripcion!.monto_mensual - suscripcion!.descuento_monto) : 0,
    };
  }

  /** Real — GET /empresas/usuarios/resumen (conteo cross-tenant por estado). */
  usuariosActivosReal = 0;
  usuariosRetiradosReal = 0;

  private livelineHandle?: LivelineHandle;

  ngAfterViewInit(): void {
    this.livelineHandle = mountLiveline(this.liveChartHost.nativeElement);
    this.iniciarPollingEnLinea();
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
  get scoreGlobal(): number {
    const conScore = this.todasEmpresas.filter((e) => e.scorePromedio > 0);
    if (conScore.length === 0) return 0;
    return Math.round(conScore.reduce((a, e) => a + e.scorePromedio, 0) / conScore.length);
  }
  get empresasActivas(): number {
    return this.todasEmpresas.filter(e => e.estado === 'activo').length;
  }
  get ingresosTotal(): number {
    return this.todasEmpresas.reduce((a, e) => a + e.ingresosMes, 0);
  }
  get usuariosActivos(): number {
    return this.usuariosActivosReal;
  }
  get usuariosRetirados(): number {
    return this.usuariosRetiradosReal;
  }
  get empresasAltaEsteMes(): number {
    const hoy = new Date();
    return this.todasEmpresas.filter((e) => {
      const f = new Date(e.fechaAlta);
      return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    }).length;
  }
  /** Empresas en riesgo de baja: inactivas o con score de desempeño bajo. */
  get empresasEnRiesgo(): Empresa[] {
    return this.todasEmpresas.filter((e) => e.estado === 'inactivo' || (e.scorePromedio > 0 && e.scorePromedio < 70));
  }

  /* ── Distribución por sector (tipo de empresa) ── */
  get distribucionPorTipo(): FilaTipo[] {
    return this.tipos
      .map((tipo) => {
        const grupo = this.todasEmpresas.filter((e) => e.tipo === tipo);
        const ingresos = grupo.reduce((a, e) => a + e.ingresosMes, 0);
        const conScore = grupo.filter((e) => e.scorePromedio > 0);
        const scorePromedio = conScore.length > 0
          ? Math.round(conScore.reduce((a, e) => a + e.scorePromedio, 0) / conScore.length)
          : 0;
        return { tipo, cantidad: grupo.length, ingresos, scorePromedio };
      })
      .filter((f) => f.cantidad > 0)
      .sort((a, b) => b.ingresos - a.ingresos);
  }
  get maxIngresoTipo(): number {
    return Math.max(1, ...this.distribucionPorTipo.map((f) => f.ingresos));
  }

  /* ── Distribución por plan contratado ── */
  get distribucionPorPlan(): FilaPlan[] {
    const mapa = new Map<string, { cantidad: number; ingresos: number }>();
    for (const e of this.todasEmpresas) {
      const actual = mapa.get(e.plan) ?? { cantidad: 0, ingresos: 0 };
      actual.cantidad += 1;
      actual.ingresos += e.ingresosMes;
      mapa.set(e.plan, actual);
    }
    const totalIngresos = this.ingresosTotal;
    return Array.from(mapa.entries())
      .map(([plan, v]) => ({
        plan,
        cantidad: v.cantidad,
        ingresos: v.ingresos,
        pct: totalIngresos > 0 ? (v.ingresos / totalIngresos) * 100 : 0,
      }))
      .sort((a, b) => b.ingresos - a.ingresos);
  }

  /* ── Rankings de empresas ── */
  get topEmpresasPorIngreso(): Empresa[] {
    return [...this.todasEmpresas].sort((a, b) => b.ingresosMes - a.ingresosMes).slice(0, 5);
  }
  get empresasMenorScore(): Empresa[] {
    return [...this.todasEmpresas]
      .filter((e) => e.scorePromedio > 0)
      .sort((a, b) => a.scorePromedio - b.scorePromedio)
      .slice(0, 5);
  }

  /* ── Evolución de altas de empresas (últimos 6 meses) — real, basada en creado_en ── */
  get evolucionAltas(): PuntoMes[] {
    const hoy = new Date();
    const buckets = new Map<string, number>();
    const orden: string[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, 0);
      orden.push(key);
    }

    for (const e of this.todasEmpresas) {
      const f = new Date(e.fechaAlta);
      const key = `${f.getFullYear()}-${f.getMonth()}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return orden.map((key) => {
      const mesIdx = Number(key.split('-')[1]);
      return { etiqueta: MESES[mesIdx], altas: buckets.get(key) ?? 0 };
    });
  }
  get maxAltasMes(): number {
    return Math.max(1, ...this.evolucionAltas.map((p) => p.altas));
  }
  alturaBarra(valor: number, max: number): number {
    return Math.round((valor / max) * 100);
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
  fmtPEN(n: number): string {
    return n === 0 ? '—' : `S/ ${n.toLocaleString('es-PE')}`;
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

  /**
   * Polling cada 15s mientras el dashboard está montado (arranca en
   * ngAfterViewInit, para en ngOnDestroy — sin conexión persistente que
   * cerrar). La ventana de presencia en el backend es de 90s, así que
   * 15s da margen de sobra. Ver app/core/presencia.py.
   */
  private iniciarPollingEnLinea(): void {
    const poll = () => {
      this.usuariosService.obtenerUsuariosEnLinea().subscribe({
        next: (r) => {
          this.liveValueActual = r.en_linea;
          this.livelineHandle?.push(r.en_linea);
        },
        error: () => {
          // Silencioso: si el backend/Redis está caído, se mantiene el
          // último valor conocido en vez de mostrar un salto a 0.
        },
      });
    };
    poll();
    this.liveInterval = setInterval(poll, 15000);
  }
}
