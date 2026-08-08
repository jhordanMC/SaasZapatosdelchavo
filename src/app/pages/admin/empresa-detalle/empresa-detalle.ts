import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Empresa, EmpresasService, EstadoEmpresa, Local, LocalInput, LocalUpdateInput, Sector } from '../../../services/empresas';
import { PageTitleService } from '../../../shared/admin-layout/page-title';
import {
  ClaveVista,
  EstadoUsuario,
  PermisoVista,
  Rol,
  Usuario,
  UsuariosService,
  VISTAS_POR_ROL,
  mapearRol,
} from '../../../services/usuarios';
import { Plan, Suscripcion, SuscripcionCreateInput, SuscripcionesService } from '../../../services/suscripciones';
import {
  CredencialesMarketplaceInput,
  IntegracionMarketplace,
  MARKETPLACES_DISPONIBLES,
  MarketplaceIntegracionesService,
  MarketplaceProveedor,
} from '../../../services/marketplace-integraciones';

type TabDetalle = 'locales' | 'usuarios' | 'suscripcion';

interface NuevoUsuarioForm {
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  password: string;
  idRol: string;
}

interface EditarUsuarioForm {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  estado: EstadoUsuario;
  idRol: string;
}

interface EditarEmpresaForm {
  nombre: string;
  estado: EstadoEmpresa;
  idSector: string | null;
}

interface EditarLocalForm {
  nombre: string;
  direccion: string;
  descripcion: string;
  esta_activo: boolean;
}

@Component({
  selector: 'app-empresa-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './empresa-detalle.html',
  styleUrls: ['./empresa-detalle.css'],
})
export class EmpresaDetalleComponent implements OnInit {
  empresa = signal<Empresa | null>(null);
  locales = signal<Local[]>([]);
  cargando = signal(true);
  noEncontrada = signal(false);
  error = signal<string | null>(null);

  private idEmpresa: string;
  tabActiva: TabDetalle = 'locales';
  // Se llena en abrirModalPermisos() según el rol REAL del usuario al que
  // se le abre el modal (VISTAS_POR_ROL) — no es fijo, dueño/vendedor/admin
  // tienen catálogos distintos.
  vistas: PermisoVista[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasService: EmpresasService,
    private usuariosService: UsuariosService,
    private suscripcionesService: SuscripcionesService,
    private marketplaceService: MarketplaceIntegracionesService,
    private pageTitleService: PageTitleService
  ) {
    this.idEmpresa = this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    if (!this.idEmpresa) {
      this.noEncontrada.set(true);
      this.cargando.set(false);
      return;
    }

    this.empresasService.obtenerEmpresa(this.idEmpresa).subscribe({
      next: (empresa) => {
        this.empresa.set(empresa);
        this.pageTitleService.setTitle(empresa.nombre);
        this.pageTitleService.setSubtitle('Locales, usuarios y suscripción');
        this.cargarLocales();
        this.cargarUsuarios();
        this.cargarRoles();
      },
      error: () => {
        this.noEncontrada.set(true);
        this.cargando.set(false);
      },
    });

    this.empresasService.listarSectores().subscribe({
      next: (sectores) => this.sectores.set(sectores),
      error: () => {
        /* si falla, el select de sector simplemente queda vacío */
      },
    });
  }

  cambiarTab(tab: TabDetalle): void {
    this.tabActiva = tab;
    if (tab === 'suscripcion') {
      if (!this.planes().length && !this.cargandoPlanes()) {
        this.cargarPlanes();
      }
      if (!this.suscripcion() && !this.cargandoSuscripcion()) {
        this.cargarSuscripcion();
      }
      // Si ambos ya estaban cacheados (no se disparó ninguna carga arriba),
      // igual hay que evaluar si toca cargar integraciones.
      this.evaluarCargaIntegraciones();
    }
  }

  /** Plan completo (con sus beneficios) de la suscripción vigente — cruza suscripcion() + planes(). */
  planAsignado(): Plan | null {
    const idPlan = this.suscripcion()?.id_plan;
    if (!idPlan) return null;
    return this.planes().find((p) => p.id_plan === idPlan) ?? null;
  }

  volver(): void {
    this.router.navigate(['/admin/empresas']);
  }

  iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  // ── Modal "Editar empresa" (nombre / estado / sector) ───
  modalEditarEmpresaAbierto = false;
  formEmpresa: EditarEmpresaForm = { nombre: '', estado: 'activa', idSector: null };
  guardandoEmpresa = false;
  sectores = signal<Sector[]>([]);

  /** Solo los activos, más el sector actual de la empresa aunque esté desactivado
   * (si no, desaparecería del select y parecería que se le quitó sin querer). */
  get sectoresParaEditar(): Sector[] {
    const idActual = this.empresa()?.id_sector;
    return this.sectores().filter((s) => s.esta_activo || s.id_sector === idActual);
  }

  abrirModalEditarEmpresa(): void {
    const actual = this.empresa();
    if (!actual) return;
    this.formEmpresa = { nombre: actual.nombre, estado: actual.estado, idSector: actual.id_sector };
    this.modalEditarEmpresaAbierto = true;
  }

  cerrarModalEditarEmpresa(): void {
    this.modalEditarEmpresaAbierto = false;
  }

  get formEmpresaValido(): boolean {
    return this.formEmpresa.nombre.trim().length > 0;
  }

  guardarEmpresa(): void {
    if (!this.formEmpresaValido || this.guardandoEmpresa) return;
    this.guardandoEmpresa = true;
    this.empresasService
      .actualizarEmpresa(this.idEmpresa, {
        nombre: this.formEmpresa.nombre.trim(),
        estado: this.formEmpresa.estado,
        id_sector: this.formEmpresa.idSector,
      })
      .subscribe({
        next: (actualizada) => {
          this.guardandoEmpresa = false;
          this.empresa.set(actualizada);
          this.pageTitleService.setTitle(actualizada.nombre);
          this.cerrarModalEditarEmpresa();
        },
        error: () => {
          this.guardandoEmpresa = false;
          this.error.set('No se pudo actualizar la empresa.');
        },
      });
  }

  // ── Desactivar / reactivar empresa (toggle rápido, sin abrir el modal
  // completo de edición) ──────────────────────────────────
  cambiandoEstadoEmpresa = signal(false);

  toggleActivaEmpresa(): void {
    const actual = this.empresa();
    if (!actual || this.cambiandoEstadoEmpresa()) return;
    const nuevoEstado: EstadoEmpresa = actual.estado === 'activa' ? 'suspendida' : 'activa';

    this.cambiandoEstadoEmpresa.set(true);
    this.empresasService.actualizarEmpresa(this.idEmpresa, { estado: nuevoEstado }).subscribe({
      next: (actualizada) => {
        this.cambiandoEstadoEmpresa.set(false);
        this.empresa.set(actualizada);
      },
      error: () => {
        this.cambiandoEstadoEmpresa.set(false);
        this.error.set('No se pudo cambiar el estado de la empresa.');
      },
    });
  }

  // ── Modal "Eliminar empresa" (PERMANENTE, cascada, irreversible) ──
  // Requiere escribir el slug exacto para habilitar el botón — mismo
  // criterio que usan GitHub/otros paneles para borrados destructivos de
  // alto impacto (acá se lleva usuarios, ventas, comprobantes, todo).
  modalEliminarEmpresaAbierto = false;
  confirmacionEliminarEmpresa = '';
  // Pantalla de carga a pantalla completa: la cascada + limpieza de
  // imágenes puede tardar, y no queremos que el staff piense que no hizo
  // nada y reintente el borrado mientras la transacción sigue corriendo.
  eliminandoEmpresaEnCurso = signal(false);

  abrirModalEliminarEmpresa(): void {
    this.confirmacionEliminarEmpresa = '';
    this.modalEliminarEmpresaAbierto = true;
  }

  cerrarModalEliminarEmpresa(): void {
    if (this.eliminandoEmpresaEnCurso()) return;
    this.modalEliminarEmpresaAbierto = false;
    this.confirmacionEliminarEmpresa = '';
  }

  get confirmacionEliminarEmpresaValida(): boolean {
    return this.confirmacionEliminarEmpresa.trim() === (this.empresa()?.slug ?? '');
  }

  confirmarEliminarEmpresa(): void {
    if (!this.confirmacionEliminarEmpresaValida || this.eliminandoEmpresaEnCurso()) return;

    this.eliminandoEmpresaEnCurso.set(true);
    this.empresasService.eliminarEmpresa(this.idEmpresa).subscribe({
      next: () => {
        this.eliminandoEmpresaEnCurso.set(false);
        this.modalEliminarEmpresaAbierto = false;
        this.router.navigate(['/admin/empresas']);
      },
      error: () => {
        this.eliminandoEmpresaEnCurso.set(false);
        this.error.set('No se pudo eliminar la empresa.');
      },
    });
  }

  private cargarLocales(): void {
    this.empresasService.listarLocales(this.idEmpresa).subscribe({
      next: (locales) => {
        this.locales.set(locales);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  nombreLocal(idLocal: string | null): string {
    if (!idLocal) return 'Sin asignar';
    return this.locales().find((l) => l.id_local === idLocal)?.nombre ?? 'Sin asignar';
  }

  vendedoresDeLocal(idLocal: string): Usuario[] {
    return this.usuarios().filter((u) => u.id_local === idLocal);
  }

  // ── Modal "Nuevo local" ──────────────────────────────────
  modalNuevoLocalAbierto = false;
  nuevoLocal: LocalInput = this.formularioLocalVacio();
  guardandoLocalNuevo = false;

  private formularioLocalVacio(): LocalInput {
    return { nombre: '', direccion: '', descripcion: '' };
  }

  abrirModalNuevoLocal(): void {
    this.nuevoLocal = this.formularioLocalVacio();
    this.modalNuevoLocalAbierto = true;
  }

  cerrarModalNuevoLocal(): void {
    this.modalNuevoLocalAbierto = false;
  }

  get formularioLocalValido(): boolean {
    return this.nuevoLocal.nombre.trim().length > 0;
  }

  crearLocalNuevo(): void {
    if (!this.formularioLocalValido || this.guardandoLocalNuevo) return;
    this.guardandoLocalNuevo = true;
    this.empresasService.crearLocal(this.idEmpresa, this.nuevoLocal).subscribe({
      next: (local) => {
        this.guardandoLocalNuevo = false;
        this.locales.set([...this.locales(), local]);
        this.cerrarModalNuevoLocal();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoLocalNuevo = false;
        this.error.set(err.status === 400 ? 'Ya existe un local con ese nombre.' : 'No se pudo crear el local.');
      },
    });
  }

  // ── Modal "Editar local" ─────────────────────────────────
  modalEditarLocalAbierto = false;
  editarLocal: EditarLocalForm = this.formularioEdicionLocalVacio();
  guardandoLocalEdicion = false;
  private localEditandoId: string | null = null;

  private formularioEdicionLocalVacio(): EditarLocalForm {
    return { nombre: '', direccion: '', descripcion: '', esta_activo: true };
  }

  abrirModalEditarLocal(local: Local): void {
    this.localEditandoId = local.id_local;
    this.editarLocal = {
      nombre: local.nombre,
      direccion: local.direccion ?? '',
      descripcion: local.descripcion ?? '',
      esta_activo: local.esta_activo,
    };
    this.modalEditarLocalAbierto = true;
  }

  cerrarModalEditarLocal(): void {
    this.modalEditarLocalAbierto = false;
    this.localEditandoId = null;
  }

  get formularioEdicionLocalValido(): boolean {
    return this.editarLocal.nombre.trim().length > 0;
  }

  guardarEdicionLocal(): void {
    if (!this.formularioEdicionLocalValido || !this.localEditandoId || this.guardandoLocalEdicion) return;
    const idLocal = this.localEditandoId;

    const payload: LocalUpdateInput = {
      nombre: this.editarLocal.nombre.trim(),
      direccion: this.editarLocal.direccion.trim() || null,
      descripcion: this.editarLocal.descripcion.trim() || null,
      esta_activo: this.editarLocal.esta_activo,
    };

    this.guardandoLocalEdicion = true;
    this.empresasService.actualizarLocal(this.idEmpresa, idLocal, payload).subscribe({
      next: (actualizado) => {
        this.guardandoLocalEdicion = false;
        this.locales.set(this.locales().map((l) => (l.id_local === actualizado.id_local ? actualizado : l)));
        this.cerrarModalEditarLocal();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoLocalEdicion = false;
        this.error.set(err.status === 400 ? 'Ya existe un local con ese nombre.' : 'No se pudo actualizar el local.');
      },
    });
  }

  // ── Modal "Eliminar local" ───────────────────────────────
  modalEliminarLocalAbierto = false;
  localEliminando: Local | null = null;
  eliminandoLocal = false;

  abrirModalEliminarLocal(local: Local): void {
    this.localEliminando = local;
    this.modalEliminarLocalAbierto = true;
  }

  cerrarModalEliminarLocal(): void {
    this.modalEliminarLocalAbierto = false;
    this.localEliminando = null;
  }

  confirmarEliminarLocal(): void {
    if (!this.localEliminando || this.eliminandoLocal) return;
    const idLocal = this.localEliminando.id_local;

    this.eliminandoLocal = true;
    this.empresasService.eliminarLocal(this.idEmpresa, idLocal).subscribe({
      next: () => {
        this.eliminandoLocal = false;
        this.locales.set(this.locales().filter((l) => l.id_local !== idLocal));
        this.cerrarModalEliminarLocal();
      },
      error: () => {
        this.eliminandoLocal = false;
        this.error.set('No se pudo eliminar el local.');
        this.cerrarModalEliminarLocal();
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // ── Pestaña "Usuarios" ────────────────────────────────────
  // ════════════════════════════════════════════════════════
  usuarios = signal<Usuario[]>([]);
  roles = signal<Rol[]>([]);
  cargandoUsuarios = signal(true);

  busqueda = '';
  filtroEstado: EstadoUsuario | 'Todos' = 'Todos';

  modalLogoError = false;

  private cargarUsuarios(): void {
    this.cargandoUsuarios.set(true);
    this.usuariosService.listarUsuarios(this.idEmpresa).subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.cargandoUsuarios.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de usuarios.');
        this.cargandoUsuarios.set(false);
      },
    });
  }

  private cargarRoles(): void {
    this.usuariosService.listarRolesDeEmpresa(this.idEmpresa).subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => {
        /* si falla, el select de rol simplemente queda vacío */
      },
    });
  }

  get usuariosFiltrados(): Usuario[] {
    return this.usuarios().filter((usuario) => {
      const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.toLowerCase();
      const dni = usuario.dni ?? '';
      if (
        this.busqueda &&
        !nombreCompleto.includes(this.busqueda.toLowerCase()) &&
        !dni.includes(this.busqueda) &&
        !usuario.email.toLowerCase().includes(this.busqueda.toLowerCase())
      ) {
        return false;
      }
      if (this.filtroEstado !== 'Todos' && usuario.estado !== this.filtroEstado) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroEstado !== 'Todos');
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroEstado = 'Todos';
  }

  inicialesUsuario(nombres: string, apellidos: string): string {
    return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
  }

  nombreRol(idRol: string): string {
    return this.roles().find((r) => r.id_rol === idRol)?.nombre ?? '—';
  }

  // ── Modal "Nuevo usuario" ───────────────────────────────
  modalNuevoAbierto = false;
  nuevoUsuario: NuevoUsuarioForm = this.formularioVacio();
  guardando = false;

  modalConfirmacionAbierto = false;
  usuarioRecienCreado: Usuario | null = null;

  private formularioVacio(): NuevoUsuarioForm {
    return { nombres: '', apellidos: '', dni: '', email: '', password: '', idRol: '' };
  }

  abrirModalNuevo(): void {
    this.nuevoUsuario = this.formularioVacio();
    this.modalNuevoAbierto = true;
  }

  cerrarModalNuevo(): void {
    this.modalNuevoAbierto = false;
  }

  get formularioValido(): boolean {
    if (!this.nuevoUsuario.nombres.trim() || !this.nuevoUsuario.apellidos.trim()) return false;
    if (!this.nuevoUsuario.email.trim() || this.nuevoUsuario.password.length < 8) return false;
    if (!this.nuevoUsuario.idRol) return false;
    if (this.nuevoUsuario.dni && !/^[0-9]{8}$/.test(this.nuevoUsuario.dni)) return false;
    return true;
  }

  crearUsuario(): void {
    if (!this.formularioValido || this.guardando) return;
    const idEmpresa = this.idEmpresa;

    this.guardando = true;
    this.error.set(null);
    this.usuariosService
      .crearUsuario(idEmpresa, {
        nombres: this.nuevoUsuario.nombres.trim(),
        apellidos: this.nuevoUsuario.apellidos.trim(),
        email: this.nuevoUsuario.email.trim(),
        password: this.nuevoUsuario.password,
        dni: this.nuevoUsuario.dni.trim() || null,
      })
      .subscribe({
        next: (usuarioCreado) => {
          this.usuariosService.asignarRol(idEmpresa, usuarioCreado.id_usuario, this.nuevoUsuario.idRol).subscribe({
            next: () => this.finalizarCreacion(usuarioCreado),
            error: () => {
              this.error.set('El usuario se creó, pero no se pudo asignar el rol. Asígnalo manualmente después.');
              this.finalizarCreacion(usuarioCreado);
            },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.guardando = false;
          this.error.set(err.status === 409 ? 'Ya existe un usuario con ese email.' : 'No se pudo crear el usuario.');
        },
      });
  }

  private finalizarCreacion(usuarioCreado: Usuario): void {
    this.guardando = false;
    this.usuarios.set([usuarioCreado, ...this.usuarios()]);
    this.usuarioRecienCreado = usuarioCreado;
    this.cerrarModalNuevo();
    this.modalConfirmacionAbierto = true;
  }

  cerrarModalConfirmacion(): void {
    this.modalConfirmacionAbierto = false;
    this.usuarioRecienCreado = null;
  }

  // ── Retirar / reactivar ─────────────────────────────────
  cambiarEstado(usuario: Usuario): void {
    const nuevoEstado: EstadoUsuario = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    this.usuariosService.actualizarUsuario(this.idEmpresa, usuario.id_usuario, { estado: nuevoEstado }).subscribe({
      next: (actualizado) => {
        this.usuarios.set(this.usuarios().map((u) => (u.id_usuario === actualizado.id_usuario ? actualizado : u)));
      },
      error: () => this.error.set('No se pudo cambiar el estado del usuario.'),
    });
  }

  // ── Modal "Ver usuario" ─────────────────────────────────
  modalVerAbierto = false;
  usuarioViendo: Usuario | null = null;
  rolesDeUsuarioViendo: Rol[] = [];

  abrirModalVer(usuario: Usuario): void {
    this.usuarioViendo = usuario;
    this.rolesDeUsuarioViendo = [];
    this.modalVerAbierto = true;
    this.usuariosService.listarRolesDeUsuario(this.idEmpresa, usuario.id_usuario).subscribe({
      next: (roles) => (this.rolesDeUsuarioViendo = roles),
      error: () => {},
    });
  }

  cerrarModalVer(): void {
    this.modalVerAbierto = false;
    this.usuarioViendo = null;
  }

  // ── Modal "Editar usuario" ──────────────────────────────
  modalEditarAbierto = false;
  editarUsuario: EditarUsuarioForm = this.formularioEdicionVacio();
  guardandoEdicion = false;
  cargandoRolActual = false;
  private usuarioEditandoId: string | null = null;
  private idRolOriginal: string | null = null;

  private formularioEdicionVacio(): EditarUsuarioForm {
    return { nombres: '', apellidos: '', dni: '', telefono: '', estado: 'activo', idRol: '' };
  }

  abrirModalEditar(usuario: Usuario): void {
    this.usuarioEditandoId = usuario.id_usuario;
    this.idRolOriginal = null;
    this.editarUsuario = {
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      dni: usuario.dni ?? '',
      telefono: usuario.telefono ?? '',
      estado: usuario.estado,
      idRol: '',
    };
    this.modalEditarAbierto = true;

    this.cargandoRolActual = true;
    this.usuariosService.listarRolesDeUsuario(this.idEmpresa, usuario.id_usuario).subscribe({
      next: (roles) => {
        this.cargandoRolActual = false;
        if (roles.length > 0) {
          this.idRolOriginal = roles[0].id_rol;
          this.editarUsuario.idRol = roles[0].id_rol;
        }
      },
      error: () => {
        this.cargandoRolActual = false;
      },
    });
  }

  cerrarModalEditar(): void {
    this.modalEditarAbierto = false;
    this.usuarioEditandoId = null;
  }

  get formularioEdicionValido(): boolean {
    if (!this.editarUsuario.nombres.trim() || !this.editarUsuario.apellidos.trim()) return false;
    if (this.editarUsuario.dni && !/^[0-9]{8}$/.test(this.editarUsuario.dni)) return false;
    return true;
  }

  guardarEdicion(): void {
    if (!this.formularioEdicionValido || !this.usuarioEditandoId || this.guardandoEdicion) return;
    const idEmpresa = this.idEmpresa;
    const idUsuario = this.usuarioEditandoId;

    this.guardandoEdicion = true;
    this.usuariosService
      .actualizarUsuario(idEmpresa, idUsuario, {
        nombres: this.editarUsuario.nombres.trim(),
        apellidos: this.editarUsuario.apellidos.trim(),
        dni: this.editarUsuario.dni.trim() || null,
        telefono: this.editarUsuario.telefono.trim() || null,
        estado: this.editarUsuario.estado,
      })
      .subscribe({
        next: (actualizado) => this.aplicarCambioDeRolYFinalizar(idEmpresa, idUsuario, actualizado),
        error: () => {
          this.guardandoEdicion = false;
          this.error.set('No se pudo guardar los cambios del usuario.');
        },
      });
  }

  private aplicarCambioDeRolYFinalizar(idEmpresa: string, idUsuario: string, actualizado: Usuario): void {
    const rolCambio = this.editarUsuario.idRol && this.editarUsuario.idRol !== this.idRolOriginal;
    if (!rolCambio) {
      this.finalizarEdicion(actualizado);
      return;
    }

    const quitar = this.idRolOriginal
      ? this.usuariosService.quitarRol(idEmpresa, idUsuario, this.idRolOriginal)
      : null;

    const asignarNuevo = () =>
      this.usuariosService.asignarRol(idEmpresa, idUsuario, this.editarUsuario.idRol).subscribe({
        next: () => this.finalizarEdicion(actualizado),
        error: () => {
          this.error.set('Se guardaron los datos, pero no se pudo cambiar el rol.');
          this.finalizarEdicion(actualizado);
        },
      });

    if (quitar) {
      quitar.subscribe({ next: asignarNuevo, error: asignarNuevo });
    } else {
      asignarNuevo();
    }
  }

  private finalizarEdicion(actualizado: Usuario): void {
    this.guardandoEdicion = false;
    this.usuarios.set(this.usuarios().map((u) => (u.id_usuario === actualizado.id_usuario ? actualizado : u)));
    this.cerrarModalEditar();
  }

  // ── Modal "Eliminar usuario" ────────────────────────────
  modalEliminarAbierto = false;
  usuarioEliminando: Usuario | null = null;
  eliminando = false;

  abrirModalEliminar(usuario: Usuario): void {
    this.usuarioEliminando = usuario;
    this.modalEliminarAbierto = true;
  }

  cerrarModalEliminar(): void {
    this.modalEliminarAbierto = false;
    this.usuarioEliminando = null;
  }

  confirmarEliminar(): void {
    if (!this.usuarioEliminando || this.eliminando) return;
    const idUsuario = this.usuarioEliminando.id_usuario;

    this.eliminando = true;
    this.usuariosService.eliminarUsuario(this.idEmpresa, idUsuario).subscribe({
      next: () => {
        this.eliminando = false;
        this.usuarios.set(this.usuarios().filter((u) => u.id_usuario !== idUsuario));
        this.cerrarModalEliminar();
      },
      error: () => {
        this.eliminando = false;
        this.error.set('No se pudo eliminar el usuario.');
        this.cerrarModalEliminar();
      },
    });
  }

  // ── Modal "Asignar / quitar local" (usuarios con rol vendedor) ──
  modalLocalAbierto = false;
  usuarioAsignandoLocal: Usuario | null = null;
  localSeleccionadoId = '';
  guardandoLocal = false;

  abrirModalLocal(usuario: Usuario): void {
    this.usuarioAsignandoLocal = usuario;
    this.localSeleccionadoId = usuario.id_local ?? '';
    this.modalLocalAbierto = true;
  }

  cerrarModalLocal(): void {
    this.modalLocalAbierto = false;
    this.usuarioAsignandoLocal = null;
  }

  guardarAsignacionLocal(): void {
    if (!this.usuarioAsignandoLocal || !this.localSeleccionadoId || this.guardandoLocal) return;
    const idUsuario = this.usuarioAsignandoLocal.id_usuario;

    this.guardandoLocal = true;
    this.usuariosService.asignarLocal(this.idEmpresa, idUsuario, this.localSeleccionadoId).subscribe({
      next: (actualizado) => {
        this.guardandoLocal = false;
        this.usuarios.set(this.usuarios().map((u) => (u.id_usuario === actualizado.id_usuario ? actualizado : u)));
        this.cerrarModalLocal();
      },
      error: () => {
        this.guardandoLocal = false;
        this.error.set('No se pudo asignar el local.');
      },
    });
  }

  quitarLocalAsignado(usuario: Usuario): void {
    this.usuariosService.quitarLocal(this.idEmpresa, usuario.id_usuario).subscribe({
      next: (actualizado) => {
        this.usuarios.set(this.usuarios().map((u) => (u.id_usuario === actualizado.id_usuario ? actualizado : u)));
      },
      error: () => this.error.set('No se pudo quitar el local asignado.'),
    });
  }

  // ── Modal "Permisos de vista" (por usuario) ─────────────
  modalPermisosAbierto = false;
  usuarioPermisos: Usuario | null = null;
  permisosSeleccion: Record<ClaveVista, boolean> = {} as Record<ClaveVista, boolean>;
  cargandoPermisos = false;
  guardandoPermisos = false;

  abrirModalPermisos(usuario: Usuario): void {
    this.usuarioPermisos = usuario;
    this.vistas = [];
    this.permisosSeleccion = {} as Record<ClaveVista, boolean>;
    this.modalPermisosAbierto = true;
    this.cargandoPermisos = true;

    // El catálogo de vistas depende del rol REAL del usuario (admin ve
    // Dashboard/Empresas/Suscripciones/Actividad; dueño ve Dashboard/
    // Inventario/Ventas/Finanzas; vendedor solo Inventario/Ventas) — hay
    // que saber su rol antes de poder armar los checkboxes.
    forkJoin({
      roles: this.usuariosService.listarRolesDeUsuario(this.idEmpresa, usuario.id_usuario),
      deshabilitadas: this.usuariosService.listarPermisosVista(this.idEmpresa, usuario.id_usuario),
    }).subscribe({
      next: ({ roles, deshabilitadas }) => {
        const rol = mapearRol(roles.map((r) => r.nombre));
        this.vistas = VISTAS_POR_ROL[rol];
        this.vistas.forEach((v) => (this.permisosSeleccion[v.clave] = true));
        deshabilitadas.forEach((clave) => (this.permisosSeleccion[clave] = false));
        this.cargandoPermisos = false;
      },
      error: () => {
        this.cargandoPermisos = false;
      },
    });
  }

  cerrarModalPermisos(): void {
    this.modalPermisosAbierto = false;
    this.usuarioPermisos = null;
  }

  guardarPermisos(): void {
    if (!this.usuarioPermisos || this.guardandoPermisos) return;
    const deshabilitadas = this.vistas
      .filter((v) => !this.permisosSeleccion[v.clave])
      .map((v) => v.clave);

    this.guardandoPermisos = true;
    this.usuariosService
      .actualizarPermisosVista(this.idEmpresa, this.usuarioPermisos.id_usuario, deshabilitadas)
      .subscribe({
        next: () => {
          this.guardandoPermisos = false;
          this.cerrarModalPermisos();
        },
        error: () => {
          this.guardandoPermisos = false;
          this.error.set('No se pudieron guardar los permisos de vista.');
        },
      });
  }

  // ════════════════════════════════════════════════════════
  // ── Pestaña "Suscripción" ─────────────────────────────────
  // Solo lectura del plan vigente + asignar un plan cuando la empresa
  // no tiene ninguno. Editar precio/descuento/estado y registrar pagos
  // se hace en el panel centralizado /admin/suscripciones.
  // ════════════════════════════════════════════════════════
  suscripcion = signal<Suscripcion | null>(null);
  planes = signal<Plan[]>([]);
  cargandoSuscripcion = signal(false);
  cargandoPlanes = signal(false);

  private cargarSuscripcion(): void {
    this.cargandoSuscripcion.set(true);
    this.error.set(null);
    this.suscripcionesService.obtenerSuscripcion(this.idEmpresa).subscribe({
      next: (suscripcion) => {
        this.suscripcion.set(suscripcion);
        this.cargandoSuscripcion.set(false);
        this.evaluarCargaIntegraciones();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.suscripcion.set(null);
          this.cargandoSuscripcion.set(false);
          return;
        }
        this.cargandoSuscripcion.set(false);
        this.error.set('No se pudo cargar la suscripción de la empresa.');
      },
    });
  }

  private cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.suscripcionesService.listarPlanes().subscribe({
      next: (planes) => {
        this.planes.set(planes);
        this.cargandoPlanes.set(false);
        this.evaluarCargaIntegraciones();
      },
      error: () => {
        this.cargandoPlanes.set(false);
      },
    });
  }

  /** Se llama tras resolver suscripcion() o planes() (lo que termine último) — evita carreras. */
  private evaluarCargaIntegraciones(): void {
    if (this.planAsignado()?.integraciones_omnicanal && !this.integracionesCargadas) {
      this.cargarIntegracionesMarketplace();
    }
  }

  // ── Modal "Asignar plan" (solo cuando la empresa aún no tiene suscripción) ──
  modalAsignarPlanAbierto = false;
  idPlanAsignar = '';
  guardandoAsignacion = false;

  abrirModalCrearSuscripcion(): void {
    this.idPlanAsignar = '';
    if (!this.planes().length && !this.cargandoPlanes()) {
      this.cargarPlanes();
    }
    this.modalAsignarPlanAbierto = true;
  }

  cerrarModalAsignarPlan(): void {
    this.modalAsignarPlanAbierto = false;
  }

  crearSuscripcion(): void {
    const plan = this.planes().find((p) => p.id_plan === this.idPlanAsignar);
    if (!plan || this.guardandoAsignacion) return;
    this.guardandoAsignacion = true;

    const payload: SuscripcionCreateInput = {
      id_plan: plan.id_plan,
      precio_acordado: plan.precio,
      descuento_monto: 0,
      estado: 'trial',
      fecha_fin: null,
    };

    this.suscripcionesService.crearSuscripcion(this.idEmpresa, payload).subscribe({
      next: (suscripcion) => {
        this.guardandoAsignacion = false;
        this.suscripcion.set(suscripcion);
        this.cerrarModalAsignarPlan();
      },
      error: () => {
        this.guardandoAsignacion = false;
        this.error.set('No se pudo asignar el plan.');
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // ── "Integraciones Omnicanal" (Falabella, Ripley, Mercado Libre) ──
  // Solo visible si el plan asignado a esta empresa incluye el beneficio
  // `integraciones_omnicanal` (ver /admin/suscripciones → catálogo de planes).
  // ════════════════════════════════════════════════════════
  readonly marketplacesDisponibles = MARKETPLACES_DISPONIBLES;

  integracionesMarketplace = signal<IntegracionMarketplace[]>([]);
  cargandoIntegraciones = signal(false);
  private integracionesCargadas = false;

  private cargarIntegracionesMarketplace(): void {
    this.cargandoIntegraciones.set(true);
    this.marketplaceService.listarIntegraciones(this.idEmpresa).subscribe({
      next: (integraciones) => {
        this.integracionesMarketplace.set(integraciones);
        this.cargandoIntegraciones.set(false);
        this.integracionesCargadas = true;
      },
      error: () => {
        this.cargandoIntegraciones.set(false);
        // No se marca integracionesCargadas = true a propósito: si falló
        // por un error transitorio, la próxima vez que se evalúe se
        // reintenta en vez de quedar en blanco para siempre.
      },
    });
  }

  /** Estado actual de un marketplace puntual — null si nunca se conectó. */
  estadoIntegracion(proveedor: MarketplaceProveedor): IntegracionMarketplace | null {
    return this.integracionesMarketplace().find((i) => i.proveedor === proveedor) ?? null;
  }

  etiquetaEstadoIntegracion(proveedor: MarketplaceProveedor): string {
    const integracion = this.estadoIntegracion(proveedor);
    if (!integracion) return 'No conectado';
    switch (integracion.estado) {
      case 'conectado':
        return 'Conectado';
      case 'token_vencido':
        return 'Conexión vencida';
      case 'error_credenciales':
        return 'Credenciales inválidas';
      default:
        return 'No conectado';
    }
  }

  // ── Modal "Conectar marketplace" ──────────────────────────
  modalConectarAbierto = false;
  proveedorSeleccionado: MarketplaceProveedor | null = null;
  formCredenciales: CredencialesMarketplaceInput = { client_id: '', client_secret: '', tienda_id: '' };
  guardandoConexion = false;
  errorConexion: string | null = null;

  get nombreProveedorSeleccionado(): string {
    return this.marketplacesDisponibles.find((m) => m.id === this.proveedorSeleccionado)?.nombre ?? '';
  }

  abrirModalConectar(proveedor: MarketplaceProveedor): void {
    this.proveedorSeleccionado = proveedor;
    this.formCredenciales = { client_id: '', client_secret: '', tienda_id: '' };
    this.errorConexion = null;
    this.modalConectarAbierto = true;
  }

  cerrarModalConectar(): void {
    this.modalConectarAbierto = false;
    this.proveedorSeleccionado = null;
  }

  get credencialesValidas(): boolean {
    return (
      this.formCredenciales.client_id.trim().length > 0 &&
      this.formCredenciales.client_secret.trim().length > 0 &&
      this.formCredenciales.tienda_id.trim().length > 0
    );
  }

  conectarMarketplace(): void {
    if (!this.proveedorSeleccionado || !this.credencialesValidas || this.guardandoConexion) return;
    this.guardandoConexion = true;
    this.errorConexion = null;

    this.marketplaceService
      .conectarIntegracion(this.idEmpresa, this.proveedorSeleccionado, this.formCredenciales)
      .subscribe({
        next: (integracion) => {
          this.guardandoConexion = false;
          const sinDuplicado = this.integracionesMarketplace().filter((i) => i.proveedor !== integracion.proveedor);
          this.integracionesMarketplace.set([...sinDuplicado, integracion]);
          this.integracionesCargadas = true;
          this.cerrarModalConectar();
        },
        error: () => {
          this.guardandoConexion = false;
          this.errorConexion = 'No se pudo conectar. Verifica las credenciales e intenta de nuevo.';
        },
      });
  }

  desconectarMarketplace(integracion: IntegracionMarketplace): void {
    this.marketplaceService.desconectarIntegracion(this.idEmpresa, integracion.id_integracion).subscribe({
      next: () => {
        this.integracionesMarketplace.set(
          this.integracionesMarketplace().filter((i) => i.id_integracion !== integracion.id_integracion),
        );
      },
      error: () => this.error.set('No se pudo desconectar la integración.'),
    });
  }
}