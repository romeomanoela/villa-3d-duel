// Visite intérieure à la première personne : regard (pointer lock ou glisser), déplacement ZQSD/WASD/flèches,
// course (Maj), collisions AABB, suivi de la hauteur du sol (escalier), transitions d'entrée/sortie.
import * as THREE from 'three';
import { easeInOut } from './utils.js';

const EYE = 1.65;
const RADIUS = 0.28;
const WALK_SPEED = 2.3, RUN_SPEED = 4.6;

export function createWalker({ camera, canvas, colliders, floorHeight, entry, onExit }) {
  const st = {
    active: false, entering: false,
    x: entry.pos[0], z: entry.pos[2], feet: entry.pos[1] - EYE,
    yaw: 0, pitch: 0, bob: 0,
    keys: new Set(), run: false,
    touchMove: { x: 0, y: 0 }, touchLook: { dx: 0, dy: 0 },
    locked: false, dragging: false, lastX: 0, lastY: 0,
  };
  const tw = { t: 0, dur: 1.6, p0: new THREE.Vector3(), p1: new THREE.Vector3(), l0: new THREE.Vector3(), l1: new THREE.Vector3() };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const dir = new THREE.Vector3();

  // ---------- Entrée / sortie ----------
  function enter(lookAtFrom) {
    if (st.active || st.entering) return;
    st.entering = true;
    tw.t = 0;
    tw.p0.copy(camera.position);
    tw.l0.copy(lookAtFrom);
    st.x = entry.pos[0]; st.z = entry.pos[2];
    st.feet = floorHeight(st.x, st.z, 0);
    tw.p1.set(st.x, st.feet + EYE, st.z);
    tw.l1.set(...entry.look);
    document.body.classList.add('walking');
  }

  function finishEnter() {
    st.entering = false;
    st.active = true;
    camera.getWorldDirection(dir);
    st.yaw = Math.atan2(-dir.x, -dir.z);
    st.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    requestLock();
  }

  function exit() {
    if (!st.active && !st.entering) return;
    st.active = false; st.entering = false;
    st.keys.clear();
    document.body.classList.remove('walking');
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    camera.getWorldDirection(dir);
    onExit(camera.position.clone().addScaledVector(dir, 6));
  }

  // ---------- Pointer lock (desktop) avec repli « glisser pour regarder » ----------
  function requestLock() {
    if (!canvas.requestPointerLock || window.matchMedia('(pointer: coarse)').matches) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* non disponible : glisser pour regarder */ }
  }
  document.addEventListener('pointerlockchange', () => {
    const was = st.locked;
    st.locked = document.pointerLockElement === canvas;
    if (was && !st.locked && st.active) exit(); // Échap pendant le verrouillage = sortie de la visite
  });
  document.addEventListener('pointerlockerror', () => { st.locked = false; });

  canvas.addEventListener('mousemove', (e) => {
    if (!st.active || !st.locked) return;
    look(e.movementX, e.movementY, 0.0022);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!st.active || st.locked) return;
    if (e.pointerType === 'mouse') { requestLock(); if (st.locked) return; }
    st.dragging = true; st.lastX = e.clientX; st.lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointeur synthétique */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!st.active || !st.dragging) return;
    look(e.clientX - st.lastX, e.clientY - st.lastY, 0.0045);
    st.lastX = e.clientX; st.lastY = e.clientY;
  });
  const endDrag = () => { st.dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function look(dx, dy, sens) {
    st.yaw -= dx * sens;
    st.pitch = THREE.MathUtils.clamp(st.pitch - dy * sens, -1.35, 1.35);
  }

  // ---------- Clavier (codes physiques : ZQSD sur AZERTY = KeyW/KeyA/KeyS/KeyD) ----------
  const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', (e) => {
    if (!st.active) return;
    if (e.code === 'Escape') { exit(); return; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') st.run = true;
    if (MOVE_CODES.has(e.code)) { st.keys.add(e.code); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') st.run = false;
    st.keys.delete(e.code);
  });
  window.addEventListener('blur', () => { st.keys.clear(); st.run = false; });

  // ---------- Collisions ----------
  function collides(px, pz, feet) {
    const y0 = feet + 0.2, y1 = feet + 1.7;
    for (const c of colliders) {
      if (px + RADIUS > c.x0 && px - RADIUS < c.x1 && pz + RADIUS > c.z0 && pz - RADIUS < c.z1 && y1 > c.y0 && y0 < c.y1) return true;
    }
    return false;
  }

  function tryMove(dx, dz) {
    const nx = st.x + dx;
    if (!collides(nx, st.z, st.feet)) st.x = nx;
    const nz = st.z + dz;
    if (!collides(st.x, nz, st.feet)) st.z = nz;
  }

  // ---------- Boucle ----------
  function update(dt, elapsed) {
    if (st.entering) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = easeInOut(tw.t);
      camera.position.lerpVectors(tw.p0, tw.p1, e);
      camera.lookAt(dir.lerpVectors(tw.l0, tw.l1, e));
      if (tw.t >= 1) finishEnter();
      return;
    }
    if (!st.active) return;

    // Vecteur de déplacement (clavier + joystick tactile)
    let f = 0, s = 0;
    if (st.keys.has('KeyW') || st.keys.has('ArrowUp')) f += 1;
    if (st.keys.has('KeyS') || st.keys.has('ArrowDown')) f -= 1;
    if (st.keys.has('KeyD') || st.keys.has('ArrowRight')) s += 1;
    if (st.keys.has('KeyA') || st.keys.has('ArrowLeft')) s -= 1;
    f += -st.touchMove.y; s += st.touchMove.x;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    // Regard tactile (deltas accumulés par le joystick de droite / glisser)
    if (st.touchLook.dx || st.touchLook.dy) { look(st.touchLook.dx, st.touchLook.dy, 0.0045); st.touchLook.dx = st.touchLook.dy = 0; }

    const speed = (st.run ? RUN_SPEED : WALK_SPEED) * (len > 0 ? Math.min(1, len) : 0);
    if (speed > 0) {
      const sy = Math.sin(st.yaw), cy = Math.cos(st.yaw);
      // avant = (-sin yaw, 0, -cos yaw) ; droite = (cos yaw, 0, -sin yaw)
      const dx = (-sy * f + cy * s) * speed * dt;
      const dz = (-cy * f - sy * s) * speed * dt;
      tryMove(dx, dz);
      st.bob += dt * (st.run ? 11 : 8);
    } else {
      st.bob = 0;
    }

    // Hauteur du sol (escalier inclus), lissée
    const target = floorHeight(st.x, st.z, st.feet);
    st.feet += (target - st.feet) * Math.min(1, dt * 10);

    euler.set(st.pitch, st.yaw, 0);
    camera.quaternion.setFromEuler(euler);
    camera.position.set(st.x, st.feet + EYE + Math.sin(st.bob) * 0.025 * Math.min(1, speed), st.z);
    void elapsed;
  }

  return {
    state: st, enter, exit, update,
    isActive: () => st.active || st.entering,
    setTouchMove(x, y) { st.touchMove.x = x; st.touchMove.y = y; },
    addTouchLook(dx, dy) { st.touchLook.dx += dx; st.touchLook.dy += dy; },
    setRun(v) { st.run = v; },
  };
}
