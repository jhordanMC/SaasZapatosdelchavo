import { Injectable } from '@angular/core';

export type TipoEmpresa = 'Banca' | 'Seguros' | 'Telecomunicaciones' | 'Retail' | 'Financiero';

export interface Local {
  id: string;
  nombre: string;
  direccion: string;
  descripcion: string;
}

export interface Empresa {
  id: string;
  nombre: string;
  tipo: TipoEmpresa;
  asesores: number;
  entrenadores: number;
  scorePromedio: number;
  plan: string;
  estado: 'activo' | 'inactivo';
  fechaAlta: string;
  ingresosMes: number;
  locales: Local[];
}

let localAutoId = 0;
function nuevoLocalId(): string {
  localAutoId += 1;
  return `local-${localAutoId}`;
}

function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private empresas: Empresa[] = [
    {
      id: 'banco-continental',
      nombre: 'Banco Continental',
      tipo: 'Banca',
      asesores: 24,
      entrenadores: 3,
      scorePromedio: 84,
      plan: 'Pro',
      estado: 'activo',
      fechaAlta: '2026-01-05',
      ingresosMes: 4800,
      locales: [
        { id: nuevoLocalId(), nombre: 'Sede San Isidro', direccion: 'Av. Rivera Navarrete 501, San Isidro', descripcion: 'Agencia principal y oficinas administrativas.' },
        { id: nuevoLocalId(), nombre: 'Sede Miraflores', direccion: 'Av. Larco 345, Miraflores', descripcion: 'Atención al cliente y ventanilla preferencial.' },
        { id: nuevoLocalId(), nombre: 'Sede La Molina', direccion: 'Av. Javier Prado Este 4200, La Molina', descripcion: 'Agencia de zona residencial.' },
        { id: nuevoLocalId(), nombre: 'Sede Surco', direccion: 'Av. Caminos del Inca 1234, Surco', descripcion: 'Agencia con horario extendido.' },
        { id: nuevoLocalId(), nombre: 'Sede Callao', direccion: 'Av. Sáenz Peña 210, Callao', descripcion: 'Agencia portuaria.' },
        { id: nuevoLocalId(), nombre: 'Sede Los Olivos', direccion: 'Av. Carlos Izaguirre 789, Los Olivos', descripcion: 'Agencia zona norte.' },
      ],
    },
    {
      id: 'seguros-del-sur',
      nombre: 'Seguros del Sur',
      tipo: 'Seguros',
      asesores: 12,
      entrenadores: 2,
      scorePromedio: 77,
      plan: 'Básico',
      estado: 'activo',
      fechaAlta: '2026-01-20',
      ingresosMes: 1200,
      locales: [
        { id: nuevoLocalId(), nombre: 'Oficina Central', direccion: 'Av. El Sol 120, Arequipa', descripcion: 'Oficina matriz.' },
        { id: nuevoLocalId(), nombre: 'Sucursal Cusco', direccion: 'Av. de la Cultura 555, Cusco', descripcion: 'Atención a asegurados regionales.' },
        { id: nuevoLocalId(), nombre: 'Sucursal Tacna', direccion: 'Av. Bolognesi 300, Tacna', descripcion: 'Sucursal fronteriza.' },
      ],
    },
    {
      id: 'telco-express',
      nombre: 'Telco Express',
      tipo: 'Telecomunicaciones',
      asesores: 31,
      entrenadores: 4,
      scorePromedio: 91,
      plan: 'Pro',
      estado: 'activo',
      fechaAlta: '2026-02-03',
      ingresosMes: 6200,
      locales: Array.from({ length: 9 }, (_, i) => ({
        id: nuevoLocalId(),
        nombre: `Tienda ${i + 1}`,
        direccion: `Centro Comercial Plaza ${i + 1}, Lima`,
        descripcion: 'Punto de venta y soporte técnico.',
      })),
    },
    {
      id: 'retail-max',
      nombre: 'Retail Max',
      tipo: 'Retail',
      asesores: 8,
      entrenadores: 1,
      scorePromedio: 68,
      plan: 'Básico',
      estado: 'inactivo',
      fechaAlta: '2026-02-15',
      ingresosMes: 0,
      locales: [
        { id: nuevoLocalId(), nombre: 'Tienda Jockey Plaza', direccion: 'Av. Javier Prado Este 4200, Santiago de Surco', descripcion: 'Local en cierre temporal.' },
        { id: nuevoLocalId(), nombre: 'Tienda Mega Plaza', direccion: 'Av. Alfredo Mendiola 3698, Independencia', descripcion: 'Local en cierre temporal.' },
      ],
    },
    {
      id: 'financiera-norte',
      nombre: 'Financiera Norte',
      tipo: 'Financiero',
      asesores: 19,
      entrenadores: 3,
      scorePromedio: 80,
      plan: 'Pro',
      estado: 'activo',
      fechaAlta: '2026-03-01',
      ingresosMes: 3800,
      locales: [
        { id: nuevoLocalId(), nombre: 'Agencia Trujillo', direccion: 'Av. España 450, Trujillo', descripcion: 'Agencia matriz zona norte.' },
        { id: nuevoLocalId(), nombre: 'Agencia Chiclayo', direccion: 'Av. Balta 620, Chiclayo', descripcion: 'Agencia regional.' },
        { id: nuevoLocalId(), nombre: 'Agencia Piura', direccion: 'Av. Grau 310, Piura', descripcion: 'Agencia regional.' },
        { id: nuevoLocalId(), nombre: 'Agencia Chimbote', direccion: 'Av. Pardo 200, Chimbote', descripcion: 'Agencia regional.' },
      ],
    },
  ];

  getEmpresas(): Empresa[] {
    return this.empresas;
  }

  getEmpresaById(id: string): Empresa | undefined {
    return this.empresas.find((empresa) => empresa.id === id);
  }

  private generarIdUnico(nombre: string): string {
    const base = slugify(nombre) || 'empresa';
    let id = base;
    let sufijo = 2;
    while (this.empresas.some((empresa) => empresa.id === id)) {
      id = `${base}-${sufijo}`;
      sufijo += 1;
    }
    return id;
  }

  crearLocal(nombre: string, direccion: string, descripcion: string): Local {
    return { id: nuevoLocalId(), nombre: nombre.trim(), direccion: direccion.trim(), descripcion: descripcion.trim() };
  }

  agregarEmpresa(datos: {
    nombre: string;
    tipo: TipoEmpresa;
    plan: string;
    locales: Local[];
  }): Empresa {
    const empresaCreada: Empresa = {
      id: this.generarIdUnico(datos.nombre),
      nombre: datos.nombre.trim(),
      tipo: datos.tipo,
      asesores: 0,
      entrenadores: 0,
      scorePromedio: 0,
      plan: datos.plan,
      estado: 'activo',
      fechaAlta: new Date().toISOString().slice(0, 10),
      ingresosMes: 0,
      locales: datos.locales,
    };

    this.empresas = [empresaCreada, ...this.empresas];
    return empresaCreada;
  }
}