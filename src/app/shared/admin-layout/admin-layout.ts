import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { SidebarComponent, SidebarItem } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';
import { PageTitleService } from './page-title';

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
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    public pageTitleService: PageTitleService
  ) {}

  // ── Fuente única del menú de navegación admin ──────────
  navItems: SidebarItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard', exact: true },
    { label: 'Empresas', route: '/admin/empresas', icon: 'empresas' },
    { label: 'Usuarios', route: '/admin/usuarios', icon: 'usuarios' },
    { label: 'Reportes', href: '#', icon: 'reportes' },
    { label: 'Configuración', href: '#', icon: 'config' },
  ];

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