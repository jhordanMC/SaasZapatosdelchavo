import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { SidebarComponent, SidebarItem } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';
import { PageTitleService } from './page-title';
import { AuthService } from '../../core/auth';

/**
 * Layout único para toda la sección /admin.
 * Contiene el sidebar y el topbar UNA sola vez.
 * Las páginas hijas (dashboard, empresas, usuarios, etc.) solo
 * ponen su contenido — ya no repiten <app-sidebar>/<app-topbar>.
 *
 * El menú de navegación se define aquí, en un solo lugar.
 * El título del topbar se toma de `data: { title: '...' }` en cada ruta hija.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css'],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  usuario;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    public pageTitleService: PageTitleService
  ) {
    this.usuario = this.authService.usuarioActual;
  }

  // ── Fuente única del menú de navegación admin ──────────
  navItems: SidebarItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard', exact: true },
    { label: 'Empresas', route: '/admin/empresas', icon: 'empresas' },
    { label: 'Usuarios', route: '/admin/usuarios', icon: 'usuarios' },
    { label: 'Actividad', route: '/admin/actividad', icon: 'actividad' },
    { label: 'Reportes', href: '#', icon: 'reportes' },
    { label: 'Configuración', href: '#', icon: 'config' },
  ];

  iniciales(): string {
    const nombre = this.usuario()?.nombre?.trim();
    if (!nombre) return 'A';
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
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private actualizarTitulo(): void {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) route = route.firstChild;
    this.pageTitleService.setTitle((route.data['title'] as string) ?? 'Dashboard');
  }
}