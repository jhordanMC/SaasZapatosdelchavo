import { Injectable, signal } from '@angular/core';

export type AppLang = 'es' | 'en' | 'qu';

const STORAGE_KEY = 'vilcas_app_lang';

/**
 * Diccionario global de la aplicación. Cada clave es un identificador estable
 * (no cambia aunque cambie el texto visible) y cada idioma tiene su traducción.
 * Si una clave no existe en el idioma activo, se cae a español automáticamente.
 *
 * Convención de claves: SECCION.subclave (todo en mayúsculas para la sección).
 */
const DICT: Record<AppLang, Record<string, string>> = {
  es: {
    // Sidebar / navegación
    'NAV.DASHBOARD': 'Dashboard',
    'NAV.INVENTARIO': 'Inventario',
    'NAV.CATALOGO': 'Catálogos',
    'NAV.VENTAS': 'Ventas',
    'NAV.VENTAS_HISTORIAL': 'Ver Historial',
    'NAV.VENTAS_PROFORMAS': 'Proformas',
    'NAV.FINANZAS': 'Finanzas',
    'NAV.ANALITICA': 'Analítica',
    'NAV.INTEGRACIONES': 'Integraciones',
    'NAV.CONFIGURACION': 'Configuración',
    'NAV.ROL_DUENO': 'Dueño',
    'NAV.ROL_VENDEDOR': 'Vendedor',
    'NAV.ROL_USUARIO': 'Usuario',
    'NAV.CERRAR_SESION': 'Cerrar sesión',
    'NAV.CERRAR': 'Cerrar',
    'NAV.CONFIRMAR_CIERRE_TITULO': '¿Cerrar sesión?',
    'NAV.CONFIRMAR_CIERRE_DESC': 'Vas a salir de tu cuenta. Vas a necesitar volver a iniciar sesión para continuar.',
    'NAV.CONFIRMAR_CIERRE_SI': 'Sí, cerrar sesión',
    'NAV.CONFIRMAR_CIERRE_CANCELAR': 'Cancelar',
    'NAV.VER_PERFIL_ID': 'ID de usuario',
    'NAV.VER_PERFIL_DNI': 'DNI',
    'NAV.VER_PERFIL_CORREO': 'Correo',
    'NAV.VER_PERFIL_TELEFONO': 'Teléfono',

    // Login
    'LOGIN.CORREO_PLACEHOLDER': 'Correo electrónico',
    'LOGIN.PASSWORD_PLACEHOLDER': 'Contraseña',
    'LOGIN.RECORDARME': 'Recordarme',
    'LOGIN.OLVIDE_PASSWORD': '¿Olvidaste tu contraseña?',
    'LOGIN.INICIAR_SESION': 'Iniciar Sesión',
    'LOGIN.SIN_CUENTA': '¿Sin cuenta?',
    'LOGIN.CONTACTAR_VENTAS': 'Contactar al área de ventas',
    'LOGIN.POWERED_BY': 'Powered by ALBA',
    'LOGIN.PASSWORD_CORRECTA': '¡Contraseña correcta!',
    'LOGIN.CODIGO_ENVIADO': 'Te enviamos un código a tu correo.',
    'LOGIN.REDIRIGIENDO_2FA': 'Redirigiendo a verificación…',
    'LOGIN.ERR_CORREO_VACIO': 'Ingresa tu correo.',
    'LOGIN.ERR_CORREO_INVALIDO': 'El correo no es válido.',
    'LOGIN.ERR_PASSWORD_CORTA': 'Contraseña mínimo 6 caracteres.',
    'LOGIN.ERR_401': 'Email o contraseña incorrectos.',
    'LOGIN.ERR_403': 'El acceso de tu empresa a la plataforma está restringido. Contacta a soporte de ALBA.',
    'LOGIN.ERR_429': 'Demasiados intentos. Espera un momento antes de volver a intentar.',
    'LOGIN.ERR_SIN_CONEXION': 'No se pudo conectar con el servidor. Intenta de nuevo.',
    'LOGIN.ERR_INESPERADO': 'Ocurrió un error inesperado. Intenta de nuevo.',
    'LOGIN.CLICK_DESCUBRIR': 'Click para descubrir',

    // Dashboard (empresa) — KPIs y secciones principales
    'DASH.INGRESOS_MES': 'Ingresos del mes',
    'DASH.INGRESOS_MES_SUB': 'últimos 30 días',
    'DASH.UTILIDAD_NETA': 'Utilidad neta real',
    'DASH.UTILIDAD_NETA_SUB': 'ingresos − costo − gastos',
    'DASH.TICKET_PROMEDIO': 'Ticket promedio',
    'DASH.TICKET_PROMEDIO_SUB': 'por venta',
    'DASH.VALOR_INVENTARIO': 'Valor de inventario',
    'DASH.VALOR_INVENTARIO_SUB': 'a costo de compra',
    'DASH.RIESGO_MERMA': 'Productos en riesgo de merma',
    'DASH.RIESGO_MERMA_SUB': 'rotación lenta o nula',
    'DASH.WATERFALL_TITLE': 'De la venta a la ganancia real',
    'DASH.WATERFALL_SUB': 'Lo que entra, lo que cuesta reponer mercadería y lo que realmente te queda — últimos 30 días.',
    'DASH.INGRESOS_VENTAS': 'Ingresos por ventas',
    'DASH.COSTO_MERCADERIA': '− Costo de mercadería vendida',
    'DASH.UTILIDAD_BRUTA': '= Utilidad bruta',
    'DASH.GASTOS_OPERATIVOS': '− Gastos operativos',
    'DASH.UTILIDAD_NETA_REAL': '= Utilidad neta real',
    'DASH.PRODUCTO_MAS_VENDIDO': 'Producto más vendido',
    'DASH.MENOS_VENDIDO': 'Menos vendido (con ventas)',
  },
  en: {
    'NAV.DASHBOARD': 'Dashboard',
    'NAV.INVENTARIO': 'Inventory',
    'NAV.CATALOGO': 'Catalogs',
    'NAV.VENTAS': 'Sales',
    'NAV.VENTAS_HISTORIAL': 'View History',
    'NAV.VENTAS_PROFORMAS': 'Quotes',
    'NAV.FINANZAS': 'Finance',
    'NAV.ANALITICA': 'Analytics',
    'NAV.INTEGRACIONES': 'Integrations',
    'NAV.CONFIGURACION': 'Settings',
    'NAV.ROL_DUENO': 'Owner',
    'NAV.ROL_VENDEDOR': 'Seller',
    'NAV.ROL_USUARIO': 'User',
    'NAV.CERRAR_SESION': 'Log out',
    'NAV.CERRAR': 'Close',
    'NAV.CONFIRMAR_CIERRE_TITULO': 'Log out?',
    'NAV.CONFIRMAR_CIERRE_DESC': 'You are about to log out. You will need to sign in again to continue.',
    'NAV.CONFIRMAR_CIERRE_SI': 'Yes, log out',
    'NAV.CONFIRMAR_CIERRE_CANCELAR': 'Cancel',
    'NAV.VER_PERFIL_ID': 'User ID',
    'NAV.VER_PERFIL_DNI': 'National ID',
    'NAV.VER_PERFIL_CORREO': 'Email',
    'NAV.VER_PERFIL_TELEFONO': 'Phone',

    'LOGIN.CORREO_PLACEHOLDER': 'Email address',
    'LOGIN.PASSWORD_PLACEHOLDER': 'Password',
    'LOGIN.RECORDARME': 'Remember me',
    'LOGIN.OLVIDE_PASSWORD': 'Forgot your password?',
    'LOGIN.INICIAR_SESION': 'Sign In',
    'LOGIN.SIN_CUENTA': "Don't have an account?",
    'LOGIN.CONTACTAR_VENTAS': 'Contact our sales team',
    'LOGIN.POWERED_BY': 'Powered by ALBA',
    'LOGIN.PASSWORD_CORRECTA': 'Password correct!',
    'LOGIN.CODIGO_ENVIADO': "We've sent a code to your email.",
    'LOGIN.REDIRIGIENDO_2FA': 'Redirecting to verification…',
    'LOGIN.ERR_CORREO_VACIO': 'Enter your email.',
    'LOGIN.ERR_CORREO_INVALIDO': 'The email is not valid.',
    'LOGIN.ERR_PASSWORD_CORTA': 'Password must be at least 6 characters.',
    'LOGIN.ERR_401': 'Incorrect email or password.',
    'LOGIN.ERR_403': 'Your company\'s access to the platform is restricted. Contact ALBA support.',
    'LOGIN.ERR_429': 'Too many attempts. Please wait a moment before trying again.',
    'LOGIN.ERR_SIN_CONEXION': 'Could not connect to the server. Please try again.',
    'LOGIN.ERR_INESPERADO': 'An unexpected error occurred. Please try again.',
    'LOGIN.CLICK_DESCUBRIR': 'Click to discover',

    'DASH.INGRESOS_MES': 'Revenue this month',
    'DASH.INGRESOS_MES_SUB': 'last 30 days',
    'DASH.UTILIDAD_NETA': 'Real net profit',
    'DASH.UTILIDAD_NETA_SUB': 'revenue − cost − expenses',
    'DASH.TICKET_PROMEDIO': 'Average ticket',
    'DASH.TICKET_PROMEDIO_SUB': 'per sale',
    'DASH.VALOR_INVENTARIO': 'Inventory value',
    'DASH.VALOR_INVENTARIO_SUB': 'at purchase cost',
    'DASH.RIESGO_MERMA': 'Products at shrinkage risk',
    'DASH.RIESGO_MERMA_SUB': 'slow or no turnover',
    'DASH.WATERFALL_TITLE': 'From sale to real profit',
    'DASH.WATERFALL_SUB': 'What comes in, what it costs to restock, and what you actually keep — last 30 days.',
    'DASH.INGRESOS_VENTAS': 'Sales revenue',
    'DASH.COSTO_MERCADERIA': '− Cost of goods sold',
    'DASH.UTILIDAD_BRUTA': '= Gross profit',
    'DASH.GASTOS_OPERATIVOS': '− Operating expenses',
    'DASH.UTILIDAD_NETA_REAL': '= Real net profit',
    'DASH.PRODUCTO_MAS_VENDIDO': 'Best seller',
    'DASH.MENOS_VENDIDO': 'Lowest seller (with sales)',
  },
  qu: {
    'NAV.DASHBOARD': 'Dashboard',
    'NAV.INVENTARIO': 'Qhatuna waqaychana',
    'NAV.CATALOGO': 'Katalogokuna',
    'NAV.VENTAS': 'Rantikuykuna',
    'NAV.VENTAS_HISTORIAL': 'Historial rikuy',
    'NAV.VENTAS_PROFORMAS': 'Proformas',
    'NAV.FINANZAS': 'Qullqi',
    'NAV.ANALITICA': 'Qhaway huñusqa',
    'NAV.CONFIGURACION': 'Configuración',
    'NAV.ROL_DUENO': 'Kamayuq',
    'NAV.ROL_VENDEDOR': 'Rantichiq',
    'NAV.ROL_USUARIO': 'Servichikuq',
    'NAV.CERRAR_SESION': 'Lluqsiy',
    'NAV.CERRAR': 'Wichqay',
    'NAV.CONFIRMAR_CIERRE_TITULO': '¿Lluqsiyta munankichu?',
    'NAV.CONFIRMAR_CIERRE_DESC': 'Cuentaykimanta lluqsinki. Kutimuspa qallarinaykipaq, watiqmanta yaykunayki tiyan.',
    'NAV.CONFIRMAR_CIERRE_SI': 'Ari, lluqsiy',
    'NAV.CONFIRMAR_CIERRE_CANCELAR': 'Mana',
    'NAV.VER_PERFIL_ID': 'Servichikuq ID',
    'NAV.VER_PERFIL_DNI': 'DNI',
    'NAV.VER_PERFIL_CORREO': 'Correo',
    'NAV.VER_PERFIL_TELEFONO': 'Waqyana',

    'LOGIN.CORREO_PLACEHOLDER': 'Correo (imaylniyki)',
    'LOGIN.PASSWORD_PLACEHOLDER': 'Yaykuna rimay (contraseña)',
    'LOGIN.RECORDARME': 'Yuyariway',
    'LOGIN.OLVIDE_PASSWORD': '¿Yaykuna rimayta qunqarqankichu?',
    'LOGIN.INICIAR_SESION': 'Yaykuy',
    'LOGIN.SIN_CUENTA': '¿Manaraqchu cuenta kanki?',
    'LOGIN.CONTACTAR_VENTAS': 'Rantikuq equipowan rimanakuy',
    'LOGIN.POWERED_BY': 'ALBA ruwasqa',
    'LOGIN.PASSWORD_CORRECTA': '¡Yaykuna rimay allinmi!',
    'LOGIN.CODIGO_ENVIADO': 'Correo-ykiman huk código-ta apachimuyku.',
    'LOGIN.REDIRIGIENDO_2FA': 'Qhawanapaq pusachkayku…',
    'LOGIN.ERR_CORREO_VACIO': 'Correo-ykita churay.',
    'LOGIN.ERR_CORREO_INVALIDO': 'Correo mana allinchu.',
    'LOGIN.ERR_PASSWORD_CORTA': 'Yaykuna rimay 6 letra kananmi.',
    'LOGIN.ERR_401': 'Correo otaq yaykuna rimay mana allinchu.',
    'LOGIN.ERR_403': 'Empresaykip plataformaman yaykunan harkasqa kachkan. ALBA yanapayta tapuy.',
    'LOGIN.ERR_429': 'Achkha kutita yaykuyta munarqanki. Suyay huk ratuchata.',
    'LOGIN.ERR_SIN_CONEXION': 'Mana atisqachu servidor-man yaykuyta. Wakmanta kutichiy.',
    'LOGIN.ERR_INESPERADO': 'Mana yuyasqa pantay kachkan. Wakmanta kutichiy.',
    'LOGIN.CLICK_DESCUBRIR': 'Tapuykuna rikunapaq picha',

    'DASH.INGRESOS_MES': 'Kay killapi haypasqa',
    'DASH.INGRESOS_MES_SUB': 'qhipa 30 p\u2019unchaw',
    'DASH.UTILIDAD_NETA': 'Chiqaq ganancia',
    'DASH.UTILIDAD_NETA_SUB': 'haypasqa − gastu − qullqi',
    'DASH.TICKET_PROMEDIO': 'Chawpi rantikuy',
    'DASH.TICKET_PROMEDIO_SUB': 'sapa rantikuypi',
    'DASH.VALOR_INVENTARIO': 'Inventario valor',
    'DASH.VALOR_INVENTARIO_SUB': 'rantisqan qullqiwan',
    'DASH.RIESGO_MERMA': 'Wasinchikuna wat\u2019ekunapaq riesgo',
    'DASH.RIESGO_MERMA_SUB': 'llamp\u2019u otaq mana kuyuq',
    'DASH.WATERFALL_TITLE': 'Rantikuymanta chiqaq gananciaman',
    'DASH.WATERFALL_SUB': 'Imaymi haykumun, imaynatam kutichinapaq gastan, ima chiqapmi qhipan — qhipa 30 p\u2019unchaw.',
    'DASH.INGRESOS_VENTAS': 'Rantikuymanta haypasqa',
    'DASH.COSTO_MERCADERIA': '− Rantisqan qullqi',
    'DASH.UTILIDAD_BRUTA': '= Ganancia bruta',
    'DASH.GASTOS_OPERATIVOS': '− Llank\u2019ay gastukuna',
    'DASH.UTILIDAD_NETA_REAL': '= Chiqaq ganancia',
    'DASH.PRODUCTO_MAS_VENDIDO': 'Aswan rantisqan',
    'DASH.MENOS_VENDIDO': 'Aswan pisi rantisqan',
  },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  /** Signal reactivo: cualquier componente que lo lea se re-renderiza solo al cambiar de idioma. */
  lang = signal<AppLang>(this.readInitialLang());

  constructor() {
    // Puente con el widget de accesibilidad (vanilla JS, vive fuera de Angular
    // pegado a document.body). El widget dispara este evento al elegir idioma.
    window.addEventListener('vilcas-lang-change', (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { lang?: string } | undefined;
      const lang = detail?.lang;
      if (lang === 'es' || lang === 'en' || lang === 'qu') this.setLang(lang);
    });
  }

  private readInitialLang(): AppLang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'es' || stored === 'en' || stored === 'qu') return stored;
    } catch { /* localStorage no disponible (SSR, modo incógnito estricto, etc.) */ }
    return 'es';
  }

  setLang(lang: AppLang): void {
    this.lang.set(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
  }

  /** Traduce una clave al idioma activo; si falta, cae a español; si tampoco existe, devuelve la clave. */
  t(key: string): string {
    const dict = DICT[this.lang()] ?? DICT['es'];
    return dict[key] ?? DICT['es'][key] ?? key;
  }
}