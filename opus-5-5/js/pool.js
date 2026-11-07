import * as THREE from 'three';
import { L } from './config.js';
import { Batcher } from './utils.js';
import * as F from './furniture.js';

/* ---------- Eau : vagues procédurales, Fresnel, reflet du ciel, caustiques, lueur nocturne ---------- */
const waterVert = /* glsl */ `
uniform float uTime;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += (sin(w.x * 1.7 + uTime * 1.3) + sin(w.z * 2.3 - uTime * 1.1)) * 0.004;
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const waterFrag = /* glsl */ `
uniform float uTime;
uniform float uLights;
uniform float uSunI;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec4 uBounds;
uniform sampler2D uCaustics;
varying vec3 vW;

float hgt(vec2 p, float t) {
  float h = sin(dot(p, vec2(0.8, 0.6)) * 3.1 + t * 1.6) * 0.5;
  h += sin(dot(p, vec2(-0.7, 0.7)) * 4.3 + t * 1.9) * 0.35;
  h += sin(dot(p, vec2(0.2, -1.0)) * 7.7 + t * 2.6) * 0.2;
  h += sin(dot(p, vec2(-0.9, -0.3)) * 11.3 + t * 3.1) * 0.12;
  h += (texture2D(uCaustics, p * 0.16 + vec2(t * 0.02, t * 0.013)).r - 0.5) * 0.5;
  return h;
}

void main() {
  vec2 p = vW.xz;
  float t = uTime, e = 0.035;
  float h0 = hgt(p, t);
  vec3 n = normalize(vec3(-(hgt(p + vec2(e, 0.0), t) - h0) / e * 0.045, 1.0, -(hgt(p + vec2(0.0, e), t) - h0) / e * 0.045));
  vec3 V = normalize(cameraPosition - vW);
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uZenith, uHorizon, pow(1.0 - clamp(R.y, 0.0, 1.0), 4.0));

  vec2 q = (p - uBounds.xy) / (uBounds.zw - uBounds.xy);
  float edge = smoothstep(0.0, 0.3, min(min(q.x, 1.0 - q.x) * 2.4, min(q.y, 1.0 - q.y)));
  vec3 water = mix(vec3(0.12, 0.58, 0.6), vec3(0.02, 0.28, 0.4), edge * 0.75);
  float day = clamp(uSunI / 3.3, 0.0, 1.0);
  float dif = 0.45 + 0.55 * max(dot(n, uSunDir), 0.0);
  vec3 col = water * (uSunCol * day * dif * 0.85 + uZenith * 0.8 + 0.015);

  float c = texture2D(uCaustics, p * 0.33 + vec2(t * 0.03, -t * 0.02)).r * texture2D(uCaustics, p * 0.27 - vec2(t * 0.025, t * 0.031)).r;
  col += vec3(0.55, 0.9, 0.95) * c * 0.55 * day;

  // Projecteurs immergés : lueur turquoise depuis les parois longues
  float wallGlow = exp(-pow((q.y - 1.0) * 3.2, 2.0)) * 0.7 + exp(-pow(q.y * 3.2, 2.0)) * 0.5;
  vec3 glow = vec3(0.04, 0.58, 0.85) * (0.55 + wallGlow + c * 1.4);
  col += glow * uLights;

  col = mix(col, sky, fres * (1.0 - 0.6 * uLights));
  float spec = pow(max(dot(R, uSunDir), 0.0), 700.0) * 40.0 * day;
  col += uSunCol * spec;
  float a = mix(0.6, 0.94, fres);
  a = max(a, 0.78 * uLights);
  gl_FragColor = vec4(col, a);
}`;

/* ---------- Caustiques animées projetées sur le fond du bassin ---------- */
const causticVert = /* glsl */ `
varying vec2 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const causticFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uTime;
uniform float uI;
uniform vec3 uCol;
varying vec2 vP;
void main() {
  float a = texture2D(uTex, vP * 0.42 + vec2(uTime * 0.03, uTime * 0.017)).r;
  float b = texture2D(uTex, vP * 0.35 + vec2(-uTime * 0.021, uTime * 0.027)).r;
  float c = min(a, b) * 1.5 + a * b * 1.8;
  gl_FragColor = vec4(uCol * c * uI, 1.0);
}`;

export function buildPool(scene, M, T) {
  const group = new THREE.Group();
  group.name = 'pool';
  scene.add(group);
  const b = new Batcher();
  const { FL0, POOL: PO, PLATFORM: PL, DECK } = L;

  /* --- Plateforme en travertin (plage) percée du bassin + terrasse bois --- */
  b.slabHole(M.travPave, PL.x0, PL.x1, PL.z0, PL.z1, PO.x0, PO.x1, PO.z0, PO.z1, 0, FL0);
  b.boxB(M.deck, DECK.x0, DECK.x1, FL0, FL0 + 0.03, DECK.z0, DECK.z1 - 0.15);
  // Emmarchements vers la pelouse
  for (let k = 0; k < 2; k++) {
    const y = FL0 - 0.15 * (k + 1);
    b.boxB(M.travPave, PL.x1, PL.x1 + 0.4 * (k + 1), 0, y, -15, -10.5);
    b.boxB(M.travPave, -7, -2, 0, y, PL.z0 - 0.4 * (k + 1), PL.z0);
  }

  /* --- Bassin : parois et fond en mosaïque, marches romaines, margelle --- */
  const fl = PO.floor;
  b.boxB(M.poolTile, PO.x0, PO.x1, fl - 0.2, fl, PO.z0, PO.z1);
  b.boxB(M.poolTile, PO.x0 - 0.2, PO.x0, fl - 0.2, FL0 - 0.01, PO.z0 - 0.2, PO.z1 + 0.2);
  b.boxB(M.poolTile, PO.x1, PO.x1 + 0.2, fl - 0.2, FL0 - 0.01, PO.z0 - 0.2, PO.z1 + 0.2);
  b.boxB(M.poolTile, PO.x0, PO.x1, fl - 0.2, FL0 - 0.01, PO.z0 - 0.2, PO.z0);
  b.boxB(M.poolTile, PO.x0, PO.x1, fl - 0.2, FL0 - 0.01, PO.z1, PO.z1 + 0.2);
  for (let k = 0; k < 3; k++) {
    const top = PO.water - 0.27 * (k + 1);
    b.boxB(M.poolTile, PO.x1 - 0.42 * (k + 1), PO.x1, fl, top, PO.z0, PO.z0 + 2.2 - k * 0.3);
    b.boxB(M.coping, PO.x1 - 0.42 * (k + 1), PO.x1 - 0.42 * (k + 1) + 0.05, top - 0.02, top + 0.005, PO.z0, PO.z0 + 2.2 - k * 0.3, { cast: false });
  }
  const cw = 0.42, ov = 0.03, yt = FL0 + 0.05;
  b.boxB(M.coping, PO.x0 - cw, PO.x1 + cw, FL0 - 0.02, yt, PO.z0 - cw, PO.z0 + ov);
  b.boxB(M.coping, PO.x0 - cw, PO.x1 + cw, FL0 - 0.02, yt, PO.z1 - ov, PO.z1 + cw);
  b.boxB(M.coping, PO.x0 - cw, PO.x0 + ov, FL0 - 0.02, yt, PO.z0 + ov, PO.z1 - ov);
  b.boxB(M.coping, PO.x1 - ov, PO.x1 + cw, FL0 - 0.02, yt, PO.z0 + ov, PO.z1 - ov);
  // Projecteurs immergés
  const lampGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20).rotateX(Math.PI / 2);
  for (const x of [-9.5, -5.5, -1.5]) {
    b.mesh(lampGeo, M.poolLamp, [x, PO.water - 0.5, PO.z1 - 0.012], [0, 0, 0], [1, 1, 1], { cast: false });
    b.mesh(lampGeo, M.poolLamp, [x, PO.water - 0.5, PO.z0 + 0.012], [0, 0, 0], [1, 1, 1], { cast: false });
  }

  /* --- Mobilier de plage --- */
  const at = (x, z, ry, fn, y = FL0) => { b.push(x, y, z, ry); fn(); b.pop(); };
  for (const x of [-9.6, -8.0, -6.4]) at(x, -18.8, 0, () => F.lounger(b, M));
  at(-8.8, -19.55, 0, () => F.sideTable(b, M));
  at(-4.4, -18.7, 0, () => F.parasol(b, M, 1.7, 2.45));
  at(2.6, -13.4, -Math.PI / 2, () => F.lounger(b, M));
  at(2.6, -15.4, -Math.PI / 2, () => F.lounger(b, M));
  at(3.5, -14.4, 0, () => F.sideTable(b, M));
  at(4.6, -15.5, 0, () => F.parasol(b, M, 1.5, 2.4));
  // Salon extérieur sous le porte-à-faux
  const yd = FL0 + 0.03;
  at(-10.6, -7.1, Math.PI, () => F.sofa(b, M, 2.6, { mat: M.cushion }), yd);
  at(-10.6, -8.6, 0, () => F.coffeeTable(b, M, 1.2, 0.7, 0.32), yd);
  at(-12.6, -8.6, Math.PI / 2, () => F.armchair(b, M), yd);
  // Table à manger extérieure
  at(-1.8, -8.3, 0, () => F.diningTable(b, M, 2.2, 0.95), yd);
  for (const x of [-2.5, -1.1]) {
    at(x, -7.6, Math.PI, () => F.chair(b, M), yd);
    at(x, -9.0, 0, () => F.chair(b, M), yd);
  }
  // Grandes jardinières
  for (const [x, z] of [[5.3, -19.3], [-14.0, -10.6]]) {
    b.box(M.planter, 0.9, 0.7, 0.9, x, FL0 + 0.35, z);
    b.mesh(new THREE.IcosahedronGeometry(0.55, 2), M.box, [x, FL0 + 1.15, z]);
  }

  b.build(group, 'pool');

  /* --- Eau et caustiques --- */
  const w = PO.x1 - PO.x0, d = PO.z1 - PO.z0;
  const waterU = {
    uTime: { value: 0 }, uLights: { value: 0 }, uSunI: { value: 3 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uBounds: { value: new THREE.Vector4(PO.x0, PO.z0, PO.x1, PO.z1) },
    uCaustics: { value: T.caustics },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d, 48, 20).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: waterVert, fragmentShader: waterFrag, transparent: true, depthWrite: false })
  );
  water.position.set((PO.x0 + PO.x1) / 2, PO.water, (PO.z0 + PO.z1) / 2);
  water.renderOrder = 2;
  group.add(water);

  const caU = { uTex: { value: T.caustics }, uTime: { value: 0 }, uI: { value: 0.5 }, uCol: { value: new THREE.Color() } };
  const caustic = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms: caU, vertexShader: causticVert, fragmentShader: causticFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  caustic.position.set(water.position.x, fl + 0.006, water.position.z);
  caustic.renderOrder = 1;
  group.add(caustic);

  const light = new THREE.PointLight(0x40d8ff, 0, 15, 2);
  light.position.set(-5.5, 0.1, -14.5);
  group.add(light);
  const cyan = new THREE.Color(0.25, 0.85, 1.0);

  return {
    update(state) {
      waterU.uTime.value = caU.uTime.value = state.time;
      waterU.uLights.value = state.lights;
      waterU.uSunI.value = state.sunI;
      waterU.uSunDir.value.copy(state.sunDir);
      waterU.uSunCol.value.setRGB(...state.sunColor);
      waterU.uZenith.value.setRGB(...state.zenith);
      waterU.uHorizon.value.setRGB(...state.horizon);
      const day = Math.min(1, state.sunI / 3.3);
      caU.uI.value = 0.35 * day + 1.1 * state.lights;
      caU.uCol.value.setRGB(...state.sunColor).lerp(cyan, state.lights);
      light.intensity = 26 * state.lights;
    },
  };
}
