(function(){
  if(window.AccessibilityWidget) return;
  const LS_POS='acc_fab_pos_summas_v1';
  /* Referencias a openPanel/closePanel (definidas dentro de buildUI) para
     poder abrir/cerrar el panel desde afuera — ej. el botón del navbar. */
  let externalOpenPanel=null, externalClosePanel=null;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  /* ─────────────────────────────────────────────
     POWERED BY — edita el link aquí
  ───────────────────────────────────────────── */
  const POWERED_BY_LINK = 'https://www.linkedin.com/in/alba-engineering-development-42a3493ab?utm_source=share_via&utm_content=profile&utm_medium=member_android'; // ← pon el link de Alba aquí

  /* ─────────────────────────────────────────────
     TRADUCCIONES
  ───────────────────────────────────────────── */
  const LANGS = {
    es: {
      title:'Accesibilidad', subtitle:'Personaliza tu experiencia',
      tabs:['Visión','Texto','Idioma','Salud Visual','Voz'],
      tabKeys:['vision','texto','idioma','herramientas','voz'],
      sec_contrast:'Contraste', sec_colortemp:'Temperatura de color',
      sec_images:'Imágenes', sec_saturation:'Saturación', sec_dalt:'Daltonismo',
      sec_size:'Tamaño y espaciado', sec_focus:'Enfoque y concentración',
      sec_zoom:'Zoom de página', sec_aids:'Ayudas visuales', sec_pos:'Posición del botón flotante',
      sec_timer:'Regla 20-20-20 — Salud visual', sec_quick:'Acciones rápidas',
      sec_tts:'Leer contenido en voz alta', sec_narrator:'Narrador interactivo',
      sec_shortcuts:'Atajos de teclado globales', sec_stats:'Tu uso de accesibilidad',
      sec_about:'Sobre el widget', sec_ai:'Resumen de página con IA',
      sec_lang:'Idioma del widget',
      t_lightContrast:'Luz suave', t_lightNote:'Brillo reducido',
      t_smart:'Inteligente', t_smartNote:'Adaptativo',
      t_dark:'Modo oscuro', t_darkNote:'Invertir colores',
      t_textContrast:'Alto contraste texto', t_textContrastNote:'Negro sobre blanco',
      t_links:'Resaltar enlaces', t_linksNote:'Subrayado visible',
      t_night:'Modo noche', t_nightNote:'Warm · brillo suave',
      t_tempLabel:'Temperatura de pantalla',
      t_tempNote:'Ajusta el tono para reducir la fatiga visual según el entorno',
      t_warm:' Cálido', t_cool:' Frío', t_sepia:' Sepia', t_normal:'✕ Normal',
      t_hideImg:'Ocultar imágenes', t_hideImgNote:'Solo contenido de texto',
      t_satLabel:'Nivel de saturación',
      t_satLow:'Baja', t_satHigh:'Alta', t_satOff:'Sin color',
      t_daltLabel:'Filtro para daltonismo',
      t_proto:'Protanopia', t_deut:'Deuteranopia', t_trit:'Tritanopia', t_acro:'Acromatopsia', t_disable:'✕ Desactivar',
      t_fontSize:'Tamaño de texto', t_letterSp:'Espaciado letras',
      t_sizeSmall:'Pequeño', t_sizeSmallNote:'Texto compacto', t_sizeMedium:'Mediano', t_sizeMediumNote:'Tamaño estándar', t_sizeLarge:'Grande', t_sizeLargeNote:'Máxima legibilidad',
      t_focus:'Modo enfoque (TDAH)', t_focusNote:'Menos distracciones · más espacio · guía de lectura',
      t_lineH:'Altura de línea', t_spacing:'Más espacio párrafos', t_spacingNote:'Mejor legibilidad',
      t_dysLabel:'Fuente para dislexia',
      t_dys:'OpenDyslexic', t_hyper:'Alta legibilidad',
      t_alignLabel:'Alineación del texto',
      t_left:'Izquierda', t_center:'Centrado', t_right:'Derecha',
      t_zoomLabel:'Nivel de zoom',
      t_noAnim:'Detener animaciones', t_noAnimNote:'Reduce distracciones',
      t_bigCursor:'Cursor grande', t_bigCursorNote:'Mayor visibilidad',
      t_ruler:'Regla de lectura', t_rulerNote:'Sigue el puntero',
      t_highlight:'Resaltador de texto', t_highlightNote:'Botón copiar al seleccionar',
      t_spotlight:'Spotlight de cursor', t_spotlightNote:'Foco alrededor del puntero',
      t_magnifier:'Lupa al hover', t_magnifierNote:'Amplía zona bajo el cursor',
      t_outline:'Estructura de la página', t_outlineNote:'Índice de secciones y títulos navegables',
      t_snapTL:'Sup. Izq.', t_snapTR:'Sup. Der.', t_snapBL:'Inf. Izq.', t_snapBR:'Inf. Der.',
      t_hide:'Ocultar', t_show:'Mostrar',
      timerLabel:'🔵 Tiempo de trabajo', timerRest:'🟡 Descansa la vista — mira 6m',
      timerDesc:'Trabaja · Descansa la vista · Repite',
      timerStart:'Iniciar', timerPause:'Pausar', timerStop:'Detener',
      timerIntro:'Cada 20 minutos de trabajo, descansa 20 segundos mirando un punto a 6 metros. Reduce la fatiga ocular hasta un 40%.',
      t_qSearch:'Buscar función', t_qSearchNote:'Ctrl+K · acceso rápido',
      t_qReset:'Resetear todo', t_qResetNote:'Valores predeterminados',
      ttsLabel:'Lectura de página completa', ttsNote:'Lee todo el contenido principal',
      ttsRead:'Leer', ttsResume:'Reanudar', ttsStop:'Detener',
      narratorLabel:'Activar narrador', narratorNote:'Lee cada elemento que toques o enfoques',
      shortcutsIntro:'Activa funciones sin abrir el menú. Funcionan en cualquier parte de la plataforma.',
      statsIntro:'Resumen de las herramientas que más utilizas. Datos almacenados localmente en tu dispositivo.',
      statsSessions:'Sesiones', statsFeatures:'Funciones usadas', statsLast:'Último uso',
      statsTop:'Funciones más utilizadas', statsEmpty:'Aún no hay datos de uso registrados.\nActiva algunas funciones para comenzar.',
      clearStats:'Borrar datos de uso',
      aboutPlatform:'Plataforma', aboutSector:'Sector', aboutVersion:'Versión widget', aboutConfig:'Configuración',
      aboutPlatformVal:'VILCAS', aboutSectorVal:'Retail — Calzado',
      aboutVersionVal:'5.1 · Accesibilidad avanzada', aboutConfigVal:'Guardada en este dispositivo',
      aiTitle:'Resumen con IA', aiIntro:'Genera un resumen del contenido principal de esta página usando inteligencia artificial.',
      aiBtn:'Generar resumen', aiLoading:'Analizando página…', aiError:'No se pudo generar el resumen. Intenta de nuevo.',
      langTitle:'Idioma del widget', langNote:'Cambia el idioma de los textos del panel de accesibilidad.',
      resetAll:'Restablecer', searchBtn:'Ctrl+K para buscar',
      poweredBy:'Powered By',
      toastNarratorOn:'Narrador activado',toastNarratorOff:'',
      toastReset:'Configuración restablecida ✓',
    },
    qu: {
      title:'Yanapakuy', subtitle:'Servicioykita allichay',
      tabs:['Qhaway','Qillqa','Rimay','Ñawi Qhali','Kunka'],
      tabKeys:['vision','texto','idioma','herramientas','voz'],
      sec_contrast:'Contraste', sec_colortemp:'Pantalla ruphaynin',
      sec_images:'Sut\'inkuna', sec_saturation:'Llimp\'i sinchin', sec_dalt:'Llimp\'ita mana rikuy (daltonismo)',
      sec_size:'Sayay hinallataq kitiy', sec_focus:'Yuyayta churay',
      sec_aids:'Qhaway yanapaqkuna', sec_pos:'Bottón kaqnin',
      sec_timer:'20-20-20 kamachiy — Ñawi qhali kay', sec_quick:'Utqha ruraykuna',
      sec_tts:'Qillqata kunkawan ñawinchay', sec_narrator:'Willaq rimaq',
      sec_shortcuts:'Teclado utqhachiykuna', sec_stats:'Imaynata servichikusqayki',
      sec_about:'Widget-manta willakuy', sec_ai:'Qillqa huñusqa IA-wan',
      sec_lang:'Widget-pa rimayninmi',
      t_lightContrast:'Q\'illu k\'anchay', t_lightNote:'Aslla k\'anchay',
      t_smart:'Yachaysapa', t_smartNote:'Kuska tikray',
      t_dark:'Tuta hina', t_darkNote:'Llimp\'ikunata tikray',
      t_textContrast:'Sinchi contraste qillqapi', t_textContrastNote:'Yana yuraqpi',
      t_links:'Enlace-kunata rikuchiy', t_linksNote:'Sut\'i subrayado',
      t_night:'Tuta rikch\'ay', t_nightNote:'Q\'uñi · aslla k\'anchay',
      t_tempLabel:'Pantalla ruphaynin',
      t_tempNote:'Ñawiykipa sayk\'unanta pisichinapaq tikray',
      t_warm:' Q\'uñi', t_cool:' Chiri', t_sepia:' Sepia', t_normal:'✕ Kaqllan',
      t_hideImg:'Sut\'inkunata pakay', t_hideImgNote:'Qillqallanta rikuchiy',
      t_satLabel:'Llimp\'i sinchin',
      t_satLow:'Pisi', t_satHigh:'Anchata', t_satOff:'Mana llimp\'iyuq',
      t_daltLabel:'Llimp\'ita mana rikuypaq filtro',
      t_proto:'Protanopia', t_deut:'Deuteranopia', t_trit:'Tritanopia', t_acro:'Acromatopsia', t_disable:'✕ Sipiy',
      t_fontSize:'Qillqa sayaynin', t_letterSp:'Qillqa k\'itiynin',
      t_sizeSmall:'Huch\'uy', t_sizeSmallNote:'Kichkisqa qillqa', t_sizeMedium:'Chawpi', t_sizeMediumNote:'Kaqllan sayay', t_sizeLarge:'Hatun', t_sizeLargeNote:'Aswan sut\'i ñawinchanapaq',
      t_focus:'Yuyayta churay (TDAH)', t_focusNote:'Aswan hawka · aswan kitiy · ñawinchay pusaq',
      t_lineH:'Siq\'i sayaynin', t_spacing:'Aswan kitiy p\'itisqakunapi', t_spacingNote:'Aswan allin ñawinchay',
      t_noAnim:'Kuyuchiykunata sipiy', t_noAnimNote:'Yuyayta ch\'illichiqkunata pisichin',
      t_bigCursor:'Hatun cursor', t_bigCursorNote:'Aswan sut\'ita rikuy',
      t_ruler:'Ñawinchay regla', t_rulerNote:'Puntero-ta qatin',
      t_highlight:'Qillqa rikuchiq', t_highlightNote:'Akllaspa copiay botón',
      t_spotlight:'Cursor k\'anchay', t_spotlightNote:'Puntero muyuriqpi qhaway',
      t_magnifier:'Hatunchaq qhaway', t_magnifierNote:'Cursor ukhupi hatunchan',
      t_outline:'Página ruwasqan', t_outlineNote:'Sayaqkunapa hina purina índice',
      t_snapTL:'Wich\'ay Lluq\'i', t_snapTR:'Wich\'ay Paña', t_snapBL:'Uray Lluq\'i', t_snapBR:'Uray Paña',
      t_hide:'Pakay', t_show:'Rikuchiy',
      timerLabel:'🔵 Llank\'ay pacha', timerRest:'🟡 Ñawiykita samachiy — 6m qhaway',
      timerDesc:'Llank\'ay · Ñawita samachiy · Kutichiy',
      timerStart:'Qallariy', timerPause:'Samachiy', timerStop:'Tanichiy',
      timerIntro:'Sapa 20 minuto llank\'aspa, 20 segundo samay, 6 metro karupi imatapas qhawaspa. Ñawi sayk\'uyta 40%-kama pisichin.',
      t_qSearch:'Ruraq maskhay', t_qSearchNote:'Utqha yaykuna',
      t_qReset:'Llapanta kutichiy', t_qResetNote:'Qallariy hina kutichiy',
      ttsLabel:'Llapa página ñawinchay', ttsNote:'Llapa contenido-ta ñawinchan',
      ttsRead:'Ñawinchay', ttsResume:'Kutirichiy', ttsStop:'Tanichiy',
      narratorLabel:'Willaq rimaqta qallarichiy', narratorNote:'Llamk\'aq imatapas llamiyta otaq qhaway ñawinchan',
      shortcutsIntro:'Ruraykunata qallarichiy, mana menú-ta kichaspa.',
      statsIntro:'Aswan servichikusqayki ruraykunamanta willakuy. Willakuykuna kay dispositivo-llapi waqaychasqa.',
      statsSessions:'Sesiones', statsFeatures:'Servichisqa ruraykuna', statsLast:'Qhipa servichikusqan',
      statsTop:'Aswan servichisqa ruraykuna', statsEmpty:'Manaraq willakuykuna kanchu.\nHuk ruraykunata qallarichiy.',
      clearStats:'Willakuykunata pichay',
      aboutPlatform:'Plataforma', aboutSector:'Rikch\'ay llank\'ay', aboutVersion:'Widget versión', aboutConfig:'Configuración',
      aboutPlatformVal:'VILCAS', aboutSectorVal:'Rantiy — Usut\'a (Calzado)',
      aboutVersionVal:'5.1 · Ñawpaq yanapakuy', aboutConfigVal:'Kay dispositivo-pi waqaychasqa',
      aiTitle:'IA-wan huñusqa', aiIntro:'Kay página-pa contenido-nmanta huñusqata ruwan.',
      aiBtn:'Huñuyta ruray', aiLoading:'Página-ta qhawachkan…', aiError:'Mana atisqachu. Kutin wakmanta.',
      langTitle:'Widget-pa rimayninmi', langNote:'Yanapakuy panel-pa qillqankunata rimaynikita tikray.',
      resetAll:'Kutichiy', searchBtn:'Ctrl+K maskhanapaq',
      poweredBy:'Ruwasqa',
      toastNarratorOn:'Willaq rimaq qallarichisqa',toastNarratorOff:'',
      toastReset:'Configuración kutichisqa ✓',
    },
    en: {
      title:'Accessibility', subtitle:'Customize your experience',
      tabs:['Vision','Text','Language','Eye Health','Voice'],
      tabKeys:['vision','texto','idioma','herramientas','voz'],
      sec_contrast:'Contrast', sec_colortemp:'Color temperature',
      sec_images:'Images', sec_saturation:'Saturation', sec_dalt:'Color blindness',
      sec_size:'Size & spacing', sec_focus:'Focus & concentration',
      sec_zoom:'Page zoom', sec_aids:'Visual aids', sec_pos:'FAB position',
      sec_timer:'20-20-20 Rule — Eye health', sec_quick:'Quick actions',
      sec_tts:'Read content aloud', sec_narrator:'Interactive narrator',
      sec_shortcuts:'Global keyboard shortcuts', sec_stats:'Your accessibility usage',
      sec_about:'About the widget', sec_ai:'AI Page Summary',
      sec_lang:'Widget language',
      t_lightContrast:'Soft light', t_lightNote:'Reduced brightness',
      t_smart:'Smart', t_smartNote:'Adaptive',
      t_dark:'Dark mode', t_darkNote:'Invert colors',
      t_textContrast:'High contrast text', t_textContrastNote:'Black on white',
      t_links:'Highlight links', t_linksNote:'Visible underline',
      t_night:'Night mode', t_nightNote:'Warm · soft brightness',
      t_tempLabel:'Screen temperature',
      t_tempNote:'Adjust the tone to reduce eye strain based on your environment',
      t_warm:' Warm', t_cool:' Cool', t_sepia:' Sepia', t_normal:'✕ Normal',
      t_hideImg:'Hide images', t_hideImgNote:'Text content only',
      t_satLabel:'Saturation level',
      t_satLow:'Low', t_satHigh:'High', t_satOff:'No color',
      t_daltLabel:'Color blindness filter',
      t_proto:'Protanopia', t_deut:'Deuteranopia', t_trit:'Tritanopia', t_acro:'Achromatopsia', t_disable:'✕ Disable',
      t_fontSize:'Font size', t_letterSp:'Letter spacing',
      t_sizeSmall:'Small', t_sizeSmallNote:'Compact text', t_sizeMedium:'Medium', t_sizeMediumNote:'Standard size', t_sizeLarge:'Large', t_sizeLargeNote:'Maximum readability',
      t_focus:'Focus mode (ADHD)', t_focusNote:'Fewer distractions · more spacing · reading guide',
      t_lineH:'Line height', t_spacing:'Extra paragraph spacing', t_spacingNote:'Better readability',
      t_dysLabel:'Dyslexia font',
      t_dys:'OpenDyslexic', t_hyper:'High legibility',
      t_alignLabel:'Text alignment',
      t_left:'Left', t_center:'Center', t_right:'Right',
      t_zoomLabel:'Zoom level',
      t_noAnim:'Stop animations', t_noAnimNote:'Reduce distractions',
      t_bigCursor:'Large cursor', t_bigCursorNote:'Better visibility',
      t_ruler:'Reading ruler', t_rulerNote:'Follows pointer',
      t_highlight:'Text highlighter', t_highlightNote:'Copy button on selection',
      t_spotlight:'Cursor spotlight', t_spotlightNote:'Focus around pointer',
      t_magnifier:'Hover magnifier', t_magnifierNote:'Zooms area under cursor',
      t_outline:'Page structure', t_outlineNote:'Navigable headings index',
      t_snapTL:'Top Left', t_snapTR:'Top Right', t_snapBL:'Bottom Left', t_snapBR:'Bottom Right',
      t_hide:'Hide', t_show:'Show',
      timerLabel:'🔵 Work time', timerRest:'🟡 Rest your eyes — look 6m away',
      timerDesc:'Work · Rest your eyes · Repeat',
      timerStart:'Start', timerPause:'Pause', timerStop:'Stop',
      timerIntro:'Every 20 minutes of work, rest your eyes for 20 seconds looking at a point 6 meters away. Reduces eye strain by up to 40%.',
      t_qSearch:'Search feature', t_qSearchNote:'Ctrl+K · quick access',
      t_qReset:'Reset all', t_qResetNote:'Back to defaults',
      ttsLabel:'Full page reading', ttsNote:'Reads all main content aloud',
      ttsRead:'Read', ttsResume:'Resume', ttsStop:'Stop',
      narratorLabel:'Enable narrator', narratorNote:'Reads every element you touch or focus',
      shortcutsIntro:'Activate features without opening the menu. Work anywhere on the platform.',
      statsIntro:'Summary of your most used tools. Data stored locally on your device.',
      statsSessions:'Sessions', statsFeatures:'Features used', statsLast:'Last used',
      statsTop:'Most used features', statsEmpty:'No usage data yet.\nActivate some features to start.',
      clearStats:'Clear usage data',
      aboutPlatform:'Platform', aboutSector:'Sector', aboutVersion:'Widget version', aboutConfig:'Settings',
      aboutPlatformVal:'VILCAS', aboutSectorVal:'Retail — Footwear',
      aboutVersionVal:'5.1 · Advanced accessibility', aboutConfigVal:'Saved on this device',
      aiTitle:'AI Summary', aiIntro:'Generate a summary of this page\'s main content using artificial intelligence.',
      aiBtn:'Generate summary', aiLoading:'Analyzing page…', aiError:'Could not generate summary. Please try again.',
      langTitle:'Widget language', langNote:'Change the language of the accessibility panel texts.',
      resetAll:'Reset', searchBtn:'Ctrl+K to search',
      poweredBy:'Developed by',
      toastNarratorOn:'Narrator enabled',toastNarratorOff:'',
      toastReset:'Settings reset ✓',
    },
    pt: {
      title:'Acessibilidade', subtitle:'Personalize sua experiência',
      tabs:['Visão','Texto','Idioma','Saúde Visual','Voz'],
      tabKeys:['vision','texto','idioma','herramientas','voz'],
      sec_contrast:'Contraste', sec_colortemp:'Temperatura de cor',
      sec_images:'Imagens', sec_saturation:'Saturação', sec_dalt:'Daltonismo',
      sec_size:'Tamanho e espaçamento', sec_focus:'Foco e concentração',
      sec_zoom:'Zoom da página', sec_aids:'Auxílios visuais', sec_pos:'Posição do botão flutuante',
      sec_timer:'Regra 20-20-20 — Saúde visual', sec_quick:'Ações rápidas',
      sec_tts:'Ler conteúdo em voz alta', sec_narrator:'Narrador interativo',
      sec_shortcuts:'Atalhos de teclado globais', sec_stats:'Seu uso de acessibilidade',
      sec_about:'Sobre o widget', sec_ai:'Resumo da página com IA',
      sec_lang:'Idioma do widget',
      t_lightContrast:'Luz suave', t_lightNote:'Brilho reduzido',
      t_smart:'Inteligente', t_smartNote:'Adaptativo',
      t_dark:'Modo escuro', t_darkNote:'Inverter cores',
      t_textContrast:'Alto contraste texto', t_textContrastNote:'Preto sobre branco',
      t_links:'Destacar links', t_linksNote:'Sublinhado visível',
      t_night:'Modo noite', t_nightNote:'Warm · brilho suave',
      t_tempLabel:'Temperatura da tela',
      t_tempNote:'Ajuste o tom para reduzir a fadiga visual conforme o ambiente',
      t_warm:' Quente', t_cool:' Frio', t_sepia:' Sépia', t_normal:'✕ Normal',
      t_hideImg:'Ocultar imagens', t_hideImgNote:'Somente conteúdo de texto',
      t_satLabel:'Nível de saturação',
      t_satLow:'Baixa', t_satHigh:'Alta', t_satOff:'Sem cor',
      t_daltLabel:'Filtro para daltonismo',
      t_proto:'Protanopia', t_deut:'Deuteranopia', t_trit:'Tritanopia', t_acro:'Acromatopsia', t_disable:'✕ Desativar',
      t_fontSize:'Tamanho do texto', t_letterSp:'Espaçamento de letras',
      t_sizeSmall:'Pequeno', t_sizeSmallNote:'Texto compacto', t_sizeMedium:'Médio', t_sizeMediumNote:'Tamanho padrão', t_sizeLarge:'Grande', t_sizeLargeNote:'Máxima legibilidade',
      t_focus:'Modo foco (TDAH)', t_focusNote:'Menos distrações · mais espaço · guia de leitura',
      t_lineH:'Altura da linha', t_spacing:'Mais espaço entre parágrafos', t_spacingNote:'Melhor legibilidade',
      t_dysLabel:'Fonte para dislexia',
      t_dys:'OpenDyslexic', t_hyper:'Alta legibilidade',
      t_alignLabel:'Alinhamento do texto',
      t_left:'Esquerda', t_center:'Centro', t_right:'Direita',
      t_zoomLabel:'Nível de zoom',
      t_noAnim:'Parar animações', t_noAnimNote:'Reduz distrações',
      t_bigCursor:'Cursor grande', t_bigCursorNote:'Maior visibilidade',
      t_ruler:'Régua de leitura', t_rulerNote:'Segue o ponteiro',
      t_highlight:'Marcador de texto', t_highlightNote:'Botão copiar ao selecionar',
      t_spotlight:'Spotlight do cursor', t_spotlightNote:'Foco ao redor do ponteiro',
      t_magnifier:'Lupa ao hover', t_magnifierNote:'Amplia a área sob o cursor',
      t_outline:'Estrutura da página', t_outlineNote:'Índice de seções e títulos navegáveis',
      t_snapTL:'Sup. Esq.', t_snapTR:'Sup. Dir.', t_snapBL:'Inf. Esq.', t_snapBR:'Inf. Dir.',
      t_hide:'Ocultar', t_show:'Mostrar',
      timerLabel:'🔵 Tempo de trabalho', timerRest:'🟡 Descanse a vista — olhe 6m',
      timerDesc:'Trabalhe · Descanse a vista · Repita',
      timerStart:'Iniciar', timerPause:'Pausar', timerStop:'Parar',
      timerIntro:'A cada 20 minutos de trabalho, descanse os olhos por 20 segundos olhando para um ponto a 6 metros. Reduz a fadiga ocular em até 40%.',
      t_qSearch:'Buscar função', t_qSearchNote:'Ctrl+K · acesso rápido',
      t_qReset:'Redefinir tudo', t_qResetNote:'Valores padrão',
      ttsLabel:'Leitura de página completa', ttsNote:'Lê todo o conteúdo principal em voz alta',
      ttsRead:'Ler', ttsResume:'Retomar', ttsStop:'Parar',
      narratorLabel:'Ativar narrador', narratorNote:'Lê cada elemento que você tocar ou focar',
      shortcutsIntro:'Ative funções sem abrir o menu. Funcionam em qualquer parte da plataforma.',
      statsIntro:'Resumo das ferramentas mais usadas. Dados armazenados localmente no seu dispositivo.',
      statsSessions:'Sessões', statsFeatures:'Funções usadas', statsLast:'Último uso',
      statsTop:'Funções mais utilizadas', statsEmpty:'Ainda não há dados de uso.\nAtive algumas funções para começar.',
      clearStats:'Apagar dados de uso',
      aboutPlatform:'Plataforma', aboutSector:'Setor', aboutVersion:'Versão widget', aboutConfig:'Configuração',
      aboutPlatformVal:'Auditoria Summas (PAS)', aboutSectorVal:'Automotivo — Consultorias e Auditorias',
      aboutVersionVal:'5.1 · Acessibilidade avançada', aboutConfigVal:'Salvo neste dispositivo',
      aiTitle:'Resumo com IA', aiIntro:'Gere um resumo do conteúdo principal desta página usando inteligência artificial.',
      aiBtn:'Gerar resumo', aiLoading:'Analisando página…', aiError:'Não foi possível gerar o resumo. Tente novamente.',
      langTitle:'Idioma do widget', langNote:'Altere o idioma dos textos do painel de acessibilidade.',
      resetAll:'Redefinir', searchBtn:'Ctrl+K para buscar',
      poweredBy:'Desenvolvido por',
      toastNarratorOn:'Narrador ativado',toastNarratorOff:'',
      toastReset:'Configuração redefinida ✓',
    }
  };

  let currentLang = (function(){
    try{
      const shared=localStorage.getItem('vilcas_app_lang');
      if(shared==='es'||shared==='en'||shared==='qu') return shared;
    }catch(e){}
    return 'es';
  })();
  const T = () => LANGS[currentLang];

  const css=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&display=swap');

  :root{
    --s-navy:#024B40;--s-navy2:#036B54;--s-cyan:#DA9E0B;
    --s-grad:linear-gradient(90deg,#024B40 0%,#036B54 13%,#DA9E0B 100%);
    --s-grad-v:linear-gradient(160deg,#024B40 0%,#036B54 30%,#DA9E0B 100%);
    --s-light:#EFF6FF;--s-border:#D0DCF5;--s-text:#0F1B40;--s-muted:#6B7CA8;
    --s-white:#ffffff;--s-tile-bg:#F4F7FF;--s-tile-active:#E0EAFF;
    --s-success:#27ae60;--s-warning:#f39c12;--s-danger:#e74c3c;
  }

  /* FAB */
#accFab{position:fixed;bottom:180px;left:22px;width:90px;height:90px;border-radius:0;background:transparent;border:none;box-shadow:none;z-index:10050;cursor:grab;display:flex;align-items:center;justify-content:center;transition:transform .25s;touch-action:none;user-select:none;overflow:visible;padding:0;}  #accFab.dragging{cursor:grabbing;transform:scale(1.12);box-shadow:0 18px 48px rgba(2,75,64,.45);}  #accFab.hidden{display:none}
  #accFab.narrator-on::after{content:'';position:absolute;top:-2px;right:-2px;width:16px;height:16px;border-radius:999px;background:var(--s-cyan);border:2.5px solid #fff;animation:narratorPulse 1.8s ease-in-out infinite;}
  @keyframes narratorPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}
#accFabLogo{width:90px;height:90px;border-radius:0;object-fit:contain;background:transparent;padding:0;pointer-events:none;mix-blend-mode:multiply;}
  /* PANEL */
  #accPanel{position:fixed;top:50%;left:50%;transform:translate(-50%,-46%) scale(.97);width:400px;max-width:calc(100% - 32px);max-height:90vh;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(6,30,25,.3),0 4px 20px rgba(218,158,11,.15);z-index:10060;display:none;font-family:'Barlow',system-ui,sans-serif;opacity:0;transition:transform .3s cubic-bezier(.34,1.4,.64,1),opacity .22s ease;overflow:hidden;}
  #accPanel.open{display:flex;flex-direction:column;opacity:1;transform:translate(-50%,-50%) scale(1);}
  #accPanel.open{
    resize:both;
    overflow:hidden;
    min-width:320px;
    min-height:200px;
    max-width:95vw;
    max-height:95vh;
}

  /* HEADER */
  #accPanel .ap-header{flex-shrink:0;background:var(--s-grad);padding:0 22px;display:flex;align-items:center;justify-content:space-between;min-height:66px;position:relative;overflow:hidden;}
  #accPanel .ap-header::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 60L60 0' stroke='rgba(255,255,255,.06)' stroke-width='1.5'/%3E%3Cpath d='M-20 60L40 0' stroke='rgba(255,255,255,.04)' stroke-width='1'/%3E%3Cpath d='M20 60L80 0' stroke='rgba(255,255,255,.04)' stroke-width='1'/%3E%3C/svg%3E");pointer-events:none;}
  #accPanel .ap-header-left{display:flex;align-items:center;gap:14px;z-index:1;}
  #accPanel .ap-logo-wrap{background:transparent;border-radius:8px;padding:5px 10px;display:flex;align-items:center;justify-content:center;height:44px;min-width:90px;max-width:130px;overflow:hidden;flex-shrink:0;}
  #accPanel .ap-logo-wrap img{max-height:80px;max-width:140px;width:auto;object-fit:contain;display:block;}
  #accPanel .ap-title{z-index:1;}
  #accPanel .ap-title h3{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;line-height:1.1;}
  #accPanel .ap-title p{margin:1px 0 0;font-size:11.5px;color:rgba(255,255,255,.72);font-weight:500;letter-spacing:.2px;}
  #accPanel .ap-close{z-index:1;border:none;background:rgba(255,255,255,.15);color:#fff;width:34px;height:34px;border-radius:9px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;flex-shrink:0;font-family:inherit;}
  #accPanel .ap-close:hover{background:rgba(255,255,255,.25);transform:rotate(90deg);}

  /* TABS */
  #accPanel .ap-tabs-wrap{flex-shrink:0;position:relative;border-bottom:1.5px solid var(--s-border);}
  #accPanel .ap-tabs-toggle{width:100%;display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:#F0F4FF;font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;color:var(--s-navy);letter-spacing:.4px;text-transform:uppercase;cursor:pointer;}
  #accPanel .ap-tabs-toggle:hover{background:#E6ECFF;}
  #accPanel .ap-tabs-chevron{margin-left:auto;font-size:10px;color:var(--s-muted);transition:transform .2s;}
  #accPanel .ap-tabs-wrap.open .ap-tabs-chevron{transform:rotate(180deg);}
  #accPanel .ap-tabs{display:none;flex-direction:column;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid var(--s-border);border-top:none;border-radius:0 0 14px 14px;box-shadow:0 16px 32px rgba(6,30,25,.16);z-index:30;max-height:260px;overflow-y:auto;padding:4px;gap:1px;}
  #accPanel .ap-tabs-wrap.open .ap-tabs{display:flex;}
  #accPanel .ap-tab{padding:10px 12px;border:none;border-radius:9px;background:transparent;font-family:'Barlow',sans-serif;font-size:12.5px;font-weight:700;color:var(--s-muted);letter-spacing:.2px;cursor:pointer;display:flex;align-items:center;gap:9px;text-align:left;white-space:normal;}
  #accPanel .ap-tab:hover{background:#F0F4FF;color:var(--s-navy);}
  #accPanel .ap-tab.active{background:var(--s-grad);color:#fff;}

  /* BODY */
  #accPanel .ap-body{flex:1;overflow-y:auto;overflow-x:auto;padding:18px 18px 22px;scrollbar-width:thin;scrollbar-color:var(--s-border) transparent;}
  #accPanel .ap-body::-webkit-scrollbar{width:5px;}
  #accPanel .ap-body::-webkit-scrollbar-thumb{background:var(--s-border);border-radius:3px;}
  .ap-pane{display:none;} .ap-pane.active{display:block;}

  /* SECTION */
  .ap-section{font-family:'Barlow Condensed',sans-serif;font-size:11.5px;font-weight:700;color:var(--s-muted);text-transform:uppercase;letter-spacing:1.2px;margin:18px 0 10px;display:flex;align-items:center;gap:7px;}
  .ap-section::after{content:'';flex:1;height:1px;background:var(--s-border);}
  .ap-section:first-child{margin-top:0;}

  /* GRIDS */
  .ap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .ap-grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}

  /* TILE */
  .acc-tile{position:relative;border:1.5px solid var(--s-border);border-radius:12px;background:var(--s-tile-bg);min-height:96px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:12px 8px;gap:5px;font-size:12.5px;font-weight:600;color:var(--s-text);cursor:pointer;user-select:none;transition:border-color .18s,background .18s,box-shadow .18s,transform .15s;font-family:'Barlow',sans-serif;}
  .acc-tile:hover{background:#fff;border-color:var(--s-cyan);box-shadow:0 4px 16px rgba(218,158,11,.18);transform:translateY(-1px);}
  .acc-tile[aria-pressed="true"]{border-color:var(--s-navy);background:var(--s-tile-active);box-shadow:0 0 0 2px var(--s-navy) inset;}
  .acc-tile[aria-pressed="true"]::after{content:"✓";position:absolute;top:7px;right:7px;width:18px;height:18px;border-radius:999px;background:var(--s-grad);color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:800;}
  .acc-tile .ico{font-size:20px;line-height:1;background:var(--s-grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
  .acc-tile .tile-label{font-size:12px;font-weight:700;line-height:1.25;}
  .acc-tile .tile-note{font-size:10.5px;color:var(--s-muted);font-weight:500;line-height:1.2;}
  .acc-tile.span2{grid-column:span 2;} .acc-tile.span3{grid-column:span 3;}
  .acc-tile.no-click{cursor:default;}
  .acc-tile.no-click:hover{transform:none;border-color:var(--s-border);box-shadow:none;background:var(--s-tile-bg);}
  .acc-tile.tile-green{border-color:#b7e4c7;}
  .acc-tile.tile-green[aria-pressed="true"]{border-color:var(--s-success);background:#e8f8ee;box-shadow:0 0 0 2px var(--s-success) inset;}
  .acc-tile.tile-orange{border-color:#fde8c8;}
  .acc-tile.tile-orange[aria-pressed="true"]{border-color:var(--s-warning);background:#fff3e0;box-shadow:0 0 0 2px var(--s-warning) inset;}
  .acc-tile.tile-red{border-color:#fcc;}
  .acc-tile.tile-red[aria-pressed="true"]{border-color:var(--s-danger);background:#ffeef0;box-shadow:0 0 0 2px var(--s-danger) inset;}

  /* SEGMENTED */
  .segmented{display:flex;gap:5px;width:100%;justify-content:center;flex-wrap:wrap;margin-top:6px;}
  .segmented .seg{flex:1 1 auto;padding:5px 7px;border:1.5px solid var(--s-border);border-radius:999px;background:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;transition:all .18s;color:var(--s-text);font-family:'Barlow',sans-serif;}
  .segmented .seg:hover{border-color:var(--s-cyan);background:#F0FAFC;}
  .segmented .seg.active{border-color:var(--s-navy);background:var(--s-grad);color:#fff;box-shadow:0 2px 8px rgba(2,75,64,.25);}

  /* SLIDER */
  .acc-tile input[type="range"]{width:calc(100% - 4px);accent-color:var(--s-navy);height:4px;margin:4px 0;cursor:pointer;}
  .slider-val{font-size:11px;font-weight:700;color:var(--s-navy);font-family:'Barlow',sans-serif;}

  /* BUTTONS */
  .ap-btn{padding:8px 13px;border-radius:9px;border:1.5px solid var(--s-border);background:#fff;cursor:pointer;font-size:12.5px;font-weight:600;transition:all .18s;font-family:'Barlow',sans-serif;color:var(--s-text);display:inline-flex;align-items:center;gap:6px;}
  .ap-btn:hover{background:var(--s-light);border-color:var(--s-cyan);}
  .ap-btn.primary{background:var(--s-grad);color:#fff;border-color:transparent;box-shadow:0 2px 10px rgba(2,75,64,.25);}
  .ap-btn.primary:hover{box-shadow:0 4px 16px rgba(2,75,64,.35);transform:translateY(-1px);}
  .ap-btn.danger{background:linear-gradient(90deg,#c0392b,#e74c3c);color:#fff;border-color:transparent;}
  .ap-btn.success{background:linear-gradient(90deg,#1e8449,#27ae60);color:#fff;border-color:transparent;}
  .ap-btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important;}

  /* TTS */
  .tts-row{display:flex;gap:8px;justify-content:center;margin-top:7px;flex-wrap:wrap;}

  /* TIMER 20-20-20 */
  #acc2020Box{background:linear-gradient(135deg,#024B40,#DA9E0B);border-radius:14px;padding:18px 20px;color:#fff;font-family:'Barlow',sans-serif;text-align:center;margin-bottom:12px;}
  #acc2020Box .timer-btns{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap;}
  #acc2020Box .timer-btns button{padding:7px 18px;border-radius:999px;border:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.15);color:#fff;font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;}
  #acc2020Box .timer-btns button:hover{background:rgba(255,255,255,.3);border-color:#fff;}
  #acc2020Box .timer-btns button.active-btn{background:#fff;color:var(--s-navy);}
  .timer-progress-ring{display:inline-block;position:relative;width:80px;height:80px;margin:6px auto 0;}
  .timer-progress-ring svg{transform:rotate(-90deg);}
  .timer-progress-ring .ring-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:#fff;}

  /* READING RULER (usada internamente por el Modo enfoque / TDAH) */
  #accReadingRuler{position:fixed;left:0;right:0;height:40px;background:rgba(2,75,64,.1);border-top:2px solid rgba(2,75,64,.35);border-bottom:2px solid rgba(2,75,64,.35);pointer-events:none;z-index:10045;display:none;transform:translateY(-50%);}
  #accReadingRuler.on{display:block;}

  /* TOAST */
  #accNarratorToast{position:fixed;bottom:90px;left:20px;background:rgba(13,24,68,.93);color:#fff;font-size:12.5px;padding:9px 15px;border-radius:12px;pointer-events:none;opacity:0;transform:translateY(8px) scale(.97);transition:opacity .22s,transform .22s;z-index:10200;max-width:300px;line-height:1.45;backdrop-filter:blur(8px);box-shadow:0 4px 20px rgba(0,0,0,.25);font-family:'Barlow',sans-serif;font-weight:500;border-left:3px solid var(--s-cyan);}
  #accNarratorToast.show{opacity:1;transform:translateY(0) scale(1);}
  #accNarratorToast.toast-success{border-left-color:#27ae60;}
  #accNarratorToast.toast-warning{border-left-color:#f39c12;}

  /* CURSOR RING */
  #accCursorRing{position:fixed;top:0;left:0;width:46px;height:46px;border:3px solid var(--s-cyan);border-radius:999px;pointer-events:none;transform:translate(-200px,-200px);opacity:0;transition:opacity .2s;z-index:10080;}
  #accCursorRing.on{opacity:.75;}

  /* LANG SWITCHER */
  .lang-btn{display:flex;align-items:center;gap:10px;padding:13px 16px;border:1.5px solid var(--s-border);border-radius:12px;background:var(--s-tile-bg);cursor:pointer;font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;color:var(--s-text);transition:all .18s;width:100%;}
  .lang-btn:hover{border-color:var(--s-cyan);background:#fff;box-shadow:0 4px 14px rgba(218,158,11,.15);}
  .lang-btn.active{border-color:var(--s-navy);background:var(--s-tile-active);box-shadow:0 0 0 2px var(--s-navy) inset;}
  .lang-btn .lang-flag{font-size:22px;line-height:1;}
  .lang-btn .lang-name{flex:1;}
  .lang-btn .lang-check{color:var(--s-navy);font-size:14px;display:none;}
  .lang-btn.active .lang-check{display:block;}
  .langs-grid{display:flex;flex-direction:column;gap:8px;margin-top:4px;}

  /* GLOBAL EFFECTS */
  html.acc-contrast-light{filter:brightness(0.92) contrast(0.97) saturate(0.95)}
  html.acc-daltonic-protanopia{filter:url('#acc-protanopia')}
  html.acc-daltonic-deuteranopia{filter:url('#acc-deuteranopia')}
  html.acc-daltonic-tritanopia{filter:url('#acc-tritanopia')}
  html.acc-daltonic-acromatopsia{filter:url('#acc-acromatopsia')}
  html.acc-big-cursor,html.acc-big-cursor *{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M8 4L8 32L16 24L22 36L26 34L20 22L32 22Z' fill='%23024B40' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 4 4,auto!important}
  html.acc-ctl *{font-size:var(--acc-font-scale,100%);letter-spacing:var(--acc-letter-spacing,0px);line-height:var(--acc-line-height,normal)}
  #accPanel,#accPanel *{font-size:min(var(--acc-font-scale,100%),115%)!important;letter-spacing:min(var(--acc-letter-spacing,0px),2px)!important;line-height:min(var(--acc-line-height,normal),1.6)!important;}
  html.acc-night-mode{filter:sepia(.15) brightness(.88)!important;}
  /* MODO ENFOQUE (TDAH): menos movimiento + más aire entre líneas + guía de lectura activa */
  html.acc-focus-mode *,html.acc-focus-mode *::before,html.acc-focus-mode *::after{animation-duration:.001s!important;animation-iteration-count:1!important;transition:none!important;}
  html.acc-focus-mode p,html.acc-focus-mode li,html.acc-focus-mode td{margin-bottom:1.3em!important;line-height:1.85!important;}

  /* MOBILE */
  @media(max-width:680px){
    #accFab{width:58px;height:58px;bottom:150px;left:16px;}
    #accPanel{top:auto!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;max-width:100%!important;transform:translateY(105%)!important;border-radius:20px 20px 0 0!important;max-height:91vh!important;opacity:1!important;transition:transform .32s cubic-bezier(.4,0,.2,1)!important;}
    #accPanel.open{transform:translateY(0)!important;}
    #accPanel .ap-header{border-radius:20px 20px 0 0;padding:12px 18px;}
    .ap-grid{grid-template-columns:repeat(2,1fr);}
    .acc-tile{min-height:88px;font-size:13px;}
  }
  @media(max-width:380px){
    .ap-grid{grid-template-columns:repeat(2,1fr);}
    .acc-tile{min-height:80px;font-size:12px;}
    .ap-tab{font-size:10.5px;padding:9px 10px;}
  }
  `;

  /* ── DEFAULTS ── */
  const defaults={
    contrast:null,daltonic:null,textSize:'medium',
    voiceFeedback:false,focusMode:false,bigCursor:false,
    nightMode:false
  };
  let settings={...defaults};

  function loadFabPos(){try{return JSON.parse(localStorage.getItem(LS_POS)||'null')}catch{return null}}
  function saveFabPos(x,y){localStorage.setItem(LS_POS,JSON.stringify({x,y}))}

  /* ── ESTADÍSTICAS ── */
  const STATS_KEY='acc_usage_summas_v1';
  function getStats(){try{return JSON.parse(localStorage.getItem(STATS_KEY)||'{}')}catch{return{}}}
  function trackStat(f){const s=getStats();s[f]=(s[f]||0)+1;s._lastUsed=new Date().toISOString();localStorage.setItem(STATS_KEY,JSON.stringify(s));}

  /* ── VOZ ── */
  let preferredVoice=null;
  function loadVoices(){
    const voices=window.speechSynthesis?window.speechSynthesis.getVoices():[];
    /* Prioriza voces LOCALES (no dependen de internet) para evitar el error
       "no se pudo conectar con el servidor" de las voces de red tipo Google. */
    const prio=[
      v=>v.lang.startsWith('es')&&v.localService,
      v=>v.localService,
      v=>v.lang.startsWith('es'),
      v=>true
    ];
    for(const t of prio){const f=voices.find(t);if(f){preferredVoice=f;break;}}
  }
  if(window.speechSynthesis){loadVoices();window.speechSynthesis.onvoiceschanged=loadVoices;}
  function speak(text,interrupt=false){
    if(!window.speechSynthesis||!text) return;
    if(interrupt) window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text.trim().slice(0,220));
    if(preferredVoice) u.voice=preferredVoice;
    u.lang=preferredVoice?.lang||'es-ES';u.rate=1.08;u.pitch=1.05;u.volume=1;
    /* Si la voz elegida falla (p.ej. una voz de red sin conexión), reintenta una sola vez
       forzando una voz local para no dejar al usuario sin narración. */
    u.onerror=()=>{
      const localVoice=(window.speechSynthesis.getVoices()||[]).find(v=>v.localService);
      if(localVoice&&preferredVoice!==localVoice){
        preferredVoice=localVoice;
        const retry=new SpeechSynthesisUtterance(text.trim().slice(0,220));
        retry.voice=localVoice;retry.lang=localVoice.lang;retry.rate=1.08;retry.pitch=1.05;retry.volume=1;
        window.speechSynthesis.speak(retry);
      }
    };
    window.speechSynthesis.speak(u);
  }


  /* ── TOAST ── */
  let narratorToast=null,narratorTimer=null;
  function showToast(msg,icon='',type=''){
    if(!narratorToast) return;
    narratorToast.textContent=(icon?icon+' ':'')+msg;
    narratorToast.className='';
    if(type) narratorToast.classList.add('toast-'+type);
    narratorToast.classList.add('show');
    clearTimeout(narratorTimer);
    narratorTimer=setTimeout(()=>narratorToast.classList.remove('show'),2800);
  }

  /* ── NARRADOR ── */
  function getLabel(el){
    if(!el||el===document.body||el===document.documentElement) return '';
    const lbl=(el.getAttribute('aria-label')||el.getAttribute('title')||'').trim();
    if(lbl) return lbl.slice(0,90);
    if(el.placeholder) return el.placeholder.slice(0,90);
    if(el.tagName==='IMG') return el.alt?el.alt.slice(0,90):'imagen';
    if(el.tagName==='SELECT'){const o=el.options[el.selectedIndex];return o?o.text.slice(0,90):'';}
    const txt=(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    if(txt) return txt.slice(0,90);
    const map={A:'enlace',BUTTON:'botón',INPUT:'campo',TEXTAREA:'área de texto',SELECT:'selector'};
    return map[el.tagName]||'';
  }
  function narratorClick(e){
    const el=e.target;const lbl=getLabel(el);if(!lbl) return;
    if(el.closest('#accPanel,#accFab,#accPanelOverlay,#accNarratorToast,#accOutlinePanel')) return;
    const tag=el.tagName.toUpperCase();let msg='';
    if(tag==='A') msg='Enlace: '+lbl;
    else if(tag==='BUTTON'||el.getAttribute('role')==='button') msg='Botón: '+lbl;
    else if(tag==='INPUT'){const t=el.type||'text';if(t==='checkbox') msg=lbl+': '+(el.checked?'activado':'desactivado');else msg='Campo: '+lbl;}
    else msg=lbl;
    if(msg){showToast(msg);speak(msg,true);}
  }
  function narratorFocus(e){
    const el=e.target;if(!el||el===document.body) return;
    if(el.closest('#accPanel,#accFab,#accOutlinePanel')) return;
    const interactive=['A','BUTTON','INPUT','SELECT','TEXTAREA'];
    if(!interactive.includes(el.tagName)&&!el.getAttribute('role')) return;
    const lbl=getLabel(el);if(!lbl) return;
    showToast('Enfocado: '+lbl);speak('Enfocado: '+lbl,false);
  }
  let narratorActive=false;
  /* Anuncio proactivo: si la página cambia de título (navegación SPA), el narrador la anuncia solo,
     sin que la persona tenga que tocar nada — clave para navegación no vidente en una app de una sola página. */
  let narratorTitleObserver=null;
  function watchTitleForNarrator(){
    if(narratorTitleObserver) return;
    const titleEl=document.querySelector('title');if(!titleEl) return;
    let lastTitle=document.title;
    narratorTitleObserver=new MutationObserver(()=>{
      if(!narratorActive) return;
      if(document.title&&document.title!==lastTitle){
        lastTitle=document.title;
        speak('Nueva página: '+document.title,true);
        showToast('Nueva página: '+document.title,'📍');
      }
    });
    narratorTitleObserver.observe(titleEl,{childList:true});
  }
  function enableNarrator(){
    if(narratorActive) return;narratorActive=true;
    document.addEventListener('click',narratorClick,true);
    document.addEventListener('touchstart',narratorClick,true); /* respuesta inmediata al tacto, sin esperar el click sintético */
    document.addEventListener('focusin',narratorFocus,true);
    watchTitleForNarrator();
    const fab=$('#accFab');if(fab) fab.classList.add('narrator-on');
    const bienvenida=T().toastNarratorOn+'. Estás en: '+document.title+'. Toca o navega los elementos para escucharlos.';
    speak(bienvenida,true);showToast(T().toastNarratorOn,'🎙️');
  }
  function disableNarrator(){
    if(!narratorActive) return;narratorActive=false;
    document.removeEventListener('click',narratorClick,true);
    document.removeEventListener('touchstart',narratorClick,true);
    document.removeEventListener('focusin',narratorFocus,true);
    const fab=$('#accFab');if(fab) fab.classList.remove('narrator-on');
    if(narratorToast) narratorToast.classList.remove('show');
    window.speechSynthesis&&window.speechSynthesis.cancel();
  }

  /* ── TTS ── */
  let reading=false,paused=false;
  let ttsQueue=[],ttsIndex=0,ttsWatchdog=null;

  /* Bug conocido de Chrome: si se le pasa TODO el texto en una sola
     SpeechSynthesisUtterance larga, el motor se "cuelga" en silencio a los
     ~15s (2-4 oraciones) y no vuelve a hablar. Se evita partiendo el texto
     en fragmentos cortos por oración y encadenándolos con onend. */
  function ttsSplitChunks(text,maxLen=180){
    const sentences=text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g)||[text];
    const chunks=[];
    for(let s of sentences){
      s=s.trim();if(!s) continue;
      while(s.length>maxLen){
        let cut=s.lastIndexOf(' ',maxLen);if(cut<=0) cut=maxLen;
        chunks.push(s.slice(0,cut).trim());
        s=s.slice(cut).trim();
      }
      if(s) chunks.push(s);
    }
    return chunks;
  }
  function ttsStartWatchdog(){
    ttsStopWatchdog();
    /* Refuerzo extra contra el mismo bug de Chrome: pausar/reanudar cada 5s
       mientras se lee "resetea" el temporizador interno del navegador. */
    ttsWatchdog=setInterval(()=>{
      if(!reading||paused) return;
      try{window.speechSynthesis.pause();window.speechSynthesis.resume();}catch{}
    },5000);
  }
  function ttsStopWatchdog(){if(ttsWatchdog){clearInterval(ttsWatchdog);ttsWatchdog=null;}}
  function ttsSpeakNext(){
    if(ttsIndex>=ttsQueue.length){reading=false;paused=false;ttsStopWatchdog();syncTTS();return;}
    const u=new SpeechSynthesisUtterance(ttsQueue[ttsIndex]);
    if(preferredVoice) u.voice=preferredVoice;
    u.lang=preferredVoice?.lang||'es-ES';u.rate=1.05;u.pitch=1;
    u.onend=()=>{ttsIndex++;ttsSpeakNext();};
    u.onerror=()=>{ttsIndex++;ttsSpeakNext();}; /* si un fragmento falla, sigue con el siguiente en vez de quedar colgado */
    window.speechSynthesis.speak(u);
  }
  function ttsReadAll(){
    try{window.speechSynthesis.cancel()}catch{}
    const root=document.querySelector('main')||document.querySelector('[role="main"]')||document.body;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode(n){return n.parentElement.closest('#accPanel,#accFab,#accNarratorToast,#accOutlinePanel,script,style,noscript')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}
    });
    let text='';while(walker.nextNode()) text+=' '+walker.currentNode.nodeValue;
    text=text.replace(/\s+/g,' ').trim();if(!text) return;
    ttsQueue=ttsSplitChunks(text.slice(0,250000));ttsIndex=0;
    reading=true;paused=false;syncTTS();
    ttsStartWatchdog();
    ttsSpeakNext();
    trackStat('tts');
  }
  function ttsPause(){try{window.speechSynthesis.pause();paused=true;syncTTS();}catch{}}
function ttsResume(){try{window.speechSynthesis.resume();paused=false;syncTTS();}catch{}}
function ttsStop(){try{window.speechSynthesis.cancel();}catch{}ttsQueue=[];ttsIndex=0;reading=false;paused=false;ttsStopWatchdog();syncTTS();}
function syncTTS(){
    const p=$('#ttsPlay'),s=$('#ttsStop');
    if(!p) return;
    p.disabled=reading;
    s.disabled=!reading;
}

 /* ── TEMPORIZADOR 20-20-20 ── */
let timer2020=null,timer2020State='idle',timer2020Seconds=0,timer2020Phase='work';
const WORK_SECS=20*60,REST_SECS=20;
const TIMER_LS='acc_2020_summas';

function _timerSave(){
  if(timer2020State!=='running') return;
  localStorage.setItem(TIMER_LS,JSON.stringify({
    s:timer2020Seconds, phase:timer2020Phase, at:Date.now()
  }));
}
function _timerClear(){ localStorage.removeItem(TIMER_LS); }

function start2020(){
  if(timer2020) clearInterval(timer2020);

  /* Restaurar desde localStorage si había timer corriendo */
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(TIMER_LS)); }catch(e){}
  if(saved && saved.at && saved.s>0){
    const elapsed=Math.floor((Date.now()-saved.at)/1000);
    const remaining=saved.s-elapsed;
    if(remaining>0){
      timer2020Seconds=remaining;
      timer2020Phase=saved.phase||'work';
    } else {
      timer2020Seconds=WORK_SECS;
      timer2020Phase='work';
      _timerClear();
    }
  } else {
    timer2020Seconds=WORK_SECS;
    timer2020Phase='work';
  }

  timer2020State='running';
  render2020();

  timer2020=setInterval(()=>{
    timer2020Seconds--;

    /* Guardar en cada tick */
    _timerSave();

    if(timer2020Seconds<=0){
      if(timer2020Phase==='work'){
        timer2020Phase='rest';timer2020Seconds=REST_SECS;
        showToast('¡Descansa 20 segundos! Mira algo a 6 metros 👁️','','warning');
        speak('Es hora de descansar la vista. Mira un punto a 6 metros durante 20 segundos.',true);
      } else {
        timer2020Phase='work';timer2020Seconds=WORK_SECS;
        showToast('Descanso terminado. ¡Sigue! ✓','','success');
        speak('Descanso terminado.',true);
      }
    }
    render2020();
  },1000);
  trackStat('timer2020');
}

function pause2020(){
  if(timer2020) clearInterval(timer2020);
  timer2020State='paused';
  _timerSave();
  render2020();
}

function stop2020(){
  if(timer2020) clearInterval(timer2020);
  timer2020State='idle';
  timer2020Phase='work';
  timer2020Seconds=0;
  _timerClear(); /* Detenido = borrar */
  render2020();
}

function render2020(){
  const disp=$('#timer2020Display'),lbl=$('#timer2020Label'),fill=$('#timer2020RingFill');
  if(!disp) return;
  const total=timer2020Phase==='work'?WORK_SECS:REST_SECS;
  const m=Math.floor(timer2020Seconds/60),s=timer2020Seconds%60;
  disp.textContent=(timer2020State==='idle'?'20:00':`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  const t=T();
  lbl.textContent=timer2020Phase==='rest'?t.timerRest:t.timerLabel;
  if(fill){
    const pct=timer2020State==='idle'?1:(timer2020Seconds/total);
    const r=34,circ=2*Math.PI*r;
    fill.style.strokeDashoffset=circ*(1-pct);
  }
  const bS=$('#timer2020Start'),bP=$('#timer2020Pause');
  if(bS) bS.classList.toggle('active-btn',timer2020State==='running');
  if(bP) bP.classList.toggle('active-btn',timer2020State==='paused');
}

/* Al cargar la página: si había timer corriendo, retomar automáticamente */
(function(){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(TIMER_LS)); }catch(e){}
  if(!saved||!saved.at||!saved.s) return;
  const elapsed=Math.floor((Date.now()-saved.at)/1000);
  if(saved.s-elapsed<=0){ localStorage.removeItem(TIMER_LS); return; }
  /* Esperar a que el botón exista y arrancar */
  let tries=0;
  const check=setInterval(()=>{
    if(++tries>50){ clearInterval(check); return; }
    const btn=document.getElementById('timer2020Start');
    if(!btn) return;
    clearInterval(check);
    btn.click(); /* start2020() leerá el localStorage y retomará */
  },100);
})();

  let syncTilesExt=()=>{};

  /* ── APPLY ── */
  /* Presets de las 3 escalas de texto: Pequeño / Mediano / Grande */
  const TEXT_SIZE_PRESETS={
    small:{scale:90,letter:0,line:130},
    medium:{scale:100,letter:0,line:140},
    large:{scale:130,letter:.5,line:165}
  };

  function apply(){
    localStorage.setItem('acc_settings_summas', JSON.stringify(settings));
    const html=document.documentElement;
    html.classList.remove('acc-contrast-light','acc-daltonic-protanopia','acc-daltonic-deuteranopia','acc-daltonic-tritanopia','acc-daltonic-acromatopsia','acc-big-cursor','acc-night-mode','acc-focus-mode');
    if(settings.contrast==='light') html.classList.add('acc-contrast-light');
    if(settings.daltonic==='protanopia') html.classList.add('acc-daltonic-protanopia');
    if(settings.daltonic==='deuteranopia') html.classList.add('acc-daltonic-deuteranopia');
    if(settings.daltonic==='tritanopia') html.classList.add('acc-daltonic-tritanopia');
    if(settings.daltonic==='acromatopsia') html.classList.add('acc-daltonic-acromatopsia');
    if(settings.bigCursor) html.classList.add('acc-big-cursor');
    if(settings.nightMode) html.classList.add('acc-night-mode');
    if(settings.focusMode) html.classList.add('acc-focus-mode');

    const preset=TEXT_SIZE_PRESETS[settings.textSize]||TEXT_SIZE_PRESETS.medium;
    html.style.setProperty('--acc-font-scale',`${preset.scale}%`);
    html.style.setProperty('--acc-letter-spacing',`${preset.letter}px`);
    html.style.setProperty('--acc-line-height',(preset.line/100).toFixed(2));
    html.classList.toggle('acc-ctl',settings.textSize!=='medium');

    /* La regla de lectura ya no tiene botón propio: se activa sola con el Modo enfoque (TDAH). */
    const ruler=$('#accReadingRuler');if(ruler) ruler.classList.toggle('on',settings.focusMode);
}

  function openTab(name){
    $$('.ap-tab').forEach(t=>{t.classList.remove('active');t.setAttribute('aria-selected','false');});
    $$('.ap-pane').forEach(p=>p.classList.remove('active'));
    const tab=$(`.ap-tab[data-tab="${name}"]`);const pane=$('#pane-'+name);
    if(tab){tab.classList.add('active');tab.setAttribute('aria-selected','true');}
    if(pane) pane.classList.add('active');
  }

  /* ── FAB DRAG ── */
  function initDraggableFab(fab){
    let drag=false,sx,sy,il,it,moved=false;
    const sp=loadFabPos();
    if(sp){fab.style.left=clamp(sp.x,8,window.innerWidth-68)+'px';fab.style.top=clamp(sp.y,8,window.innerHeight-68)+'px';fab.style.bottom='auto';fab.style.right='auto';}
    function onS(e){const t=e.touches?e.touches[0]:e;drag=true;moved=false;sx=t.clientX;sy=t.clientY;const r=fab.getBoundingClientRect();il=r.left;it=r.top;fab.classList.add('dragging');fab.style.transition='none';}
    function onM(e){if(!drag) return;const t=e.touches?e.touches[0]:e;const dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)>6||Math.abs(dy)>6){moved=true;e.preventDefault?.();}if(!moved) return;fab.style.left=clamp(il+dx,8,window.innerWidth-66)+'px';fab.style.top=clamp(it+dy,8,window.innerHeight-66)+'px';fab.style.bottom='auto';fab.style.right='auto';}
    function onE(){if(!drag) return;drag=false;fab.classList.remove('dragging');fab.style.transition='';if(moved){const r=fab.getBoundingClientRect();saveFabPos(r.left,r.top);fab._wd=true;}else fab._wd=false;}
    fab.addEventListener('mousedown',onS);window.addEventListener('mousemove',onM,{passive:false});window.addEventListener('mouseup',onE);
    fab.addEventListener('touchstart',onS,{passive:true});window.addEventListener('touchmove',onM,{passive:false});window.addEventListener('touchend',onE);
    window.addEventListener('resize',()=>{const r=fab.getBoundingClientRect();if(r.left>window.innerWidth-66) fab.style.left=(window.innerWidth-66)+'px';if(r.top>window.innerHeight-66) fab.style.top=(window.innerHeight-66)+'px';});
  }

  /* ── RESET ── */
 function doReset(){
    Object.assign(settings,{...defaults});
    localStorage.removeItem('acc_settings_summas');
    disableNarrator();ttsStop();stop2020();
    const html=document.documentElement;
    [...html.classList].filter(c=>c.startsWith('acc-')).forEach(c=>html.classList.remove(c));
    html.style.removeProperty('--acc-font-scale');html.style.removeProperty('--acc-letter-spacing');html.style.removeProperty('--acc-line-height');
    const ruler=$('#accReadingRuler');if(ruler) ruler.classList.remove('on');
    const ring=$('#accCursorRing');if(ring) ring.classList.remove('on');
    const fab=$('#accFab');if(fab){localStorage.removeItem(LS_POS);fab.style.left='22px';fab.style.top='auto';fab.style.bottom='180px';fab.style.right='auto';fab.classList.remove('hidden','narrator-on');}
    syncAll();
    speak(T().toastReset,true);showToast(T().toastReset,'','success');
}

  /* ── BUILD UI ── */
  function buildUI(){
    if(!$('#acc-widget-styles')){const s=document.createElement('style');s.id='acc-widget-styles';s.textContent=css;document.head.appendChild(s);}
    if(!$('#acc-svg-filters-wrap')){
      const w=document.createElement('div');w.id='acc-svg-filters-wrap';w.style.cssText='display:none;position:absolute;width:0;height:0;overflow:hidden';
      w.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="acc-protanopia"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0,0.558,0.442,0,0,0,0,0.242,0.758,0,0,0,0,0,1,0"/></filter><filter id="acc-deuteranopia"><feColorMatrix type="matrix" values="0.625,0.375,0,0,0,0.7,0.3,0,0,0,0,0.3,0.7,0,0,0,0,0,1,0"/></filter><filter id="acc-tritanopia"><feColorMatrix type="matrix" values="0.95,0.05,0,0,0,0,0.433,0.567,0,0,0,0.475,0.525,0,0,0,0,0,1,0"/></filter><filter id="acc-acromatopsia"><feColorMatrix type="matrix" values="0.299,0.587,0.114,0,0,0.299,0.587,0.114,0,0,0.299,0.587,0.114,0,0,0,0,0,1,0"/></filter></defs></svg>`;
      document.body.appendChild(w);
    }

    /* FAB — oculto: el widget ahora se abre solo desde el botón de accesibilidad del navbar (ver window.AccessibilityWidget.open()) */
    const fab=document.createElement('button');fab.id='accFab';fab.setAttribute('aria-label','Abrir menú de accesibilidad');
    fab.innerHTML=`<img id="accFabLogo" src="/vilcas.png" alt="VILCAS" onerror="this.style.display='none';document.getElementById('accFabIcon').style.display='block'"><span id="accFabIcon" aria-hidden="true" style="font-size:20px;color:#fff;display:none;"><i class="fas fa-universal-access"></i></span>`;
    fab.style.display='none';
    document.body.appendChild(fab);
    initDraggableFab(fab);

    /* OVERLAY + PANEL */
    const overlay=document.createElement('div');overlay.id='accPanelOverlay';
    const panel=document.createElement('div');panel.id='accPanel';
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Menú de accesibilidad VILCAS');

    const t=T();
    panel.innerHTML=`
    <div class="ap-header">
      <div class="ap-header-left">
        <div class="ap-logo-wrap">
          <img src="/vilcas.png" alt="VILCAS" onerror="this.parentElement.innerHTML='<span style=\'color:#024B40;font-family:Barlow Condensed,sans-serif;font-weight:800;font-size:15px;\'>VILCAS</span>'">
        </div>
        <div class="ap-title">
          <h3 id="ap-title-text">${t.title}</h3>
          <p id="ap-subtitle-text">${t.subtitle}</p>
        </div>
      </div>
      <button class="ap-close" id="accClose" aria-label="Cerrar">✕</button>
    </div>

    <div class="ap-tabs-wrap" id="ap-tabs-wrap">
      <button type="button" class="ap-tabs-toggle" id="ap-tabs-toggle" aria-haspopup="listbox" aria-expanded="false">
        <i class="fas fa-eye" id="ap-tabs-toggle-icon"></i>
        <span class="tab-text" id="ap-tabs-toggle-label">${t.tabs[0]}</span>
        <i class="fas fa-chevron-down ap-tabs-chevron"></i>
      </button>
      <div class="ap-tabs" role="listbox" id="ap-tabs-container">
        <button class="ap-tab active" data-tab="vision" data-icon="fa-eye" role="option" aria-selected="true"><i class="fas fa-eye"></i> <span class="tab-text">${t.tabs[0]}</span></button>
        <button class="ap-tab" data-tab="texto" data-icon="fa-font" role="option" aria-selected="false"><i class="fas fa-font"></i> <span class="tab-text">${t.tabs[1]}</span></button>
        <button class="ap-tab" data-tab="idioma" data-icon="fa-globe" role="option" aria-selected="false"><i class="fas fa-globe"></i> <span class="tab-text">${t.tabs[2]}</span></button>
        <button class="ap-tab" data-tab="herramientas" data-icon="fa-eye" role="option" aria-selected="false"><i class="fas fa-eye"></i> <span class="tab-text">${t.tabs[3]}</span></button>
        <button class="ap-tab" data-tab="voz" data-icon="fa-microphone" role="option" aria-selected="false"><i class="fas fa-microphone"></i> <span class="tab-text">${t.tabs[4]}</span></button>
      </div>
    </div>

    <div class="ap-body">

      <!-- VISIÓN -->
      <div class="ap-pane active" id="pane-vision">
        <div class="ap-section"><i class="fas fa-adjust"></i> <span data-i="sec_contrast">${t.sec_contrast}</span></div>
        <div class="ap-grid">
          <button class="acc-tile" id="contrastLight" aria-pressed="false"><div class="ico"><i class="fas fa-sun"></i></div><div class="tile-label" data-i="t_lightContrast">${t.t_lightContrast}</div><div class="tile-note" data-i="t_lightNote">${t.t_lightNote}</div></button>
          <button class="acc-tile tile-orange" id="nightMode" aria-pressed="false"><div class="ico"><i class="fas fa-moon"></i></div><div class="tile-label" data-i="t_night">${t.t_night}</div><div class="tile-note" data-i="t_nightNote">${t.t_nightNote}</div></button>
          <button class="acc-tile" id="cursor" aria-pressed="false"><div class="ico"><i class="fas fa-mouse-pointer"></i></div><div class="tile-label" data-i="t_bigCursor">${t.t_bigCursor}</div><div class="tile-note" data-i="t_bigCursorNote">${t.t_bigCursorNote}</div></button>
        </div>
        <div class="ap-section"><i class="fas fa-palette"></i> <span data-i="sec_dalt">${t.sec_dalt}</span></div>
        <div class="ap-grid"><div class="acc-tile no-click span3"><div class="ico"><i class="fas fa-eye"></i></div><div class="tile-label" data-i="t_daltLabel">${t.t_daltLabel}</div><div class="segmented"><button type="button" class="seg" data-mode="protanopia" data-i="t_proto">${t.t_proto}</button><button type="button" class="seg" data-mode="deuteranopia" data-i="t_deut">${t.t_deut}</button><button type="button" class="seg" data-mode="tritanopia" data-i="t_trit">${t.t_trit}</button><button type="button" class="seg" data-mode="acromatopsia" data-i="t_acro">${t.t_acro}</button><button type="button" class="seg" data-mode="off" data-i="t_disable">${t.t_disable}</button></div></div></div>
      </div>

      <!-- TEXTO -->
      <div class="ap-pane" id="pane-texto">
        <div class="ap-section"><i class="fas fa-text-height"></i> <span data-i="sec_size">${t.sec_size}</span></div>
        <div class="ap-grid">
          <div class="acc-tile no-click span3">
            <div class="ico"><i class="fas fa-text-height"></i></div>
            <div class="tile-label" id="textSizeGaugeLabel">${t.t_sizeMedium}</div>
            <div class="tile-note" id="textSizeGaugeNote">${t.t_sizeMediumNote}</div>
            <input type="range" id="rng-textsize" min="0" max="2" step="1" value="1" style="width:100%;margin-top:10px;">
            <div style="display:flex;justify-content:space-between;width:100%;font-size:10.5px;color:var(--s-muted);font-family:'Barlow',sans-serif;margin-top:2px;">
              <span data-i="t_sizeSmall">${t.t_sizeSmall}</span><span data-i="t_sizeMedium">${t.t_sizeMedium}</span><span data-i="t_sizeLarge">${t.t_sizeLarge}</span>
            </div>
          </div>
        </div>
        <div class="ap-section"><i class="fas fa-brain"></i> <span data-i="sec_focus">${t.sec_focus}</span></div>
        <div class="ap-grid-2"><button class="acc-tile tile-green span2" id="focusMode" aria-pressed="false"><div class="ico"><i class="fas fa-brain"></i></div><div class="tile-label" data-i="t_focus">${t.t_focus}</div><div class="tile-note" data-i="t_focusNote">${t.t_focusNote}</div></button></div>
      </div>


      <!-- HERRAMIENTAS -->
      <div class="ap-pane" id="pane-herramientas">
        <div class="ap-section"><i class="fas fa-eye"></i> <span data-i="sec_timer">${t.sec_timer}</span></div>
        <p style="font-size:12px;color:var(--s-muted);margin-bottom:12px;font-family:'Barlow',sans-serif;line-height:1.5;" id="timer-intro-text">${t.timerIntro}</p>
        <div id="acc2020Box">
          <div style="font-size:12px;font-weight:600;opacity:.85;letter-spacing:.5px;text-transform:uppercase;" id="timer2020Label">${t.timerLabel}</div>
          <div class="timer-progress-ring">
            <svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="6"/><circle id="timer2020RingFill" cx="40" cy="40" r="34" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="${2*Math.PI*34}" stroke-dashoffset="0" stroke-linecap="round" style="transition:stroke-dashoffset .8s ease"/></svg>
            <div class="ring-val" id="timer2020Display">20:00</div>
          </div>
          <div style="font-size:11.5px;opacity:.75;margin-top:6px;line-height:1.5;" id="timer-desc-text">${t.timerDesc}</div>
          <div class="timer-btns">
            <button id="timer2020Start"><i class="fas fa-play"></i> <span id="timer-start-text">${t.timerStart}</span></button>
            <button id="timer2020Pause"><i class="fas fa-pause"></i> <span id="timer-pause-text">${t.timerPause}</span></button>
            <button id="timer2020Stop"><i class="fas fa-stop"></i> <span id="timer-stop-text">${t.timerStop}</span></button>
          </div>
        </div>
      </div>

      <!-- VOZ -->
      <div class="ap-pane" id="pane-voz">
        <div class="ap-section"><i class="fas fa-volume-up"></i> <span data-i="sec_tts">${t.sec_tts}</span></div>
        <div class="ap-grid"><div class="acc-tile no-click span3"><div class="ico"><i class="fas fa-volume-up"></i></div><div class="tile-label" data-i="ttsLabel">${t.ttsLabel}</div><div class="tile-note" data-i="ttsNote">${t.ttsNote}</div><div class="tts-row"><button class="ap-btn primary" id="ttsPlay"><i class="fas fa-play"></i> <span>${t.ttsRead}</span></button><button class="ap-btn danger" id="ttsStop"><i class="fas fa-stop"></i> <span>${t.ttsStop}</span></button></div></div></div>
        <div class="ap-section"><i class="fas fa-microphone"></i> <span data-i="sec_narrator">${t.sec_narrator}</span></div>
        <div class="ap-grid"><button class="acc-tile span3" id="info" aria-pressed="false"><div class="ico"><i class="fas fa-microphone-alt"></i></div><div class="tile-label" data-i="narratorLabel">${t.narratorLabel}</div><div class="tile-note" data-i="narratorNote">${t.narratorNote}</div></button></div>
      </div>

      <!-- IDIOMA -->
      <div class="ap-pane" id="pane-idioma">
        <div class="ap-section"><i class="fas fa-globe"></i> <span data-i="langTitle">${t.langTitle}</span></div>
        <p style="font-size:12px;color:var(--s-muted);margin-bottom:10px;font-family:'Barlow',sans-serif;line-height:1.5;" id="lang-note-text">${t.langNote}</p>
        <div class="langs-grid">
          <button type="button" class="lang-btn${currentLang==='es'?' active':''}" data-lang="es"><span class="lang-flag">🇵🇪</span><span class="lang-name">Español</span><span class="lang-check">✓</span></button>
          <button type="button" class="lang-btn${currentLang==='qu'?' active':''}" data-lang="qu"><span class="lang-flag">🏔️</span><span class="lang-name">Runasimi (Quechua)</span><span class="lang-check">✓</span></button>
          <button type="button" class="lang-btn${currentLang==='en'?' active':''}" data-lang="en"><span class="lang-flag">🇬🇧</span><span class="lang-name">English</span><span class="lang-check">✓</span></button>
        </div>
      </div>


    </div>

    <!-- FOOTER -->
    <div style="flex-shrink:0;padding:10px 18px;background:#F8FAFF;border-top:1px solid var(--s-border);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <button class="ap-btn" id="accReset"><i class="fas fa-undo"></i> <span data-i="resetAll">${t.resetAll}</span></button>
      <a href="${POWERED_BY_LINK}" target="_blank" rel="noopener" id="acc-powered-link" style="font-family:'Barlow',sans-serif;font-size:11px;color:var(--s-muted);text-decoration:none;display:flex;align-items:center;gap:6px;transition:color .2s;">
  <span data-i="poweredBy">${t.poweredBy}</span>
  <strong style="color:var(--s-navy);font-weight:800;letter-spacing:.3px;">Alba</strong>
  <img src="/LogoAlba.png" alt="" style="height:26px;width:auto;object-fit:contain;display:block;">
</a>
    </div>
    `;

    document.body.appendChild(overlay);document.body.appendChild(panel);

    /* Cualquier clic dentro del panel/FAB/overlay se queda contenido aquí:
       nunca debe seguir de largo hacia listeners globales de la página que lo aloja
       (login, dashboard, etc.), o terminaría activando botones de fondo sin querer. */
    panel.addEventListener('click',e=>e.stopPropagation());
    fab.addEventListener('click',e=>e.stopPropagation());
    panel.addEventListener('mousedown',e=>e.stopPropagation());
    panel.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
    fab.addEventListener('mousedown',e=>e.stopPropagation());

    /* ── LANGUAGE SWITCHER ── */
    function applyLang(lang){
      currentLang=lang;
      const tr=T();
      /* Avisa al resto de la web (Angular) que el idioma cambió, para que
         TODO el sitio (sidebar, dashboard, login, etc.) se traduzca también,
         no solo este panel. Angular escucha este evento en I18nService. */
      window.dispatchEvent(new CustomEvent('vilcas-lang-change',{detail:{lang}}));
      /* Header */
      const h=$('#ap-title-text');if(h) h.textContent=tr.title;
      const sub=$('#ap-subtitle-text');if(sub) sub.textContent=tr.subtitle;
      /* Tab labels */
      $$('.ap-tab .tab-text').forEach((el,i)=>{if(tr.tabs[i] !== undefined) el.textContent=tr.tabs[i];});
      /* Lang tab badge */
      const ltab=$(`.ap-tab[data-tab="idioma"] .tab-text`);if(ltab) ltab.textContent=lang.toUpperCase();
      /* Etiqueta del botón desplegable de tabs: refleja la pestaña activa en el nuevo idioma */
      const tabActivo=$('.ap-tab.active');const toggleLbl=$('#ap-tabs-toggle-label');
      if(tabActivo && toggleLbl){const txt=tabActivo.querySelector('.tab-text');if(txt) toggleLbl.textContent=txt.textContent;}
      /* All data-i elements */
      $$('[data-i]',panel).forEach(el=>{const key=el.dataset.i;if(tr[key]!==undefined) el.textContent=tr[key];});
      /* Footer powered by */
      const pw=$('[data-i="poweredBy"]',panel);if(pw) pw.textContent=tr.poweredBy;
      /* Dynamic texts */
      const ti=$('#timer-intro-text');if(ti) ti.textContent=tr.timerIntro;
      const td=$('#timer-desc-text');if(td) td.textContent=tr.timerDesc;
      const ts=$('#timer-start-text');if(ts) ts.textContent=tr.timerStart;
      const tp=$('#timer-pause-text');if(tp) tp.textContent=tr.timerPause;
      const tst=$('#timer-stop-text');if(tst) tst.textContent=tr.timerStop;
      const ai=$('#ai-intro-text');if(ai) ai.textContent=tr.aiIntro;
      const aib=$('#ai-btn-text');if(aib) aib.textContent=tr.aiBtn;
      const si=$('#stats-intro-text');if(si) si.textContent=tr.statsIntro;
      const shc=$('#shortcuts-intro-text');if(shc) shc.textContent=tr.shortcutsIntro;
      const lnote=$('#lang-note-text');if(lnote) lnote.textContent=tr.langNote;
      /* Sliders label */
      const ll=$('#lbl-line');if(ll) ll.textContent=tr.t_lineH;
      /* Lang buttons */
      $$('.lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
      render2020();
    }
    $$('.lang-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        applyLang(btn.dataset.lang);
        trackStat('lang_'+btn.dataset.lang);
        showToast(btn.querySelector('.lang-name').textContent,'🌐','success');
      });
    });

    /* ── TABS (menú desplegable) ── */
    const tabsWrap=$('#ap-tabs-wrap');
    const tabsToggle=$('#ap-tabs-toggle');
    const tabsToggleIcon=$('#ap-tabs-toggle-icon');
    const tabsToggleLabel=$('#ap-tabs-toggle-label');

    function closeTabsMenu(){
      if(!tabsWrap) return;
      tabsWrap.classList.remove('open');
      if(tabsToggle) tabsToggle.setAttribute('aria-expanded','false');
    }
    function toggleTabsMenu(){
      if(!tabsWrap) return;
      const abierto=tabsWrap.classList.toggle('open');
      if(tabsToggle) tabsToggle.setAttribute('aria-expanded',abierto?'true':'false');
    }
    function syncTabsToggle(tab){
      if(!tab) return;
      if(tabsToggleLabel){const txt=tab.querySelector('.tab-text');if(txt) tabsToggleLabel.textContent=txt.textContent;}
      if(tabsToggleIcon){const icon=tab.dataset.icon;if(icon) tabsToggleIcon.className='fas '+icon;}
    }
    if(tabsToggle){
      tabsToggle.addEventListener('click',(e)=>{e.stopPropagation();toggleTabsMenu();});
    }
    document.addEventListener('click',(e)=>{
      if(tabsWrap && tabsWrap.classList.contains('open') && !tabsWrap.contains(e.target)) closeTabsMenu();
    });
    document.addEventListener('keydown',(e)=>{
      if(e.key==='Escape' && tabsWrap && tabsWrap.classList.contains('open')) closeTabsMenu();
    });

    $$('.ap-tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        try{
          $$('.ap-tab').forEach(t=>{t.classList.remove('active');t.setAttribute('aria-selected','false');});
          $$('.ap-pane').forEach(p=>p.classList.remove('active'));
          tab.classList.add('active');tab.setAttribute('aria-selected','true');
          const pane=$('#pane-'+tab.dataset.tab);if(pane) pane.classList.add('active');
          if(tab.dataset.tab==='herramientas') render2020();
          syncTabsToggle(tab);
          closeTabsMenu();
        }catch(err){
          /* Nunca dejar que un error interno del widget se propague fuera de él
             (Zone.js de Angular parchea addEventListener globalmente, y un error
             sin capturar aquí puede llegar hasta el ErrorHandler de Angular). */
          console.error('[Widget accesibilidad] Error al cambiar de pestaña:',err);
        }
      });
    });

    // ── DRAG PANEL ──
let panelDrag=false,panelSX,panelSY,panelIL,panelIT;
panel.querySelector('.ap-header').style.cursor='grab';
panel.querySelector('.ap-header').addEventListener('mousedown',function(e){
    if(e.target.closest('#accClose')) return;
    panelDrag=true;
    panel.style.transition='none';
    const r=panel.getBoundingClientRect();
    panelIL=r.left;panelIT=r.top;
    panelSX=e.clientX;panelSY=e.clientY;
    panel.querySelector('.ap-header').style.cursor='grabbing';
});
window.addEventListener('mousemove',function(e){
    if(!panelDrag) return;
    const dx=e.clientX-panelSX,dy=e.clientY-panelSY;
    const newL=clamp(panelIL+dx,0,window.innerWidth-panel.offsetWidth);
    const newT=clamp(panelIT+dy,0,window.innerHeight-panel.offsetHeight);
    panel.style.left=newL+'px';
    panel.style.top=newT+'px';
    panel.style.transform='none';
});
window.addEventListener('mouseup',function(){
    if(!panelDrag) return;
    panelDrag=false;
    panel.querySelector('.ap-header').style.cursor='grab';
    panel.style.transition='';
});
// Touch
panel.querySelector('.ap-header').addEventListener('touchstart',function(e){
    if(e.target.closest('#accClose')) return;
    const t=e.touches[0];
    panelDrag=true;
    panel.style.transition='none';
    const r=panel.getBoundingClientRect();
    panelIL=r.left;panelIT=r.top;
    panelSX=t.clientX;panelSY=t.clientY;
},{passive:true});
window.addEventListener('touchmove',function(e){
    if(!panelDrag) return;
    const t=e.touches[0];
    const dx=t.clientX-panelSX,dy=t.clientY-panelSY;
    const newL=clamp(panelIL+dx,0,window.innerWidth-panel.offsetWidth);
    const newT=clamp(panelIT+dy,0,window.innerHeight-panel.offsetHeight);
    panel.style.left=newL+'px';
    panel.style.top=newT+'px';
    panel.style.transform='none';
    panel._dragMoved=true;
},{passive:true});
window.addEventListener('touchend',function(){
    panelDrag=false;
});

    /* ── OPEN/CLOSE ── */
    const openPanel=()=>{
      overlay.classList.add('open');panel.style.display='flex';
      panel.getBoundingClientRect();panel.classList.add('open');
      const s=getStats();s._sessions=(s._sessions||0)+1;localStorage.setItem(STATS_KEY,JSON.stringify(s));
    };
    const closePanel=()=>{
      overlay.classList.remove('open');panel.classList.remove('open');
      panel.addEventListener('transitionend',()=>{if(!panel.classList.contains('open')) panel.style.display='none';},{once:true});
    };
    /* Se guardan en el scope externo del IIFE para poder abrirlo/cerrarlo
       desde afuera (botón del navbar) sin depender del FAB oculto. */
    externalOpenPanel=openPanel;externalClosePanel=closePanel;

    let swY=0,swStarted=false;
    panel.addEventListener('touchstart',e=>{const body=panel.querySelector('.ap-body');if(body&&body.scrollTop>0) return;swY=e.touches[0].clientY;swStarted=true;},{passive:true});
    panel.addEventListener('touchmove',e=>{if(!swStarted) return;if(e.touches[0].clientY-swY>60){closePanel();swStarted=false;}},{passive:true});
    panel.addEventListener('touchend',()=>{swStarted=false;},{passive:true});

    fab.addEventListener('click',()=>{if(fab._wd){fab._wd=false;return;}openPanel();});
    fab.addEventListener('touchend',e=>{if(!fab._wd){e.preventDefault();openPanel();}fab._wd=false;},{passive:false});
    fab.addEventListener('mousedown',()=>{fab._wd=false;});
    overlay.addEventListener('click',closePanel);
    $('#accClose').addEventListener('click',closePanel);

    /* ── KEYBOARD SHORTCUTS ── */
    document.addEventListener('keydown',e=>{
      const ctrl=e.ctrlKey||e.metaKey;const alt=e.altKey;
      if(ctrl&&(e.key==='u'||e.key==='U')){e.preventDefault();openPanel();}
      if(alt&&(e.key==='n'||e.key==='N')){e.preventDefault();settings.voiceFeedback=!settings.voiceFeedback;if(settings.voiceFeedback)enableNarrator();else disableNarrator();syncTiles();}
      if(alt&&(e.key==='r'||e.key==='R')){e.preventDefault();ttsReadAll();}
      if(e.key==='Escape'){closePanel();}
    });

    /* ── SNAPS ── */

    /* ── MEDIDOR DE TAMAÑO DE TEXTO (Pequeño / Mediano / Grande) ── */
    const SIZE_STOPS=['small','medium','large'];
    function updateTextSizeGauge(){
      const tr=T();
      const labels={small:[tr.t_sizeSmall,tr.t_sizeSmallNote],medium:[tr.t_sizeMedium,tr.t_sizeMediumNote],large:[tr.t_sizeLarge,tr.t_sizeLargeNote]};
      const [lbl,note]=labels[settings.textSize]||labels.medium;
      const lblEl=$('#textSizeGaugeLabel');if(lblEl) lblEl.textContent=lbl;
      const noteEl=$('#textSizeGaugeNote');if(noteEl) noteEl.textContent=note;
      const rng=$('#rng-textsize');if(rng) rng.value=String(Math.max(0,SIZE_STOPS.indexOf(settings.textSize)));
    }
    $('#rng-textsize')?.addEventListener('input',function(){
      settings.textSize=SIZE_STOPS[+this.value]||'medium';
      updateTextSizeGauge();apply();trackStat('textSize_'+settings.textSize);
    });
    updateTextSizeGauge();

    /* ── TILES ── */
    function tile(id,fn){const el=$(id);if(!el) return;el.addEventListener('click',()=>{fn();syncTiles();apply();trackStat(id);});}
    tile('#contrastLight',()=>settings.contrast=settings.contrast==='light'?null:'light');
    tile('#focusMode',()=>settings.focusMode=!settings.focusMode);
    tile('#nightMode',()=>settings.nightMode=!settings.nightMode);
    tile('#cursor',()=>{
      settings.bigCursor=!settings.bigCursor;
      if(!$('#accCursorRing')){const r=document.createElement('div');r.id='accCursorRing';document.body.appendChild(r);window.addEventListener('mousemove',e=>{const ring=$('#accCursorRing');if(ring&&ring.classList.contains('on')) ring.style.transform=`translate(${e.clientX-23}px,${e.clientY-23}px)`;},{passive:true});}
      $('#accCursorRing').classList.toggle('on',settings.bigCursor);
    });

    /* ── POWERED BY LINK HOVER ── */
    const pwLink=$('#acc-powered-link');
    if(pwLink){pwLink.addEventListener('mouseenter',()=>pwLink.style.color='var(--s-navy)');pwLink.addEventListener('mouseleave',()=>pwLink.style.color='var(--s-muted)');}

    /* TIMER */
    $('#timer2020Start')?.addEventListener('click',()=>{if(timer2020State==='running'){pause2020();}else{start2020();}});
    $('#timer2020Pause')?.addEventListener('click',()=>{if(timer2020State==='paused'){start2020();}else{pause2020();}});
    $('#timer2020Stop')?.addEventListener('click',stop2020);

    /* SEGMENTADOS */
    $$('#pane-vision .seg[data-mode]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.mode;settings.daltonic=(m==='off'||settings.daltonic===m)?null:m;syncTiles();apply();}));

    /* NARRADOR */
    $('#info').addEventListener('click',()=>{settings.voiceFeedback=!settings.voiceFeedback;syncTiles();if(settings.voiceFeedback)enableNarrator();else disableNarrator();});

    /* TTS */
   $('#ttsPlay').addEventListener('click',ttsReadAll);
$('#ttsStop').addEventListener('click',ttsStop);

    $('#accReset').addEventListener('click',doReset);

    /* ── SYNC TILES ── */
    function syncTiles(){
      const sT=(id,on)=>{const el=$(id);if(el) el.setAttribute('aria-pressed',String(!!on));};
      sT('#contrastLight',settings.contrast==='light');
      sT('#focusMode',settings.focusMode);
      sT('#nightMode',settings.nightMode);
      sT('#cursor',settings.bigCursor);sT('#info',settings.voiceFeedback);
      const gaugeEl=$('#rng-textsize');if(gaugeEl){const stops=['small','medium','large'];const tr=T();const labels={small:[tr.t_sizeSmall,tr.t_sizeSmallNote],medium:[tr.t_sizeMedium,tr.t_sizeMediumNote],large:[tr.t_sizeLarge,tr.t_sizeLargeNote]};const[lbl,note]=labels[settings.textSize]||labels.medium;gaugeEl.value=String(Math.max(0,stops.indexOf(settings.textSize)));const lblEl=$('#textSizeGaugeLabel');if(lblEl) lblEl.textContent=lbl;const noteEl=$('#textSizeGaugeNote');if(noteEl) noteEl.textContent=note;}
      $$('#pane-vision .seg[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===settings.daltonic));
    }

    function syncAll(){syncTiles();}
    syncTilesExt=syncTiles;

   /* INIT */
    if(!$('#accNarratorToast')){narratorToast=document.createElement('div');narratorToast.id='accNarratorToast';document.body.appendChild(narratorToast);}
    else narratorToast=$('#accNarratorToast');
    if(!$('#accReadingRuler')){
      const r=document.createElement('div');r.id='accReadingRuler';document.body.appendChild(r);
      window.addEventListener('mousemove',e=>{if(settings.focusMode) r.style.top=e.clientY+'px';},{passive:true});
    }
    if(settings.voiceFeedback) enableNarrator();
    try {
      const saved = localStorage.getItem('acc_settings_summas');
      if(saved) Object.assign(settings, JSON.parse(saved));
    } catch(e) {}
    syncAll();apply();

    /* ── Restaurar timer al cambiar de página ── */
    (function(){
      let saved=null;
      try{ saved=JSON.parse(localStorage.getItem('acc_2020_summas')); }catch(e){}
      if(!saved||!saved.at||!saved.s) return;
      const elapsed=Math.floor((Date.now()-saved.at)/1000);
      if(saved.s-elapsed<=0){ localStorage.removeItem('acc_2020_summas'); return; }
      let tries=0;
      const check=setInterval(()=>{
        if(++tries>80){ clearInterval(check); return; }
        const btn=document.getElementById('timer2020Start');
        if(!btn) return;
        clearInterval(check);
        btn.click();
      },100);
    })();

    window.AccessibilityWidget._settings=settings;
  }

  window.AccessibilityWidget={
    init(){buildUI()},
    open(){if(!$('#accPanel')) buildUI();externalOpenPanel&&externalOpenPanel();},
    close(){externalClosePanel&&externalClosePanel();},
    toggle(){const p=$('#accPanel');(p&&p.classList.contains('open'))?this.close():this.open();},
    _settings:settings,
  };
  if(document.readyState!=='loading') window.AccessibilityWidget.init();
  else document.addEventListener('DOMContentLoaded',()=>window.AccessibilityWidget.init());
})();