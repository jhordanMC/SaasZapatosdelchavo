/**
 * CSS de Cirobot inyectado una sola vez vía <style> (ver cirobot-wrapper.ts)
 * — no un import de .css desde un .tsx, para no depender de que el build
 * de Angular soporte imports de CSS en archivos fuera del compilador de
 * componentes. Mismo criterio "portable y sin sorpresas" que liveline.
 *
 * Tema CLARO — sigue la identidad real de VILCAS (blanco/verde), Cirobot
 * se siente como una extensión natural del producto, no una app aparte.
 */
export const CIROBOT_CSS = `
:root {
  --cbot-bg: #FFFFFF;
  --cbot-bg-2: #F7FAF8;
  --cbot-borde: #D9F1E2;
  --cbot-verde: #138A52;
  --cbot-verde-oscuro: #0F6B40;
  --cbot-hover: #EAF8EF;
  --cbot-texto: #1F2937;
  --cbot-texto-sec: #6B7280;
  --cbot-error: #EF4444;
  --cbot-advertencia: #F59E0B;
  --cbot-info: #2563EB;
  --cbot-exito: #16A34A;
}

.cbot-raiz {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}

/* Cirobot vive por encima de todo (z-index:9999) para poder flotar sobre
   la app, pero eso mismo tapaba los botones de los modals (Guardar/
   Cancelar, Enviar del propio chat en mobile), que usan z-index 1000-3000.
   Mientras exista algún .modal-overlay abierto en la página, se oculta
   TODO Cirobot —mascota y chat, si el usuario lo tenía abierto— para no
   competir por el touch del usuario con el modal. Se restaura solo al
   cerrar el modal (al desaparecer el .modal-overlay del DOM).

   A PROPÓSITO resuelto con :has() y nada de JS/MutationObserver: una
   primera versión usaba un MutationObserver sobre <body> para togglear
   una clase, pero el proyecto corre con Zone.js clásico (angular.json),
   que parchea MutationObserver — cada mutación del DOM disparaba un
   ciclo completo de change detection de Angular. Al hacer F5, Angular
   arma TODO el layout de una sola vez (cientos de nodos entrando casi
   juntos) y eso se retroalimentaba en cascada justo en el momento más
   pesado del primer render, congelando la página entera. :has() hace
   exactamente lo mismo (reacciona a que aparezca/desaparezca
   .modal-overlay en el documento) pero lo resuelve el motor CSS del
   navegador — sin JS, sin Zone.js, sin observers, sin ese riesgo.

   Solo aplica en mobile (mismo breakpoint que el resto del archivo): en
   desktop el hotspot vive en una esquina fija chica (bottom:40px/right:50px)
   que en la práctica no se cruza con los footers de los modals, así que
   ahí no hace falta ocultar nada. */
@media (max-width: 768px) {
  body:has(.modal-overlay) .cbot-raiz {
    display: none;
  }
}

/* Medidas EXACTAS de C:\Users\JHORDAN\Downloads\headBot.js (#headbot-canvas /
   #headbot-clickarea) — calibradas a mano contra este mismo modelo
   (cabezareconstruida.glb = cirobot.glb), incluidos los breakpoints por
   zoom del navegador, no solo por ancho de pantalla. */
.cbot-mascota-wrap {
  position: fixed;
  bottom: -100px;
  right: -60px;
  width: 300px;
  height: 300px;
  pointer-events: none;
}

/* El "acercar" (scale+translate) del modelo cuando el chat está abierto
   vive en este div INTERNO (no en .cbot-mascota-wrap) a propósito: un
   transform en .cbot-mascota-wrap —que es position:fixed— lo convertiría
   en el containing block de sus hijos position:fixed, incluido
   .cbot-mascota-click, que dejaría de anclarse al viewport para anclarse
   a esta caja y saltaría de lugar en cuanto se abre el chat (así se
   descubrió el bug: el hotspot terminaba tapando el botón Enviar del
   panel, en desktop y mobile por igual). Con el transform acá adentro,
   .cbot-mascota-wrap nunca se transforma, así que .cbot-mascota-click
   se queda siempre en el mismo sitio fijo respecto al viewport. */
.cbot-mascota-visual {
  width: 100%;
  height: 100%;
  transition: transform 0.5s cubic-bezier(0.22,0.8,0.35,1);
}
.cbot-mascota-visual.cbot-mascota-acercada {
  transform: scale(1.06) translate(-6px, -6px);
}
/* .cbot-mascota-click se queda en "position: fixed" (anclado siempre al
   viewport). A propósito NO vive dentro del div que recibe el transform
   (ver .cbot-mascota-visual más abajo) — si estuviera ahí adentro, el
   transform del padre lo convertiría en su containing block y el hotspot
   dejaría de anclarse al viewport para anclarse a esa caja transformada,
   saltando de posición justo cuando el chat se abre (bug real que hubo:
   el hotspot terminaba encima del botón Enviar del panel). Mismo motivo
   por el que .cbot-mascota-visual (no .cbot-mascota-wrap) es quien lleva
   la clase .cbot-mascota-acercada. */
.cbot-mascota-click {
  position: fixed;
  bottom: 40px;
  right: 50px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
}

@media (max-width: 768px) {
  .cbot-mascota-wrap { bottom: -115px; right: -60px; }
  .cbot-mascota-click { bottom: 30px; right: 50px; }
}
@media (max-width: 480px) {
  .cbot-mascota-wrap { bottom: -105px; right: -55px; width: 235px; height: 235px; }
  .cbot-mascota-click { bottom: 30px; right: 38px; width: 56px; height: 56px; }
}
@media (max-width: 436px) { .cbot-mascota-click { bottom: 10px; right: 28px; } }
@media (max-width: 400px) { .cbot-mascota-wrap { bottom: -100px; right: -50px; width: 225px; height: 225px; } }
@media (max-width: 384px) { .cbot-mascota-click { bottom: 15px; right: 28px; } }
@media (max-width: 360px) { .cbot-mascota-wrap { bottom: -95px; right: -45px; width: 215px; height: 215px; } }
@media (max-width: 320px) { .cbot-mascota-click { bottom: 10px; right: 24px; } }
@media (max-width: 274px) { .cbot-mascota-click { bottom: 5px; right: 20px; } }

/* ── Ventana: tarjeta premium, ligera, nunca "un rectángulo de chat" ── */
.cbot-panel {
  display: flex;
  flex-direction: column;
  background: var(--cbot-bg);
  border: 1px solid var(--cbot-borde);
  box-shadow: 0 20px 50px rgba(15,107,64,0.12), 0 2px 8px rgba(15,107,64,0.06);
  overflow: hidden;
  pointer-events: auto;
  font-family: 'Inter', -apple-system, 'Segoe UI', Tahoma, sans-serif;
  color: var(--cbot-texto);
}

.cbot-panel-flotante {
  position: fixed;
  bottom: 118px;
  right: 24px;
  width: 420px;
  max-width: calc(100vw - 32px);
  height: 580px;
  max-height: calc(100vh - 140px);
  border-radius: 24px;
  animation: cbot-in 0.22s cubic-bezier(0.22,0.8,0.35,1) both;
}

.cbot-panel-fullscreen {
  position: fixed;
  inset: 20px;
  width: auto;
  height: auto;
  border-radius: 24px;
  animation: cbot-in-scale 0.22s cubic-bezier(0.22,0.8,0.35,1) both;
}

/* Si el Panel Inteligente (KPIs/tabla) está abierto en modo flotante, la
   ventana de 420px no alcanza: la columna de KPIs (320px fija) dejaba solo
   ~90px para el chat, partiendo el texto palabra por palabra. Se ensancha
   la ventana SOLO cuando hay panel, igual criterio que ya existe para
   fullscreen. En mobile no aplica: el breakpoint de abajo ya apila panel
   debajo del chat (flex-direction: column). */
@media (min-width: 769px) {
  .cbot-panel-flotante.cbot-con-panel-lateral {
    width: 740px;
    max-width: calc(100vw - 32px);
  }
}

@keyframes cbot-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cbot-in-scale {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

/* ── Barra minimizada ── */
.cbot-mini-barra {
  position: fixed;
  bottom: 118px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 16px 9px 9px;
  background: var(--cbot-bg);
  border: 1px solid var(--cbot-borde);
  border-radius: 999px;
  box-shadow: 0 12px 30px rgba(15,107,64,0.14);
  cursor: pointer;
  pointer-events: auto;
  font-family: 'Inter', -apple-system, 'Segoe UI', Tahoma, sans-serif;
  animation: cbot-in 0.2s cubic-bezier(0.22,0.8,0.35,1) both;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.cbot-mini-barra:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(15,107,64,0.18); }
.cbot-avatar-mini { width: 28px; height: 28px; font-size: 14px; }
.cbot-mini-texto { font-size: 13px; font-weight: 700; color: var(--cbot-texto); }

/* ── Header: blanco, separado con línea verde muy fina ── */
.cbot-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 68px;
  flex-shrink: 0;
  padding: 0 18px;
  background: var(--cbot-bg);
  border-bottom: 1.5px solid var(--cbot-verde);
  box-shadow: 0 1px 0 var(--cbot-borde);
}
.cbot-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--cbot-verde), var(--cbot-verde-oscuro));
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cbot-header-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cbot-header-titulo { font-size: 14.5px; font-weight: 700; color: var(--cbot-texto); }
.cbot-header-sub { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--cbot-texto-sec); }
.cbot-estado-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--cbot-exito);
  flex-shrink: 0;
}
.cbot-estado-dot-activo { animation: cbot-pulso 1.2s ease-in-out infinite; }
@keyframes cbot-pulso {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

.cbot-header-acciones { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.cbot-icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none;
  background: transparent;
  color: var(--cbot-texto-sec);
  cursor: pointer;
  font-size: 14px;
  border-radius: 9px;
  transition: background 0.16s ease, color 0.16s ease;
}
.cbot-icon-btn:hover { background: var(--cbot-hover); color: var(--cbot-verde-oscuro); }
.cbot-icon-btn.activo { background: var(--cbot-hover); color: var(--cbot-verde); }
.cbot-icon-btn:focus-visible,
.cbot-chip:focus-visible,
.cbot-enviar:focus-visible,
.cbot-input:focus-visible,
.cbot-pi-cerrar:focus-visible {
  outline: 2px solid var(--cbot-verde);
  outline-offset: 2px;
}

/* ── Cuerpo: columna de chat + Panel Inteligente ── */
.cbot-cuerpo { flex: 1; min-height: 0; display: flex; flex-direction: row; }
.cbot-columna-chat { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--cbot-bg); }
.cbot-columna-panel {
  width: 320px;
  min-height: 0;
  flex-shrink: 0;
  border-left: 1px solid var(--cbot-borde);
  background: var(--cbot-bg-2);
  overflow-y: auto;
  scrollbar-width: thin;
  animation: cbot-panel-in 0.22s cubic-bezier(0.22,0.8,0.35,1) both;
}
.cbot-columna-panel::-webkit-scrollbar { width: 6px; }
.cbot-columna-panel::-webkit-scrollbar-thumb { background: var(--cbot-borde); border-radius: 6px; }
@keyframes cbot-panel-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
/* Ancho fijo del panel en fullscreen SOLO cuando hay espacio real — si no,
   esta regla (2 clases = más específica) le gana a la de mobile de abajo
   y el panel se desborda con KPIs/tablas angostando todo lo demás. */
@media (min-width: 769px) {
  .cbot-panel-fullscreen .cbot-columna-panel { width: 420px; }
}

/* ── Bienvenida ── */
.cbot-bienvenida { padding: 34px 22px 6px; text-align: center; }
.cbot-bienvenida-titulo { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--cbot-texto); }
.cbot-bienvenida-sub { margin: 0; font-size: 12.5px; color: var(--cbot-texto-sec); line-height: 1.5; }

/* ── Mensajes tipo ChatGPT: usuario = burbuja verde; IA = card gris muy
   claro, texto oscuro — nunca negro, nunca cajas oscuras ── */
.cbot-mensajes {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cbot-msg { font-size: 13.5px; line-height: 1.6; animation: cbot-msg-in 0.2s cubic-bezier(0.22,0.8,0.35,1) both; }
@keyframes cbot-msg-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
.cbot-msg-usuario {
  align-self: flex-end;
  max-width: 78%;
  padding: 11px 16px;
  border-radius: 16px 16px 4px 16px;
  background: var(--cbot-verde);
  color: #ffffff;
  font-weight: 500;
}
.cbot-msg-bot {
  align-self: stretch;
  max-width: 100%;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--cbot-bg-2);
  color: var(--cbot-texto);
}
.cbot-msg-bot p { margin: 0 0 8px; }
.cbot-msg-bot p:last-child { margin-bottom: 0; }
.cbot-md-espacio { height: 4px; }
.cbot-md-lista { margin: 0 0 8px; padding-left: 20px; }
.cbot-md-lista:last-child { margin-bottom: 0; }
.cbot-md-lista li { margin-bottom: 3px; }
.cbot-code-inline {
  background: var(--cbot-hover);
  color: var(--cbot-verde-oscuro);
  border-radius: 5px;
  padding: 1px 6px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
}
.cbot-code-block {
  background: #1F2937;
  border-radius: 12px;
  padding: 12px 14px;
  overflow-x: auto;
  margin: 0 0 8px;
}
.cbot-code-block code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; color: #A7F3D0; }

/* ── Feed de tools: nunca JSON, solo "✓ etiqueta" ── */
.cbot-tool-feed {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--cbot-borde);
}
.cbot-tool-feed-item {
  display: flex; align-items: center; gap: 7px;
  font-size: 11.5px;
  color: var(--cbot-texto-sec);
  animation: cbot-msg-in 0.2s cubic-bezier(0.22,0.8,0.35,1) both;
}
.cbot-tool-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px;
  border-radius: 50%;
  background: var(--cbot-hover);
  color: var(--cbot-verde);
  font-size: 9px;
  flex-shrink: 0;
}

/* ── "Cirobot está pensando…" ── */
.cbot-pensando { display: flex; flex-direction: column; gap: 8px; background: var(--cbot-bg-2); }
.cbot-pensando-texto { font-size: 12.5px; color: var(--cbot-texto-sec); }
.cbot-pensando-barra {
  display: block; width: 100%; height: 3px; border-radius: 3px;
  background: var(--cbot-borde);
  overflow: hidden;
}
.cbot-pensando-barra span {
  display: block; height: 100%; width: 40%; border-radius: 3px;
  background: linear-gradient(90deg, transparent, var(--cbot-verde), var(--cbot-verde-oscuro), transparent);
  animation: cbot-barra 1.3s ease-in-out infinite;
}
@keyframes cbot-barra {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* ── Chips: pastillas chicas, no botones enormes ── */
.cbot-chips { display: flex; flex-wrap: wrap; gap: 7px; padding: 4px 20px 16px; flex-shrink: 0; }
.cbot-chip {
  border: 1px solid var(--cbot-borde);
  background: var(--cbot-bg);
  color: var(--cbot-verde-oscuro);
  font-size: 11.5px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.cbot-chip:hover { background: var(--cbot-hover); border-color: var(--cbot-verde); transform: scale(1.02); }

/* ── Input ── */
.cbot-input-area {
  display: flex; align-items: center; gap: 6px;
  padding: 14px 16px;
  border-top: 1px solid var(--cbot-borde);
  flex-shrink: 0;
  background: var(--cbot-bg);
}
.cbot-input {
  flex: 1; min-width: 0;
  background: var(--cbot-bg-2);
  border: 1px solid var(--cbot-borde);
  border-radius: 14px;
  padding: 12px 14px;
  color: var(--cbot-texto);
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cbot-input:focus { border-color: var(--cbot-verde); box-shadow: 0 0 0 3px rgba(19,138,82,0.12); }
.cbot-input::placeholder { color: var(--cbot-texto-sec); }
.cbot-input-icon {
  flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
  border: none; background: transparent;
  color: var(--cbot-texto-sec);
  cursor: not-allowed;
  opacity: 0.45;
  font-size: 14px;
  display: inline-flex; align-items: center; justify-content: center;
}
.cbot-enviar {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px;
  border: none;
  background: var(--cbot-verde);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, transform 0.12s ease;
}
.cbot-enviar:hover:not(:disabled) { background: var(--cbot-verde-oscuro); transform: scale(1.02); }
.cbot-enviar:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Panel Inteligente: blanco, borde verde, header verde ── */
.cbot-panel-inteligente { display: flex; flex-direction: column; height: 100%; }
.cbot-pi-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 16px;
  background: linear-gradient(135deg, var(--cbot-verde), var(--cbot-verde-oscuro));
  color: #fff;
  flex-shrink: 0;
}
.cbot-pi-header-icono { font-size: 18px; flex-shrink: 0; }
.cbot-pi-header-textos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cbot-pi-header-titulo { font-size: 13.5px; font-weight: 800; }
.cbot-pi-header-sub { font-size: 10.5px; opacity: 0.85; }
.cbot-pi-cerrar {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px;
  border: none; background: rgba(255,255,255,0.18);
  color: #fff; cursor: pointer; font-size: 11px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s ease;
}
.cbot-pi-cerrar:hover { background: rgba(255,255,255,0.32); }
.cbot-pi-cuerpo { padding: 16px; overflow-y: auto; flex: 1; }

.cbot-panel-vacio { font-size: 12.5px; color: var(--cbot-texto-sec); }

/* ── DataGrid moderno (no tabla clásica): buscar, ordenar, sticky header ── */
.cbot-datagrid { display: flex; flex-direction: column; gap: 10px; }
.cbot-datagrid-buscar {
  padding: 9px 12px;
  font-size: 12.5px;
  font-family: inherit;
  border: 1px solid var(--cbot-borde);
  border-radius: 10px;
  background: var(--cbot-bg);
  color: var(--cbot-texto);
  outline: none;
}
.cbot-datagrid-buscar:focus { border-color: var(--cbot-verde); }
.cbot-datagrid-scroll { overflow: auto; border-radius: 12px; border: 1px solid var(--cbot-borde); background: var(--cbot-bg); max-height: 360px; }
.cbot-datagrid-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
.cbot-datagrid-tabla thead { position: sticky; top: 0; z-index: 1; }
.cbot-datagrid-tabla th {
  text-align: left;
  text-transform: capitalize;
  color: var(--cbot-texto-sec);
  font-weight: 700;
  padding: 10px 14px;
  background: var(--cbot-bg-2);
  border-bottom: 1px solid var(--cbot-borde);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.cbot-datagrid-flecha { color: var(--cbot-verde); }
.cbot-datagrid-tabla td {
  padding: 12px 14px;
  color: var(--cbot-texto);
  border-bottom: 1px solid var(--cbot-borde);
  white-space: nowrap;
}
.cbot-datagrid-tabla tr:last-child td { border-bottom: none; }
.cbot-datagrid-tabla tbody tr { transition: background 0.12s ease; }
.cbot-datagrid-tabla tbody tr:hover { background: var(--cbot-hover); }

/* ── KPI Cards estilo Stripe/Notion ── */
.cbot-kpi-grid { display: flex; flex-direction: column; gap: 12px; }
.cbot-kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: var(--cbot-bg);
  border: 1px solid var(--cbot-borde);
  border-radius: 18px;
  box-shadow: 0 2px 6px rgba(15,107,64,0.04);
  transition: transform 0.18s cubic-bezier(0.22,0.8,0.35,1), box-shadow 0.18s ease, border-color 0.18s ease;
}
.cbot-kpi-card:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 24px rgba(15,107,64,0.12);
  border-color: var(--cbot-verde);
}
.cbot-kpi-icono { color: var(--cbot-verde); margin-bottom: 2px; display: inline-flex; }
.cbot-kpi-label { font-size: 11.5px; color: var(--cbot-texto-sec); text-transform: capitalize; font-weight: 600; }
.cbot-kpi-valor { font-size: 21px; font-weight: 800; color: var(--cbot-texto); }
.cbot-kpi-delta { font-size: 11px; font-weight: 700; margin-top: 2px; }
.cbot-kpi-delta-pos { color: var(--cbot-exito); }
.cbot-kpi-delta-neg { color: var(--cbot-error); }

/* ── Responsive: tablet = panel debajo del chat, mobile = fullscreen total ── */
@media (max-width: 1024px) and (min-width: 769px) {
  .cbot-panel-flotante { width: min(480px, calc(100vw - 32px)); }
  .cbot-cuerpo { flex-direction: column; }
  .cbot-columna-panel { width: 100%; max-height: 46%; border-left: none; border-top: 1px solid var(--cbot-borde); }
}
@media (max-width: 768px) {
  .cbot-panel-flotante {
    inset: 12px;
    bottom: 12px; right: 12px; top: 12px; left: 12px;
    width: auto; height: auto;
  }
  .cbot-panel-fullscreen { inset: 0; border-radius: 0; }
  .cbot-cuerpo { flex-direction: column; }
  .cbot-columna-panel { width: 100%; max-height: 50%; border-left: none; border-top: 1px solid var(--cbot-borde); }
  .cbot-mascota-click { right: 16px; bottom: 8px; }
  .cbot-mini-barra { right: 12px; bottom: 90px; }
}

@media (prefers-reduced-motion: reduce) {
  .cbot-panel, .cbot-msg, .cbot-chip, .cbot-columna-panel, .cbot-tool-feed-item, .cbot-kpi-card, .cbot-mini-barra {
    animation: none !important;
    transition: none !important;
  }
  .cbot-estado-dot-activo, .cbot-pensando-barra span { animation: none !important; }
}
`;