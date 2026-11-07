// Interface en surimpression : jour/nuit, garage, vues prédéfinies, rotation automatique, raccourcis clavier.

export function initUI({ env, garage, rig, walker }) {
  const $ = (id) => document.getElementById(id);
  const btnDay = $('btn-day'), btnNight = $('btn-night');
  const btnGarage = $('btn-garage'), garageLabel = $('garage-label');
  const btnRotate = $('btn-rotate');
  const viewBtns = [...document.querySelectorAll('.view-btn')];
  const panel = $('panel'), toggle = $('panel-toggle');
  const status = $('status');

  let statusTimer = 0;
  function toast(msg) {
    status.textContent = msg;
    status.classList.add('is-on');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove('is-on'), 2200);
  }

  /* ----- jour / nuit ----- */
  function setNight(flag, silent = false) {
    env.setNight(flag);
    btnDay.classList.toggle('is-active', !flag);
    btnNight.classList.toggle('is-active', flag);
    btnDay.setAttribute('aria-pressed', String(!flag));
    btnNight.setAttribute('aria-pressed', String(flag));
    if (!silent) toast(flag ? 'Tombée de la nuit…' : 'Lever du jour…');
  }
  btnDay.addEventListener('click', () => setNight(false));
  btnNight.addEventListener('click', () => setNight(true));

  /* ----- garage ----- */
  const LABELS = { closed: 'Ouvrir le garage', opening: 'Ouverture…', open: 'Fermer le garage', closing: 'Fermeture…' };
  function syncGarage(st) {
    garageLabel.textContent = LABELS[st];
    const open = st === 'open' || st === 'opening';
    btnGarage.setAttribute('aria-pressed', String(open));
  }
  garage.onChange = syncGarage;
  syncGarage('closed');
  btnGarage.addEventListener('click', () => garage.toggle());

  /* ----- vues ----- */
  function syncView(name) {
    viewBtns.forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  rig.onViewChange = syncView;
  viewBtns.forEach((b) =>
    b.addEventListener('click', () => {
      if (walker.active) walker.stop(); // une vue orbitale met fin à la visite
      rig.goTo(b.dataset.view);
    })
  );

  /* ----- rotation automatique ----- */
  function setRotate(on) {
    rig.autoRotate = on;
    btnRotate.setAttribute('aria-checked', String(on));
    toast(on ? 'Rotation automatique activée' : 'Rotation automatique désactivée');
  }
  btnRotate.addEventListener('click', () => {
    if (walker.active) walker.stop();
    setRotate(!rig.autoRotate);
  });

  /* ----- panneau repliable ----- */
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? 'Déplier le panneau' : 'Réduire le panneau';
  });

  /* ----- clavier ----- */
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'j') setNight(false);
    else if (k === 'n') setNight(true);
    else if (k === 'g') garage.toggle();
    else if (k === 'v') walker.toggle();
    else if (k === 'r') {
      if (!walker.active) setRotate(!rig.autoRotate);
    } else if (k >= '1' && k <= '4') {
      if (walker.active) walker.stop();
      rig.goTo(['facade', 'piscine', 'garage', 'aerienne'][Number(k) - 1]);
    }
  });

  return { setNight, setRotate, syncView, toast };
}
