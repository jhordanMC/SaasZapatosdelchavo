import { Component, ElementRef, OnDestroy, AfterViewInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { AsistenteRespuesta, AsistenteService, UsoIAEmpresa } from '../../services/asistente';

/**
 * Mismo patrón de embedding React-en-Angular que ya usa
 * src/app/livelinewc/liveline-wrapper.ts (mount/unmount de un root de
 * React dentro de un <div> que este componente controla) — la única
 * diferencia es que acá el mount es async (ver cirobot-wrapper.ts:
 * three.js se importa dinámicamente para no pesar en el bundle inicial).
 *
 * Vive UNA sola vez, montado tanto en empresa-layout como en
 * admin-layout — no necesita saber en cuál está: el backend ya resuelve
 * el contexto (empresa/admin) del JWT, y el mapa de vistas de abajo
 * cubre las dos familias de rutas sin que colisionen entre sí.
 */
const VISTA_A_RUTA: Record<string, string> = {
  // Empresa
  dashboard: '/empresa/dashboard',
  inventario: '/empresa/inventario',
  catalogo: '/empresa/catalogo',
  ventas: '/empresa/ventas',
  historial_ventas: '/empresa/ventas/historial',
  proformas: '/empresa/ventas/proformas',
  finanzas: '/empresa/finanzas',
  integraciones: '/empresa/integraciones',
  // Admin
  dashboard_admin: '/admin/dashboard',
  empresas: '/admin/empresas',
  suscripciones: '/admin/suscripciones',
  actividad: '/admin/actividad',
  anuncios: '/admin/anuncios',
  tickets: '/admin/tickets',
  reclamaciones: '/admin/reclamaciones',
};

type FaseAgujero = 'girando' | 'colapsando' | 'oculto';

// Si la cabeza llega casi al instante (chunk y .glb ya en caché), no se
// muestra el agujero: colapsarlo apenas apareció sería un parpadeo.
const UMBRAL_CARGA_INSTANTANEA_MS = 250;

@Component({
  selector: 'app-cirobot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cirobot.html',
  styleUrls: ['./cirobot.css'],
})
export class CirobotComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  /**
   * Animación de carga (agujero negro) mientras bajan el chunk de React +
   * three.js y cirobot.glb. Vive acá, en HTML/CSS de Angular, y no en React
   * a propósito: este componente se pinta con el layout, mientras que todo
   * lo de cirobotwc llega por import() dinámico — en un celular con datos
   * lentos, cualquier loader hecho en React aparecería recién al final.
   */
  readonly faseAgujero = signal<FaseAgujero>('girando');
  private readonly montadoEn = performance.now();

  constructor(
    private asistenteService: AsistenteService,
    private router: Router,
    private authService: AuthService,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.montar();
    } catch (error) {
      // Sin Cirobot no tiene sentido dejar el agujero girando para siempre.
      this.faseAgujero.set('oculto');
      throw error;
    }
  }

  alModeloListo(): void {
    if (this.faseAgujero() !== 'girando') return;
    const instantaneo = performance.now() - this.montadoEn < UMBRAL_CARGA_INSTANTANEA_MS;
    this.faseAgujero.set(instantaneo ? 'oculto' : 'colapsando');
  }

  alTerminarAnimacionAgujero(evento: AnimationEvent): void {
    // Los hijos tienen animaciones infinitas; solo interesa el colapso del
    // contenedor. Se busca por fragmento porque Angular renombra los
    // @keyframes por componente (encapsulación emulada).
    if (evento.target === evento.currentTarget && /colapso|desvanece/.test(evento.animationName)) {
      this.faseAgujero.set('oculto');
    }
  }

  private async montar(): Promise<void> {
    const { mountCirobot } = await import('../../cirobotwc/cirobot-wrapper');
    // Mismo criterio que el backend (router.py: id_empresa === EMPRESA_ALBA_ID),
    // pero del lado Angular ya viene resuelto en el rol — evita duplicar esa
    // constante acá. Sirve para que la UI (chips iniciales, etc.) no le
    // ofrezca a un admin acciones que el backend igual le va a rechazar.
    const contexto = this.authService.tieneRol('admin') ? 'admin' : 'empresa';
    // Rol solo para que la UI no ofrezca chips que el backend igual le va a negar
    // (el permiso real lo valida el backend por rol y vistas; ver chatbot/mcp/permisos.py).
    const rol = this.authService.tieneRol('admin') ? 'admin' : this.authService.tieneRol('dueño') ? 'dueño'
      : this.authService.tieneRol('inventario') ? 'inventario' : 'vendedor';
    await mountCirobot(this.hostRef.nativeElement, {
      contexto,
      rol,
      onEnviarMensaje: (texto: string) => this.enviarMensaje(texto),
      onNavegar: (vista: string) => this.navegar(vista),
      onObtenerUsoIA: () => this.obtenerUsoIA(),
      onModeloListo: () => this.alModeloListo(),
    });
  }

  async ngOnDestroy(): Promise<void> {
    const { unmountCirobot } = await import('../../cirobotwc/cirobot-wrapper');
    unmountCirobot(this.hostRef.nativeElement);
  }

  private enviarMensaje(texto: string): Promise<AsistenteRespuesta> {
    return firstValueFrom(this.asistenteService.enviarMensaje(texto));
  }

  private obtenerUsoIA(): Promise<UsoIAEmpresa> {
    return firstValueFrom(this.asistenteService.obtenerUsoIA());
  }

  private navegar(vista: string): void {
    const ruta = VISTA_A_RUTA[vista];
    if (!ruta) return;
    this.router.navigate([ruta]);
  }
}