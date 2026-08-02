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
import { Anuncios } from './pages/admin/anuncios/anuncios';
import { TicketsAdminComponent } from './pages/admin/tickets/tickets';
import { EmpresaLayoutComponent } from './shared/empresa-layout/empresa-layout';
import { EmpresaDashboardComponent } from './pages/empresa/dashboard/dashboard';
import { InventarioComponent } from './pages/empresa/inventario/inventario';
import { VentasComponent } from './pages/empresa/ventas/ventas';
import { HistorialVentasComponent } from './pages/empresa/ventas/historial-ventas/historial-ventas';
import { ProformasComponent } from './pages/empresa/ventas/proformas/proformas';
import { ProformaEditorComponent } from './pages/empresa/ventas/proformas/proforma-editor/proforma-editor';
import { FinanzasComponent } from './pages/empresa/finanzas/finanzas';
import { AnaliticaComponent } from './pages/empresa/analitica/analitica';
import { IntegracionesComponent } from './pages/empresa/integraciones/integraciones';
import { NotFoundComponent } from './pages/not-found/not-found';
import { AccesoRestringidoComponent } from './pages/acceso-restringido/acceso-restringido';
import { roleGuard, redirigirSiAutenticado, vistaGuard, resolverPrimeraVista } from './core/auth.guard';

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
      { path: '', pathMatch: 'full', redirectTo: resolverPrimeraVista },
      {
        path: 'dashboard',
        component: DashboardAdminComponent,
        data: { title: 'Dashboard', subtitle: 'Vista general de la plataforma VILCAS' },
        canActivate: [vistaGuard('dashboard')],
      },
      {
        path: 'empresas',
        component: EmpresasComponent,
        data: { title: 'Empresas', subtitle: 'Empresas registradas en la plataforma' },
        canActivate: [vistaGuard('empresas')],
      },
      {
        path: 'empresas/:id',
        component: EmpresaDetalleComponent,
        data: { title: 'Detalle de empresa' },
        canActivate: [vistaGuard('empresas')],
      },
      {
        path: 'suscripciones',
        component: Suscripciones,
        data: { title: 'Suscripciones', subtitle: 'Planes y estado de suscripción por empresa' },
        canActivate: [vistaGuard('suscripciones')],
      },
      {
        path: 'actividad',
        component: ActividadComponent,
        data: { title: 'Actividad', subtitle: 'Auditoría y registro de eventos del sistema' },
        canActivate: [vistaGuard('actividad')],
      },
      {
        path: 'anuncios',
        component: Anuncios,
        data: { title: 'Anuncios', subtitle: 'Anuncios y encuestas para las empresas' },
        canActivate: [vistaGuard('anuncios')],
      },
      {
        path: 'tickets',
        component: TicketsAdminComponent,
        data: { title: 'Centro de Soporte', subtitle: 'Tickets reportados por las empresas, incluidos los de Cirobot' },
        // Sin vistaGuard a propósito: roleGuard('admin') del layout ya alcanza (ver admin-layout.ts).
      },
    ],
  },

  // ── Vista empresa: dueño y vendedor comparten layout, con permisos por rol ──
  {
    path: 'empresa',
    component: EmpresaLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: resolverPrimeraVista },
      {
        path: 'dashboard',
        component: EmpresaDashboardComponent,
        data: { title: 'Dashboard', subtitle: 'Resumen del negocio' },
        canActivate: [roleGuard('dueño'), vistaGuard('dashboard')],
      },
      {
        path: 'inventario',
        component: InventarioComponent,
        data: { title: 'Inventario', subtitle: 'Productos, tallas y stock por local' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('inventario')],
      },
      {
        path: 'ventas',
        component: VentasComponent,
        data: { title: 'Ventas', subtitle: 'Registra una nueva venta' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('ventas')],
      },
      {
        path: 'ventas/historial',
        component: HistorialVentasComponent,
        data: { title: 'Historial de ventas', subtitle: 'Ventas registradas y devoluciones' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('ventas')],
      },
      {
        path: 'ventas/proformas',
        component: ProformasComponent,
        data: { title: 'Proformas', subtitle: 'Cotizaciones para tus clientes' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('ventas')],
      },
      {
        // Debe ir antes que 'ventas/proformas/:id' — si no, Angular intenta
        // resolver "nueva" como si fuera un id de proforma.
        path: 'ventas/proformas/nueva',
        component: ProformaEditorComponent,
        data: { title: 'Nueva proforma', subtitle: 'Arma la cotización con los productos, el cliente y las condiciones de venta' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('ventas')],
      },
      {
        path: 'ventas/proformas/:id',
        component: ProformaEditorComponent,
        data: { title: 'Editar proforma', subtitle: 'Arma la cotización con los productos, el cliente y las condiciones de venta' },
        canActivate: [roleGuard('dueño', 'vendedor'), vistaGuard('ventas')],
      },
      {
        path: 'finanzas',
        component: FinanzasComponent,
        data: { title: 'Finanzas', subtitle: 'Ingresos, gastos y balance' },
        canActivate: [roleGuard('dueño'), vistaGuard('finanzas')],
      },
      {
        path: 'analitica',
        component: AnaliticaComponent,
        data: { title: 'Analítica', subtitle: 'Clientes por segmento' },
        canActivate: [roleGuard('dueño'), vistaGuard('analitica')],
      },
      {
        path: 'integraciones',
        component: IntegracionesComponent,
        data: { title: 'Integraciones', subtitle: 'Marketplaces conectados' },
        canActivate: [roleGuard('dueño'), vistaGuard('integraciones')],
      },
    ],
  },

  // ⚠️ debe ir siempre al final: un wildcard antes se comería el resto de rutas
  { path: '**', component: NotFoundComponent },
];
