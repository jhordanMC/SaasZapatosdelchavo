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

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    public pageTitleService: PageTitleService
  ) {
    this.usuario = this.authService.usuarioActual;
  }

  get navItems(): SidebarItem[] {
    const esDueño = this.authService.tieneRol('dueño');
    const base: SidebarItem[] = [
      { label: 'Dashboard', route: '/empresa/dashboard', icon: 'dashboard', exact: true },
      { label: 'Inventario', route: '/empresa/inventario', icon: 'inventario' },
      { label: 'Ventas', route: '/empresa/ventas', icon: 'ventas' },
    ];
    if (esDueño) {
      base.push(
        { label: 'Finanzas', route: '/empresa/finanzas', icon: 'finanzas' },
        { label: 'Analítica', route: '/empresa/analitica', icon: 'analitica' }
      );
    }
    base.push({ label: 'Configuración', href: '#', icon: 'config' });
    return base;
  }

  rolEtiqueta(): string {
    const rol = this.usuario()?.rol;
    if (rol === 'dueño') return 'Dueño';
    if (rol === 'vendedor') return 'Vendedor';
    return 'Usuario';
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
