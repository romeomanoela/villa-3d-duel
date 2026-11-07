// Panneau de commandes : boutons, raccourcis clavier, interface de visite, retour d'état.
export function initUI(h) {
  const $ = (id) => document.getElementById(id);
  const btnDay = $('btn-day');
  const btnNight = $('btn-night');
  const btnGarage = $('btn-garage');
  const garageLabel = $('garage-label');
  const btnRotate = $('btn-rotate');
  const btnTour = $('btn-tour');
  const tourLabel = $('tour-label');
  const hud = $('tour-hud');
  const roomEl = $('tour-room');
  const joystick = $('joystick');
  const panel = $('panel');
  const btnCollapse = $('btn-collapse');
  const fpsEl = $('fps');
  const viewBtns = [...document.querySelectorAll('[data-view]')];
  const touch = matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch', touch);

  btnDay.addEventListener('click', () => h.setNight(false));
  btnNight.addEventListener('click', () => h.setNight(true));
  btnGarage.addEventListener('click', () => h.toggleGarage());
  btnRotate.addEventListener('click', () => h.toggleRotate());
  btnTour.addEventListener('click', () => h.toggleTour());
  $('btn-exit-tour').addEventListener('click', () => h.toggleTour());
  document.querySelectorAll('[data-tp]').forEach((b) => b.addEventListener('click', () => h.teleport(b.dataset.tp)));
  viewBtns.forEach((b) => b.addEventListener('click', () => h.goTo(b.dataset.view)));

  const setCollapsed = (c) => {
    panel.classList.toggle('collapsed', c);
    btnCollapse.setAttribute('aria-expanded', String(!c));
    btnCollapse.title = c ? 'Déplier le panneau' : 'Replier le panneau';
  };
  btnCollapse.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
  if (window.innerWidth <= 640 && window.innerHeight < 560) setCollapsed(true);

  const VIEW_KEYS = { 1: 'facade', 2: 'pool', 3: 'garage', 4: 'aerial' };
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'n') h.toggleNight();
    else if (k === 'g') h.toggleGarage();
    else if (k === 'r') h.toggleRotate();
    else if (k === 'v') h.toggleTour();
    else if (VIEW_KEYS[k]) h.goTo(VIEW_KEYS[k]);
  });

  // Les boutons ne gardent pas le focus : les touches de déplacement restent disponibles.
  document.querySelectorAll('button').forEach((b) => b.addEventListener('mouseup', () => b.blur()));

  return {
    showNight(isNight) {
      btnDay.classList.toggle('on', !isNight);
      btnNight.classList.toggle('on', isNight);
      btnDay.setAttribute('aria-pressed', String(!isNight));
      btnNight.setAttribute('aria-pressed', String(isNight));
    },
    showGarage(open) {
      garageLabel.textContent = open ? 'Fermer le garage' : 'Ouvrir le garage';
      btnGarage.setAttribute('aria-pressed', String(open));
      btnGarage.classList.toggle('on', open);
    },
    showView(name) {
      viewBtns.forEach((b) => b.classList.toggle('on', b.dataset.view === name));
    },
    showRotate(on) {
      btnRotate.setAttribute('aria-pressed', String(on));
    },
    showTour(on) {
      tourLabel.textContent = on ? 'Vue extérieure' : "Visiter l'intérieur";
      btnTour.setAttribute('aria-pressed', String(on));
      btnTour.classList.toggle('on', on);
      hud.hidden = !on;
      joystick.hidden = !(on && touch);
      document.body.classList.toggle('touring', on);
      if (on && window.innerWidth <= 640) setCollapsed(true);
      if (on) viewBtns.forEach((b) => b.classList.remove('on'));
    },
    showRoom(name) {
      roomEl.textContent = name || 'Visite intérieure';
    },
    showFps(v, dpr) {
      fpsEl.textContent = `${v} fps · ×${dpr.toFixed(2)}`;
    },
  };
}
