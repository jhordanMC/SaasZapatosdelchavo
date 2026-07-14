import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { OlvidecontraComponent } from './pages/olvidecontra/olvidecontra';
import { DashboardUsuarioComponent } from './pages/usuario/dashboard/dashboard';
import { AdminLayoutComponent } from './shared/admin-layout/admin-layout';
import { DashboardAdminComponent } from './pages/admin/dashboard/dashboard';
import { EmpresasComponent } from './pages/admin/empresas/empresas';
import { EmpresaDetalleComponent } from './pages/admin/empresa-detalle/empresa-detalle';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'olvide-contrasena', component: OlvidecontraComponent },

  // ── Vista admin: un solo layout (sidebar + topbar) para todas las hijas ──
  {
    path: 'admin',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardAdminComponent, data: { title: 'Dashboard' } },
      { path: 'empresas', component: EmpresasComponent, data: { title: 'Empresas' } },
      { path: 'empresas/:id', component: EmpresaDetalleComponent, data: { title: 'Detalle de empresa' } },
      { path: 'usuarios', component: UsuariosComponent, data: { title: 'Usuarios' } },
    ],
  },

  // ── Vista usuario ──
  { path: 'dashboardu', component: DashboardUsuarioComponent },
];