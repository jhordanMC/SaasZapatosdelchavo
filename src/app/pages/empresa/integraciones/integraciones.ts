/**
 * Componente de Integraciones (vista empresa, solo dueño).
 *
 * Sección tipo "App Store": una tarjeta por marketplace.
 *   - Mercado Libre: OAuth automático. El botón manda el navegador de
 *     frente al endpoint de login del backend — no se pide ninguna API key
 *     acá, el flujo entero (login + callback) lo maneja el backend.
 *   - Falabella / Ripley: no tienen OAuth, así que abren un modal simple
 *     con "Seller ID" + "API Key" (los datos que el dueño copia y pega
 *     desde el panel de su marketplace) y al guardar pegan a
 *     POST /integrations/{proveedor}/config.
 *
 * Las alertas de stock/ventas en tiempo real (SSE) NO se manejan acá: ya
 * están conectadas globalmente desde EmpresaLayoutComponent
 * (MarketplaceRealtimeService + <app-marketplace-alerta-toast>), así que
 * cualquier venta que llegue de estos marketplaces ya dispara su aviso sin
 * que el usuario tenga que estar en esta pantalla ni recargar nada.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import {
  ConfigTiendaGuardada,
  CredencialesTiendaInput,
  EstadoConexionTienda,
  IntegracionesTenantService,
  ProveedorConCredenciales,
} from '../../../services/integraciones-tenant';
import { MarketplaceProveedor } from '../../../services/marketplace-integraciones';
import { MarketplaceRealtimeService } from '../../../services/marketplace-realtime';

interface MarketplaceCardMeta {
  id: MarketplaceProveedor;
  nombre: string;
  descripcion: string;
  iniciales: string;
  colorAcento: string;
  /** Solo los que NO tienen OAuth abren el modal de Seller ID / API Key. */
  requiereCredenciales: boolean;
}

interface AyudaCredenciales {
  pasos: string[];
  /** Link (o embed) al mini-video de ~15s. Vacío mientras marketing/backend no lo entreguen. */
  videoUrl: string;
}

@Component({
  selector: 'app-integraciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './integraciones.html',
  styleUrls: ['./integraciones.css'],
})
export class IntegracionesComponent implements OnInit {
  constructor(
    private integracionesService: IntegracionesTenantService,
    public marketplaceRealtime: MarketplaceRealtimeService,
  ) {}

  readonly marketplaces: MarketplaceCardMeta[] = [
    {
      id: 'mercado_libre',
      nombre: 'Mercado Libre',
      descripcion: 'Conexión automática por OAuth: inicia sesión con tu cuenta de Mercado Libre, sin digitar ninguna API key.',
      iniciales: 'ML',
      colorAcento: '#FFE600',
      requiereCredenciales: false,
    },
    {
      id: 'falabella',
      nombre: 'Falabella',
      descripcion: 'Pega el Seller ID y el API Key que ya tienes en tu Seller Center de Falabella.',
      iniciales: 'FA',
      colorAcento: '#6DBE45',
      requiereCredenciales: true,
    },
    {
      id: 'ripley',
      nombre: 'Ripley',
      descripcion: 'Pega el Seller ID y el API Key que ya tienes en tu panel de Ripley Marketplace.',
      iniciales: 'RI',
      colorAcento: '#E2001A',
      requiereCredenciales: true,
    },
  ];

  /** Dónde encontrar los datos, por proveedor — mostrado dentro del modal de credenciales. */
  readonly ayudaCredenciales: Record<ProveedorConCredenciales, AyudaCredenciales> = {
    falabella: {
      pasos: [
        'Entra a tu Seller Center de Falabella.',
        'Ve a Configuración → Integraciones → API.',
        'Copia tu "Seller ID" y genera (o copia) tu "API Key".',
      ],
      videoUrl: '', // TODO(marketing/backend): pegar el link al video de 15s cuando esté listo
    },
    ripley: {
      pasos: [
        'Entra a tu panel de Ripley Marketplace.',
        'Ve a Configuración → Credenciales de API.',
        'Copia tu "Seller ID" y tu "API Key".',
      ],
      videoUrl: '', // TODO(marketing/backend): pegar el link al video de 15s cuando esté listo
    },
  };

  cargandoEstado = true;

  /**
   * TODO(backend): en cuanto exista el endpoint de estado (tabla
   * tenant_integraciones), esto refleja lo que devuelva de verdad. Mientras
   * tanto arranca en "no_conectado" para los 3 — listarEstado() intenta
   * igual, por si ya lo prendieron, pero traga el error si el endpoint aún
   * no existe (404) para no romper la pantalla.
   */
  estados: Record<MarketplaceProveedor, EstadoConexionTienda> = {
    mercado_libre: 'no_conectado',
    falabella: 'no_conectado',
    ripley: 'no_conectado',
  };

  // ── Modal Seller ID / API Key (Falabella / Ripley) ───────────────────────
  proveedorModal: ProveedorConCredenciales | null = null;
  formCredenciales = { sellerId: '', apiKey: '' };
  mostrarApiKey = false;
  guardandoCredenciales = false;
  errorCredenciales: string | null = null;

  ngOnInit(): void {
    this.integracionesService
      .listarEstado()
      .pipe(catchError(() => of([] as ConfigTiendaGuardada[])))
      .subscribe((lista) => {
        this.cargandoEstado = false;
        for (const item of lista) {
          this.estados = { ...this.estados, [item.proveedor]: item.estado };
        }
      });
  }

  nombreProveedor(id: MarketplaceProveedor): string {
    return this.marketplaces.find((m) => m.id === id)?.nombre ?? id;
  }

  /** Mercado Libre: el botón manda el navegador directo al backend, no hay modal ni API key. */
  conectarMercadoLibre(): void {
    window.location.href = this.integracionesService.urlLoginMercadoLibre();
  }

  /** Wrapper para el template: los cards son MarketplaceProveedor genérico,
   *  pero el modal de credenciales solo aplica a Falabella/Ripley. */
  abrirModalCredencialesDesde(id: MarketplaceProveedor): void {
    if (id === 'falabella' || id === 'ripley') {
      this.abrirModalCredenciales(id);
    }
  }

  abrirModalCredenciales(proveedor: ProveedorConCredenciales): void {
    this.proveedorModal = proveedor;
    this.formCredenciales = { sellerId: '', apiKey: '' };
    this.mostrarApiKey = false;
    this.errorCredenciales = null;
  }

  cerrarModalCredenciales(): void {
    if (this.guardandoCredenciales) return;
    this.proveedorModal = null;
  }

  toggleMostrarApiKey(): void {
    this.mostrarApiKey = !this.mostrarApiKey;
  }

  guardarCredenciales(): void {
    if (!this.proveedorModal) return;
    const proveedor = this.proveedorModal;

    const sellerId = this.formCredenciales.sellerId.trim();
    const apiKey = this.formCredenciales.apiKey.trim();
    if (!sellerId || !apiKey) {
      this.errorCredenciales = 'Completa el Seller ID y el API Key.';
      return;
    }

    this.errorCredenciales = null;
    this.guardandoCredenciales = true;

    const payload: CredencialesTiendaInput = { seller_id: sellerId, api_key: apiKey };
    const peticion$ =
      proveedor === 'falabella'
        ? this.integracionesService.guardarConfigFalabella(payload)
        : this.integracionesService.guardarConfigRipley(payload);

    peticion$.subscribe({
      next: () => {
        this.guardandoCredenciales = false;
        this.estados = { ...this.estados, [proveedor]: 'conectado' };
        this.proveedorModal = null;
      },
      error: (err) => {
        this.guardandoCredenciales = false;
        this.errorCredenciales =
          err?.error?.detail ?? 'No se pudo guardar la conexión. Revisa los datos e intenta de nuevo.';
      },
    });
  }
}
