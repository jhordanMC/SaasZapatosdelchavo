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
  errorDescuento = signal<string | null>(null);
  errorTablaDescuento = signal<{ id: string, msg: string } | null>(null);

  busqueda = '';
  filtroEstado: EstadoSuscripcion | 'Todos' = 'Todos';

  private timerErrorDescuento: any;
  mostrarErrorDescuento(msg: string) {
    this.errorDescuento.set(msg);
    clearTimeout(this.timerErrorDescuento);
    this.timerErrorDescuento = setTimeout(() => this.errorDescuento.set(null), 4000);
  }

  private timerErrorTabla: any;
  mostrarErrorTabla(idDescuento: string, msg: string) {
    this.errorTablaDescuento.set({ id: idDescuento, msg });
    clearTimeout(this.timerErrorTabla);
    this.timerErrorTabla = setTimeout(() => this.errorTablaDescuento.set(null), 4000);
  }

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
    this.caracteristicaEditandoId = null;
    this.nuevaCaracteristica = { texto: '', esPositiva: true };
    this.nuevoDescuento = this.formularioDescuentoVacio();
    this.error.set(null);
    this.errorDescuento.set(null);
    this.errorTablaDescuento.set(null);
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
    this.error.set(null);
    this.errorDescuento.set(null);
    this.errorTablaDescuento.set(null);
    this.modalPlanAbierto = true;
    this.cargarCaracteristicas(plan.id_plan);
    this.cargarDescuentos(plan.id_plan);
  }

  cerrarModalPlan(): void {
    this.modalPlanAbierto = false;
    this.planEditando = null;
    this.error.set(null);
    this.errorDescuento.set(null);
    this.errorTablaDescuento.set(null);
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
        this.caracteristicas.set(items.sort((a, b) => (a.es_positiva === b.es_positiva ? 0 : a.es_positiva ? -1 : 1)));
        this.cargandoCaracteristicas.set(false);
      },
      error: () => this.cargandoCaracteristicas.set(false),
    });
  }

  caracteristicaEditandoId: string | null = null;

  prepararEdicionCaracteristica(item: CaracteristicaPlan): void {
    this.caracteristicaEditandoId = item.id_caracteristica;
    this.nuevaCaracteristica = { texto: item.texto, esPositiva: item.es_positiva };
  }

  cancelarEdicionCaracteristica(): void {
    this.caracteristicaEditandoId = null;
    this.nuevaCaracteristica = { texto: '', esPositiva: true };
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
    
    if (this.caracteristicaEditandoId) {
      this.suscripcionesService.actualizarCaracteristica(idPlan, this.caracteristicaEditandoId, { texto: datos.texto, es_positiva: datos.es_positiva }).subscribe({
        next: (actualizada) => {
          this.guardandoCaracteristica = false;
          this.caracteristicas.set(
            this.caracteristicas()
              .map((c) => (c.id_caracteristica === actualizada.id_caracteristica ? actualizada : c))
              .sort((a, b) => (a.es_positiva === b.es_positiva ? 0 : a.es_positiva ? -1 : 1))
          );
          this.cancelarEdicionCaracteristica();
        },
        error: () => {
          this.guardandoCaracteristica = false;
          this.error.set('No se pudo actualizar la característica.');
        }
      });
    } else {
      this.suscripcionesService.crearCaracteristica(idPlan, datos).subscribe({
        next: (creada) => {
          this.guardandoCaracteristica = false;
          this.caracteristicas.set([...this.caracteristicas(), creada].sort((a, b) => (a.es_positiva === b.es_positiva ? 0 : a.es_positiva ? -1 : 1)));
          this.nuevaCaracteristica = { texto: '', esPositiva: true };
        },
        error: () => {
          this.guardandoCaracteristica = false;
          this.error.set('No se pudo agregar la característica.');
        },
      });
    }
  }

  eliminandoCaracteristicaId: string | number | null = null;

  eliminarCaracteristica(item: CaracteristicaPlan): void {
    if (!this.planEditando || this.eliminandoCaracteristicaId !== null) return;
    const idPlan = this.planEditando.id_plan;
    this.eliminandoCaracteristicaId = item.id_caracteristica;
    this.suscripcionesService.eliminarCaracteristica(idPlan, item.id_caracteristica).subscribe({
      next: () => {
        this.caracteristicas.set(this.caracteristicas().filter((c) => c.id_caracteristica !== item.id_caracteristica));
        this.eliminandoCaracteristicaId = null;
      },
      error: () => {
        this.error.set('No se pudo eliminar la característica.');
        this.eliminandoCaracteristicaId = null;
      },
    });
  }

  // ── Descuentos temporales del plan que se está editando ──
  descuentos = signal<DescuentoPlan[]>([]);
  cargandoDescuentos = signal(false);
  guardandoDescuento = false;
  nuevoDescuento: NuevoDescuentoForm = this.formularioDescuentoVacio();

  descuentoEditandoId: string | null = null;
  eliminandoDescuentoId: string | null = null;

  private formularioDescuentoVacio(): NuevoDescuentoForm {
    return { etiqueta: '', tipo: 'porcentaje', valor: 0, fechaInicio: hoyISO(), fechaFin: '' };
  }

  prepararEdicionDescuento(item: DescuentoPlan): void {
    this.descuentoEditandoId = item.id_descuento;
    this.nuevoDescuento = {
      etiqueta: item.etiqueta,
      tipo: item.tipo,
      valor: item.valor,
      fechaInicio: item.fecha_inicio.slice(0, 10),
      fechaFin: item.fecha_fin ? item.fecha_fin.slice(0, 10) : ''
    };
  }

  cancelarEdicionDescuento(): void {
    this.descuentoEditandoId = null;
    this.nuevoDescuento = this.formularioDescuentoVacio();
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
    
    const descuentoExistente = this.descuentoEditandoId ? this.descuentos().find(x => x.id_descuento === this.descuentoEditandoId) : null;
    const esActivo = descuentoExistente ? descuentoExistente.esta_activo : true; // Nuevo nace activo
    
    const nuevaInicio = this.nuevoDescuento.fechaInicio;
    const esInfinito1 = !this.nuevoDescuento.fechaFin;
    const nuevaFin = this.nuevoDescuento.fechaFin || '9999-12-31';
    
    if (!esInfinito1 && nuevaFin < nuevaInicio) {
      this.mostrarErrorDescuento('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    
    if (esActivo) {
      const solapado = this.descuentos().find(d => {
        if (!d.esta_activo) return false;
        if (this.descuentoEditandoId && d.id_descuento === this.descuentoEditandoId) return false;
        const esInfinito2 = !d.fecha_fin;
        
        if (esInfinito1 !== esInfinito2) return false;
        if (esInfinito1 && esInfinito2) return true;
        
        const dInicio = d.fecha_inicio.slice(0, 10);
        const dFin = d.fecha_fin!.slice(0, 10);
        return (nuevaInicio <= dFin) && (dInicio <= nuevaFin);
      });
      
      if (solapado) {
        if (esInfinito1 && !solapado.fecha_fin) {
          this.mostrarErrorDescuento(`Ya existe un descuento sin fecha fin ('${solapado.etiqueta}'). Solo puede haber uno.`);
        } else {
          this.mostrarErrorDescuento(`Las fechas chocan con el descuento existente: '${solapado.etiqueta}'.`);
        }
        return;
      }
    }

    const datos: DescuentoPlanInput = {
      etiqueta: this.nuevoDescuento.etiqueta.trim(),
      tipo: this.nuevoDescuento.tipo,
      valor: this.nuevoDescuento.valor,
      fecha_inicio: this.nuevoDescuento.fechaInicio,
      fecha_fin: this.nuevoDescuento.fechaFin || null,
      esta_activo: true,
    };
    this.guardandoDescuento = true;
    
    if (this.descuentoEditandoId) {
      this.suscripcionesService.actualizarDescuento(idPlan, this.descuentoEditandoId, {
        etiqueta: datos.etiqueta,
        tipo: datos.tipo,
        valor: datos.valor,
        fecha_inicio: datos.fecha_inicio,
        fecha_fin: datos.fecha_fin
      }).subscribe({
        next: (actualizado) => {
          this.errorDescuento.set(null);
          this.errorTablaDescuento.set(null);
          this.guardandoDescuento = false;
          this.descuentos.set(this.descuentos().map(d => d.id_descuento === actualizado.id_descuento ? actualizado : d));
          this.cancelarEdicionDescuento();
        },
        error: (err) => {
          this.guardandoDescuento = false;
          const msg = err.error?.detail || 'No se pudo actualizar el descuento.';
          this.mostrarErrorDescuento(msg);
        }
      });
    } else {
      this.suscripcionesService.crearDescuento(idPlan, datos).subscribe({
        next: (creado) => {
          this.errorDescuento.set(null);
          this.errorTablaDescuento.set(null);
          this.guardandoDescuento = false;
          this.descuentos.set([creado, ...this.descuentos()]);
          this.nuevoDescuento = this.formularioDescuentoVacio();
        },
        error: (err) => {
          this.guardandoDescuento = false;
          const msg = err.error?.detail || 'No se pudo registrar el descuento (revisa las fechas).';
          this.mostrarErrorDescuento(msg);
        },
      });
    }
  }

  cambiandoEstadoId: string | null = null;

  cambiarEstadoDescuento(item: DescuentoPlan, estaActivo: boolean): void {
    if (!this.planEditando || this.cambiandoEstadoId !== null) return;
    const idPlan = this.planEditando.id_plan;
    
    if (estaActivo) {
      const nuevaInicio = item.fecha_inicio.slice(0, 10);
      const esInfinito1 = !item.fecha_fin;
      const nuevaFin = item.fecha_fin ? item.fecha_fin.slice(0, 10) : '9999-12-31';

      const solapado = this.descuentos().find(d => {
        if (!d.esta_activo || d.id_descuento === item.id_descuento) return false;
        
        const esInfinito2 = !d.fecha_fin;
        if (esInfinito1 !== esInfinito2) return false;
        if (esInfinito1 && esInfinito2) return true;
        
        const dInicio = d.fecha_inicio.slice(0, 10);
        const dFin = d.fecha_fin!.slice(0, 10);
        return (nuevaInicio <= dFin) && (dInicio <= nuevaFin);
      });
      
      if (solapado) {
        // Al clonar el objeto y actualizar el array, obligamos a Angular a repintar 
        // toda la fila y el <select> nativo vuelve a sincronizarse con 'false'.
        const itemRevertido = { ...item, esta_activo: false };
        this.descuentos.set(this.descuentos().map(d => d.id_descuento === item.id_descuento ? itemRevertido : d));
        
        if (esInfinito1 && !solapado.fecha_fin) {
          this.mostrarErrorTabla(item.id_descuento, `No se puede activar: Ya hay un descuento sin fecha fin activo ('${solapado.etiqueta}').`);
        } else {
          this.mostrarErrorTabla(item.id_descuento, `No se puede activar: Las fechas chocan con el descuento activo '${solapado.etiqueta}'.`);
        }
        return;
      }
    }
    
    this.cambiandoEstadoId = item.id_descuento;
    
    this.suscripcionesService.actualizarDescuento(idPlan, item.id_descuento, { esta_activo: estaActivo }).subscribe({
      next: (actualizado) => {
        this.errorTablaDescuento.set(null);
        this.descuentos.set(this.descuentos().map((d) => (d.id_descuento === actualizado.id_descuento ? actualizado : d)));
        this.cambiandoEstadoId = null;
      },
      error: () => {
        this.cambiandoEstadoId = null;
        this.mostrarErrorTabla(item.id_descuento, 'No se pudo cambiar el estado del descuento.');
        
        const itemRevertido = { ...item, esta_activo: !estaActivo };
        this.descuentos.set(this.descuentos().map((d) => (d.id_descuento === item.id_descuento ? itemRevertido : d)));
      },
    });
  }


  eliminarDescuento(item: DescuentoPlan): void {
    if (!this.planEditando || this.eliminandoDescuentoId !== null) return;
    const idPlan = this.planEditando.id_plan;
    this.eliminandoDescuentoId = item.id_descuento;
    this.suscripcionesService.eliminarDescuento(idPlan, item.id_descuento).subscribe({
      next: () => {
        this.errorTablaDescuento.set(null);
        this.descuentos.set(this.descuentos().filter((d) => d.id_descuento !== item.id_descuento));
        this.eliminandoDescuentoId = null;
      },
      error: () => {
        this.mostrarErrorTabla(item.id_descuento, 'No se pudo eliminar el descuento.');
        this.eliminandoDescuentoId = null;
      },
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