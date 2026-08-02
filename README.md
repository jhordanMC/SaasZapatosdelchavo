# ProyectoSaasAlba

Frontend Angular del SaaS de Alba: una plataforma multi-tenant de gestión empresarial (inventario, ventas, finanzas, analítica) con un panel de administración separado para operar las empresas suscritas.

Generado originalmente con [Angular CLI](https://github.com/angular/angular-cli) (v21.2.5).

## Stack

- **Angular 21** (standalone components, signals) + **TypeScript 5.9**
- **Tailwind CSS 4** (vía `@tailwindcss/postcss`)
- **RxJS** para estado reactivo y llamadas HTTP
- **Chart.js** para gráficos de analítica/dashboard
- **jsPDF** + **jspdf-autotable** para exportar PDFs (proformas, resúmenes)
- **xlsx** (SheetJS) para exportar/leer Excel
- **Vitest** (+ jsdom) como test runner
- React 19 está declarado como dependencia (`liveline`, integración puntual vía `src/app/livelinewc`), pero la app es Angular de punta a punta

## Estructura del proyecto

```
src/app/
├── core/               # Auth (login + 2FA), guards de rutas, interceptor HTTP, i18n, token store
├── services/            # Clientes HTTP por dominio (empresas, ventas, inventario, finanzas, usuarios, etc.)
├── shared/               # Layouts y componentes compartidos (sidebar, topbar, layouts admin/empresa, modales)
├── pages/
│   ├── login/ verificar-2fa/ olvidecontra/ acceso-restringido/ not-found/
│   ├── admin/            # Panel admin: dashboard, empresas, suscripciones, actividad, anuncios
│   └── empresa/          # Panel de cada empresa: dashboard, inventario, ventas, finanzas, analítica, integraciones
├── utils/                # Helpers de exportación (proformas, resúmenes mensuales)
└── livelinewc/           # Wrapper de integración con la librería `liveline`
```

## Arquitectura funcional

La app sirve dos paneles bajo el mismo router (`src/app/app.routes.ts`), cada uno con su propio layout:

- **`/admin`** (`AdminLayoutComponent`) — solo rol `admin`: dashboard general, gestión de empresas, suscripciones, actividad y anuncios.
- **`/empresa`** (`EmpresaLayoutComponent`) — roles `dueño` y `vendedor`, compartiendo layout con permisos distintos por rol: dashboard, inventario, ventas (con historial y proformas), finanzas, analítica e integraciones.

**Autenticación**: login en dos pasos con 2FA obligatorio por email (`AuthService` en `core/auth.ts`). El primer paso (`/iam/auth/login`) valida credenciales y devuelve un `login_token` pendiente; el segundo (`/iam/auth/verificar-2fa`) confirma el código de 6 dígitos y recién ahí entrega los tokens de sesión. La sesión se restaura al recargar la página usando el access token guardado (`TokenStore`).

**Autorización**: combina rol (`roleGuard`) y "vistas habilitadas" por usuario (`vistaGuard`), donde el backend puede deshabilitar puntualmente vistas concretas a un usuario independientemente de su rol (`core/auth.guard.ts`).

### Roles

Hay 3 roles de sistema (`RolUsuario` en `src/app/services/usuarios.ts`), cada uno con su propio panel y vistas por defecto:

| Rol | Panel | Vistas |
|---|---|---|
| `admin` | `/admin` | Dashboard, Empresas, Suscripciones, Actividad, Anuncios |
| `dueño` | `/empresa` | Dashboard, Inventario, Ventas, Finanzas, Integraciones |
| `vendedor` | `/empresa` | Inventario, Ventas |

Un usuario puede tener varios roles asignados en el backend; el frontend usa el de mayor privilegio (`admin` > `dueño` > `vendedor`, ver `mapearRol`) para decidir a dónde navega y qué vistas le corresponden por defecto. Sobre esa base, el admin puede deshabilitar puntualmente vistas concretas a un usuario (`vistasDeshabilitadas`), independientemente de lo que le daría su rol.

**Backend**: la app consume una API REST externa vía `environment.apiUrl` (`http://localhost:8000` en desarrollo, `https://api.vilcaspe.com` en producción). No incluye el backend — es un repositorio aparte.

## Desarrollo

Requiere Node.js y npm (`packageManager: npm@11.8.0` fijado en `package.json`).

```bash
npm install
npm start        # equivalente a: ng serve
```

Abre `http://localhost:4200/`. La app recarga automáticamente al modificar el código fuente.

## Generar código

```bash
ng generate component pages/empresa/mi-componente
ng generate --help   # lista completa de schematics disponibles
```

## Compilación

```bash
npm run build              # build de producción, salida en dist/ProyectoSaasAlba/browser
npm run watch               # build de desarrollo con --watch
```

## Tests

```bash
npm test    # unit tests con Vitest
```

No hay framework de e2e configurado.

## Despliegue

```bash
npm run deploy
```

Ejecuta `scripts/deploy.ps1`, que:
1. Compila el proyecto en modo producción.
2. Sincroniza (`robocopy /MIR`) la salida de `dist/ProyectoSaasAlba/browser` hacia el repo local de despliegue `D:\Alba\Saas\DespliegueFront\RepoSaasPruebas`.
3. Si hay cambios, hace commit y push en ese repo.

Azure Static Web Apps observa ese repo de despliegue y publica el sitio automáticamente tras el push. Este script asume esa ruta local fija, por lo que solo funciona en el entorno de quien tiene ese repo clonado ahí.

## Convenciones

- Formateo con Prettier (`printWidth: 100`, comillas simples, parser `angular` para HTML) — ver `.prettierrc`.
- Estilos globales en `src/styles.css`, procesados con Tailwind vía PostCSS.
- Nombres de variables, componentes y comentarios en español, siguiendo el dominio del negocio (ventas, proformas, empresas, etc.).

## Recursos adicionales

Para más información sobre Angular CLI, incluyendo referencia detallada de comandos, visita la [documentación oficial de Angular CLI](https://angular.dev/tools/cli).
