import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Empresa, EmpresasService } from '../../../services/empresas';
import { EstadoUsuario, Rol, Usuario, UsuariosService } from '../../../services/usuarios';

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

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css'],
})
export class UsuariosComponent implements OnInit {
  constructor(private usuariosService: UsuariosService, private empresasService: EmpresasService) {}

  empresas = signal<Empresa[]>([]);
  empresaSeleccionadaId: string | null = null;

  usuarios = signal<Usuario[]>([]);
  roles = signal<Rol[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  modalLogoError = false;

  busqueda = '';
  filtroEstado: EstadoUsuario | 'Todos' = 'Todos';

  ngOnInit(): void {
    this.empresasService.listarEmpresas().subscribe({
      next: (empresas) => {
        this.empresas.set(empresas);
        if (empresas.length > 0) {
          this.empresaSeleccionadaId = empresas[0].id_empresa;
          this.onCambiarEmpresa();
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

  onCambiarEmpresa(): void {
    this.cargarUsuarios();
    this.cargarRoles();
  }

  private cargarUsuarios(): void {
    if (!this.empresaSeleccionadaId) return;
    this.cargando.set(true);
    this.usuariosService.listarUsuarios(this.empresaSeleccionadaId).subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de usuarios.');
        this.cargando.set(false);
      },
    });
  }

  private cargarRoles(): void {
    if (!this.empresaSeleccionadaId) return;
    this.usuariosService.listarRolesDeEmpresa(this.empresaSeleccionadaId).subscribe({
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

  iniciales(nombres: string, apellidos: string): string {
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
    if (!this.empresaSeleccionadaId) return false;
    if (!this.nuevoUsuario.nombres.trim() || !this.nuevoUsuario.apellidos.trim()) return false;
    if (!this.nuevoUsuario.email.trim() || this.nuevoUsuario.password.length < 8) return false;
    if (!this.nuevoUsuario.idRol) return false;
    if (this.nuevoUsuario.dni && !/^[0-9]{8}$/.test(this.nuevoUsuario.dni)) return false;
    return true;
  }

  crearUsuario(): void {
    if (!this.formularioValido || this.guardando || !this.empresaSeleccionadaId) return;
    const idEmpresa = this.empresaSeleccionadaId;

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
    if (!this.empresaSeleccionadaId) return;
    const nuevoEstado: EstadoUsuario = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    this.usuariosService.actualizarUsuario(this.empresaSeleccionadaId, usuario.id_usuario, { estado: nuevoEstado }).subscribe({
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
    if (this.empresaSeleccionadaId) {
      this.usuariosService.listarRolesDeUsuario(this.empresaSeleccionadaId, usuario.id_usuario).subscribe({
        next: (roles) => (this.rolesDeUsuarioViendo = roles),
        error: () => {},
      });
    }
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

    if (this.empresaSeleccionadaId) {
      this.cargandoRolActual = true;
      this.usuariosService.listarRolesDeUsuario(this.empresaSeleccionadaId, usuario.id_usuario).subscribe({
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
    if (!this.formularioEdicionValido || !this.usuarioEditandoId || !this.empresaSeleccionadaId || this.guardandoEdicion) return;
    const idEmpresa = this.empresaSeleccionadaId;
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
    if (!this.usuarioEliminando || !this.empresaSeleccionadaId || this.eliminando) return;
    const idUsuario = this.usuarioEliminando.id_usuario;

    this.eliminando = true;
    this.usuariosService.eliminarUsuario(this.empresaSeleccionadaId, idUsuario).subscribe({
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
}
