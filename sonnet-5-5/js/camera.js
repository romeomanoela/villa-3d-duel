// Caméra orbitale bornée + vues prédéfinies avec transition fluide.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeInOutCubic } from './utils.js';

export const VIEWS = {
  facade: { label: 'Façade', pos: [2.5, 3.4, 32], target: [0, 3.0, 0], fov: 46 },
  piscine: { label: 'Piscine', pos: [3.5, 2.4, 22.6], target: [-8.5, 0.9, 9.8], fov: 52 },
  garage: { label: 'Garage', pos: [24.2, 1.5, -0.6], target: [12.2, 0.95, -4.1], fov: 54 },
  aerienne: { label: 'Aérienne', pos: [38, 29, 40], target: [-1, 0, 0], fov: 44 },
};

const BOUNDS_MIN = new THREE.Vector3(-48, 0.2, -38);
const BOUNDS_MAX = new THREE.Vector3(48, 14, 38);

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.minDistance = 3;
    c.maxDistance = 105;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = Math.PI * 0.488; // jamais sous l'horizon : pas de passage sous le sol
    c.screenSpacePanning = false;
    c.panSpeed = 0.7;
    c.rotateSpeed = 0.62;
    c.zoomSpeed = 0.8;
    c.autoRotate = false;
    c.autoRotateSpeed = 0.8;
    this.tween = null;
    this.activeView = null;
    this.onViewChange = null;
    this.onUserInteract = null;

    c.addEventListener('start', () => {
      if (this.tween) this.tween = null;
      if (this.activeView) {
        this.activeView = null;
        this.onViewChange && this.onViewChange(null);
      }
      this.onUserInteract && this.onUserInteract();
    });
  }

  set autoRotate(v) {
    this.controls.autoRotate = v;
  }
  get autoRotate() {
    return this.controls.autoRotate;
  }

  /** Adapte une vue au format d'écran : en portrait (mobile) on recule et on élargit un peu le champ. */
  resolve(v) {
    const aspect = this.camera.aspect || 1.6;
    const k = Math.min(2.2, Math.max(1, 1.5 / aspect));
    const dolly = 1 + (k - 1) * 0.55;
    const target = new THREE.Vector3(...v.target);
    const pos = new THREE.Vector3(...v.pos).sub(target).multiplyScalar(dolly).add(target);
    pos.y = Math.max(pos.y, v.pos[1]);
    return { p: pos, t: target, fov: Math.min(72, v.fov * (1 + (k - 1) * 0.25)) };
  }

  /** Place la caméra sans animation (état initial). */
  snapTo(name) {
    const r = this.resolve(VIEWS[name]);
    this.camera.position.copy(r.p);
    this.controls.target.copy(r.t);
    this.camera.fov = r.fov;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /** Transition fluide vers une vue (trajectoire légèrement arquée, easing cubique). */
  goTo(name, duration = 2.6) {
    const v = VIEWS[name];
    if (!v) return;
    const from = { p: this.camera.position.clone(), t: this.controls.target.clone(), fov: this.camera.fov };
    const to = this.resolve(v);
    const dist = from.p.distanceTo(to.p);
    this.tween = { from, to, time: 0, duration: Math.max(1.4, Math.min(duration, 1.2 + dist * 0.045)), lift: Math.min(10, dist * 0.18) };
    this.activeView = name;
    this.onViewChange && this.onViewChange(name);
  }

  update(dt) {
    const tw = this.tween;
    if (tw) {
      tw.time += dt;
      const k = Math.min(1, tw.time / tw.duration);
      const e = easeInOutCubic(k);
      this.camera.position.lerpVectors(tw.from.p, tw.to.p, e);
      this.camera.position.y += Math.sin(Math.PI * e) * tw.lift;
      this.controls.target.lerpVectors(tw.from.t, tw.to.t, e);
      const fov = tw.from.fov + (tw.to.fov - tw.from.fov) * e;
      if (Math.abs(fov - this.camera.fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      if (k >= 1) this.tween = null;
    }
    const auto = this.controls.autoRotate;
    if (this.tween) this.controls.autoRotate = false; // pas de rotation parasite pendant la transition
    this.controls.update();
    this.controls.autoRotate = auto;
    // bornes : pas sous le sol, cible dans le terrain
    this.controls.target.clamp(BOUNDS_MIN, BOUNDS_MAX);
    if (this.camera.position.y < 0.45) this.camera.position.y = 0.45;
  }
}
