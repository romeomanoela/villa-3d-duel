// Éclairage global et cycle jour/nuit : soleil/lune directionnel avec ombres, hémisphère, brouillard, application de k.
import * as THREE from 'three';
import { R } from './registry.js';
import { lerp, smoothstep } from './utils.js';

const SUN_DAY = new THREE.Vector3(38, 52, 26);
const SUN_NIGHT = new THREE.Vector3(-30, 40, -34);     // position de la lune
const COL = {
  sunDay: new THREE.Color(0xfff1d6), sunNight: new THREE.Color(0x7f93c8),
  hemiSkyDay: new THREE.Color(0xbfdcff), hemiSkyNight: new THREE.Color(0x1a2440),
  hemiGroundDay: new THREE.Color(0x8c7f63), hemiGroundNight: new THREE.Color(0x0b0d12),
  fogDay: new THREE.Color(0xcfe3f4), fogNight: new THREE.Color(0x0a1224),
  skyDay: new THREE.Color(0x9fc8f0), skyNight: new THREE.Color(0x0e1a33),
};

export function createLighting(scene, renderer, sky) {
  const sun = new THREE.DirectionalLight(COL.sunDay, 3.2);
  sun.position.copy(SUN_DAY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 170;
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(COL.hemiSkyDay, COL.hemiGroundDay, 0.7);
  scene.add(hemi);

  scene.fog = new THREE.Fog(COL.fogDay.clone(), 70, 260);

  const state = {
    k: 0,            // 0 = jour, 1 = nuit (valeur lissée)
    target: 0,
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3().copy(SUN_NIGHT).normalize(),
    skyColor: new THREE.Color(),
    speed: 1 / 2.6,  // durée de transition ≈ 2.6 s
  };

  const sunDirDay = SUN_DAY.clone().normalize();

  function apply(k) {
    const ks = smoothstep(k);
    sun.position.lerpVectors(SUN_DAY, SUN_NIGHT, ks);
    sun.intensity = lerp(3.2, 0.4, ks);
    sun.color.lerpColors(COL.sunDay, COL.sunNight, ks);
    hemi.intensity = lerp(0.7, 0.18, ks);
    hemi.color.lerpColors(COL.hemiSkyDay, COL.hemiSkyNight, ks);
    hemi.groundColor.lerpColors(COL.hemiGroundDay, COL.hemiGroundNight, ks);
    scene.fog.color.lerpColors(COL.fogDay, COL.fogNight, ks);
    renderer.toneMappingExposure = lerp(1.0, 0.9, ks);
    state.sunDir.copy(sun.position).normalize();
    state.skyColor.lerpColors(COL.skyDay, COL.skyNight, ks);
    sky.update(ks, ks < 0.5 ? sunDirDay : state.sunDir, state.moonDir);

    // Lumières artificielles : montée douce, légèrement en avance sur la nuit (elles s'allument au crépuscule)
    const kl = smoothstep(Math.min(1, k * 1.25));
    for (const { light, intensity } of R.nightLights) light.intensity = intensity * kl;
    for (const { material, intensity } of R.nightEmissives) material.emissiveIntensity = intensity * kl;
    const envI = lerp(1, 0.35, ks);
    for (const mat of R.envMaterials) mat.envMapIntensity = envI * (mat.userData.envBase || 1);
  }

  for (const mat of R.envMaterials) mat.userData.envBase = mat.envMapIntensity;
  apply(0);

  return {
    sun, hemi, state,
    setNight(night) { state.target = night ? 1 : 0; },
    isNight() { return state.target === 1; },
    update(dt) {
      if (state.k !== state.target) {
        const dir = Math.sign(state.target - state.k);
        state.k = Math.min(1, Math.max(0, state.k + dir * dt * state.speed));
        if (dir > 0 && state.k > state.target) state.k = state.target;
        if (dir < 0 && state.k < state.target) state.k = state.target;
        apply(state.k);
      }
    },
  };
}
