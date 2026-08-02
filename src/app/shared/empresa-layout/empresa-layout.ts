import { Component, OnDestroy, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { SidebarComponent, SidebarItem } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';
import { MarketplaceAlertaToastComponent } from '../marketplace-alerta-toast/marketplace-alerta-toast';
import { CirobotComponent } from '../cirobot/cirobot';
import { PageTitleService } from '../admin-layout/page-title';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n.service';
import { ClaveVista } from '../../services/usuarios';
import { MarketplaceRealtimeService } from '../../services/marketplace-realtime';

@Component({
  selector: 'app-empresa-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, MarketplaceAlertaToastComponent, CirobotComponent],
  templateUrl: './empresa-layout.html',
  styleUrls: ['./empresa-layout.css'],
})
export class EmpresaLayoutComponent implements OnInit, OnDestroy {
  usuario;
  /** Reactivo: se recalcula solo al cambiar el idioma (i18n.lang()), sin recargar la página. */
  navItems;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    public pageTitleService: PageTitleService,
    private i18n: I18nService,
    private marketplaceRealtime: MarketplaceRealtimeService,
  ) {
    this.usuario = this.authService.usuarioActual;

    // El Vendedor no tiene acceso a dashboard/finanzas/analítica (el
    // roleGuard de esas rutas exige 'dueño') — antes el sidebar siempre
    // mostraba "Dashboard" sin importar el rol, y el Vendedor terminaba
    // clickeando un link que el guard le rebotaba a /login.
    const esDueño = this.authService.tieneRol('dueño');

    this.navItems = computed<SidebarItem[]>(() => {
      this.i18n.lang(); // dependencia reactiva: fuerza recálculo al cambiar idioma
      // Además del rol, cada vista puede estar deshabilitada puntualmente
      // para este usuario (modal "Permisos de vista" del panel admin) —
      // no tiene sentido listarla en el sidebar si el guard igual la va
      // a bloquear.
      const puedeVer = (clave: ClaveVista) => this.authService.puedeVerVista(clave);

      const base: SidebarItem[] = [];
      if (esDueño && puedeVer('dashboard')) {
        base.push({ label: this.i18n.t('NAV.DASHBOARD'), route: '/empresa/dashboard', icon: 'dashboard', exact: true });
      }
      if (puedeVer('inventario')) {
        base.push({ label: this.i18n.t('NAV.INVENTARIO'), route: '/empresa/inventario', icon: 'inventario' });
      }
      if (puedeVer('ventas')) {
        base.push({
          label: this.i18n.t('NAV.VENTAS'),
          route: '/empresa/ventas',
          icon: 'ventas',
          exact: true,
          subItems: [
            { label: this.i18n.t('NAV.VENTAS_HISTORIAL'), route: '/empresa/ventas/historial' },
            { label: this.i18n.t('NAV.VENTAS_PROFORMAS'), route: '/empresa/ventas/proformas' },
          ],
        });
      }
      if (esDueño && puedeVer('finanzas')) {
        base.push({ label: this.i18n.t('NAV.FINANZAS'), route: '/empresa/finanzas', icon: 'finanzas' });
        // Analítica: oculta a pedido, se reactivará más adelante.
        // { label: this.i18n.t('NAV.ANALITICA'), route: '/empresa/analitica', icon: 'analitica' }
      }
      // Integraciones maneja credenciales de marketplaces (Seller ID / API Key)
      // y el OAuth de Mercado Libre — solo el dueño debe verla.
      if (esDueño && puedeVer('integraciones')) {
        base.push({ label: this.i18n.t('NAV.INTEGRACIONES'), route: '/empresa/integraciones', icon: 'integraciones' });
      }
      // Configuración: oculta a pedido, se reactivará más adelante.
      // base.push({ label: this.i18n.t('NAV.CONFIGURACION'), href: '#', icon: 'config' });
      return base;
    });
  }

  rolEtiqueta(): string {
    const rol = this.usuario()?.rol;
    if (rol === 'dueño') return this.i18n.t('NAV.ROL_DUENO');
    if (rol === 'vendedor') return this.i18n.t('NAV.ROL_VENDEDOR');
    return this.i18n.t('NAV.ROL_USUARIO');
  }

  iniciales(): string {
    const nombre = this.usuario()?.nombre?.trim();
    if (!nombre) return 'U';
    const palabras = nombre.split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  private routerSub?: Subscription;

  ngOnInit(): void {
    this.actualizarTitulo();
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.actualizarTitulo());
    this.marketplaceRealtime.conectar();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.marketplaceRealtime.desconectar();
  }

  private actualizarTitulo(): void {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) route = route.firstChild;
    this.pageTitleService.setTitle((route.data['title'] as string) ?? 'Dashboard');
    this.pageTitleService.setSubtitle((route.data['subtitle'] as string) ?? '');
  }
}
