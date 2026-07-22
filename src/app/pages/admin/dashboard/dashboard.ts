import { Component, AfterViewInit, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { LivelineHandle, mountLiveline, unmountLiveline } from '../../../livelinewc/liveline-wrapper';
import { Empresa as EmpresaReal, EmpresasService } from '../../../services/empresas';
import { SuscripcionesService, SuscripcionListItem } from '../../../services/suscripciones';
import { UsuariosService } from '../../../services/usuarios';
import { AnunciosService } from '../../../services/anuncios';

/**
 * `scorePromedio` es real-condicional: viene de GET /anuncios/satisfaccion/
 * por-empresa (promedio de los votos de esa empresa en la encuesta de
 * satisfacción vigente marcada `es_satisfaccion` en /admin/anuncios — ver
 * AnunciosService en el backend). `null` = sin dato — empresa inactiva, no
 * hay ninguna encuesta de satisfacción vigente, o sus usuarios todavía no
 * votaron esa encuesta en particular. Importante: NO se usa 0 como
 * sentinel de "sin dato", porque 0% es un resultado real y válido (todos
 * los usuarios de esa empresa calificaron con la peor opción de la
 * escala) — confundirlo con "sin dato" excluiría injustamente ese
 * feedback negativo del promedio global. `sector` también es real: viene
 * de `empresa.nombre_sector` (GET /empresas, JOIN con la tabla `sectores` —
 * ver services/empresas.ts y el catálogo gestionable en /admin/empresas).
 *
 * `plan` e `ingresosMes` SÍ son reales desde acá: vienen del módulo de
 * billing (GET /empresas/suscripciones — misma fuente que usa
 * /admin/suscripciones). Una empresa solo cuenta ingresos si tanto ella
 * como su suscripción están en estado 'activa'.
 *
 * "Usuarios activos"/"retirados" también son reales: GET
 * /empresas/usuarios/resumen (conteo cross-tenant por estado).
 * `usuariosActivos` (columna de la tabla de abajo) también es real, por
 * empresa: GET /empresas/usuarios/activos-por-empresa.
 *
 * "Actividad en tiempo real" también es real: GET /empresas/usuarios/
 * en-linea, basado en presencia trackeada en Redis (ver
 * app/core/presencia.py en el backend) — reemplaza el random-walk
 * viejo. Este SaaS no tiene el concepto de "entrenadores" — se sacó
 * del todo (campo, getter y texto de KPI).
 *
 * La KPI "Usuarios en la plataforma" (antes "Asesores") se sacó del todo
 * — quedaba redundante con "Usuarios activos" y "Actividad en tiempo
 * real", que ya son reales.
 */
interface Empresa {
  nombre: string;
  sector: string;
  usuariosActivos: number;
  // null = sin dato de satisfacción (ver comentario de cabecera arriba).
  scorePromedio: number | null;
  plan: string;
  estado: 'activo' | 'inactivo';
  fechaAlta: string;
  ingresosMes: number;
}

interface FilaSector {
  sector: string;
  cantidad: number;
  ingresos: number;
  scorePromedio: number | null;
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
/** No es un plan real — el valor que le ponemos a una empresa sin suscripción vigente. */
const SIN_PLAN = 'Sin plan';
/** No es un sector real del catálogo — el valor que le ponemos a una empresa sin sector asignado. */
const SIN_SECTOR = 'Sin sector';
/**
 * Paleta de colores anónima (no atada a ningún sector en particular —
 * los sectores ahora los define el admin dinámicamente en /admin/empresas,
 * así que no hay una lista fija de 5 a la que asignarles nombre). Se
 * elige una de estas 5 clases por hash del nombre del sector — ver
 * sectorStyle().
 */
const PALETA_SECTOR = ['tipo-banca', 'tipo-seguros', 'tipo-telco', 'tipo-retail', 'tipo-financiero'];

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

  /* ── Estado de filtros ── */
  busqueda = '';
  filtroSector: string | 'Todos' = 'Todos';
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
    private usuariosService: UsuariosService,
    private anunciosService: AnunciosService
  ) {
    const today = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    this.capitalizedDate = today.charAt(0).toUpperCase() + today.slice(1);
  }

  /** Real — GET /anuncios/satisfaccion/por-empresa. false = no hay ninguna
   *  encuesta de satisfacción vigente creada todavía (distinto de "hay
   *  encuesta pero nadie votó", que si trae datos pero vacíos). */
  existeEncuestaSatisfaccion = false;

  ngOnInit(): void {
    forkJoin({
      empresas: this.empresasService.listarEmpresas(),
      suscripciones: this.suscripcionesService.listarTodas(),
      usuariosActivos: this.usuariosService.obtenerUsuariosActivosPorEmpresa(),
      scoreSatisfaccion: this.anunciosService.obtenerScoreSatisfaccionPorEmpresa(),
    }).subscribe({
      next: ({ empresas, suscripciones, usuariosActivos, scoreSatisfaccion }) => {
        const suscripcionPorEmpresa = new Map(suscripciones.map((s) => [s.id_empresa, s]));
        const usuariosActivosPorEmpresa = new Map(usuariosActivos.map((u) => [u.id_empresa, u.usuarios_activos]));
        const scorePorEmpresa = new Map(scoreSatisfaccion.scores.map((s) => [s.id_empresa, s.score_promedio]));
        this.existeEncuestaSatisfaccion = scoreSatisfaccion.existe_encuesta_vigente;
        this.todasEmpresas = empresas.map((e) =>
          this.enriquecerEmpresa(
            e,
            suscripcionPorEmpresa.get(e.id_empresa),
            usuariosActivosPorEmpresa.get(e.id_empresa) ?? 0,
            scorePorEmpresa.get(e.id_empresa) ?? null
          )
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

  private enriquecerEmpresa(
    empresa: EmpresaReal,
    suscripcion?: SuscripcionListItem,
    usuariosActivos = 0,
    scoreSatisfaccion: number | null = null
  ): Empresa {
    const activa = empresa.estado === 'activa';
    const facturando = activa && suscripcion?.estado === 'activa';
    return {
      nombre: empresa.nombre,
      sector: empresa.nombre_sector ?? SIN_SECTOR,
      usuariosActivos,
      scorePromedio: activa ? scoreSatisfaccion : null,
      plan: suscripcion?.plan ?? SIN_PLAN,
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
  /** null = ninguna empresa tiene dato de satisfacción todavía. */
  get scoreGlobal(): number | null {
    const conScore = this.todasEmpresas.filter((e): e is Empresa & { scorePromedio: number } => e.scorePromedio !== null);
    if (conScore.length === 0) return null;
    return Math.round(conScore.reduce((a, e) => a + e.scorePromedio, 0) / conScore.length);
  }
  /** Texto de la KPI "Score global de satisfacción" — distingue "no hay
   *  encuesta creada" de "hay encuesta pero nadie votó todavía". */
  get scoreGlobalTexto(): string {
    if (!this.existeEncuestaSatisfaccion) return 'Sin encuestas creadas';
    const score = this.scoreGlobal;
    return score === null ? 'Sin votos aún' : `${score}%`;
  }
  /** Cuántas empresas entran en el promedio de scoreGlobal (para el texto de tendencia). */
  get empresasConScore(): number {
    return this.todasEmpresas.filter((e) => e.scorePromedio !== null).length;
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
    return this.todasEmpresas.filter(
      (e) => e.estado === 'inactivo' || (e.scorePromedio !== null && e.scorePromedio < 70)
    );
  }

  /* ── Distribución por sector (real, empresa.nombre_sector) ── */
  get distribucionPorSector(): FilaSector[] {
    const sectores = Array.from(new Set(this.todasEmpresas.map((e) => e.sector)));
    return sectores
      .map((sector) => {
        const grupo = this.todasEmpresas.filter((e) => e.sector === sector);
        const ingresos = grupo.reduce((a, e) => a + e.ingresosMes, 0);
        const conScore = grupo.filter((e): e is Empresa & { scorePromedio: number } => e.scorePromedio !== null);
        const scorePromedio = conScore.length > 0
          ? Math.round(conScore.reduce((a, e) => a + e.scorePromedio, 0) / conScore.length)
          : null;
        return { sector, cantidad: grupo.length, ingresos, scorePromedio };
      })
      .sort((a, b) => b.ingresos - a.ingresos);
  }
  get maxIngresoSector(): number {
    return Math.max(1, ...this.distribucionPorSector.map((f) => f.ingresos));
  }

  /** Sectores realmente presentes entre las empresas cargadas (no el
   *  catálogo completo) — para poblar el <select> del filtro. 'Sin sector'
   *  siempre al final si aparece. */
  get sectoresPresentes(): string[] {
    const nombres = Array.from(new Set(this.todasEmpresas.map((e) => e.sector)));
    return nombres.sort((a, b) => {
      if (a === SIN_SECTOR) return 1;
      if (b === SIN_SECTOR) return -1;
      return a.localeCompare(b);
    });
  }

  /**
   * KPI "Planes contratados": cuántos planes REALES distintos tienen
   * contratados las empresas activas — a propósito NO usa
   * distribucionPorPlan.length de abajo, porque ese incluye "Sin plan"
   * (no es un plan, es la ausencia de uno) y no filtra por activas pese
   * a que el texto de la card decía "entre las empresas activas".
   */
  get planesDistintosActivos(): number {
    const planes = this.todasEmpresas
      .filter((e) => e.estado === 'activo' && e.plan !== SIN_PLAN)
      .map((e) => e.plan);
    return new Set(planes).size;
  }

  /* ── Distribución por plan contratado (incluye "Sin plan" a propósito, para ver cobertura) ── */
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
      .filter((e): e is Empresa & { scorePromedio: number } => e.scorePromedio !== null)
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
      if (this.filtroSector !== 'Todos' && e.sector !== this.filtroSector) return false;
      if (this.fechaDesde && e.fechaAlta < this.fechaDesde) return false;
      if (this.fechaHasta && e.fechaAlta > this.fechaHasta) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroSector !== 'Todos' || this.fechaDesde || this.fechaHasta);
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroSector = 'Todos';
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
  sectorAbrev(sector: string): string {
    return sector.slice(0, 3).toUpperCase();
  }

  /** Color determinístico por nombre de sector (mismo string → mismo
   *  color siempre) — no hay una lista fija de sectores a la que
   *  mapear colores 1 a 1, así que se elige por hash módulo paleta. */
  sectorStyle(sector: string): string {
    if (sector === SIN_SECTOR) return 'tipo-sin-sector';
    let hash = 0;
    for (let i = 0; i < sector.length; i++) {
      hash = (hash * 31 + sector.charCodeAt(i)) >>> 0;
    }
    return PALETA_SECTOR[hash % PALETA_SECTOR.length];
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
