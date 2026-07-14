import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Local } from '../../../services/empresas';
import { ROLES_RULES, RolUsuario, Usuario, UsuariosService } from '../../../services/usuarios';

interface NuevoUsuarioForm {
  nombre: string;
  apellido: string;
  dni: string;
  correo: string;
  password: string;
  rol: RolUsuario | '';
  empresaId: string | null;
  localId: string | null;
}

const FOTO_MAX_BYTES = 1.5 * 1024 * 1024;
const FOTO_TIPOS_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css'],
})
export class UsuariosComponent {
  constructor(private usuariosService: UsuariosService) {}

  // Roles simplificados para Vilcas (sin Marca/Concesionario)
  roles: RolUsuario[] = ['Admin VILCAS', 'Empresa', 'Trabajador de Local'];

  rolStyle: Record<RolUsuario, string> = {
    'Admin VILCAS': 'rol-admin',
    Empresa: 'rol-empresa',
    'Trabajador de Local': 'rol-trabajador',
  };

  modalLogoError = false;

  busqueda = '';
  filtroEmpresa = 'Todas';
  filtroRol: RolUsuario | 'Todos' = 'Todos';
  filtroEstado: 'activo' | 'retirado' | 'Todos' = 'Todos';

  get usuarios(): Usuario[] {
    return this.usuariosService.getUsuarios();
  }

  get empresasDisponibles() {
    return this.usuariosService.getEmpresasDisponibles();
  }

  get usuariosFiltrados(): Usuario[] {
    return this.usuarios.filter((usuario) => {
      const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`.toLowerCase();
      if (
        this.busqueda &&
        !nombreCompleto.includes(this.busqueda.toLowerCase()) &&
        !usuario.dni.includes(this.busqueda) &&
        !usuario.correo.toLowerCase().includes(this.busqueda.toLowerCase())
      ) {
        return false;
      }
      if (this.filtroEmpresa !== 'Todas' && usuario.empresaId !== this.filtroEmpresa) return false;
      if (this.filtroRol !== 'Todos' && usuario.rol !== this.filtroRol) return false;
      if (this.filtroEstado !== 'Todos' && usuario.estado !== this.filtroEstado) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return !!(
      this.busqueda ||
      this.filtroEmpresa !== 'Todas' ||
      this.filtroRol !== 'Todos' ||
      this.filtroEstado !== 'Todos'
    );
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroEmpresa = 'Todas';
    this.filtroRol = 'Todos';
    this.filtroEstado = 'Todos';
  }

  nombreEmpresa(empresaId: string | null): string {
    if (!empresaId) return '—';
    return this.usuariosService.getEmpresasDisponibles().find((empresa) => empresa.id === empresaId)?.nombre ?? '—';
  }

  nombreLocal(empresaId: string | null, localId: string | null): string {
    if (!empresaId || !localId) return '—';
    return this.usuariosService.getLocalesDeEmpresa(empresaId).find((local) => local.id === localId)?.nombre ?? '—';
  }

  iniciales(nombre: string, apellido: string): string {
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }

  // ── Modal "Nuevo usuario" ───────────────────────────────
  modalNuevoAbierto = false;
  nuevoUsuario: NuevoUsuarioForm = this.formularioVacio();

  fotoPreview: string | null = null;
  fotoNombreArchivo = '';
  fotoError = '';

  modalConfirmacionAbierto = false;
  usuarioRecienCreado: Usuario | null = null;

  private formularioVacio(): NuevoUsuarioForm {
    return {
      nombre: '',
      apellido: '',
      dni: '',
      correo: '',
      password: '',
      rol: '',
      empresaId: null,
      localId: null,
    };
  }

  get localesDelFormulario(): Local[] {
    return this.usuariosService.getLocalesDeEmpresa(this.nuevoUsuario.empresaId);
  }

  get reglasRolActual() {
    return this.nuevoUsuario.rol ? ROLES_RULES[this.nuevoUsuario.rol] : null;
  }

  get empresaHabilitada(): boolean {
    return !!this.reglasRolActual?.enabled.empresa;
  }

  get localHabilitado(): boolean {
    return !!this.reglasRolActual?.enabled.local;
  }

  abrirModalNuevo(): void {
    this.nuevoUsuario = this.formularioVacio();
    this.fotoPreview = null;
    this.fotoNombreArchivo = '';
    this.fotoError = '';
    this.modalNuevoAbierto = true;
  }

  cerrarModalNuevo(): void {
    this.modalNuevoAbierto = false;
  }

  onRolChange(): void {
    const reglas = this.reglasRolActual;
    if (!reglas?.enabled.empresa) this.nuevoUsuario.empresaId = null;
    if (!reglas?.enabled.local) this.nuevoUsuario.localId = null;
  }

  onEmpresaChange(): void {
    this.nuevoUsuario.localId = null;
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fotoError = '';

    if (!FOTO_TIPOS_VALIDOS.includes(file.type)) {
      this.fotoError = 'Formato no válido. Usa JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > FOTO_MAX_BYTES) {
      this.fotoError = 'La imagen supera el máximo de 1.5 MB.';
      input.value = '';
      return;
    }

    this.fotoNombreArchivo = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.fotoPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoPreview = null;
    this.fotoNombreArchivo = '';
    this.fotoError = '';
  }

  get formularioValido(): boolean {
    const reglas = this.reglasRolActual;
    if (!this.nuevoUsuario.nombre.trim() || !this.nuevoUsuario.apellido.trim()) return false;
    if (!this.nuevoUsuario.correo.trim() || !this.nuevoUsuario.password.trim()) return false;
    if (!this.nuevoUsuario.rol) return false;
    if (!reglas) return false;
    if (reglas.required.empresa && !this.nuevoUsuario.empresaId) return false;
    if (reglas.required.local && !this.nuevoUsuario.localId) return false;
    return true;
  }

  crearUsuario(): void {
    if (!this.formularioValido) return;

    const usuarioCreado = this.usuariosService.agregarUsuario({
      nombre: this.nuevoUsuario.nombre,
      apellido: this.nuevoUsuario.apellido,
      dni: this.nuevoUsuario.dni,
      correo: this.nuevoUsuario.correo,
      rol: this.nuevoUsuario.rol as RolUsuario,
      empresaId: this.empresaHabilitada ? this.nuevoUsuario.empresaId : null,
      localId: this.localHabilitado ? this.nuevoUsuario.localId : null,
      fotoUrl: this.fotoPreview,
    });

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
    const nuevoEstado = usuario.estado === 'activo' ? 'retirado' : 'activo';
    this.usuariosService.cambiarEstado(usuario.id, nuevoEstado);
  }
}