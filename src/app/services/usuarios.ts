import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoUsuario = 'activo' | 'inactivo' | 'suspendido';

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
  ultimo_login_en: string | null;
  creado_en: string;
}

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
}
