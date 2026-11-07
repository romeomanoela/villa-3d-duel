// Ciel procédural, cycle jour/nuit, soleil/lune (lumière directionnelle à ombres), brouillard et IBL.
import * as THREE from 'three';
import { lerp, smoothstep, easeInOutSine } from './utils.js';

/* ------------------------------------------------------------------ */
/*  GLSL partagé : dégradé de ciel (dôme + reflets de l'eau)           */
/* ------------------------------------------------------------------ */
export const SKY_COMMON_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVis;

vec3 skyBase(vec3 d) {
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uGround, smoothstep(0.0, -0.18, h));
  float sd = max(dot(d, uSunDir), 0.0);
  float low = 1.0 - clamp(h * 1.6, 0.0, 1.0);
  col += uSunColor * (pow(sd, 6.0) * 0.12 + pow(sd, 48.0) * 0.28) * uSunVis * (0.35 + 0.65 * low);
  return col;
}
`;

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // collé au plan lointain : le ciel est dessiné en dernier et ne colore que les pixels libres
}
`;

const DOME_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uMoonDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uMoonVis;
uniform float uStars;
uniform float uTime;
uniform float uCover;
${SKY_COMMON_GLSL}

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}
float starField(vec3 d) {
  vec3 p = d * 150.0;
  vec3 id = floor(p);
  vec3 f = fract(p) - 0.5;
  float h = hash13(id);
  float on = step(0.982, h);
  float r = length(f);
  float tw = 0.65 + 0.35 * sin(uTime * (1.2 + h * 3.0) + h * 60.0);
  return on * smoothstep(0.24, 0.0, r) * tw * (0.35 + 0.65 * hash13(id + 7.7));
}

void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyBase(d);

  // étoiles
  if (uStars > 0.01 && d.y > 0.0) {
    col += vec3(0.85, 0.9, 1.0) * starField(d) * uStars * 2.2 * smoothstep(0.0, 0.15, d.y);
  }

  // soleil
  float sd = dot(d, uSunDir);
  col += uSunColor * smoothstep(0.99955, 0.99978, sd) * 18.0 * uSunVis;

  // lune
  float md = dot(d, uMoonDir);
  if (md > 0.99) {
    vec3 mu = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir));
    vec3 mv = cross(uMoonDir, mu);
    vec2 q = vec2(dot(d, mu), dot(d, mv)) / 0.0175;
    float disc = smoothstep(1.0, 0.94, length(q));
    float maria = fbm(q * 1.6 + 3.0);
    vec3 moonCol = mix(vec3(0.55, 0.58, 0.66), vec3(1.0, 0.98, 0.93), smoothstep(0.35, 0.65, maria));
    // phase : léger croissant gibbeux
    float shade = smoothstep(-0.9, 0.55, q.x + 0.25 * q.y + 0.1);
    col += moonCol * disc * (0.35 + 0.65 * shade) * 3.0 * uMoonVis;
  }
  col += vec3(0.45, 0.55, 0.85) * (pow(max(md, 0.0), 120.0) * 0.45 + pow(max(md, 0.0), 12.0) * 0.04) * uMoonVis;

  // nuages
  if (d.y > 0.015) {
    vec2 p = d.xz / (d.y + 0.28) * 1.7 + vec2(uTime * 0.012, uTime * 0.005);
    float n = fbm(p);
    float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.3, n);
    float n2 = fbm(p + uSunDir.xz * 0.35);
    float lit = clamp((n - n2) * 3.2 + 0.55, 0.0, 1.0);
    vec3 cc = mix(uCloudShade, uCloudLit, lit);
    col = mix(col, cc, c * smoothstep(0.015, 0.2, d.y) * 0.92);
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* ------------------------------------------------------------------ */
/*  Images clés (par élévation du soleil en degrés)                    */
/* ------------------------------------------------------------------ */
const C = (h) => new THREE.Color(h);
const KEYS = [
  { e: 46, zen: C(0x2c6bd0), hor: C(0xb7d4f1), gnd: C(0x908c82), sun: C(0xfff2dc), sunI: 3.3, hs: C(0xc2dcff), hg: C(0xaaa497), hI: 0.34, exp: 0.92, cl: C(0xffffff), cs: C(0x93a3bd), cover: 0.46 },
  { e: 16, zen: C(0x3e7ed2), hor: C(0xd6d8d2), gnd: C(0x8a8478), sun: C(0xffe4bd), sunI: 3.0, hs: C(0xcfd9f2), hg: C(0x9d9585), hI: 0.32, exp: 0.95, cl: C(0xfff0dc), cs: C(0x98a2b8), cover: 0.46 },
  { e: 5, zen: C(0x4a74bf), hor: C(0xf3b98c), gnd: C(0x6c6055), sun: C(0xffb26c), sunI: 2.0, hs: C(0xffd9ba), hg: C(0x5c4a3c), hI: 0.3, exp: 1.0, cl: C(0xffc99c), cs: C(0x7d7392), cover: 0.5 },
  { e: -2, zen: C(0x36518f), hor: C(0xee8458), gnd: C(0x443d44), sun: C(0xff7b3d), sunI: 0.8, hs: C(0xb7a3cc), hg: C(0x3c3244), hI: 0.28, exp: 1.05, cl: C(0xff9b6c), cs: C(0x5a5677), cover: 0.5 },
  { e: -8, zen: C(0x1c2a62), hor: C(0x7b5b88), gnd: C(0x1c1d2c), sun: C(0xff7240), sunI: 0.0, hs: C(0x7586bd), hg: C(0x22222f), hI: 0.3, exp: 1.05, cl: C(0xa17b92), cs: C(0x303656), cover: 0.46 },
  { e: -14, zen: C(0x0b1536), hor: C(0x2d3c6c), gnd: C(0x10131f), sun: C(0xff7240), sunI: 0.0, hs: C(0x5f74b0), hg: C(0x161a28), hI: 0.36, exp: 1.05, cl: C(0x4b5782), cs: C(0x1b2142), cover: 0.42 },
  { e: -20, zen: C(0x050b1e), hor: C(0x19264d), gnd: C(0x090c17), sun: C(0xff7240), sunI: 0.0, hs: C(0x6c84c4), hg: C(0x151926), hI: 0.42, exp: 1.05, cl: C(0x3a446c), cs: C(0x141a34), cover: 0.4 },
];

const _state = {
  zen: new THREE.Color(), hor: new THREE.Color(), gnd: new THREE.Color(), sun: new THREE.Color(),
  hs: new THREE.Color(), hg: new THREE.Color(), cl: new THREE.Color(), cs: new THREE.Color(),
  sunI: 0, hI: 0, exp: 1, cover: 0.4,
};

function sampleKeys(e) {
  let i = 0;
  while (i < KEYS.length - 2 && e < KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const f = Math.min(1, Math.max(0, (a.e - e) / (a.e - b.e)));
  for (const k of ['zen', 'hor', 'gnd', 'sun', 'hs', 'hg', 'cl', 'cs']) _state[k].lerpColors(a[k], b[k], f);
  for (const k of ['sunI', 'hI', 'exp', 'cover']) _state[k] = lerp(a[k], b[k], f);
  return _state;
}

/* ------------------------------------------------------------------ */
/*  Contrôleur d'environnement                                         */
/* ------------------------------------------------------------------ */
export class Environment {
  constructor({ renderer, scene, camera, ambience, shadowSize = 4096 }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.ambience = ambience;

    // uniformes partagés (dôme + eau)
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunVis: { value: 1 },
      uMoonDir: { value: new THREE.Vector3(-0.52, 0.42, -0.74).normalize() },
      uMoonVis: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uCover: { value: 0.45 },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
    };

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), this.skyMat);
    this.dome.scale.setScalar(900);
    this.dome.renderOrder = 1000; // dernier des objets opaques (early-z : on évite de calculer le ciel derrière la scène)
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // scène miroir pour générer la carte d'environnement (reflets PBR)
    this.envScene = new THREE.Scene();
    const envDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.skyMat);
    envDome.scale.setScalar(50);
    envDome.frustumCulled = false;
    this.envScene.add(envDome);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this._envClock = 0;

    // lumières
    this.key = new THREE.DirectionalLight(0xffffff, 3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.key.shadow.camera;
    sc.left = -46; sc.right = 46; sc.top = 40; sc.bottom = -40; sc.near = 5; sc.far = 330;
    this.key.shadow.bias = -0.00025;
    this.key.shadow.normalBias = 0.05;
    this.key.shadow.radius = 2.2;
    scene.add(this.key, this.key.target);

    this.moonLightDir = new THREE.Vector3(-0.25, 0.75, 0.6).normalize(); // lumière lunaire : vient du sud (façade éclairée)
    this.fill = new THREE.DirectionalLight(0x9db6ff, 0);
    this.fill.position.set(55, 40, 70);
    scene.add(this.fill);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x666655, 0.3);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(0xb7d4f1, 90, 520);

    // état
    this.tod = 0;
    this.target = 0;
    this.progress = 0; // 0..1 linéaire
    this.duration = 5.5;
    this._dirty = true;
    this.onChange = null;

    this.apply(0);
    this.updateEnv();
  }

  get isNight() {
    return this.target > 0.5;
  }

  setNight(flag, instant = false) {
    this.target = flag ? 1 : 0;
    if (instant) {
      this.progress = this.target;
      this.tod = this.target;
      this._dirty = true;
    }
  }

  /** Réduit la taille de la shadow map (adaptation dynamique des performances). */
  setShadowSize(n) {
    if (this.key.shadow.mapSize.x === n) return;
    this.key.shadow.mapSize.set(n, n);
    if (this.key.shadow.map) {
      this.key.shadow.map.dispose();
      this.key.shadow.map = null;
    }
  }

  apply(tod) {
    const e = lerp(46, -20, tod); // élévation du soleil (°)
    const az = lerp(0.7, -1.25, tod); // azimut (rad) : du sud-est vers le sud-ouest
    const er = (e * Math.PI) / 180;
    const sunDir = this.uniforms.uSunDir.value.set(Math.cos(er) * Math.sin(az), Math.sin(er), Math.cos(er) * Math.cos(az)).normalize();
    const s = sampleKeys(e);
    const U = this.uniforms;
    U.uZenith.value.copy(s.zen);
    U.uHorizon.value.copy(s.hor);
    U.uGround.value.copy(s.gnd);
    U.uSunColor.value.copy(s.sun);
    U.uCloudLit.value.copy(s.cl);
    U.uCloudShade.value.copy(s.cs);
    U.uCover.value = s.cover;
    U.uSunVis.value = smoothstep(-5, 1, e);
    const moonF = 1 - smoothstep(-17, -6, e);
    U.uMoonVis.value = moonF;
    U.uStars.value = 1 - smoothstep(-17, -5, e);

    // lumière clé : soleil le jour, lune la nuit (permutation quand les deux sont ~0)
    const sunF = smoothstep(-4, 3, e);
    const sunI = s.sunI * sunF;
    const moonI = 1.35 * moonF;
    if (moonI > sunI) {
      this.key.position.copy(this.moonLightDir).multiplyScalar(130);
      this.key.color.setRGB(0.62, 0.74, 1.0);
      this.key.intensity = moonI;
    } else {
      this.key.position.copy(sunDir).multiplyScalar(130);
      this.key.color.copy(s.sun);
      this.key.intensity = sunI;
    }
    this.key.target.position.set(0, 0, 0);

    this.fill.intensity = 0.28 * moonF;
    this.hemi.color.copy(s.hs);
    this.hemi.groundColor.copy(s.hg);
    this.hemi.intensity = s.hI;

    this.scene.fog.color.copy(s.hor).lerp(s.gnd, 0.12);
    this.renderer.setClearColor(this.scene.fog.color);
    this.renderer.toneMappingExposure = s.exp;

    this.ambience.update(tod);
    this._lastApplied = tod;
  }

  updateEnv() {
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 120);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  /** À appeler chaque image. Retourne true si l'éclairage a changé. */
  update(dt, time) {
    this.uniforms.uTime.value = time;
    this.dome.position.copy(this.camera.position);
    let changed = false;
    const dir = Math.sign(this.target - this.progress);
    if (dir !== 0) {
      this.progress = THREE.MathUtils.clamp(this.progress + (dir * dt) / this.duration, 0, 1);
      if ((dir > 0 && this.progress >= this.target) || (dir < 0 && this.progress <= this.target)) this.progress = this.target;
      this.tod = easeInOutSine(this.progress);
      this._dirty = true;
      this._envClock += dt;
      if (this._envClock > 0.28 || this.progress === this.target) {
        this._envClock = 0;
        this.apply(this.tod);
        this.updateEnv();
        this._dirty = false;
        changed = true;
        if (this.progress === this.target && this.onChange) this.onChange(this.tod);
        return changed;
      }
    }
    if (this._dirty) {
      this.apply(this.tod);
      this._dirty = false;
      changed = true;
    }
    return changed;
  }
}
