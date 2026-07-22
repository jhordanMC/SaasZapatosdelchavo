import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoUsuario = 'activo' | 'inactivo' | 'suspendido';

// Nivel de rol del usuario (distinto de la interfaz `Rol` de abajo, que es
// la entidad RBAC completa con id_rol/nombre/etc.). Vive acá (no en
// core/auth.ts) para que services/usuarios.ts pueda armar VISTAS_POR_ROL
// sin depender de auth.ts — auth.ts es quien re-exporta este tipo
// (`export type { RolUsuario }`) para no romper los imports existentes.
export type RolUsuario = 'admin' | 'dueño' | 'vendedor';

// Nombres exactos de los roles de sistema sembrados en el backend
// (app/scripts/seed_catalogo_rbac.py). Un usuario puede tener varios
// roles a la vez; se usa el de mayor privilegio para decidir a dónde
// navega y qué vistas puede tener deshabilitadas.
export function mapearRol(nombresRoles: string[]): RolUsuario {
  if (nombresRoles.includes('Administrador')) return 'admin';
  if (nombresRoles.includes('Dueño de empresa')) return 'dueño';
  return 'vendedor';
}

export interface Usuario {
  id_usuario: string;
  id_empresa: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  dni: string | null;
  id_foto_perfil: string | null;
  estado: EstadoUsuario;
  // Solo aplica a usuarios con rol "Vendedor": el local en el que atiende
  // ahora mismo. Un dueño de empresa o un admin ALBA siempre tienen null.
  id_local: string | null;
  ultimo_login_en: string | null;
  creado_en: string;
}

// Vistas del sistema sobre las que se puede otorgar/quitar permiso
// individual a un usuario (independiente de lo que ya le da su rol).
// Incluye tanto las de /admin/* (staff de ALBA) como las de /empresa/*
// (dueño/vendedor) — cuál subconjunto aplica depende del rol del usuario,
// ver VISTAS_POR_ROL.
export type ClaveVista =
  | 'dashboard'
  | 'inventario'
  | 'ventas'
  | 'finanzas'
  | 'analitica'
  | 'empresas'
  | 'suscripciones'
  | 'actividad';

export interface PermisoVista {
  clave: ClaveVista;
  etiqueta: string;
}

// 'analitica' queda afuera del catálogo de 'dueño': está oculta del
// sidebar a propósito ("se reactivará más adelante"), no tiene sentido
// ofrecer un checkbox para una vista que nadie ve todavía. Ídem
// 'reportes'/'configuración' del lado admin: son links muertos (href:'#'),
// sin página real que bloquear.
export const VISTAS_POR_ROL: Record<RolUsuario, PermisoVista[]> = {
  admin: [
    { clave: 'dashboard', etiqueta: 'Dashboard' },
    { clave: 'empresas', etiqueta: 'Empresas' },
    { clave: 'suscripciones', etiqueta: 'Suscripciones' },
    { clave: 'actividad', etiqueta: 'Actividad' },
  ],
  dueño: [
    { clave: 'dashboard', etiqueta: 'Dashboard' },
    { clave: 'inventario', etiqueta: 'Inventario' },
    { clave: 'ventas', etiqueta: 'Ventas' },
    { clave: 'finanzas', etiqueta: 'Finanzas' },
  ],
  vendedor: [
    { clave: 'inventario', etiqueta: 'Inventario' },
    { clave: 'ventas', etiqueta: 'Ventas' },
  ],
};

export interface Rol {
  id_rol: string;
  id_empresa: string | null;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  esta_activo: boolean;
  creado_en: string;
}

export interface UsuarioCreateInput {
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  telefono?: string | null;
  dni?: string | null;
}

export interface UsuarioUpdateInput {
  nombres?: string;
  apellidos?: string;
  telefono?: string | null;
  dni?: string | null;
  estado?: EstadoUsuario;
}

/**
 * Cross-tenant a propósito, igual que EmpresasService: todo opera sobre
 * /empresas/{idEmpresa}/usuarios (y sus roles), exclusivo del staff de
 * ALBA — permite crear/editar usuarios de CUALQUIER empresa-cliente,
 * no solo la propia.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarUsuarios(idEmpresa: string, limit = 100, offset = 0): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios`, {
      params: { limit, offset },
    });
  }

  crearUsuario(idEmpresa: string, datos: UsuarioCreateInput): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios`, datos);
  }

  actualizarUsuario(idEmpresa: string, idUsuario: string, datos: UsuarioUpdateInput): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}`, datos);
  }

  eliminarUsuario(idEmpresa: string, idUsuario: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}`);
  }

  listarRolesDeEmpresa(idEmpresa: string): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/empresas/${idEmpresa}/roles`);
  }

  listarRolesDeUsuario(idEmpresa: string, idUsuario: string): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/roles`);
  }

  asignarRol(idEmpresa: string, idUsuario: string, idRol: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/roles`, {
      id_rol: idRol,
    });
  }

  quitarRol(idEmpresa: string, idUsuario: string, idRol: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/roles/${idRol}`);
  }

  // ── Asignación de local (solo vendedores) ────────────────
  asignarLocal(idEmpresa: string, idUsuario: string, idLocal: string): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/local`, {
      id_local: idLocal,
    });
  }

  quitarLocal(idEmpresa: string, idUsuario: string): Observable<Usuario> {
    return this.http.delete<Usuario>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/local`);
  }

  // ── Permisos de vista individuales ────────────────────────
  // Devuelve solo las claves de vista actualmente DESHABILITADAS
  // para este usuario en concreto (todo lo que no está en la lista
  // se entiende habilitado según su rol).
  listarPermisosVista(idEmpresa: string, idUsuario: string): Observable<ClaveVista[]> {
    return this.http.get<ClaveVista[]>(
      `${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/permisos-vista`
    );
  }

  actualizarPermisosVista(idEmpresa: string, idUsuario: string, vistasDeshabilitadas: ClaveVista[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/empresas/${idEmpresa}/usuarios/${idUsuario}/permisos-vista`, {
      vistas_deshabilitadas: vistasDeshabilitadas,
    });
  }
}
