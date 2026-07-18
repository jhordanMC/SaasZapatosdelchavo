import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { SidebarComponent, SidebarItem } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';
import { PageTitleService } from '../admin-layout/page-title';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-empresa-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './empresa-layout.html',
  styleUrls: ['./empresa-layout.css'],
})
export class EmpresaLayoutComponent implements OnInit, OnDestroy {
  usuario;
  navItems: SidebarItem[];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    public pageTitleService: PageTitleService
  ) {
    this.usuario = this.authService.usuarioActual;

    // El Vendedor no tiene acceso a dashboard/finanzas/analítica (el
    // roleGuard de esas rutas exige 'dueño') — antes el sidebar siempre
    // mostraba "Dashboard" sin importar el rol, y el Vendedor terminaba
    // clickeando un link que el guard le rebotaba a /login.
    const esDueño = this.authService.tieneRol('dueño');
    const base: SidebarItem[] = [];
    if (esDueño) {
      base.push({ label: 'Dashboard', route: '/empresa/dashboard', icon: 'dashboard', exact: true });
    }
    base.push(
      { label: 'Inventario', route: '/empresa/inventario', icon: 'inventario' },
      { label: 'Ventas', route: '/empresa/ventas', icon: 'ventas' },
    );
    if (esDueño) {
      base.push(
        { label: 'Finanzas', route: '/empresa/finanzas', icon: 'finanzas' },
        { label: 'Analítica', route: '/empresa/analitica', icon: 'analitica' }
      );
    }
    base.push({ label: 'Configuración', href: '#', icon: 'config' });
    this.navItems = base;
  }

  rolEtiqueta(): string {
    const rol = this.usuario()?.rol;
    if (rol === 'dueño') return 'Dueño';
    if (rol === 'vendedor') return 'Vendedor';
    return 'Usuario';
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
