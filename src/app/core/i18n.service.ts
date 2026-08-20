import { Injectable, inject } from '@angular/core';
import { AppLang, GoogleTranslateService } from './google-translate.service';

export type { AppLang };

/**
 * Mapeo base en español para claves estables del sistema.
 * La traducción a cualquier idioma (español, inglés, quechua) es realizada
 * 100% de forma automática en el cliente por el motor público de Google Translate,
 * sin necesidad de mantener diccionarios manuales por idioma.
 */
const DICT_ES: Record<string, string> = {
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
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private googleTranslate = inject(GoogleTranslateService);

  /** Signal reactivo con el idioma activo en la aplicación ('es' | 'en' | 'qu') */
  get lang() {
    return this.googleTranslate.currentLang;
  }

  /**
   * Actualiza el idioma activo y dispara la traducción en vivo mediante Google Translate.
   */
  setLang(lang: AppLang): void {
    this.googleTranslate.setLanguage(lang);
  }

  /**
   * Obtiene la cadena en español base para renderizar en el DOM.
   * Google Translate se encarga de traducirla automáticamente al idioma seleccionado.
   */
  t(key: string): string {
    return DICT_ES[key] ?? key;
  }
}