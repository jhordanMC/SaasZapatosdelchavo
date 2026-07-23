import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
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
} from '../../../services/suscripciones';

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
  integracionesOmnicanal: boolean;
  estaActivo: boolean;
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
  cargando = signal(true);
  cargandoPlanes = signal(true);
  error = signal<string | null>(null);

  busqueda = '';
  filtroEstado: EstadoSuscripcion | 'Todos' = 'Todos';

  ngOnInit(): void {
    this.cargarPlanes();
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
      integracionesOmnicanal: false,
      estaActivo: true,
    };
  }

  abrirModalNuevoPlan(): void {
    this.planEditando = null;
    this.formPlan = this.formularioPlanVacio();
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
      integracionesOmnicanal: plan.integraciones_omnicanal,
      estaActivo: plan.esta_activo,
    };
    this.modalPlanAbierto = true;
  }

  cerrarModalPlan(): void {
    this.modalPlanAbierto = false;
    this.planEditando = null;
  }

  get planFormValido(): boolean {
    return this.formPlan.nombre.trim().length > 0 && this.formPlan.precio >= 0;
  }

  guardarPlan(): void {
    if (!this.planFormValido || this.guardandoPlan) return;
    this.guardandoPlan = true;

    if (this.planEditando) {
      const payload: PlanUpdateInput = {
        nombre: this.formPlan.nombre.trim(),
        precio: this.formPlan.precio,
        moneda: this.formPlan.moneda,
        periodo: this.formPlan.periodo,
        max_usuarios: this.formPlan.maxUsuarios,
        max_locales: this.formPlan.maxLocales,
        max_ventas_mes: this.formPlan.maxVentasMes,
        integraciones_omnicanal: this.formPlan.integracionesOmnicanal,
        esta_activo: this.formPlan.estaActivo,
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
      integraciones_omnicanal: this.formPlan.integracionesOmnicanal,
    };
    this.suscripcionesService.crearPlan(payload).subscribe({
      next: (creado) => {
        this.guardandoPlan = false;
        this.planes.set([...this.planes(), creado]);
        this.cerrarModalPlan();
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
    return { monto: 0, estado: 'pagado', fechaPago: new Date().toISOString().slice(0, 10), numeroComprobante: '' };
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
