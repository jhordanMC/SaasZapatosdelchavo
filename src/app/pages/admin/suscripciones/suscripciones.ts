import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CaracteristicaPlan,
  CaracteristicaPlanInput,
  DescuentoPlan,
  DescuentoPlanInput,
  EstadoPago,
  EstadoSuscripcion,
  Pago,
  PeriodoPlan,
  Plan,
  PlanCreateInput,
  PlanUpdateInput,
  SuscripcionesService,
  SuscripcionListItem,
  SuscripcionUpdateInput,
  TipoDescuento,
  TipoPlanRead,
} from '../../../services/suscripciones';
import { hoyISO } from '../../../core/fecha-negocio';

type TabSuscripciones = 'planes' | 'suscripciones';

interface EditarSuscripcionForm {
  idPlan: string;
  estado: EstadoSuscripcion;
  montoMensual: number;
  descuentoMonto: number;
  fechaVencimiento: string;
}

interface NuevoPagoForm {
  monto: number;
  estado: EstadoPago;
  fechaPago: string;
  numeroComprobante: string;
}

interface PlanForm {
  nombre: string;
  precio: number;
  moneda: string;
  periodo: PeriodoPlan;
  maxUsuarios: number | null;
  maxLocales: number | null;
  maxVentasMes: number | null;
  estaActivo: boolean;
  descripcion: string;
  tipoPlan: string;
  esAMedida: boolean;
  esDestacado: boolean;
  ordenVisual: number;
}

interface NuevaCaracteristicaForm {
  texto: string;
  esPositiva: boolean;
}

interface NuevoDescuentoForm {
  etiqueta: string;
  tipo: TipoDescuento;
  valor: number;
  fechaInicio: string;
  fechaFin: string;
}

@Component({
  selector: 'app-suscripciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suscripciones.html',
  styleUrl: './suscripciones.css',
})
export class Suscripciones implements OnInit {
  constructor(private suscripcionesService: SuscripcionesService) {}

  tabActiva: TabSuscripciones = 'planes';
  modalLogoError = false;

  suscripciones = signal<SuscripcionListItem[]>([]);
  planes = signal<Plan[]>([]);
  planesOrdenados = computed(() => {
    return [...this.planes()].sort((a, b) => a.orden_visual - b.orden_visual);
  });
  tiposPlan = signal<TipoPlanRead[]>([]);

  modalTiposAbierto = false;
  tipoPlanEditando: string | null = null;
  formTipoPlanNombre = '';

  cargando = signal(true);
  cargandoPlanes = signal(true);
  error = signal<string | null>(null);

  busqueda = '';
  filtroEstado: EstadoSuscripcion | 'Todos' = 'Todos';

  ngOnInit(): void {
    this.cargarPlanes();
    this.cargarTiposPlan();
    this.cargarSuscripciones();
  }

  cambiarTab(tab: TabSuscripciones): void {
    this.tabActiva = tab;
  }

  private cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.suscripcionesService.listarPlanes(true).subscribe({
      next: (planes) => {
        this.planes.set(planes);
        this.cargandoPlanes.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de planes.');
        this.cargandoPlanes.set(false);
      },
    });
  }

  /** Solo los vendibles — para los selects de asignar/editar suscripción. */
  get planesActivos(): Plan[] {
    return this.planes().filter((p) => p.esta_activo);
  }

  // --- Drag and Drop for ordering planes ---
  draggedIndex: number | null = null;

  onDragStart(event: DragEvent, index: number): void {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
    setTimeout(() => (event.target as HTMLElement).classList.add('dragging'), 0);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('drag-over');
  }

  onDragLeave(event: DragEvent): void {
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
  }

  onDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
    
    const targetElement = document.querySelector('.dragging');
    if (targetElement) {
      targetElement.classList.remove('dragging');
    }

    if (this.draggedIndex === null || this.draggedIndex === dropIndex) return;

    this.reordenarPlanes(this.draggedIndex, dropIndex);
    this.draggedIndex = null;
  }

  reordenarPlanes(fromIndex: number, toIndex: number): void {
    const planesActuales = [...this.planesOrdenados()];
    const item = planesActuales[fromIndex];
    
    planesActuales.splice(fromIndex, 1);
    planesActuales.splice(toIndex, 0, item);

    planesActuales.forEach((p, index) => {
      const nuevoOrden = index + 1;
      if (p.orden_visual !== nuevoOrden) {
        p.orden_visual = nuevoOrden;
        this.suscripcionesService.actualizarPlan(p.id_plan, { orden_visual: nuevoOrden }).subscribe({
          error: () => this.error.set('No se pudo guardar el nuevo orden visual de algunos planes.')
        });
      }
    });

    this.planes.set(planesActuales);
  }
  // ----------------------------------------

  private cargarSuscripciones(): void {
    this.cargando.set(true);
    this.suscripcionesService.listarTodas().subscribe({
      next: (suscripciones) => {
        this.suscripciones.set(suscripciones);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el listado de suscripciones.');
        this.cargando.set(false);
      },
    });
  }

  get suscripcionesFiltradas(): SuscripcionListItem[] {
    return this.suscripciones().filter((s) => {
      if (this.busqueda && !s.empresa.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      if (this.filtroEstado !== 'Todos' && s.estado !== this.filtroEstado) return false;
      return true;
    });
  }

  get totalSuscripciones(): number {
    return this.suscripciones().length;
  }

  get totalActivas(): number {
    return this.suscripciones().filter((s) => s.estado === 'activa').length;
  }

  get totalVencidasOCanceladas(): number {
    return this.suscripciones().filter((s) => s.estado === 'vencida' || s.estado === 'cancelada').length;
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroEstado !== 'Todos');
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroEstado = 'Todos';
  }

  vencimiento(s: SuscripcionListItem): string {
    return s.fecha_vencimiento ? s.fecha_vencimiento.slice(0, 10) : 'Sin definir';
  }

  // ════════════════════════════════════════════════════════
  // ── Pestaña "Planes" (catálogo global, independiente de empresa) ──
  // ════════════════════════════════════════════════════════
  modalPlanAbierto = false;
  formPlan: PlanForm = this.formularioPlanVacio();
  guardandoPlan = false;
  planEditando: Plan | null = null;

  private formularioPlanVacio(): PlanForm {
    return {
      nombre: '',
      precio: 0,
      moneda: 'PEN',
      periodo: 'mensual',
      maxUsuarios: null,
      maxLocales: null,
      maxVentasMes: null,
      estaActivo: true,
      descripcion: '',
      tipoPlan: '',
      esAMedida: false,
      esDestacado: false,
      ordenVisual: 0,
    };
  }

  abrirModalNuevoPlan(): void {
    this.planEditando = null;
    this.formPlan = this.formularioPlanVacio();
    this.caracteristicas.set([]);
    this.descuentos.set([]);
    this.nuevaCaracteristica = { texto: '', esPositiva: true };
    this.nuevoDescuento = this.formularioDescuentoVacio();
    this.modalPlanAbierto = true;
  }

  abrirModalEditarPlan(plan: Plan): void {
    this.planEditando = plan;
    this.formPlan = {
      nombre: plan.nombre,
      precio: plan.precio,
      moneda: plan.moneda,
      periodo: plan.periodo as PeriodoPlan,
      maxUsuarios: plan.max_usuarios,
      maxLocales: plan.max_locales,
      maxVentasMes: plan.max_ventas_mes,
      estaActivo: plan.esta_activo,
      descripcion: plan.descripcion ?? '',
      tipoPlan: plan.tipo_plan ?? '',
      esAMedida: plan.es_a_medida ?? false,
      esDestacado: plan.es_destacado,
      ordenVisual: plan.orden_visual,
    };
    this.modalPlanAbierto = true;
    this.cargarCaracteristicas(plan.id_plan);
    this.cargarDescuentos(plan.id_plan);
  }

  cerrarModalPlan(): void {
    this.modalPlanAbierto = false;
    this.planEditando = null;
    this.caracteristicas.set([]);
    this.descuentos.set([]);
  }

  get planFormValido(): boolean {
    return this.formPlan.nombre.trim().length > 0 && this.formPlan.precio >= 0 && this.formPlan.moneda.trim().length > 0;
  }

  // ── Gestión Tipos de Plan ──

  cargarTiposPlan(): void {
    this.suscripcionesService.listarTiposPlan().subscribe({
      next: (res) => this.tiposPlan.set(res),
      error: () => console.error('Error cargando tipos de plan'),
    });
  }

  abrirModalTipos(): void {
    this.modalTiposAbierto = true;
    this.formTipoPlanNombre = '';
    this.tipoPlanEditando = null;
  }

  cerrarModalTipos(): void {
    this.modalTiposAbierto = false;
  }

  crearTipoPlan(): void {
    const nombre = this.formTipoPlanNombre.trim();
    if (!nombre) return;
    this.suscripcionesService.crearTipoPlan({ nombre }).subscribe({
      next: () => {
        this.cargarTiposPlan();
        this.formTipoPlanNombre = '';
      },
      error: (err) => alert(err.error?.detail || 'Error al crear tipo de plan'),
    });
  }

  editarTipoPlan(tipo: TipoPlanRead): void {
    this.tipoPlanEditando = tipo.nombre;
    this.formTipoPlanNombre = tipo.nombre;
  }

  guardarEdicionTipoPlan(tipoViejo: string): void {
    const nuevo = this.formTipoPlanNombre.trim();
    if (!nuevo || nuevo === tipoViejo) {
      this.cancelarEdicionTipoPlan();
      return;
    }
    this.suscripcionesService.actualizarTipoPlan(tipoViejo, { nombre: nuevo }).subscribe({
      next: () => {
        this.cargarTiposPlan();
        this.cargarPlanes(); // Los nombres en los planes cambiaron
        this.tipoPlanEditando = null;
        this.formTipoPlanNombre = '';
      },
      error: (err) => alert(err.error?.detail || 'Error al actualizar tipo de plan'),
    });
  }

  cancelarEdicionTipoPlan(): void {
    this.tipoPlanEditando = null;
    this.formTipoPlanNombre = '';
  }

  eliminarTipoPlan(nombre: string): void {
    if (!confirm(`¿Eliminar el tipo de plan "${nombre}"? Los planes que lo usen quedarán sin tipo.`)) return;
    this.suscripcionesService.eliminarTipoPlan(nombre).subscribe({
      next: () => {
        this.cargarTiposPlan();
        this.cargarPlanes();
      },
      error: (err) => alert(err.error?.detail || 'Error al eliminar tipo de plan'),
    });
  }

  alCambiarEsAMedida(): void {
    if (this.formPlan.esAMedida) {
      this.formPlan.precio = 0;
      this.formPlan.periodo = 'mensual';
      this.formPlan.moneda = 'PEN';
      this.formPlan.maxUsuarios = null;
      this.formPlan.maxLocales = null;
      this.formPlan.maxVentasMes = null;
    }
  }

  guardarPlan(): void {
    if (!this.planFormValido || this.guardandoPlan) return;
    this.guardandoPlan = true;

    // Asegurarnos de limpiar datos de límites si es a medida antes de enviar
    this.alCambiarEsAMedida();

    const planesList = [...this.planesOrdenados()];
    let nuevoOrden = 1;

    if (!this.planEditando) {
      if (this.formPlan.estaActivo) {
        const lastActivo = [...planesList].reverse().find(p => p.esta_activo);
        nuevoOrden = lastActivo ? lastActivo.orden_visual + 1 : 1;
        
        const planesToShift = planesList.filter(p => p.orden_visual >= nuevoOrden);
        planesToShift.forEach(p => {
          p.orden_visual += 1;
          this.suscripcionesService.actualizarPlan(p.id_plan, { orden_visual: p.orden_visual }).subscribe({
            error: () => console.error('Error shifting plan', p.id_plan)
          });
        });
        // We update the list eagerly so the next planes.set() has them shifted
      } else {
        const lastPlan = planesList[planesList.length - 1];
        nuevoOrden = lastPlan ? lastPlan.orden_visual + 1 : 1;
      }
    }

    const camposCatalogo = {
      descripcion: this.formPlan.descripcion.trim() || null,
      tipo_plan: this.formPlan.tipoPlan.trim() || null,
      es_a_medida: this.formPlan.esAMedida,
      es_destacado: this.formPlan.esDestacado,
      orden_visual: this.planEditando ? this.formPlan.ordenVisual : nuevoOrden,
    };

    if (this.planEditando) {
      const payload: PlanUpdateInput = {
        nombre: this.formPlan.nombre.trim(),
        precio: this.formPlan.precio,
        moneda: this.formPlan.moneda,
        periodo: this.formPlan.periodo,
        max_usuarios: this.formPlan.maxUsuarios,
        max_locales: this.formPlan.maxLocales,
        max_ventas_mes: this.formPlan.maxVentasMes,
        esta_activo: this.formPlan.estaActivo,
        ...camposCatalogo,
      };
      const idPlan = this.planEditando.id_plan;
      this.suscripcionesService.actualizarPlan(idPlan, payload).subscribe({
        next: (actualizado) => {
          this.guardandoPlan = false;
          this.planes.set(this.planes().map((p) => (p.id_plan === idPlan ? actualizado : p)));
          this.cerrarModalPlan();
        },
        error: (err) => {
          this.guardandoPlan = false;
          this.error.set(err.status === 409 ? 'Ya existe un plan con ese nombre.' : 'No se pudo actualizar el plan.');
        },
      });
      return;
    }

    const payload: PlanCreateInput = {
      nombre: this.formPlan.nombre.trim(),
      precio: this.formPlan.precio,
      moneda: this.formPlan.moneda,
      periodo: this.formPlan.periodo,
      max_usuarios: this.formPlan.maxUsuarios,
      max_locales: this.formPlan.maxLocales,
      max_ventas_mes: this.formPlan.maxVentasMes,
      esta_activo: this.formPlan.estaActivo,
      ...camposCatalogo,
    };
    this.suscripcionesService.crearPlan(payload).subscribe({
      next: (creado) => {
        this.guardandoPlan = false;
        // Agregamos el creado y pasamos toda la lista modificada
        this.planes.set([...planesList, creado]);
        // El plan recién creado no tiene características/descuentos aún:
        // lo dejamos abierto en modo edición para que se puedan agregar
        // sin tener que volver a buscarlo en la tabla.
        this.planEditando = creado;
        this.cargarCaracteristicas(creado.id_plan);
        this.cargarDescuentos(creado.id_plan);
      },
      error: (err) => {
        this.guardandoPlan = false;
        this.error.set(err.status === 409 ? 'Ya existe un plan con ese nombre.' : 'No se pudo crear el plan.');
      },
    });
  }

  toggleActivoPlan(plan: Plan): void {
    this.suscripcionesService.actualizarPlan(plan.id_plan, { esta_activo: !plan.esta_activo }).subscribe({
      next: (actualizado) => {
        this.planes.set(this.planes().map((p) => (p.id_plan === plan.id_plan ? actualizado : p)));
      },
      error: () => this.error.set('No se pudo cambiar el estado del plan.'),
    });
  }

  // ── Características (bullets) del plan que se está editando ──
  caracteristicas = signal<CaracteristicaPlan[]>([]);
  cargandoCaracteristicas = signal(false);
  guardandoCaracteristica = false;
  nuevaCaracteristica: NuevaCaracteristicaForm = { texto: '', esPositiva: true };

  private cargarCaracteristicas(idPlan: string): void {
    this.cargandoCaracteristicas.set(true);
    this.suscripcionesService.listarCaracteristicas(idPlan).subscribe({
      next: (items) => {
        this.caracteristicas.set(items);
        this.cargandoCaracteristicas.set(false);
      },
      error: () => this.cargandoCaracteristicas.set(false),
    });
  }

  agregarCaracteristica(): void {
    if (!this.planEditando || !this.nuevaCaracteristica.texto.trim() || this.guardandoCaracteristica) return;
    const idPlan = this.planEditando.id_plan;
    const datos: CaracteristicaPlanInput = {
      texto: this.nuevaCaracteristica.texto.trim(),
      es_positiva: this.nuevaCaracteristica.esPositiva,
      orden: this.caracteristicas().length,
    };
    this.guardandoCaracteristica = true;
    this.suscripcionesService.crearCaracteristica(idPlan, datos).subscribe({
      next: (creada) => {
        this.guardandoCaracteristica = false;
        this.caracteristicas.set([...this.caracteristicas(), creada]);
        this.nuevaCaracteristica = { texto: '', esPositiva: true };
      },
      error: () => {
        this.guardandoCaracteristica = false;
        this.error.set('No se pudo agregar la característica.');
      },
    });
  }

  eliminarCaracteristica(item: CaracteristicaPlan): void {
    if (!this.planEditando) return;
    const idPlan = this.planEditando.id_plan;
    this.suscripcionesService.eliminarCaracteristica(idPlan, item.id_caracteristica).subscribe({
      next: () => {
        this.caracteristicas.set(this.caracteristicas().filter((c) => c.id_caracteristica !== item.id_caracteristica));
      },
      error: () => this.error.set('No se pudo eliminar la característica.'),
    });
  }

  // ── Descuentos temporales del plan que se está editando ──
  descuentos = signal<DescuentoPlan[]>([]);
  cargandoDescuentos = signal(false);
  guardandoDescuento = false;
  nuevoDescuento: NuevoDescuentoForm = this.formularioDescuentoVacio();

  private formularioDescuentoVacio(): NuevoDescuentoForm {
    return { etiqueta: '', tipo: 'porcentaje', valor: 0, fechaInicio: hoyISO(), fechaFin: '' };
  }

  private cargarDescuentos(idPlan: string): void {
    this.cargandoDescuentos.set(true);
    this.suscripcionesService.listarDescuentos(idPlan).subscribe({
      next: (items) => {
        this.descuentos.set(items);
        this.cargandoDescuentos.set(false);
      },
      error: () => this.cargandoDescuentos.set(false),
    });
  }

  get descuentoFormValido(): boolean {
    return this.nuevoDescuento.etiqueta.trim().length > 0 && this.nuevoDescuento.valor > 0 && !!this.nuevoDescuento.fechaInicio;
  }

  agregarDescuento(): void {
    if (!this.planEditando || !this.descuentoFormValido || this.guardandoDescuento) return;
    const idPlan = this.planEditando.id_plan;
    const datos: DescuentoPlanInput = {
      etiqueta: this.nuevoDescuento.etiqueta.trim(),
      tipo: this.nuevoDescuento.tipo,
      valor: this.nuevoDescuento.valor,
      fecha_inicio: this.nuevoDescuento.fechaInicio,
      fecha_fin: this.nuevoDescuento.fechaFin || null,
      esta_activo: true,
    };
    this.guardandoDescuento = true;
    this.suscripcionesService.crearDescuento(idPlan, datos).subscribe({
      next: (creado) => {
        this.guardandoDescuento = false;
        this.descuentos.set([creado, ...this.descuentos()]);
        this.nuevoDescuento = this.formularioDescuentoVacio();
      },
      error: () => {
        this.guardandoDescuento = false;
        this.error.set('No se pudo registrar el descuento (revisa las fechas).');
      },
    });
  }

  /** "Finalizar" = desactivar, sin borrar el histórico de la promoción. */
  finalizarDescuento(item: DescuentoPlan): void {
    if (!this.planEditando) return;
    const idPlan = this.planEditando.id_plan;
    this.suscripcionesService.actualizarDescuento(idPlan, item.id_descuento, { esta_activo: false }).subscribe({
      next: (actualizado) => {
        this.descuentos.set(this.descuentos().map((d) => (d.id_descuento === actualizado.id_descuento ? actualizado : d)));
      },
      error: () => this.error.set('No se pudo finalizar el descuento.'),
    });
  }

  eliminarDescuento(item: DescuentoPlan): void {
    if (!this.planEditando) return;
    const idPlan = this.planEditando.id_plan;
    this.suscripcionesService.eliminarDescuento(idPlan, item.id_descuento).subscribe({
      next: () => {
        this.descuentos.set(this.descuentos().filter((d) => d.id_descuento !== item.id_descuento));
      },
      error: () => this.error.set('No se pudo eliminar el descuento.'),
    });
  }

  // ════════════════════════════════════════════════════════
  // ── Modal "Editar suscripción" ─────────────────────────────
  // ════════════════════════════════════════════════════════
  modalEditarAbierto = false;
  editarSuscripcion: EditarSuscripcionForm = this.formularioVacio();
  guardandoEdicion = false;
  private suscripcionEditando: SuscripcionListItem | null = null;

  private formularioVacio(): EditarSuscripcionForm {
    return { idPlan: '', estado: 'trial', montoMensual: 0, descuentoMonto: 0, fechaVencimiento: '' };
  }

  abrirModalEditar(s: SuscripcionListItem): void {
    this.suscripcionEditando = s;
    this.editarSuscripcion = {
      idPlan: s.id_plan,
      estado: s.estado,
      montoMensual: s.monto_mensual,
      descuentoMonto: s.descuento_monto ?? 0,
      fechaVencimiento: s.fecha_vencimiento ? s.fecha_vencimiento.slice(0, 10) : '',
    };
    this.modalEditarAbierto = true;
  }

  cerrarModalEditar(): void {
    this.modalEditarAbierto = false;
    this.suscripcionEditando = null;
  }

  get edicionValida(): boolean {
    return !!this.editarSuscripcion.idPlan && this.editarSuscripcion.montoMensual >= 0;
  }

  guardarEdicion(): void {
    if (!this.edicionValida || !this.suscripcionEditando || this.guardandoEdicion) return;
    const idEmpresa = this.suscripcionEditando.id_empresa;

    const payload: SuscripcionUpdateInput = {
      id_plan: this.editarSuscripcion.idPlan,
      estado: this.editarSuscripcion.estado,
      precio_acordado: this.editarSuscripcion.montoMensual,
      descuento_monto: this.editarSuscripcion.descuentoMonto,
      fecha_fin: this.editarSuscripcion.fechaVencimiento || null,
    };

    this.guardandoEdicion = true;
    this.suscripcionesService.actualizarSuscripcion(idEmpresa, payload).subscribe({
      next: (actualizada) => {
        this.guardandoEdicion = false;
        this.suscripciones.set(
          this.suscripciones().map((s) =>
            s.id_empresa === idEmpresa ? { ...s, ...actualizada, empresa: s.empresa } : s
          )
        );
        this.cerrarModalEditar();
      },
      error: () => {
        this.guardandoEdicion = false;
        this.error.set('No se pudo actualizar la suscripción.');
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // ── Modal "Pagos" (historial + registrar) ──────────────────
  // ════════════════════════════════════════════════════════
  modalPagosAbierto = false;
  suscripcionPagos: SuscripcionListItem | null = null;
  pagos = signal<Pago[]>([]);
  cargandoPagos = signal(false);

  nuevoPago: NuevoPagoForm = this.formularioPagoVacio();
  guardandoPago = false;

  private formularioPagoVacio(): NuevoPagoForm {
    return { monto: 0, estado: 'pagado', fechaPago: hoyISO(), numeroComprobante: '' };
  }

  abrirModalPagos(s: SuscripcionListItem): void {
    this.suscripcionPagos = s;
    this.nuevoPago = this.formularioPagoVacio();
    this.modalPagosAbierto = true;
    this.cargandoPagos.set(true);
    this.suscripcionesService.listarPagos(s.id_empresa).subscribe({
      next: (pagos) => {
        this.pagos.set(pagos);
        this.cargandoPagos.set(false);
      },
      error: () => {
        this.cargandoPagos.set(false);
      },
    });
  }

  cerrarModalPagos(): void {
    this.modalPagosAbierto = false;
    this.suscripcionPagos = null;
    this.pagos.set([]);
  }

  get pagoValido(): boolean {
    return this.nuevoPago.monto > 0 && !!this.nuevoPago.fechaPago;
  }

  registrarPago(): void {
    if (!this.pagoValido || !this.suscripcionPagos || this.guardandoPago) return;
    const idEmpresa = this.suscripcionPagos.id_empresa;

    this.guardandoPago = true;
    this.suscripcionesService
      .registrarPago(idEmpresa, {
        monto: this.nuevoPago.monto,
        estado: this.nuevoPago.estado,
        fecha_pago: this.nuevoPago.fechaPago,
        numero_comprobante: this.nuevoPago.numeroComprobante.trim() || null,
      })
      .subscribe({
        next: (pago) => {
          this.guardandoPago = false;
          this.pagos.set([pago, ...this.pagos()]);
          this.nuevoPago = this.formularioPagoVacio();
        },
        error: () => {
          this.guardandoPago = false;
          this.error.set('No se pudo registrar el pago.');
        },
      });
  }
}