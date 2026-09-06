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
  id_sector: string | null;
  nombre_sector: string | null;
  nombre_vendedor: string | null;
  creado_en: string;
}

export interface EmpresaBusquedaRapidaItem {
  id_empresa: string;
  nombre: string;
  estado: EstadoEmpresa;
}

export interface Sector {
  id_sector: string;
  nombre: string;
  esta_activo: boolean;
  creado_en: string;
}

export interface SectorCreateInput {
  nombre: string;
}

export interface SectorUpdateInput {
  nombre?: string;
  esta_activo?: boolean;
}

export interface LocalInput {
  nombre: string;
  direccion: string;
  descripcion: string;
}

export interface LocalUpdateInput {
  nombre?: string;
  direccion?: string | null;
  descripcion?: string | null;
  esta_activo?: boolean;
}

export interface EmpresaUpdateInput {
  nombre?: string;
  estado?: EstadoEmpresa;
  id_sector?: string | null;
  nombre_vendedor?: string | null;
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

  crearEmpresa(nombre: string, idSector?: string | null, nombreVendedor?: string | null): Observable<Empresa> {
    return this.http.post<Empresa>(`${this.apiUrl}/empresas`, {
      nombre,
      id_sector: idSector || null,
      nombre_vendedor: nombreVendedor?.trim() || null,
    });
  }

  actualizarEmpresa(idEmpresa: string, datos: EmpresaUpdateInput): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.apiUrl}/empresas/${idEmpresa}`, datos);
  }

  /** Borrado PERMANENTE en cascada (usuarios, locales, productos, ventas,
   * comprobantes, auditorías, etc.). Irreversible — ver confirmación en
   * empresa-detalle.ts antes de llamar esto. */
  eliminarEmpresa(idEmpresa: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/empresas/${idEmpresa}`);
  }

  /** Command palette del topbar (⌘K) — salto directo a una empresa por nombre. */
  buscarRapido(q: string, limit = 6): Observable<EmpresaBusquedaRapidaItem[]> {
    return this.http.get<EmpresaBusquedaRapidaItem[]>(`${this.apiUrl}/empresas/buscar-rapido`, {
      params: { q, limit: String(limit) },
    });
  }

  // ── Sectores (catálogo global) ──────────────────────────
  listarSectores(incluirInactivos = false): Observable<Sector[]> {
    return this.http.get<Sector[]>(`${this.apiUrl}/empresas/sectores`, {
      params: { incluir_inactivos: String(incluirInactivos) },
    });
  }

  crearSector(datos: SectorCreateInput): Observable<Sector> {
    return this.http.post<Sector>(`${this.apiUrl}/empresas/sectores`, datos);
  }

  actualizarSector(idSector: string, datos: SectorUpdateInput): Observable<Sector> {
    return this.http.put<Sector>(`${this.apiUrl}/empresas/sectores/${idSector}`, datos);
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

  actualizarLocal(idEmpresa: string, idLocal: string, data: LocalUpdateInput): Observable<Local> {
    return this.http.put<Local>(`${this.apiUrl}/empresas/${idEmpresa}/locales/${idLocal}`, data);
  }

  eliminarLocal(idEmpresa: string, idLocal: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/empresas/${idEmpresa}/locales/${idLocal}`);
  }
}