import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { OlvidecontraComponent } from './pages/olvidecontra/olvidecontra';
import { AdminLayoutComponent } from './shared/admin-layout/admin-layout';
import { DashboardAdminComponent } from './pages/admin/dashboard/dashboard';
import { EmpresasComponent } from './pages/admin/empresas/empresas';
import { EmpresaDetalleComponent } from './pages/admin/empresa-detalle/empresa-detalle';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios';
import { EmpresaLayoutComponent } from './shared/empresa-layout/empresa-layout';
import { EmpresaDashboardComponent } from './pages/empresa/dashboard/dashboard';
import { InventarioComponent } from './pages/empresa/inventario/inventario';
import { VentasComponent } from './pages/empresa/ventas/ventas';
import { FinanzasComponent } from './pages/empresa/finanzas/finanzas';
import { AnaliticaComponent } from './pages/empresa/analitica/analitica';
import { roleGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'olvide-contrasena', component: OlvidecontraComponent },

  // ── Vista admin: un solo layout (sidebar + topbar) para todas las hijas ──
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardAdminComponent, data: { title: 'Dashboard' } },
      { path: 'empresas', component: EmpresasComponent, data: { title: 'Empresas' } },
      { path: 'empresas/:id', component: EmpresaDetalleComponent, data: { title: 'Detalle de empresa' } },
      { path: 'usuarios', component: UsuariosComponent, data: { title: 'Usuarios' } },
    ],
  },

  // ── Vista empresa: dueño y vendedor comparten layout, con permisos por rol ──
  {
    path: 'empresa',
    component: EmpresaLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        component: EmpresaDashboardComponent,
        data: { title: 'Dashboard' },
        canActivate: [roleGuard('dueño')],
      },
      {
        path: 'inventario',
        component: InventarioComponent,
        data: { title: 'Inventario' },
        canActivate: [roleGuard('dueño', 'vendedor')],
      },
      {
        path: 'ventas',
        component: VentasComponent,
        data: { title: 'Ventas' },
        canActivate: [roleGuard('dueño', 'vendedor')],
      },
      {
        path: 'finanzas',
        component: FinanzasComponent,
        data: { title: 'Finanzas' },
        canActivate: [roleGuard('dueño')],
      },
      {
        path: 'analitica',
        component: AnaliticaComponent,
        data: { title: 'Analítica' },
        canActivate: [roleGuard('dueño')],
      },
    ],
  },
];