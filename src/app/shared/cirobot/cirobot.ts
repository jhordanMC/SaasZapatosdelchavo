import { Component, ElementRef, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AsistenteRespuesta, AsistenteService } from '../../services/asistente';

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
};

@Component({
  selector: 'app-cirobot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cirobot.html',
  styleUrls: ['./cirobot.css'],
})
export class CirobotComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  constructor(private asistenteService: AsistenteService, private router: Router) {}

  async ngAfterViewInit(): Promise<void> {
    const { mountCirobot } = await import('../../cirobotwc/cirobot-wrapper');
    await mountCirobot(this.hostRef.nativeElement, {
      onEnviarMensaje: (texto: string) => this.enviarMensaje(texto),
      onNavegar: (vista: string) => this.navegar(vista),
    });
  }

  async ngOnDestroy(): Promise<void> {
    const { unmountCirobot } = await import('../../cirobotwc/cirobot-wrapper');
    unmountCirobot(this.hostRef.nativeElement);
  }

  private enviarMensaje(texto: string): Promise<AsistenteRespuesta> {
    return firstValueFrom(this.asistenteService.enviarMensaje(texto));
  }

  private navegar(vista: string): void {
    const ruta = VISTA_A_RUTA[vista];
    if (!ruta) return;
    this.router.navigate([ruta]);
  }
}
