// Commandes tactiles de la visite : joystick virtuel (déplacement) + bouton course. Le regard = glisser sur la scène.
export function createTouchControls(walker) {
  const root = document.getElementById('touch-ui');
  const stick = document.getElementById('joystick');
  const knob = stick.querySelector('.knob');
  const runBtn = document.getElementById('btn-run');
  const RANGE = 38; // course max du bouton (px)
  let pointerId = null;
  let cx = 0, cy = 0;

  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };

  stick.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    try { stick.setPointerCapture(e.pointerId); } catch (err) { /* pointeur synthétique */ }
    move(e);
    e.preventDefault();
  });
  const move = (e) => {
    if (e.pointerId !== pointerId) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > RANGE) { dx = (dx / d) * RANGE; dy = (dy / d) * RANGE; }
    setKnob(dx, dy);
    walker.setTouchMove(dx / RANGE, dy / RANGE);
  };
  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    setKnob(0, 0);
    walker.setTouchMove(0, 0);
  };
  stick.addEventListener('pointermove', move);
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  let running = false;
  runBtn.addEventListener('click', () => {
    running = !running;
    walker.setRun(running);
    runBtn.classList.toggle('active', running);
    runBtn.setAttribute('aria-pressed', String(running));
  });

  return {
    reset() { running = false; walker.setRun(false); runBtn.classList.remove('active'); setKnob(0, 0); walker.setTouchMove(0, 0); },
    root,
  };
}
