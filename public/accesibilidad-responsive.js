/*
 * accesibilidad-responsive.js — VILCAS (basado en SUMMAS v5.8)
 *
 * REGLA DE ORO:
 *   ✅ Desktop → NO SE TOCA NADA. Cero estilos inline, cero JS al panel.
 *   ✅ Mobile ≤ 680px → bottom-sheet compacto igual a la captura de desktop.
 *   ✅ Hamburguesa reemplaza tabs en mobile.
 *   ✅ Timer localStorage + reset al cambiar ventana.
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     TIMER localStorage + reset en visibilitychange
  ══════════════════════════════════════ */
  var TK = 'acc_2020_summas';
  function clrTimer() { try { localStorage.removeItem(TK); } catch(e){} }
  function savTimer(v){ try { localStorage.setItem(TK, JSON.stringify(v)); } catch(e){} }
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        /* Solo guardar el estado — NO detener ni pausar */
        var d = document.getElementById('timer2020Display');
        if (!d || d.textContent === '20:00') return;
        var p = d.textContent.split(':');
        var s = parseInt(p[0]||0)*60 + parseInt(p[1]||0);
        var l = document.getElementById('timer2020Label');
        localStorage.setItem('acc_2020_summas', JSON.stringify({
            s: s,
            phase: l && l.textContent.includes('Descansa') ? 'rest' : 'work',
            at: Date.now()
        }));
    }
    /* Al volver: no hacer nada, el setInterval del widget sigue corriendo solo */
});

  setInterval(function() {
    var d = document.getElementById('timer2020Display');
    if (!d || d.textContent === '20:00') return;
    var p = d.textContent.split(':');
    var s = parseInt(p[0]||0)*60 + parseInt(p[1]||0);
    var l = document.getElementById('timer2020Label');
    savTimer({ s:s, phase: l && l.textContent.includes('Descansa') ? 'rest':'work', at:Date.now() });
  }, 1000);

  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'timer2020Stop') clrTimer();
  }, true);

  /* ══ RESTAURAR TIMER AL CARGAR PÁGINA ══ */
function restaurarTimer() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('acc_2020_summas')); } catch(e){}
    if (!saved || !saved.at || !saved.s) return;

    // Calcular cuánto tiempo pasó desde que se guardó
    var elapsed = Math.floor((Date.now() - saved.at) / 1000);
    var remaining = Math.max(0, saved.s - elapsed);

    if (remaining <= 0) {
        clrTimer(); // expiró mientras no estabas
        return;
    }

    // Esperar a que el widget cargue el botón Start
    var intentos = 0;
    var check = setInterval(function() {
        intentos++;
        var startBtn = document.getElementById('timer2020Start');
        var disp     = document.getElementById('timer2020Display');
        if (!startBtn || !disp) {
            if (intentos > 40) clearInterval(check); // máx 4 seg esperando
            return;
        }
        clearInterval(check);

        // Recalcular por si tardó en cargar
        var elapsed2   = Math.floor((Date.now() - saved.at) / 1000);
        var remaining2 = Math.max(0, saved.s - elapsed2);
        if (remaining2 <= 0) { clrTimer(); return; }

        // Arrancar el timer — start2020() lee localStorage y calcula el tiempo restante solo
        startBtn.click();

    }, 100);
}

// Llamar al cargar
if (document.readyState !== 'loading') {
    setTimeout(restaurarTimer, 800);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(restaurarTimer, 800);
    });
}

  /* ══════════════════════════════════════
     CSS — SOLO dentro de @media mobile
     Desktop no tiene ni una regla
  ══════════════════════════════════════ */
  var css = [

    /* Hamburguesa oculta en desktop */
    '#acc-hbar { display: none; }',

    '@media (max-width: 680px) {',

    /* Touch feedback */
    '#accFab, .acc-tile, .ap-btn, .seg {',
    '  touch-action: manipulation;',
    '  -webkit-tap-highlight-color: transparent;',
    '}',

    /* ── FAB ── */
   '#accFab {',
'  width: 80px !important;',
'  height: 80px !important;',
'  bottom: 12px !important;',
'  left: 12px !important;',
'  background: transparent !important;',
'  border-radius: 0 !important;',
'  box-shadow: none !important;',
'  overflow: visible !important;',
'}',
'#accFabLogo {',
'  width: 80px !important;',
'  height: 80px !important;',
'  padding: 0 !important;',
'  background: transparent !important;',
'  border-radius: 0 !important;',
'}',

    /* ── PANEL: bottom-sheet, hereda el ancho y estilos del widget ── */
    '#accPanel {',
    '  top: auto !important;',
    '  bottom: 0 !important;',
    '  left: 0 !important;',
    '  right: 0 !important;',
    '  width: 100% !important;',
    '  max-width: 100% !important;',
    '  height: 90vh !important;',
    '  max-height: 90vh !important;',
    '  border-radius: 16px 16px 0 0 !important;',
    '  transform: translateY(100%) !important;',
    '  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1) !important;',
    '  opacity: 1 !important;',
    '  resize: none !important;',
    '  display: flex !important;',
    '  flex-direction: column !important;',
    '  overflow: hidden !important;',
    '}',
    '#accPanel.open {',
    '  transform: translateY(0) !important;',
    '}',

    /* drag pill */
    '#accPanel .ap-header {',
    '  border-radius: 16px 16px 0 0 !important;',
    '  padding: 8px 12px !important;',
    '  min-height: 48px !important;',
    '  max-height: 48px !important;',
    '  flex-shrink: 0 !important;',
    '  position: relative !important;',
    '}',
    '#accPanel .ap-header::after {',
    '  content: "" !important;',
    '  position: absolute !important;',
    '  top: 5px !important;',
    '  left: 50% !important;',
    '  transform: translateX(-50%) !important;',
    '  width: 30px !important;',
    '  height: 3px !important;',
    '  background: rgba(255,255,255,0.35) !important;',
    '  border-radius: 999px !important;',
    '  pointer-events: none !important;',
    '}',
    '#accPanel .ap-header-left { gap: 10px !important; }',

    /* Logo perrito */
    '#accPanel .ap-logo-wrap {',
    '  height: 34px !important;',
    '  min-width: 34px !important;',
    '  max-width: 44px !important;',
    '  padding: 3px !important;',
    '  border-radius: 7px !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  justify-content: center !important;',
    '  overflow: hidden !important;',
    '  flex-shrink: 0 !important;',
    '}',
    '#accPanel .ap-logo-wrap img {',
    '  max-height: 26px !important;',
    '  max-width: 36px !important;',
    '  width: auto !important;',
    '  height: auto !important;',
    '  object-fit: contain !important;',
    '  display: block !important;',
    '}',

    /* Título header */
    '#accPanel .ap-title h3 { font-size: 13px !important; }',
    '#accPanel .ap-title p  { font-size: 9px !important; }',
    '#accPanel .ap-close {',
    '  width: 28px !important;',
    '  height: 28px !important;',
    '  font-size: 14px !important;',
    '  border-radius: 7px !important;',
    '  flex-shrink: 0 !important;',
    '}',

    /* ══ OCULTAR TABS ORIGINALES ══ */
    '#accPanel .ap-tabs,',
    '#ap-tabs-container {',
    '  display: none !important;',
    '  height: 0 !important;',
    '  min-height: 0 !important;',
    '  overflow: hidden !important;',
    '  padding: 0 !important;',
    '  border: none !important;',
    '  pointer-events: none !important;',
    '}',

    /* ══ HAMBURGUESA ══ */
    '#acc-hbar {',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  gap: 8px !important;',
    '  padding: 0 12px !important;',
    '  background: #EEF2FF !important;',
    '  border-bottom: 1.5px solid #D4DCF5 !important;',
    '  min-height: 38px !important;',
    '  max-height: 38px !important;',
    '  position: relative !important;',
    '  flex-shrink: 0 !important;',
    '  z-index: 10 !important;',
    '}',
    '#acc-hbtn {',
    '  background: linear-gradient(90deg,#1D3579,#48BED7) !important;',
    '  border: none !important;',
    '  border-radius: 8px !important;',
    '  width: 30px !important;',
    '  height: 30px !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  justify-content: center !important;',
    '  cursor: pointer !important;',
    '  flex-shrink: 0 !important;',
    '  box-shadow: 0 2px 6px rgba(29,53,121,.3) !important;',
    '}',
    '#acc-hbtn:active { opacity: .7 !important; transform: scale(.92) !important; }',
    '#acc-hbtn i { color: #fff !important; font-size: 12px !important; }',
    '#acc-hlabel {',
    '  font-family: "Barlow", sans-serif !important;',
    '  font-size: 12px !important;',
    '  font-weight: 700 !important;',
    '  color: #1D3579 !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  gap: 7px !important;',
    '  flex: 1 !important;',
    '  white-space: nowrap !important;',
    '  overflow: hidden !important;',
    '}',
    '#acc-hlabel i {',
    '  font-size: 11px !important;',
    '  flex-shrink: 0 !important;',
    '  background: linear-gradient(90deg,#1D3579,#48BED7) !important;',
    '  -webkit-background-clip: text !important;',
    '  -webkit-text-fill-color: transparent !important;',
    '  background-clip: text !important;',
    '}',
    '#acc-hbadge {',
    '  background: #48BED7 !important;',
    '  color: #fff !important;',
    '  font-size: 9px !important;',
    '  font-weight: 800 !important;',
    '  min-width: 16px !important;',
    '  height: 16px !important;',
    '  border-radius: 999px !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  justify-content: center !important;',
    '  padding: 0 4px !important;',
    '  flex-shrink: 0 !important;',
    '}',
    '#acc-hbadge.acc-badge-hidden { display: none !important; }',

    /* DROPDOWN */
    '#acc-hdd {',
    '  position: absolute !important;',
    '  top: 100% !important;',
    '  left: 0 !important;',
    '  right: 0 !important;',
    '  background: #fff !important;',
    '  border: 1.5px solid #D4DCF5 !important;',
    '  border-top: none !important;',
    '  border-radius: 0 0 16px 16px !important;',
    '  box-shadow: 0 16px 36px rgba(29,53,121,.2) !important;',
    '  z-index: 99999 !important;',
    '  overflow-y: auto !important;',
    '  max-height: 60vh !important;',
    '  display: none !important;',
    '}',
    '#acc-hdd.acc-dd-open { display: block !important; }',
    '.acc-dd-item {',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  gap: 11px !important;',
    '  padding: 12px 16px !important;',
    '  font-family: "Barlow", sans-serif !important;',
    '  font-size: 13px !important;',
    '  font-weight: 600 !important;',
    '  color: #0F1B40 !important;',
    '  cursor: pointer !important;',
    '  border-bottom: 1px solid #F0F4FF !important;',
    '  -webkit-tap-highlight-color: transparent !important;',
    '  user-select: none !important;',
    '}',
    '.acc-dd-item:last-child { border-bottom: none !important; }',
    '.acc-dd-item:active { background: #E8F0FF !important; }',
    '.acc-dd-item.acc-dd-active {',
    '  background: linear-gradient(90deg,#EEF4FF,#F0FAFD) !important;',
    '  color: #1D3579 !important;',
    '  font-weight: 800 !important;',
    '  border-left: 3px solid #48BED7 !important;',
    '}',
    '.acc-dd-ico {',
    '  width: 30px !important;',
    '  height: 30px !important;',
    '  border-radius: 8px !important;',
    '  background: linear-gradient(135deg,#EEF4FF,#E0F5FA) !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  justify-content: center !important;',
    '  flex-shrink: 0 !important;',
    '}',
    '.acc-dd-ico i {',
    '  font-size: 12px !important;',
    '  background: linear-gradient(90deg,#1D3579,#48BED7) !important;',
    '  -webkit-background-clip: text !important;',
    '  -webkit-text-fill-color: transparent !important;',
    '  background-clip: text !important;',
    '}',
    '.acc-dd-active .acc-dd-ico { background: linear-gradient(90deg,#1D3579,#48BED7) !important; }',
    '.acc-dd-active .acc-dd-ico i { background: none !important; -webkit-text-fill-color: #fff !important; }',
    '.acc-dd-check {',
    '  margin-left: auto !important;',
    '  width: 18px !important;',
    '  height: 18px !important;',
    '  border-radius: 999px !important;',
    '  background: linear-gradient(90deg,#1D3579,#48BED7) !important;',
    '  color: #fff !important;',
    '  font-size: 10px !important;',
    '  display: none !important;',
    '  align-items: center !important;',
    '  justify-content: center !important;',
    '  font-weight: 800 !important;',
    '  flex-shrink: 0 !important;',
    '}',
    '.acc-dd-active .acc-dd-check { display: flex !important; }',

    /* ── BODY ── */
    '#accPanel .ap-body {',
    '  flex: 1 !important;',
    '  overflow-y: auto !important;',
    '  -webkit-overflow-scrolling: touch !important;',
    '  padding: 10px 10px 6px !important;',
    '  min-height: 0 !important;',
    '}',
    '#accPanel .ap-body::-webkit-scrollbar { width: 3px !important; }',
    '#accPanel .ap-body::-webkit-scrollbar-thumb { background: #D4DCF5 !important; border-radius: 3px !important; }',

    /* ── FOOTER ── */
    '#accPanel > div:last-child {',
    '  flex-shrink: 0 !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  padding: 6px 10px !important;',
    '  gap: 6px !important;',
    '  flex-wrap: nowrap !important;',
    '  border-top: 1px solid #EEF2FF !important;',
    '  background: #F8FAFF !important;',
    '  min-height: 42px !important;',
    '  max-height: 42px !important;',
    '  overflow: hidden !important;',
    '}',
    '#accPanel > div:last-child #accReset {',
    '  font-size: 10px !important;',
    '  padding: 4px 9px !important;',
    '  flex-shrink: 0 !important;',
    '  white-space: nowrap !important;',
    '}',
    /* Alba más grande y visible */
    '#acc-powered-link {',
    '  font-size: 10px !important;',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  gap: 4px !important;',
    '  flex-shrink: 0 !important;',
    '  white-space: nowrap !important;',
    '  text-decoration: none !important;',
    '}',
    '#acc-powered-link > span { font-size: 9.5px !important; color: #6B7CA8 !important; }',
    '#acc-powered-link strong { font-size: 11.5px !important; color: #1D3579 !important; }',
    '#acc-powered-link img {',
    '  height: 22px !important;',
    '  width: auto !important;',
    '  object-fit: contain !important;',
    '  display: block !important;',
    '}',
    '#acc-powered-link i { display: none !important; }',
    '#accPanel > div:last-child #openSearchBtn2 {',
    '  font-size: 9px !important;',
    '  padding: 4px 7px !important;',
    '  flex-shrink: 0 !important;',
    '  margin-left: auto !important;',
    '  white-space: nowrap !important;',
    '}',

    /* ── GRIDS 2 columnas ── */
    '.ap-grid   { grid-template-columns: repeat(2,1fr) !important; gap: 7px !important; }',
    '.ap-grid-2 { grid-template-columns: repeat(2,1fr) !important; gap: 7px !important; }',
    '.acc-tile.span3 { grid-column: span 2 !important; }',
    '.acc-tile.span2 { grid-column: span 2 !important; }',

    /* ── TILES compactos (como en la captura) ── */
    '.acc-tile {',
    '  min-height: 70px !important;',
    '  padding: 8px 7px !important;',
    '  gap: 3px !important;',
    '  border-radius: 10px !important;',
    '  border-width: 1.5px !important;',
    '}',
    '.acc-tile .ico       { font-size: 17px !important; line-height: 1 !important; }',
    '.acc-tile .tile-label { font-size: 11px !important; line-height: 1.2 !important; font-weight: 700 !important; }',
    '.acc-tile .tile-note  { font-size: 9.5px !important; line-height: 1.15 !important; }',

    /* Segmentados */
    '.segmented { flex-wrap: wrap !important; gap: 4px !important; margin-top: 6px !important; }',
    '.segmented .seg {',
    '  flex: 1 1 auto !important;',
    '  min-height: 28px !important;',
    '  font-size: 10px !important;',
    '  min-width: 40px !important;',
    '  padding: 3px 6px !important;',
    '  border-radius: 999px !important;',
    '}',

    /* Sliders */
    '.acc-tile input[type="range"] { height: 5px !important; margin: 4px 0 !important; }',
    '.slider-val { font-size: 9.5px !important; }',

    /* TTS */
    '.tts-row { flex-wrap: wrap !important; gap: 4px !important; margin-top: 6px !important; }',
    '.tts-row .ap-btn {',
    '  flex: 1 1 auto !important;',
    '  justify-content: center !important;',
    '  min-width: 52px !important;',
    '  padding: 5px 7px !important;',
    '  font-size: 10.5px !important;',
    '}',

    /* Secciones */
    '.ap-section { font-size: 10px !important; margin: 10px 0 6px !important; letter-spacing: .7px !important; }',

    /* Timer */
    '#acc2020Box { padding: 10px 12px !important; border-radius: 10px !important; margin-bottom: 8px !important; }',
    '#acc2020Box .timer-btns { gap: 5px !important; margin-top: 8px !important; }',
    '#acc2020Box .timer-btns button { padding: 5px 11px !important; font-size: 10.5px !important; }',
    '.timer-progress-ring { width: 56px !important; height: 56px !important; margin: 4px auto 0 !important; }',
    '.timer-progress-ring svg { width: 56px !important; height: 56px !important; }',
    '.timer-progress-ring .ring-val { font-size: 15px !important; }',
    '#timer2020Label { font-size: 9.5px !important; }',
    '#timer-desc-text { font-size: 9.5px !important; margin-top: 3px !important; }',

    /* Textos descriptivos */
    '#timer-intro-text, #ai-intro-text, #stats-intro-text, #shortcuts-intro-text {',
    '  font-size: 10px !important; margin-bottom: 7px !important; line-height: 1.4 !important;',
    '}',

    /* Shortcuts */
    '.shortcut-chip { font-size: 10px !important; padding: 3px 8px !important; }',
    '.shortcut-chip kbd { font-size: 8.5px !important; padding: 1px 4px !important; }',
    '.shortcuts-grid { gap: 4px !important; }',

    /* Botones */
    '.ap-btn { font-size: 11px !important; padding: 6px 10px !important; }',

    /* AI */
    '#aiResultBox { font-size: 11px !important; padding: 10px 12px !important; line-height: 1.55 !important; }',

    /* Outline */
    '#accOutlinePanel { width: 100vw !important; right: -100vw !important; }',
    '#accOutlinePanel.open { right: 0 !important; }',

    '}', /* fin @media 680px */

    /* ≤ 390px: un poco más pequeño */
    '@media (max-width: 390px) {',
    '  .acc-tile { min-height: 64px !important; }',
    '  .acc-tile .tile-note { display: none !important; }',
    '  #accPanel .ap-title p { display: none !important; }',
    '}',

    /* Safe area iPhone */
    '@supports (padding-bottom: env(safe-area-inset-bottom)) {',
    '  @media (max-width: 680px) {',
    '    #accFab { bottom: calc(12px + env(safe-area-inset-bottom)) !important; }',
    '    #accPanel > div:last-child { padding-bottom: calc(6px + env(safe-area-inset-bottom)) !important; }',
    '  }',
    '}',

  ].join('\n');

  if (!document.getElementById('acc-mob-v58')) {
    var st = document.createElement('style');
    st.id = 'acc-mob-v58';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ══════════════════════════════════════
     HAMBURGUESA JS
     Solo se activa en mobile. Desktop: cero JS al panel.
  ══════════════════════════════════════ */
  var TAB_INFO = {
    vision:       { ico: 'fas fa-eye',          label: 'Visión'       },
    texto:        { ico: 'fas fa-font',          label: 'Texto'        },
    navegacion:   { ico: 'fas fa-mouse-pointer', label: 'Navegación'   },
    herramientas: { ico: 'fas fa-tools',         label: 'Herramientas' },
    voz:          { ico: 'fas fa-microphone',    label: 'Voz'          },
    ia:           { ico: 'fas fa-robot',         label: 'IA'           },
    atajos:       { ico: 'fas fa-keyboard',      label: 'Atajos'       },
    estadisticas: { ico: 'fas fa-chart-bar',     label: 'Uso'          }
  };

  var hbar, hdd, hlabel, hbadge;

  function isMob() { return window.innerWidth <= 680; }

  /* Activar pane sin tocar el panel en desktop */
  function activatePane(key) {
    document.querySelectorAll('#accPanel .ap-pane').forEach(function(p){
      p.classList.remove('active');
    });
    document.querySelectorAll('#accPanel .ap-tab').forEach(function(t){
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    var pane = document.getElementById('pane-' + key);
    if (pane) pane.classList.add('active');
    var tab = document.querySelector('.ap-tab[data-tab="' + key + '"]');
    if (tab) {
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    }
    var body = document.querySelector('#accPanel .ap-body');
    if (body) body.scrollTop = 0;
  }

  function syncLabel() {
    var active = document.querySelector('#accPanel .ap-tab.active');
    if (!active) return;
    var key  = active.dataset.tab || 'vision';
    var info = TAB_INFO[key] || { ico: 'fas fa-circle', label: key };
    var textEl = active.querySelector('.tab-text');
    var text = textEl ? textEl.textContent.trim() : info.label;
    var lbl = document.getElementById('acc-hlabel');
    if (lbl) lbl.innerHTML = '<i class="' + info.ico + '"></i> ' + text;
    document.querySelectorAll('.acc-dd-item').forEach(function(item) {
      item.classList.toggle('acc-dd-active', item.dataset.tab === key);
    });
  }

  function syncBadge() {
    if (!hbadge) return;
    var n = document.querySelectorAll(
      '.acc-tile[aria-pressed="true"], .seg.active'
    ).length;
    hbadge.textContent = n;
    hbadge.classList.toggle('acc-badge-hidden', n === 0);
  }

  function closeDD() {
    if (hdd) hdd.classList.remove('acc-dd-open');
  }

  function buildMenu(panel) {
    if (document.getElementById('acc-hbar')) { syncLabel(); syncBadge(); return; }

    var tabs = Array.from(document.querySelectorAll('#accPanel .ap-tab'));
    if (!tabs.length) return;

    hbar   = document.createElement('div');   hbar.id = 'acc-hbar';
    hlabel = document.createElement('div');   hlabel.id = 'acc-hlabel';
    hbadge = document.createElement('div');   hbadge.id = 'acc-hbadge';
    hdd    = document.createElement('div');   hdd.id = 'acc-hdd';

    hlabel.innerHTML = '<i class="fas fa-eye"></i> Visión';
    hbadge.className = 'acc-badge-hidden';
    hbadge.textContent = '0';

    var btn = document.createElement('button');
    btn.id = 'acc-hbtn'; btn.type = 'button';
    btn.setAttribute('aria-label', 'Cambiar sección');
    btn.innerHTML = '<i class="fas fa-bars"></i>';

    tabs.forEach(function(tab) {
      var key    = tab.dataset.tab || '';
      var info   = TAB_INFO[key] || { ico: 'fas fa-circle', label: key };
      var textEl = tab.querySelector('.tab-text');
      var text   = textEl ? textEl.textContent.trim() : info.label;
      var item   = document.createElement('div');
      item.className   = 'acc-dd-item';
      item.dataset.tab = key;
      item.innerHTML =
        '<div class="acc-dd-ico"><i class="' + info.ico + '"></i></div>' +
        '<span>' + text + '</span>' +
        '<div class="acc-dd-check">✓</div>';
      item.addEventListener('click', function() {
        activatePane(key); syncLabel(); syncBadge(); closeDD();
      });
      hdd.appendChild(item);
    });

    hbar.appendChild(btn);
    hbar.appendChild(hlabel);
    hbar.appendChild(hbadge);
    hbar.appendChild(hdd);

    /* Insertar antes del ap-body */
    var body = panel.querySelector('.ap-body');
    if (body) panel.insertBefore(hbar, body);
    else      panel.appendChild(hbar);

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      hdd.classList.toggle('acc-dd-open');
    });

    document.addEventListener('click', function(e) {
      if (hbar && !hbar.contains(e.target)) closeDD();
    });

    new MutationObserver(syncBadge).observe(document.body, {
      attributes: true, subtree: true,
      attributeFilter: ['aria-pressed', 'class']
    });

    syncLabel(); syncBadge();
  }

  function destroyMenu() {
    var el = document.getElementById('acc-hbar');
    if (el) el.remove();
    hbar = null; hdd = null; hlabel = null; hbadge = null;
  }

  /* ══════════════════════════════════════
     PANEL MOBILE: estilos inline SOLO en mobile
     Desktop: NUNCA se toca el panel con JS
  ══════════════════════════════════════ */
  function applyMobileStyles(panel) {
    panel.style.position      = 'fixed';
    panel.style.width         = '92vw';
    panel.style.maxWidth      = '92vw';
    panel.style.height        = '85vh';
    panel.style.maxHeight     = '85vh';
    panel.style.borderRadius  = '16px';
    panel.style.resize        = 'none';
    panel.style.overflow      = 'hidden';
    panel.style.opacity       = '1';
    panel.style.display       = 'flex';
    panel.style.flexDirection = 'column';
    // Solo centrar la primera vez (si no tiene posición de drag)
    if (!panel._dragMoved) {
        panel.style.top       = '50%';
        panel.style.left      = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.bottom    = '';
        panel.style.right     = '';
    }
}

  function clearMobileStyles(panel) {
    /* SOLO cuando se pasa de mobile → desktop */
    var props = [
      'position','top','bottom','left','right',
      'width','maxWidth','height','maxHeight',
      'transform','display','flexDirection',
      'overflow','resize','borderRadius','opacity'
    ];
    props.forEach(function(p) { panel.style[p] = ''; });
  }

  /* Observa solo cambios de clase (open/close), nunca de style */
  function watchPanelClass(panel) {
    if (panel._v58) return;
    panel._v58 = true;

    if (isMob()) applyMobileStyles(panel);

    // NO usar MutationObserver en mobile para no pisar el drag
}

  /* Resize: construir/destruir hamburguesa y aplicar/limpiar estilos mobile */
  var _prevMob = isMob();
  var _rt;
  window.addEventListener('resize', function() {
    clearTimeout(_rt);
    _rt = setTimeout(function() {
      var panel = document.getElementById('accPanel');
      var nowMob = isMob();

      if (nowMob && !_prevMob) {
        /* Desktop → Mobile */
        if (panel) applyMobileStyles(panel);
        buildMenu(panel);
      } else if (!nowMob && _prevMob) {
        /* Mobile → Desktop: limpiar estilos inline */
        if (panel) clearMobileStyles(panel);
        destroyMenu();
      }
      _prevMob = nowMob;
    }, 160);
  });

  /* ── Init ── */
  function init() {
    var panel = document.getElementById('accPanel');
    if (panel) {
      watchPanelClass(panel);
      if (isMob()) buildMenu(panel);
      return;
    }
    /* Panel aún no existe */
    var obs = new MutationObserver(function() {
      var p = document.getElementById('accPanel');
      if (p) {
        obs.disconnect();
        watchPanelClass(p);
        if (isMob()) buildMenu(p);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

})();
