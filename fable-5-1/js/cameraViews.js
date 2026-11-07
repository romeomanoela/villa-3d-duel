// Vues prédéfinies et transition fluide de la caméra (position + cible), bornes de l'orbite.
import * as THREE from 'three';
import { easeInOut } from './utils.js';

export const VIEWS = {
  facade: { pos: [-3, 7, 33], target: [-3, 2.4, -1] },
  pool: { pos: [31, 8, 11], target: [17, 0.8, -3] },
  garage: { pos: [-15, 3.4, 15], target: [-14, 1.4, -1] },
  aerial: { pos: [26, 46, 40], target: [0, 0, -2] },
};

export function createCameraRig(camera, controls) {
  const tween = { active: false, t: 0, dur: 1.7, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };

  function flyTo(name) {
    const v = VIEWS[name];
    if (!v) return;
    tween.p0.copy(camera.position);
    tween.t0.copy(controls.target);
    tween.p1.set(...v.pos);
    tween.t1.set(...v.target);
    tween.t = 0;
    tween.active = true;
    controls.enabled = false;
  }

  function update(dt) {
    if (tween.active) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const e = easeInOut(tween.t);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      // léger arc vertical pour éviter de traverser les volumes
      camera.position.y += Math.sin(e * Math.PI) * 2.5;
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (tween.t >= 1) { tween.active = false; controls.enabled = true; }
    }
    // Bornes : la cible reste au-dessus du sol et dans l'emprise ; la caméra ne passe jamais sous le sol.
    const tg = controls.target;
    tg.y = Math.max(0.3, Math.min(14, tg.y));
    tg.x = Math.max(-45, Math.min(45, tg.x));
    tg.z = Math.max(-40, Math.min(45, tg.z));
    if (camera.position.y < 0.6) camera.position.y = 0.6;
    controls.update();
  }

  return { flyTo, update, isFlying: () => tween.active };
}
