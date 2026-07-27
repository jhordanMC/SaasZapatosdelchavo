import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, FilaRotacion, ProductoRanking } from '../../../services/dashboard';
import { FinanzasService, GastoRecurrenteRead, ResumenFinanciero } from '../../../services/finanzas';
import { InventarioService, ProductoListItem } from '../../../services/inventario';
import { TPipe } from '../../../core/t.pipe';

/** Período del filtro único del dashboard — 'personalizado' deja que el usuario elija el rango a mano. */
type PeriodoAvance = 'dia' | 'semana' | 'mes' | 'personalizado';

interface FilaGasto {
  tipo: string;
  montoMensual: number;
  pct: number;
}

/** Fila del "Top categorías" — se usa como el sustituto más cercano a "marca",
 * ya que el catálogo no tiene un campo de marca propiamente (solo categoría
 * y, a nivel de variante, modelo). */
interface FilaCategoria {
  nombre: string;
  unidades: number;
  ingresos: number;
}

@Component({
  selector: 'app-empresa-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class EmpresaDashboardComponent implements OnInit {
  /** Expuesto al template para Math.max(...) en el ancho mínimo de las barras del gráfico. */
  readonly Math = Math;

  constructor(
    public dashboardService: DashboardService,
    public finanzasService: FinanzasService,
    private inventarioService: InventarioService
  ) {}

  /** id_producto → nombre_categoria, para poder agrupar el ranking de ventas por categoría (top "marcas"). */
  private categoriaPorProducto = new Map<string, string>();

  ngOnInit(): void {
    // Solo lo que el dashboard sigue usando de verdad (nada de talla/día-semana/ingresos-mes: esas
    // secciones se quitaron, así que ya no vale la pena pedirle esos datos al backend).
    this.dashboardService.cargarResumen();
    this.dashboardService.cargarProductosSinVentas();
    this.dashboardService.cargarRotacionInventario();
    this.finanzasService.recargarTodo();

    this.inventarioService.listarProductos({}, 0, 300).subscribe((pagina) => {
      this.categoriaPorProducto.clear();
      for (const p of pagina.items) {
        this.categoriaPorProducto.set(p.id_producto, p.nombre_categoria ?? 'Sin categoría');
      }
    });

    this.cambiarPeriodo('dia');
  }

  private cargarRankingProductos(): void {
    this.dashboardService
      .obtenerRankingProductosAmpliado(300, this.avanceDesde, this.avanceHasta)
      .subscribe((lista) => this.rankingAmpliado.set(lista));
  }

  // ═══════════════════════════════════════════════════════════
  // Filtro único (día / semana / mes / personalizado)
  // ═══════════════════════════════════════════════════════════
  // Un solo control, ubicado al final del dashboard, que maneja el período
  // de "Tu avance" (arriba) y de "Salud financiera real". El estado vive acá
  // en el componente, no en el DOM, así que no importa que el control visual
  // esté más abajo en la página: los paneles de arriba reaccionan igual.
  // Reutiliza FinanzasService.obtenerResumenPeriodo(desde, hasta).

  periodoAvance: PeriodoAvance = 'dia';
  avanceDesde = this.hoyISO();
  avanceHasta = this.hoyISO();
  avanceResumen = signal<ResumenFinanciero | null>(null);
  avanceCargando = signal(false);
  avanceError = signal<string | null>(null);

  private hoyISO(): string {
    return this.formatearISO(new Date());
  }

  private formatearISO(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private lunesDeEstaSemanaISO(): string {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, ...
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diasDesdeElLunes);
    return this.formatearISO(lunes);
  }

  private primerDiaDeEsteMesISO(): string {
    const hoy = new Date();
    return this.formatearISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  cambiarPeriodo(periodo: PeriodoAvance): void {
    this.periodoAvance = periodo;
    if (periodo === 'dia') {
      this.avanceDesde = this.hoyISO();
      this.avanceHasta = this.hoyISO();
    } else if (periodo === 'semana') {
      this.avanceDesde = this.lunesDeEstaSemanaISO();
      this.avanceHasta = this.hoyISO();
    } else if (periodo === 'mes') {
      this.avanceDesde = this.primerDiaDeEsteMesISO();
      this.avanceHasta = this.hoyISO();
    }
    // 'personalizado' deja las fechas tal como estén — el usuario las edita con los inputs.
    if (periodo !== 'personalizado') {
      this.cargarAvance();
      this.cargarRankingProductos();
    }
  }

  /** Se llama al editar las fechas del filtro personalizado. */
  onFechaPersonalizadaChange(): void {
    if (!this.avanceDesde || !this.avanceHasta) return;
    if (this.avanceDesde > this.avanceHasta) return; // rango inválido: se espera a que el usuario lo corrija
    this.cargarAvance();
    this.cargarRankingProductos();
  }

  private cargarAvance(): void {
    this.avanceCargando.set(true);
    this.avanceError.set(null);
    this.finanzasService.obtenerResumenPeriodo(this.avanceDesde, this.avanceHasta).subscribe({
      next: (r) => {
        this.avanceResumen.set(r);
        this.avanceCargando.set(false);
      },
      error: () => {
        this.avanceError.set('No se pudo cargar el avance de este período.');
        this.avanceCargando.set(false);
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Tu avance — tarjetas KPI del período filtrado + 2 datos "actuales"
  // ═══════════════════════════════════════════════════════════
  // Valor de inventario y Productos en riesgo de merma son estado ACTUAL del
  // negocio (una foto de hoy), no algo que tenga sentido acumular por rango
  // de fechas — por eso salen del resumen fijo del dashboard, no del filtro.

  get valorInventario(): number {
    return this.dashboardService.resumen()?.valor_inventario_costo ?? 0;
  }

  get productosEnRiesgoMerma(): number {
    return this.dashboardService.resumen()?.productos_en_riesgo_merma ?? 0;
  }

  // ═══════════════════════════════════════════════════════════
  // Salud financiera real (venta → ganancia real), mismo período filtrado
  // ═══════════════════════════════════════════════════════════
  // Antes este cuadro usaba un resumen FIJO (siempre "mes actual") mientras
  // "Tu avance" mostraba el período que el usuario elegía — por eso los
  // números de ambos cuadros no coincidían y parecía que estaba roto. Ahora
  // los dos leen del mismo `avanceResumen`, así que siempre están de acuerdo.

  get costoMercaderiaPeriodo(): number {
    const a = this.avanceResumen();
    if (!a) return 0;
    return Math.max(0, a.ingresos_periodo - a.margen_bruto_periodo);
  }

  get margenBrutoPct(): number {
    const a = this.avanceResumen();
    if (!a || a.ingresos_periodo <= 0) return 0;
    return (a.margen_bruto_periodo / a.ingresos_periodo) * 100;
  }

  // ═══════════════════════════════════════════════════════════
  // Producto más / menos vendido, top 5 y top de categorías (gráficos)
  // ═══════════════════════════════════════════════════════════
  // "Top de marcas": el catálogo no tiene un campo de marca — se usa la
  // categoría del producto como el agrupador más cercano disponible.
  // El filtro único de abajo (día/semana/mes/personalizado) recarga este
  // ranking con ese mismo rango — ver la nota en DashboardService sobre
  // si el backend ya soporta desde/hasta en este endpoint.

  rankingAmpliado = signal<ProductoRanking[]>([]);

  get top5Productos(): ProductoRanking[] {
    return this.rankingAmpliado().slice(0, 5);
  }

  /** Menos vendidos, pero solo entre los que sí tuvieron alguna venta (0 ventas ya se muestra en "Sin ventas"). */
  get bottom5Productos(): ProductoRanking[] {
    return [...this.rankingAmpliado()]
      .filter((p) => p.unidades > 0)
      .sort((a, b) => a.unidades - b.unidades)
      .slice(0, 5);
  }

  get topCategorias(): FilaCategoria[] {
    const mapa = new Map<string, FilaCategoria>();
    for (const p of this.rankingAmpliado()) {
      const nombreCategoria = this.categoriaPorProducto.get(p.id_producto) ?? 'Sin categoría';
      const fila = mapa.get(nombreCategoria) ?? { nombre: nombreCategoria, unidades: 0, ingresos: 0 };
      fila.unidades += p.unidades;
      fila.ingresos += p.ingresos;
      mapa.set(nombreCategoria, fila);
    }
    return Array.from(mapa.values())
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 5);
  }

  get maxUnidadesTop5(): number {
    return Math.max(1, ...this.top5Productos.map((p) => p.unidades));
  }

  get maxUnidadesBottom5(): number {
    return Math.max(1, ...this.bottom5Productos.map((p) => p.unidades));
  }

  get maxIngresosCategoria(): number {
    return Math.max(1, ...this.topCategorias.map((c) => c.ingresos));
  }

  // ═══════════════════════════════════════════════════════════
  // Productos sin ventas (nota informativa)
  // ═══════════════════════════════════════════════════════════

  get productosSinVentas() {
    return this.dashboardService.productosSinVentas();
  }

  // ═══════════════════════════════════════════════════════════
  // Rotación de inventario y riesgo de merma
  // ═══════════════════════════════════════════════════════════

  get analisisRotacion(): FilaRotacion[] {
    return this.dashboardService.rotacionInventario();
  }

  get productoMayorMerma(): FilaRotacion | null {
    return this.analisisRotacion[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════
  // Gastos operativos de mayor impacto
  // ═══════════════════════════════════════════════════════════
  // Solo considera gastos RECURRENTES (alquiler, sueldos, servicios): un
  // gasto único/extraordinario no debería distorsionar la estructura de
  // costos recurrentes mes a mes.

  private mensualizarGasto(g: GastoRecurrenteRead): number {
    if (g.frecuencia === 'mensual') return g.monto;
    if (g.frecuencia === 'semanal') return g.monto * 4.33;
    return g.monto * 30; // diario
  }

  get gastosPorTipo(): FilaGasto[] {
    const mapa = new Map<string, number>();
    for (const g of this.finanzasService.gastosRecurrentes()) {
      mapa.set(g.tipo_gasto, (mapa.get(g.tipo_gasto) ?? 0) + this.mensualizarGasto(g));
    }
    const total = Array.from(mapa.values()).reduce((acc, v) => acc + v, 0);
    return Array.from(mapa.entries())
      .map(([tipo, montoMensual]) => ({ tipo, montoMensual, pct: total > 0 ? (montoMensual / total) * 100 : 0 }))
      .sort((a, b) => b.montoMensual - a.montoMensual);
  }
}
