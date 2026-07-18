import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { EstadoUsuario, Rol, Usuario, UsuariosService } from '../../../services/usuarios';

interface NuevoUsuarioForm {
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  password: string;
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
  constructor(private usuariosService: UsuariosService) {}

  usuarios = signal<Usuario[]>([]);
  roles = signal<Rol[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  modalLogoError = false;

  busqueda = '';
  filtroEstado: EstadoUsuario | 'Todos' = 'Todos';

  ngOnInit(): void {
    this.cargarUsuarios();
    this.usuariosService.listarRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => {
        /* si falla, el select de rol simplemente queda vacío */
      },
    });
  }

  private cargarUsuarios(): void {
    this.cargando.set(true);
    this.usuariosService.listarUsuarios().subscribe({
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

    this.guardando = true;
    this.error.set(null);
    this.usuariosService
      .crearUsuario({
        nombres: this.nuevoUsuario.nombres.trim(),
        apellidos: this.nuevoUsuario.apellidos.trim(),
        email: this.nuevoUsuario.email.trim(),
        password: this.nuevoUsuario.password,
        dni: this.nuevoUsuario.dni.trim() || null,
      })
      .subscribe({
        next: (usuarioCreado) => {
          this.usuariosService.asignarRol(usuarioCreado.id_usuario, this.nuevoUsuario.idRol).subscribe({
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
    this.usuariosService.actualizarEstado(usuario.id_usuario, nuevoEstado).subscribe({
      next: (actualizado) => {
        this.usuarios.set(this.usuarios().map((u) => (u.id_usuario === actualizado.id_usuario ? actualizado : u)));
      },
      error: () => this.error.set('No se pudo cambiar el estado del usuario.'),
    });
  }
}
