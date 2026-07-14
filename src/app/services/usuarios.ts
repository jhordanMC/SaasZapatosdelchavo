import { Injectable } from '@angular/core';
import { EmpresasService } from './empresas';

export type RolUsuario = 'Admin VILCAS' | 'Empresa' | 'Trabajador de Local';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  correo: string;
  rol: RolUsuario;
  empresaId: string | null;
  localId: string | null;
  fotoUrl: string | null;
  estado: 'activo' | 'retirado';
  fechaAlta: string;
}

export interface CampoJerarquia {
  empresa: boolean;
  local: boolean;
}

// Reglas por rol: qué campos de jerarquía están habilitados/son requeridos.
export const ROLES_RULES: Record<RolUsuario, { enabled: CampoJerarquia; required: CampoJerarquia }> = {
  'Admin VILCAS': {
    enabled: { empresa: false, local: false },
    required: { empresa: false, local: false },
  },
  Empresa: {
    enabled: { empresa: true, local: false },
    required: { empresa: true, local: false },
  },
  'Trabajador de Local': {
    enabled: { empresa: true, local: true },
    required: { empresa: true, local: true },
  },
};

let usuarioAutoId = 0;
function nuevoUsuarioId(): string {
  usuarioAutoId += 1;
  return `usuario-${usuarioAutoId}`;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private usuarios: Usuario[];

  constructor(private empresasService: EmpresasService) {
    this.usuarios = this.crearMockInicial();
  }

  private crearMockInicial(): Usuario[] {
    const empresas = this.empresasService.getEmpresas();
    const [continental, seguros, telco] = empresas;

    const mock: Usuario[] = [
      {
        id: nuevoUsuarioId(),
        nombre: 'Rodrigo',
        apellido: 'Salazar',
        dni: '45678912',
        correo: 'rodrigo.salazar@vilcas.pe',
        rol: 'Admin VILCAS',
        empresaId: null,
        localId: null,
        fotoUrl: null,
        estado: 'activo',
        fechaAlta: '2026-01-10',
      },
    ];

    if (continental) {
      mock.push({
        id: nuevoUsuarioId(),
        nombre: 'Claudia',
        apellido: 'Fernández',
        dni: '41234567',
        correo: 'claudia.fernandez@bancocontinental.pe',
        rol: 'Empresa',
        empresaId: continental.id,
        localId: null,
        fotoUrl: null,
        estado: 'activo',
        fechaAlta: '2026-01-18',
      });

      if (continental.locales[0]) {
        mock.push({
          id: nuevoUsuarioId(),
          nombre: 'Jhordan',
          apellido: 'Medina',
          dni: '48765432',
          correo: 'jhordan.medina@bancocontinental.pe',
          rol: 'Trabajador de Local',
          empresaId: continental.id,
          localId: continental.locales[0].id,
          fotoUrl: null,
          estado: 'activo',
          fechaAlta: '2026-02-02',
        });
      }
    }

    if (seguros?.locales[0]) {
      mock.push({
        id: nuevoUsuarioId(),
        nombre: 'Ana',
        apellido: 'Torres',
        dni: '42345678',
        correo: 'ana.torres@segurosdelsur.pe',
        rol: 'Trabajador de Local',
        empresaId: seguros.id,
        localId: seguros.locales[0].id,
        fotoUrl: null,
        estado: 'retirado',
        fechaAlta: '2026-02-10',
      });
    }

    if (telco) {
      mock.push({
        id: nuevoUsuarioId(),
        nombre: 'Diego',
        apellido: 'Ramírez',
        dni: '47891234',
        correo: 'diego.ramirez@telcoexpress.pe',
        rol: 'Empresa',
        empresaId: telco.id,
        localId: null,
        fotoUrl: null,
        estado: 'activo',
        fechaAlta: '2026-02-20',
      });
    }

    return mock;
  }

  getUsuarios(): Usuario[] {
    return this.usuarios;
  }

  getEmpresasDisponibles() {
    return this.empresasService.getEmpresas();
  }

  getLocalesDeEmpresa(empresaId: string | null) {
    if (!empresaId) return [];
    return this.empresasService.getEmpresaById(empresaId)?.locales ?? [];
  }

  agregarUsuario(datos: {
    nombre: string;
    apellido: string;
    dni: string;
    correo: string;
    rol: RolUsuario;
    empresaId: string | null;
    localId: string | null;
    fotoUrl: string | null;
  }): Usuario {
    const usuarioCreado: Usuario = {
      id: nuevoUsuarioId(),
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      dni: datos.dni.trim(),
      correo: datos.correo.trim(),
      rol: datos.rol,
      empresaId: datos.empresaId,
      localId: datos.localId,
      fotoUrl: datos.fotoUrl,
      estado: 'activo',
      fechaAlta: new Date().toISOString().slice(0, 10),
    };

    this.usuarios = [usuarioCreado, ...this.usuarios];
    return usuarioCreado;
  }

  cambiarEstado(id: string, estado: 'activo' | 'retirado'): void {
    this.usuarios = this.usuarios.map((usuario) => (usuario.id === id ? { ...usuario, estado } : usuario));
  }
}