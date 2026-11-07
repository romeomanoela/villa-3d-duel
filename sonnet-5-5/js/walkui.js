// Interface de la visite : bouton du panneau, aide à l'écran, étiquette de pièce, joystick tactile, sortie (Échap).

const HELP_KEYS = `
  <div class="help-title">Visite intérieure</div>
  <ul class="help-list only-mouse">
    <li><span class="keys"><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd></span><span class="keys alt"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span class="keys alt"><kbd>↑</kbd><kbd>↓</kbd></span><em>se déplacer</em></li>
    <li><span class="keys"><kbd>←</kbd><kbd>→</kbd></span><em>tourner</em></li>
    <li><span class="keys"><kbd>Clic</kbd>+<kbd>glisser</kbd></span><em>regarder</em></li>
    <li><span class="keys"><kbd>Maj</kbd></span><em>courir</em></li>
    <li><span class="keys"><kbd>C</kbd></span><em>capturer la souris</em></li>
    <li><span class="keys"><kbd>Échap</kbd></span><em>vue extérieure</em></li>
  </ul>
  <ul class="help-list only-touch">
    <li><span class="keys"><kbd>Joystick</kbd></span><em>se déplacer (à fond : courir)</em></li>
    <li><span class="keys"><kbd>Glisser</kbd></span><em>regarder autour de soi</em></li>
    <li><span class="keys"><kbd>Vue extérieure</kbd></span><em>quitter la visite</em></li>
  </ul>
  <p class="help-tip">Montez à l’étage par l’escalier du séjour · portes-fenêtres ouvertes vers la terrasse et la loggia.</p>`;

export function initTourUI({ walker, rig, panel }) {
  const $ = (id) => document.getElementById(id);
  const btn = $('btn-tour'), label = $('tour-label');
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  document.body.classList.toggle('has-touch', touch);

  /* ----- HUD ----- */
  const hud = document.createElement('div');
  hud.id = 'tour-hud';
  hud.innerHTML = `
    <div class="crosshair" aria-hidden="true"></div>
    <div id="room-label" class="room-label" aria-live="polite"></div>
    <button id="tour-exit" class="tour-exit" type="button"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Vue extérieure</span><kbd>Échap</kbd></button>
    <div id="tour-help" class="tour-help" role="note">${HELP_KEYS}</div>
    <button id="tour-help-btn" class="tour-help-btn" type="button" aria-label="Afficher l’aide des commandes" title="Aide (H)">?</button>
    <div id="joystick" class="joystick" aria-label="Joystick de déplacement"><i class="joy-knob"></i></div>`;
  document.body.appendChild(hud);

  const roomEl = $('room-label'), helpEl = $('tour-help'), helpBtn = $('tour-help-btn');
  const exitBtn = $('tour-exit'), joyEl = $('joystick'), knob = joyEl.querySelector('.joy-knob');

  /* ----- aide ----- */
  let helpTimer = 0;
  function showHelp(on, autoHide = 0) {
    helpEl.classList.toggle('is-on', on);
    helpBtn.setAttribute('aria-pressed', String(on));
    clearTimeout(helpTimer);
    if (on && autoHide) helpTimer = setTimeout(() => showHelp(false), autoHide);
  }
  helpBtn.addEventListener('click', () => showHelp(!helpEl.classList.contains('is-on')));

  /* ----- étiquette de pièce ----- */
  let roomTimer = 0;
  walker.onZone = (name) => {
    clearTimeout(roomTimer);
    if (!name) {
      roomEl.classList.remove('is-on');
      return;
    }
    roomEl.textContent = name;
    roomEl.classList.add('is-on');
    roomTimer = setTimeout(() => roomEl.classList.remove('is-on'), 3200);
  };

  /* ----- état de la visite ----- */
  let panelWasCollapsed = false;
  walker.onState = (st) => {
    const on = st !== 'off';
    document.body.classList.toggle('is-tour', on);
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Vue extérieure' : 'Visiter l’intérieur';
    if (on && st === 'entering') {
      // sur mobile le panneau est replié pour laisser la place au joystick
      panelWasCollapsed = panel.classList.contains('is-collapsed');
      if (window.matchMedia('(max-width: 640px)').matches) {
        panel.classList.add('is-collapsed');
        $('panel-toggle').setAttribute('aria-expanded', 'false');
      }
      showHelp(true, 14000);
    }
    if (!on) {
      showHelp(false);
      roomEl.classList.remove('is-on');
      if (window.matchMedia('(max-width: 640px)').matches && !panelWasCollapsed) {
        panel.classList.remove('is-collapsed');
        $('panel-toggle').setAttribute('aria-expanded', 'true');
      }
    }
  };
  walker.onLockChange = (locked) => document.body.classList.toggle('is-captured', locked);

  btn.addEventListener('click', () => walker.toggle());
  exitBtn.addEventListener('click', () => walker.stop());

  window.addEventListener('keydown', (e) => {
    if (!walker.active || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') walker.stop();
    else if (e.code === 'KeyC') walker.toggleCapture();
    else if (e.code === 'KeyH') showHelp(!helpEl.classList.contains('is-on'));
  });

  /* ----- joystick virtuel ----- */
  let joyId = null;
  const R = 46; // rayon de débattement (px)
  function setJoy(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    walker.joy.x = dx / R;
    walker.joy.y = dy / R;
  }
  function releaseJoy() {
    joyId = null;
    knob.style.transform = '';
    walker.joy.x = walker.joy.y = 0;
  }
  joyEl.addEventListener('pointerdown', (e) => {
    if (joyId !== null) return;
    joyId = e.pointerId;
    try {
      joyEl.setPointerCapture(e.pointerId);
    } catch (err) {
      /* pointeur synthétique : pas de capture, le joystick fonctionne quand même */
    }
    setJoy(e);
    e.preventDefault();
  });
  joyEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) setJoy(e);
  });
  joyEl.addEventListener('pointerup', (e) => e.pointerId === joyId && releaseJoy());
  joyEl.addEventListener('pointercancel', (e) => e.pointerId === joyId && releaseJoy());

  return { showHelp };
}
