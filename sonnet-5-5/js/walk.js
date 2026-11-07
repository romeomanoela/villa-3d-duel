// Visite à la première personne : déplacement ZQSD / WASD / flèches, regard à la souris (glisser ou capture du
// pointeur) ou au doigt, collisions cercle/rectangles, hauteur du sol suivie marche par marche, animations d'entrée/sortie.
import * as THREE from 'three';
import { clamp, easeInOutCubic, smoothstep } from './utils.js';

export const EYE = 1.65; // hauteur des yeux au-dessus du sol (m)
const RADIUS = 0.26; // rayon de collision du visiteur
const WALK = 1.9; // m/s
const RUN = 4.2; // m/s (Maj)
const FOV = 68;

const FWD = new Set(['KeyW', 'KeyZ', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'KeyQ']);
const RIGHT = new Set(['KeyD']);
const TURN_L = 'ArrowLeft';
const TURN_R = 'ArrowRight';
const BLOCKED_KEYS = new Set(['KeyW', 'KeyZ', 'KeyA', 'KeyQ', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();

export class Walker {
  constructor({ camera, rig, canvas, map }) {
    this.camera = camera;
    this.rig = rig;
    this.canvas = canvas;
    this.map = map;
    this.state = 'off'; // 'off' | 'entering' | 'on'
    this.onState = null;
    this.onZone = null;

    this.keys = new Set();
    this.joy = { x: 0, y: 0 }; // joystick virtuel : x droite, y bas (comme l'écran)
    this.sens = 0.0023;

    this.x = map.spawn.x;
    this.z = map.spawn.z;
    this.level = 0;
    this.feet = 0.35;
    this.yaw = 0;
    this.pitch = 0;
    this.vx = 0;
    this.vz = 0;
    this.bobT = 0;
    this.zone = '';
    this.enter = null;
    this.lookId = null;
    this.lastX = 0;
    this.lastY = 0;
    this.locked = false;
    this._savedNear = camera.near;

    this._bind();
  }

  get active() {
    return this.state !== 'off';
  }
  get running() {
    return this.state === 'on' && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.92);
  }

  /* ------------------------------------------------------------------ */
  /*  Entrées                                                            */
  /* ------------------------------------------------------------------ */
  _bind() {
    // une touche reste « enfoncée » au moins ~90 ms : un simple appui bref produit tout de même un petit pas
    const downAt = new Map();
    const timers = new Map();
    window.addEventListener('keydown', (e) => {
      if (this.state === 'off') return;
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
      clearTimeout(timers.get(e.code));
      if (!this.keys.has(e.code)) downAt.set(e.code, performance.now());
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      const held = performance.now() - (downAt.get(e.code) || 0);
      clearTimeout(timers.get(e.code));
      if (held < 90) timers.set(e.code, setTimeout(() => this.keys.delete(e.code), 90 - held));
      else this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.joy.x = this.joy.y = 0;
    });

    // regard : glisser (souris, stylet, doigt)
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.state !== 'on' || this.lookId !== null || this.locked) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.lookId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      try {
        c.setPointerCapture(e.pointerId);
      } catch (err) {
        /* pointeur synthétique */
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      const k = e.pointerType === 'touch' ? 1.25 : 1;
      this._look((e.clientX - this.lastX) * k, (e.clientY - this.lastY) * k);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId !== this.lookId) return;
      this.lookId = null;
      if (c.hasPointerCapture && c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    // capture du pointeur (équivalent PointerLockControls), activable avec la touche C
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      this.onLockChange && this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked && this.state === 'on') this._look(e.movementX, e.movementY);
    });
  }

  _look(dx, dy) {
    this.yaw -= dx * this.sens;
    this.pitch = clamp(this.pitch - dy * this.sens, -1.38, 1.38);
  }

  toggleCapture() {
    if (this.state !== 'on') return;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    else if (this.canvas.requestPointerLock) {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Entrée / sortie                                                    */
  /* ------------------------------------------------------------------ */
  start() {
    if (this.state !== 'off') return;
    const rig = this.rig, cam = this.camera;
    // le focus quitte le bouton cliqué : Espace / Entrée ne doivent pas rebasculer la visite
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.canvas.focus({ preventScroll: true });
    rig.tween = null;
    rig.controls.enabled = false;
    if (rig.activeView) {
      rig.activeView = null;
      rig.onViewChange && rig.onViewChange(null);
    }
    this._savedNear = cam.near;
    cam.near = 0.1;

    const sp = this.map.spawn;
    this.x = sp.x;
    this.z = sp.z;
    this.level = sp.level;
    this.feet = this.map.floorAt(sp.x, sp.z, sp.level);
    this.vx = this.vz = 0;
    this.zone = '';

    const end = new THREE.Vector3(sp.x, this.feet + EYE, sp.z);
    const pts = [cam.position.clone(), ...this.map.approach.map((p) => new THREE.Vector3(p.x, p.y, p.z)), end];
    const dist = pts.reduce((s, p, i) => (i ? s + p.distanceTo(pts[i - 1]) : 0), 0);
    this.enter = {
      curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
      qFrom: cam.quaternion.clone(),
      fovFrom: cam.fov,
      t: 0,
      dur: clamp(2.6 + dist * 0.025, 3.2, 5.2),
      turn: 0,
      phase: 'fly',
    };
    // à l'arrivée, on regarde vers le nord (l'intérieur), puis on se retourne vers la piscine
    this.yaw = 0;
    this.pitch = -0.04;
    this._setState('entering');
  }

  stop() {
    if (this.state === 'off') return;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    this.lookId = null;
    const cam = this.camera, rig = this.rig;
    cam.near = this._savedNear;
    // la caméra orbitale reprend là où la visite s'arrête puis rejoint la vue Façade
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    rig.controls.target.copy(cam.position).addScaledVector(dir, 6);
    rig.controls.target.y = cam.position.y;
    rig.controls.enabled = true;
    rig.tween = null;
    rig.controls.update();
    rig.goTo('facade', 3.2);
    this.enter = null;
    this.zone = '';
    this.onZone && this.onZone('');
    this._setState('off');
  }

  toggle() {
    if (this.state === 'off') this.start();
    else this.stop();
  }

  _setState(s) {
    this.state = s;
    this.onState && this.onState(s);
  }

  /* ------------------------------------------------------------------ */
  /*  Boucle                                                             */
  /* ------------------------------------------------------------------ */
  update(dt) {
    if (this.state === 'entering') this._updateEnter(dt);
    else if (this.state === 'on') this._updateWalk(dt);
  }

  _updateEnter(dt) {
    const en = this.enter, cam = this.camera;
    if (en.phase === 'fly') {
      en.t = Math.min(1, en.t + dt / en.dur);
      const e = easeInOutCubic(en.t);
      cam.position.copy(en.curve.getPoint(e));
      _e.set(this.pitch, 0, 0, 'YXZ');
      _qB.setFromEuler(_e);
      cam.quaternion.slerpQuaternions(en.qFrom, _qB, smoothstep(0, 0.8, e));
      const f = en.fovFrom + (FOV - en.fovFrom) * e;
      cam.fov = f;
      cam.updateProjectionMatrix();
      if (en.t >= 1) en.phase = 'turn';
    } else {
      en.turn = Math.min(1, en.turn + dt / 1.5);
      this.yaw = Math.PI * easeInOutCubic(en.turn);
      this._applyCamera(0);
      if (en.turn >= 1) {
        this.enter = null;
        this._setState('on');
      }
    }
  }

  _updateWalk(dt) {
    const k = this.keys;
    const turn = (k.has(TURN_L) ? 1 : 0) - (k.has(TURN_R) ? 1 : 0);
    this.yaw += turn * 1.9 * dt;

    let f = 0, s = 0;
    for (const c of k) {
      if (FWD.has(c)) f += 1;
      else if (BACK.has(c)) f -= 1;
      else if (LEFT.has(c)) s -= 1;
      else if (RIGHT.has(c)) s += 1;
    }
    f += -this.joy.y;
    s += this.joy.x;
    const mag = Math.hypot(f, s);
    if (mag > 1) {
      f /= mag;
      s /= mag;
    }
    const speed = this.running ? RUN : WALK;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    // avant = (-sin, -cos) ; droite = (cos, -sin)
    const tx = (-sy * f + cy * s) * speed;
    const tz = (-cy * f - sy * s) * speed;
    const a = 1 - Math.exp(-dt * 10);
    this.vx += (tx - this.vx) * a;
    this.vz += (tz - this.vz) * a;

    // déplacement par sous-pas (pas de traversée de cloison fine, même à bas FPS)
    const list = this.map.colliders[this.level];
    const dx = this.vx * dt, dz = this.vz * dt;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    for (let i = 0; i < n; i++) {
      this.x += dx / n;
      this.z += dz / n;
      this._collide(list);
    }

    // hauteur du sol : on suit les marches (lissage = montée progressive)
    const target = this.map.floorAt(this.x, this.z, this.level);
    this.feet += (target - this.feet) * (1 - Math.exp(-dt * 13));
    if (this.level === 0 && this.feet > 2.45) this.level = 1;
    else if (this.level === 1 && this.feet < 2.15) this.level = 0;

    const sp = Math.hypot(this.vx, this.vz);
    this.bobT += sp * dt * 2.3;
    this._applyCamera(Math.sin(this.bobT) * 0.017 * Math.min(1, sp / 1.8));

    const z = this.map.zoneAt(this.x, this.z, this.level);
    if (z !== this.zone) {
      this.zone = z;
      this.onZone && this.onZone(z);
    }
  }

  _collide(list) {
    let { x, z } = this;
    const r = RADIUS;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const b of list) {
        const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), k = (r - d) / d;
          x += dx * k;
          z += dz * k;
        } else {
          const m = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
          if (m === x - b.x0) x = b.x0 - r;
          else if (m === b.x1 - x) x = b.x1 + r;
          else if (m === z - b.z0) z = b.z0 - r;
          else z = b.z1 + r;
        }
        moved = true;
      }
      if (!moved) break;
    }
    this.x = x;
    this.z = z;
  }

  _applyCamera(bob) {
    const cam = this.camera;
    cam.position.set(this.x, this.feet + EYE + bob, this.z);
    _e.set(this.pitch, this.yaw, 0, 'YXZ');
    cam.quaternion.setFromEuler(_e);
    if (cam.fov !== FOV) {
      cam.fov = FOV;
      cam.updateProjectionMatrix();
    }
  }

  /** Téléportation directe (tests, raccourcis). */
  teleport(x, z, level, yaw = this.yaw) {
    this.x = x;
    this.z = z;
    this.level = level;
    this.feet = this.map.floorAt(x, z, level);
    this.yaw = yaw;
    this.vx = this.vz = 0;
  }
}
