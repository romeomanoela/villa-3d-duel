import * as THREE from 'three';
import { L } from './config.js';
import { colliders } from './colliders.js';
import { easeInOut } from './utils.js';

// Visite intérieure à la 1re personne : clavier (ZQSD / WASD / flèches), souris (glisser ou
// pointeur verrouillé), joystick tactile, collisions cercle/boîtes, escalier praticable.
const EYE = 1.65, RADIUS = 0.28, WALK = 1.9, RUN = 4.0, FOV_IN = 68;
const S = L.STAIR, RUN_STEP = (S.x1 - S.x0) / (S.steps - 1), MID = (L.FL0 + L.FL1) / 2;

export const SPOTS = {
  rdc: { x: -6.3, z: 0.9, feet: L.FL0, yaw: 0.12 },
  etage: { x: 1.0, z: -1.9, feet: L.FL1, yaw: 0 },
};
const ENTRY = new THREE.Vector3(L.PATH_X, 2.4, 9.5); // on entre par l'allée et la porte d'entrée

const ROOMS = [
  [0, -14, -6.6, -6, 4, 'Séjour'], [0, -6.6, 0.6, -6, 1.2, 'Salle à manger'], [0, 0.6, 6, -6, 4, 'Cuisine'],
  [0, -6.6, 0.6, 1.2, 4, 'Entrée · escalier'],
  [1, -10, -4.5, -7.5, -1, 'Suite parentale'], [1, -10, -5.4, -1, 3.2, 'Salle de bain'],
  [1, 4.5, 10.5, -7.5, 3.2, "Chambre d'amis"], [1, -5.4, 4.5, -7.5, 3.2, 'Salon de l’étage'],
];

const KEYMAP = {
  KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r', ArrowUp: 'f', ArrowDown: 'b', ArrowLeft: 'l', ArrowRight: 'r',
  z: 'f', w: 'f', s: 'b', q: 'l', a: 'l', d: 'r',
};

export class Tour {
  constructor({ camera, controls, canvas, joystick, onChange, onRoom, fade }) {
    Object.assign(this, { camera, controls, canvas, joystick, onChange, onRoom, fade });
    this.mode = 'off';
    this.keys = new Set();
    this.run = false;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.feet = L.FL0;
    this.feetView = L.FL0;
    this.yaw = 0;
    this.pitch = 0;
    this.bob = 0;
    this.joy = { x: 0, y: 0 };
    this.room = '';
    this.anim = null;
    this.bindInput();
  }

  get active() { return this.mode === 'active' || this.mode === 'entering'; }

  /* ---------- Entrée / sortie animées ---------- */
  enter() {
    if (this.mode !== 'off') return;
    const c = this.camera;
    this.orbit = { pos: c.position.clone(), target: this.controls.target.clone() };
    this.baseFov = c.fov;
    this.controls.enabled = false;
    const s = SPOTS.rdc;
    this.place(s);
    const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.anim = this.makeAnim(c.position.clone(), ENTRY.clone().setY(Math.max(ENTRY.y, c.position.y * 0.35)), new THREE.Vector3(s.x, s.feet + EYE, s.z), c.quaternion.clone(), endQ, c.fov, FOV_IN, 2.6);
    this.mode = 'entering';
    this.onChange(true);
  }

  exit(dest) {
    if (this.mode === 'off' || (this.mode === 'leaving' && !dest)) return;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    const c = this.camera;
    const to = dest || this.orbit;
    const look = new THREE.Matrix4().lookAt(to.pos, to.target, new THREE.Vector3(0, 1, 0));
    const endQ = new THREE.Quaternion().setFromRotationMatrix(look);
    const mid = ENTRY.clone().setY(Math.max(3.5, to.pos.y * 0.5));
    this.anim = this.makeAnim(c.position.clone(), mid, to.pos.clone(), c.quaternion.clone(), endQ, c.fov, this.baseFov, 2.2);
    this.anim.target = to.target.clone();
    this.mode = 'leaving';
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    this.onChange(false);
  }

  makeAnim(p0, p1, p2, q0, q1, f0, f1, dur) {
    return { t: 0, p0, p1, p2, q0, q1, f0, f1, dur };
  }

  place(s) {
    this.pos.set(s.x, 0, s.z);
    this.feet = this.feetView = s.feet;
    this.yaw = s.yaw;
    this.pitch = -0.04;
    this.vel.set(0, 0, 0);
  }

  teleport(name) {
    if (this.mode !== 'active') return;
    this.fade.classList.add('on');
    setTimeout(() => {
      this.place(SPOTS[name]);
      this.fade.classList.remove('on');
    }, 280);
  }

  /* ---------- Entrées utilisateur ---------- */
  bindInput() {
    const cv = this.canvas;
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'active' || document.pointerLockElement === cv) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, k: e.pointerType === 'touch' ? 0.006 : 0.0042 };
      try { cv.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.mode !== 'active') return;
      if (document.pointerLockElement === cv) return this.look(e.movementX, e.movementY, 0.0024);
      if (!drag || drag.id !== e.pointerId) return;
      this.look(e.clientX - drag.x, e.clientY - drag.y, drag.k);
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const end = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => {
      if (this.mode === 'active' && cv.requestPointerLock && matchMedia('(pointer: fine)').matches) cv.requestPointerLock();
    });

    window.addEventListener('keydown', (e) => {
      if (this.mode === 'off' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { this.exit(); return; }
      const k = KEYMAP[e.code] || KEYMAP[e.key.toLowerCase()];
      if (e.key === 'Shift') this.run = true;
      if (k) { this.keys.add(k); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code] || KEYMAP[e.key.toLowerCase()];
      if (e.key === 'Shift') this.run = false;
      if (k) this.keys.delete(k);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.run = false; });

    // Joystick virtuel (tactile)
    const j = this.joystick, knob = j.querySelector('i');
    let jid = null;
    const setJoy = (e) => {
      const r = j.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const max = r.width * 0.38, d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / max;
      this.joy.y = -dy / max;
    };
    j.addEventListener('pointerdown', (e) => {
      jid = e.pointerId;
      try { j.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
      setJoy(e);
      e.preventDefault();
    });
    j.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const jEnd = (e) => {
      if (e.pointerId !== jid) return;
      jid = null;
      this.joy.x = this.joy.y = 0;
      knob.style.transform = '';
    };
    j.addEventListener('pointerup', jEnd);
    j.addEventListener('pointercancel', jEnd);
  }

  look(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.3, 1.3);
  }

  /* ---------- Physique simplifiée ---------- */
  floorAt(x, z) {
    if (x > S.x0 - RUN_STEP - 0.15 && x < S.x1 + 0.05 && z > S.z0 - 0.05 && z < S.z1 + 0.05) {
      const t = THREE.MathUtils.clamp((x - (S.x0 - RUN_STEP)) / (S.x1 - S.x0 + RUN_STEP), 0, 1);
      return L.FL0 + t * (L.FL1 - L.FL0);
    }
    return this.feet > MID ? L.FL1 : L.FL0;
  }

  collide(p) {
    const lo = this.feet + 0.3, hi = this.feet + 1.75, r2 = RADIUS * RADIUS;
    for (let it = 0; it < 3; it++) {
      for (const c of colliders) {
        if (c.y1 < lo || c.y0 > hi) continue;
        const qx = Math.min(Math.max(p.x, c.x0), c.x1), qz = Math.min(Math.max(p.z, c.z0), c.z1);
        const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= r2) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = (RADIUS - d) / d;
          p.x += dx * push;
          p.z += dz * push;
        } else {
          const opts = [[c.x0 - RADIUS - p.x, 0], [c.x1 + RADIUS - p.x, 0], [0, c.z0 - RADIUS - p.z], [0, c.z1 + RADIUS - p.z]];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          p.x += opts[0][0];
          p.z += opts[0][1];
        }
      }
    }
  }

  roomAt() {
    const lvl = this.feet > MID ? 1 : 0;
    const on = this.floorAt(this.pos.x, this.pos.z);
    if (on > L.FL0 + 0.05 && on < L.FL1 - 0.05) return 'Escalier';
    const r = ROOMS.find(([l, x0, x1, z0, z1]) => l === lvl && this.pos.x >= x0 && this.pos.x < x1 && this.pos.z >= z0 && this.pos.z < z1);
    return r ? r[5] : '';
  }

  update(dt) {
    const c = this.camera;
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = easeInOut(a.t), u = 1 - e;
      c.position.set(0, 0, 0).addScaledVector(a.p0, u * u).addScaledVector(a.p1, 2 * u * e).addScaledVector(a.p2, e * e);
      c.quaternion.slerpQuaternions(a.q0, a.q1, easeInOut(Math.min(1, a.t * 1.15)));
      c.fov = THREE.MathUtils.lerp(a.f0, a.f1, e);
      c.near = this.mode === 'entering' ? THREE.MathUtils.lerp(0.2, 0.05, e) : THREE.MathUtils.lerp(0.05, 0.2, e);
      c.updateProjectionMatrix();
      if (a.t >= 1) {
        this.anim = null;
        if (this.mode === 'entering') this.mode = 'active';
        else {
          this.mode = 'off';
          this.controls.target.copy(a.target);
          this.controls.enabled = true;
          c.lookAt(a.target);
          this.controls.update();
        }
      }
      return;
    }
    if (this.mode !== 'active') return;

    const k = this.keys;
    let fx = (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0) + this.joy.y;
    let sx = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0) + this.joy.x;
    const m = Math.hypot(fx, sx);
    if (m > 1) { fx /= m; sx /= m; }
    const speed = this.run ? RUN : WALK;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const tx = (-sy * fx + cy * sx) * speed, tz = (-cy * fx - sy * sx) * speed;
    const blend = 1 - Math.exp(-dt * 10);
    this.vel.x += (tx - this.vel.x) * blend;
    this.vel.z += (tz - this.vel.z) * blend;
    const steps = Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.1) || 1;
    for (let i = 0; i < steps; i++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      this.collide(this.pos);
      this.feet = this.floorAt(this.pos.x, this.pos.z);
    }
    this.feetView += (this.feet - this.feetView) * (1 - Math.exp(-dt * 14));
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * sp * 4.2;
    const bobY = Math.sin(this.bob) * 0.022 * Math.min(1, sp / WALK);
    c.position.set(this.pos.x, this.feetView + EYE + bobY, this.pos.z);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const room = this.roomAt();
    if (room !== this.room) { this.room = room; this.onRoom(room); }
  }
}
