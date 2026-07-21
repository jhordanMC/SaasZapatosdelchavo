import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoEmpresa = 'activa' | 'suspendida' | 'cancelada';

export interface Local {
  id_local: string;
  id_empresa: string;
  nombre: string;
  direccion: string | null;
  descripcion: string | null;
  esta_activo: boolean;
  creado_en: string;
}

export interface Empresa {
  id_empresa: string;
  nombre: string;
  slug: string;
  estado: EstadoEmpresa;
  creado_en: string;
}

export interface LocalInput {
  nombre: string;
  direccion: string;
  descripcion: string;
}

export interface EmpresaUpdateInput {
  nombre?: string;
  estado?: EstadoEmpresa;
}

/**
 * Cross-tenant a propósito: solo lo puede usar el staff de ALBA (el
 * backend lo exige vía require_alba_staff, GET /empresas y afines).
 */
@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarEmpresas(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(`${this.apiUrl}/empresas`);
  }

  obtenerEmpresa(idEmpresa: string): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.apiUrl}/empresas/${idEmpresa}`);
  }

  crearEmpresa(nombre: string): Observable<Empresa> {
    return this.http.post<Empresa>(`${this.apiUrl}/empresas`, { nombre });
  }

  actualizarEmpresa(idEmpresa: string, datos: EmpresaUpdateInput): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.apiUrl}/empresas/${idEmpresa}`, datos);
  }

  listarLocales(idEmpresa: string): Observable<Local[]> {
    return this.http.get<Local[]>(`${this.apiUrl}/empresas/${idEmpresa}/locales`);
  }

  crearLocal(idEmpresa: string, data: LocalInput): Observable<Local> {
    return this.http.post<Local>(`${this.apiUrl}/empresas/${idEmpresa}/locales`, {
      nombre: data.nombre,
      direccion: data.direccion || null,
      descripcion: data.descripcion || null,
    });
  }
}
