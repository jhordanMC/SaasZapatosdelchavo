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

/**
 * Nota importante: /iam/usuarios opera SIEMPRE sobre la empresa del
 * usuario autenticado (nunca cross-tenant) — a diferencia de
 * EmpresasService, este servicio solo administra usuarios de la propia
 * empresa de ALBA, no de las empresas-cliente.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarUsuarios(limit = 100, offset = 0): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/iam/usuarios`, {
      params: { limit, offset },
    });
  }

  crearUsuario(datos: UsuarioCreateInput): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/iam/usuarios`, datos);
  }

  actualizarEstado(idUsuario: string, estado: EstadoUsuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/iam/usuarios/${idUsuario}`, { estado });
  }

  listarRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/iam/roles`);
  }

  asignarRol(idUsuario: string, idRol: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/iam/usuarios/${idUsuario}/roles`, { id_rol: idRol });
  }
}
