import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { Verificar2faComponent } from './pages/verificar-2fa/verificar-2fa';
import { OlvidecontraComponent } from './pages/olvidecontra/olvidecontra';
import { AdminLayoutComponent } from './shared/admin-layout/admin-layout';
import { DashboardAdminComponent } from './pages/admin/dashboard/dashboard';
import { EmpresasComponent } from './pages/admin/empresas/empresas';
import { EmpresaDetalleComponent } from './pages/admin/empresa-detalle/empresa-detalle';
import { Suscripciones } from './pages/admin/suscripciones/suscripciones';
import { ActividadComponent } from './pages/admin/actividad/actividad';
import { EmpresaLayoutComponent } from './shared/empresa-layout/empresa-layout';
import { EmpresaDashboardComponent } from './pages/empresa/dashboard/dashboard';
import { InventarioComponent } from './pages/empresa/inventario/inventario';
import { VentasComponent } from './pages/empresa/ventas/ventas';
import { FinanzasComponent } from './pages/empresa/finanzas/finanzas';
import { AnaliticaComponent } from './pages/empresa/analitica/analitica';
import { NotFoundComponent } from './pages/not-found/not-found';
import { AccesoRestringidoComponent } from './pages/acceso-restringido/acceso-restringido';
import { roleGuard, redirigirSiAutenticado, vistaGuard } from './core/auth.guard';

export const routes: Routes = [
  // canActivate no se ejecuta en una ruta que solo hace redirectTo (Angular
  // resuelve el redirect antes de correr guards), así que el chequeo de
  // "ya autenticado" vive únicamente en la ruta 'login' de abajo.
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [redirigirSiAutenticado] },
  { path: 'verificar-2fa', component: Verificar2faComponent },
  { path: 'olvide-contrasena', component: OlvidecontraComponent },
  { path: 'acceso-restringido', component: AccesoRestringidoComponent },

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
      { path: 'suscripciones', component: Suscripciones, data: { title: 'Suscripciones' } },
      { path: 'actividad', component: ActividadComponent, data: { title: 'Actividad' } },
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
        canActivate: [roleGuard('dueño'), vistaGuard('dashboard')],
      },
      {
        path: 'inventario',
        component: InventarioComponent,
        data: { title: 'Inventario' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('inventario')],
      },
      {
        path: 'ventas',
        component: VentasComponent,
        data: { title: 'Ventas' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('ventas')],
      },
      {
        path: 'finanzas',
        component: FinanzasComponent,
        data: { title: 'Finanzas' },
        canActivate: [roleGuard('dueño'), vistaGuard('finanzas')],
      },
      {
        path: 'analitica',
        component: AnaliticaComponent,
        data: { title: 'Analítica' },
        canActivate: [roleGuard('dueño'), vistaGuard('analitica')],
      },
    ],
  },

  // ⚠️ debe ir siempre al final: un wildcard antes se comería el resto de rutas
  { path: '**', component: NotFoundComponent },
];