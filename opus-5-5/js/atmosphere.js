import * as THREE from 'three';
import { createSky } from './sky.js';
import { smooth01, sstep } from './utils.js';

// Palette clé du cycle : k = 1 plein jour, k = 0 nuit. Valeurs linéaires (HDR).
const KEYS = [
  { k: 0.0, zen: [0.003, 0.006, 0.02], hor: [0.018, 0.03, 0.07], gnd: [0.01, 0.013, 0.02], sun: [1, 0.45, 0.25], sunI: 0, sunset: 0, hemi: 0.32, exp: 1.12 },
  { k: 0.22, zen: [0.02, 0.035, 0.1], hor: [0.16, 0.11, 0.17], gnd: [0.04, 0.035, 0.045], sun: [1, 0.4, 0.2], sunI: 0, sunset: 0.35, hemi: 0.38, exp: 1.1 },
  { k: 0.42, zen: [0.07, 0.12, 0.3], hor: [0.9, 0.42, 0.2], gnd: [0.28, 0.2, 0.16], sun: [1, 0.48, 0.22], sunI: 1.1, sunset: 1, hemi: 0.5, exp: 1.05 },
  { k: 0.68, zen: [0.1, 0.26, 0.6], hor: [0.82, 0.7, 0.58], gnd: [0.42, 0.42, 0.4], sun: [1, 0.8, 0.6], sunI: 2.5, sunset: 0.25, hemi: 0.55, exp: 1.0 },
  { k: 1.0, zen: [0.11, 0.3, 0.72], hor: [0.6, 0.75, 0.9], gnd: [0.48, 0.54, 0.54], sun: [1, 0.95, 0.88], sunI: 3.3, sunset: 0, hemi: 0.5, exp: 1.0 },
];
const FIELDS = ['zen', 'hor', 'gnd', 'sun'];
function samplePalette(k) {
  let i = 0;
  while (i < KEYS.length - 2 && k > KEYS[i + 1].k) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((k - a.k) / (b.k - a.k), 0, 1);
  const o = {};
  for (const f of FIELDS) o[f] = a[f].map((v, j) => v + (b[f][j] - v) * t);
  for (const f of ['sunI', 'sunset', 'hemi', 'exp']) o[f] = a[f] + (b[f] - a[f]) * t;
  return o;
}

const DEG = Math.PI / 180;
const TRANSITION = 4.2; // secondes

export class Atmosphere {
  constructor(scene, renderer, M) {
    this.scene = scene;
    this.renderer = renderer;
    this.M = M;
    this.k = 1;
    this.target = 1;
    this.sky = createSky();
    scene.add(this.sky.mesh);
    this.envScene = new THREE.Scene();
    this.envScene.add(this.sky.envMesh);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.envK = -1;
    this.shadowK = -1;

    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 3));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.autoUpdate = false;
    sun.target.position.set(-1, 0, -5);
    scene.add(sun, sun.target);

    this.moon = new THREE.DirectionalLight(0x8ea6ff, 0);
    this.moon.position.copy(this.sky.uniforms.uMoonDir.value).multiplyScalar(60);
    scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a5440, 0.5);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(0xb8c8d4, 110, 520);
    this.tmp = new THREE.Color();
  }

  setNight(n) { this.target = n ? 0 : 1; }

  update(dt, state, camera, bloom) {
    const step = dt / TRANSITION;
    if (this.k < this.target) this.k = Math.min(this.target, this.k + step);
    else if (this.k > this.target) this.k = Math.max(this.target, this.k - step);
    const k = smooth01(this.k);
    const p = samplePalette(k);
    const u = this.sky.uniforms;

    // Course du soleil : il descend vers l'ouest et passe sous l'horizon.
    const elev = THREE.MathUtils.lerp(-14, 50, k) * DEG;
    const azim = THREE.MathUtils.lerp(168, 140, k) * DEG;
    const dir = u.uSunDir.value.set(Math.cos(elev) * Math.cos(azim), Math.sin(elev), Math.cos(elev) * Math.sin(azim));
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 80);
    this.sun.color.setRGB(...p.sun);
    this.sun.intensity = p.sunI;

    const lights = 1 - sstep(0.3, 0.78, k);
    state.night = 1 - k;
    state.lights = lights;
    state.k = k;
    state.sunDir = dir;
    state.sunColor = p.sun;
    state.sunI = p.sunI;
    state.zenith = p.zen;
    state.horizon = p.hor;

    u.uZenith.value.setRGB(...p.zen);
    u.uHorizon.value.setRGB(...p.hor);
    u.uGround.value.setRGB(...p.gnd);
    u.uDay.value = sstep(0.12, 0.6, k);
    u.uSunset.value = p.sunset;
    u.uTime.value = state.time;
    this.sky.mesh.position.copy(camera.position);

    this.moon.intensity = 0.42 * (1 - sstep(0.1, 0.45, k));
    this.hemi.intensity = p.hemi;
    const hc = this.hemi.color.setRGB(p.zen[0] * 0.6 + p.hor[0] * 0.4, p.zen[1] * 0.6 + p.hor[1] * 0.4, p.zen[2] * 0.6 + p.hor[2] * 0.4);
    hc.multiplyScalar(1 / Math.max(1e-3, hc.r, hc.g, hc.b)); // teinte normalisée, l'intensité vient de p.hemi
    this.hemi.groundColor.setRGB(0.36, 0.33, 0.25).multiplyScalar(0.25 + 0.75 * k);

    this.scene.fog.color.setRGB(p.hor[0] * 0.75 + p.gnd[0] * 0.25, p.hor[1] * 0.75 + p.gnd[1] * 0.25, p.hor[2] * 0.75 + p.gnd[2] * 0.25);
    this.renderer.toneMappingExposure = p.exp;
    if (bloom) {
      bloom.strength = 0.1 + 0.62 * lights;
      bloom.threshold = 0.92 - 0.2 * lights;
    }

    for (const [mat, d, n] of this.M.night) mat.emissiveIntensity = d + (n - d) * lights;
    for (const [mat, base] of this.M.glows) mat.opacity = base * lights;

    // Carte d'environnement régénérée au fil de la transition.
    if (this.envRT === null || Math.abs(k - this.envK) > 0.03 || (k !== this.envK && (k === 0 || k === 1))) {
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 100);
      this.scene.environment = rt.texture;
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.envK = k;
    }
    // Ombres recalculées seulement si le soleil bouge ou si un objet animé le demande.
    if (k > 0.02 && (k !== this.shadowK || state.shadowDirty)) {
      this.sun.shadow.needsUpdate = true;
      this.shadowK = k;
    }
    state.shadowDirty = false;
  }
}
