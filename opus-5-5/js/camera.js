import * as THREE from 'three';
import { easeInOut } from './utils.js';

// Vues prédéfinies : position caméra + point visé.
export const VIEWS = {
  facade: { pos: [7, 5.2, 33], target: [-1.5, 3.2, 1] },
  pool: { pos: [-20.5, 5.4, -22.8], target: [-4.5, 1.2, -12.5] },
  garage: { pos: [19.5, 3.0, 16.5], target: [10, 1.5, 0.5] },
  aerial: { pos: [36, 50, 34], target: [0, 0, -2] },
};

const MIN_TARGET_Y = 0.4;
const BOUNDS = 45;

// Transition de caméra : interpolation en coordonnées sphériques autour d'un point visé
// lui-même interpolé, pour contourner la villa plutôt que la traverser.
export class CameraRig {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.anim = null;
    this.autoRotate = false;
    this.onDone = null;
    controls.addEventListener('start', () => this.cancel());
  }

  // En portrait, on recule pour garder la villa entière dans le cadre.
  viewPos(v) {
    const a = this.camera.aspect, t = new THREE.Vector3(...v.target);
    const k = a < 1 ? Math.pow(Math.min(2.2, 1 / a), 0.7) : 1;
    return new THREE.Vector3(...v.pos).sub(t).multiplyScalar(k).add(t);
  }

  jump(name) {
    const v = VIEWS[name];
    this.camera.position.copy(this.viewPos(v));
    this.controls.target.set(...v.target);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  goTo(name) {
    const v = VIEWS[name];
    if (!v) return;
    const c = this.controls;
    const fromT = c.target.clone();
    const toT = new THREE.Vector3(...v.target);
    const s0 = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(fromT));
    const s1 = new THREE.Spherical().setFromVector3(this.viewPos(v).sub(toT));
    let dTheta = s1.theta - s0.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    const travel = Math.abs(dTheta) / Math.PI + fromT.distanceTo(toT) / 40 + Math.abs(s1.radius - s0.radius) / 60;
    this.anim = { t: 0, dur: 1.4 + travel * 1.1, fromT, toT, s0, s1, dTheta, name };
    c.autoRotate = false;
  }

  cancel() {
    if (!this.anim) return;
    this.anim = null;
    this.controls.autoRotate = this.autoRotate;
    if (this.onDone) this.onDone(null);
  }

  setAutoRotate(on) {
    this.autoRotate = on;
    if (!this.anim) this.controls.autoRotate = on;
  }

  update(dt) {
    const a = this.anim;
    if (a) {
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = easeInOut(a.t);
      const bump = Math.sin(Math.PI * e);
      const target = a.fromT.clone().lerp(a.toT, e);
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(a.s0.radius, a.s1.radius, e) * (1 + 0.12 * bump),
        THREE.MathUtils.clamp(THREE.MathUtils.lerp(a.s0.phi, a.s1.phi, e) - 0.1 * bump, 0.08, this.controls.maxPolarAngle),
        a.s0.theta + a.dTheta * e
      );
      this.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));
      this.controls.target.copy(target);
      this.camera.lookAt(target);
      if (a.t >= 1) {
        this.anim = null;
        this.controls.autoRotate = this.autoRotate;
        if (this.onDone) this.onDone(a.name);
      }
    }
    this.controls.update();
    this.clamp();
  }

  // Garde-fous : jamais sous le sol, jamais trop loin de la parcelle.
  clamp() {
    const t = this.controls.target;
    const p = this.camera.position;
    const before = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, -BOUNDS, BOUNDS);
    t.z = THREE.MathUtils.clamp(t.z, -BOUNDS, BOUNDS);
    t.y = THREE.MathUtils.clamp(t.y, MIN_TARGET_Y, 20);
    p.add(t.clone().sub(before));
    if (p.y < 0.7) p.y = 0.7;
  }
}
