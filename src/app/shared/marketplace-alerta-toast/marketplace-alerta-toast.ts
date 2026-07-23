import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  EventoMarketplace,
  MarketplaceRealtimeService,
} from '../../services/marketplace-realtime';
import { MARKETPLACES_DISPONIBLES, MarketplaceProveedor } from '../../services/marketplace-integraciones';

type SeveridadToast = 'info' | 'advertencia' | 'critica';

interface ToastMarketplace {
  id: string;
  severidad: SeveridadToast;
  titulo: string;
  mensaje: string;
}

const DURACION_AUTO_CIERRE_MS = 7000;

@Component({
  selector: 'app-marketplace-alerta-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketplace-alerta-toast.html',
  styleUrls: ['./marketplace-alerta-toast.css'],
})
export class MarketplaceAlertaToastComponent implements OnInit, OnDestroy {
  constructor(private realtimeService: MarketplaceRealtimeService) {}

  toasts: ToastMarketplace[] = [];
  private sub?: Subscription;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    // La conexión SSE se abre una sola vez (idempotente) al montar el layout.
    this.realtimeService.conectar();
    this.sub = this.realtimeService.escuchar().subscribe((evento) => this.mostrarToast(evento));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timers.forEach((t) => clearTimeout(t));
  }

  private nombreMarketplace(proveedor: MarketplaceProveedor): string {
    return MARKETPLACES_DISPONIBLES.find((m) => m.id === proveedor)?.nombre ?? proveedor;
  }

  private mostrarToast(evento: EventoMarketplace): void {
    const toast = this.construirToast(evento);
    this.toasts = [toast, ...this.toasts].slice(0, 4); // máximo 4 apiladas a la vez
    const timer = setTimeout(() => this.cerrarToast(toast.id), DURACION_AUTO_CIERRE_MS);
    this.timers.set(toast.id, timer);
  }

  private construirToast(evento: EventoMarketplace): ToastMarketplace {
    const nombreProveedor = this.nombreMarketplace(evento.proveedor);

    if (evento.tipo === 'venta_marketplace_confirmada') {
      const totalUnidades = evento.productos.reduce((acc, p) => acc + p.cantidad, 0);
      const primerProducto = evento.productos[0];
      const detalleProductos =
        evento.productos.length > 1
          ? `${primerProducto.nombre} y ${evento.productos.length - 1} producto(s) más`
          : primerProducto.nombre;

      return {
        id: evento.id_evento,
        severidad: 'info',
        titulo: 'Se vendió un producto',
        mensaje: `Se vendieron ${totalUnidades} par(es) de ${detalleProductos} en ${nombreProveedor}.`,
      };
    }

    if (evento.tipo === 'token_vencido') {
      return {
        id: evento.id_evento,
        severidad: 'advertencia',
        titulo: 'Conexión por vencer',
        mensaje: `Tu conexión con ${nombreProveedor} venció. Reconéctala desde el detalle de tu empresa.`,
      };
    }

    return {
      id: evento.id_evento,
      severidad: 'critica',
      titulo: 'Error de sincronización',
      mensaje: `No se pudo sincronizar con ${nombreProveedor}: ${evento.mensaje}`,
    };
  }

  cerrarToast(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
