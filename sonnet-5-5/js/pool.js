// Piscine : bassin carrelé, eau animée (shader procédural), margelle, plage, transats, parasols, éclairage immergé.
import * as THREE from 'three';
import { Batcher, rng, TAU } from './utils.js';
import { POOL } from './config.js';
import { SKY_COMMON_GLSL } from './sky.js';
import { lounger, Local } from './interior.js';

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const WATER_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime;
uniform float uNight;
uniform float uShelfX;
${SKY_COMMON_GLSL}

void addWave(vec2 p, float ang, float freq, float speed, float amp, inout vec2 g) {
  vec2 d = vec2(cos(ang), sin(ang));
  float ph = dot(d, p) * freq + uTime * speed;
  g += d * freq * amp * cos(ph);
}
vec3 waterNormal(vec2 p) {
  vec2 g = vec2(0.0);
  addWave(p, 0.4, 1.9, 1.1, 0.010, g);
  addWave(p, 1.3, 2.7, 1.4, 0.008, g);
  addWave(p, 2.2, 4.1, 1.8, 0.0055, g);
  addWave(p, 3.4, 5.9, 2.2, 0.004, g);
  addWave(p, 4.4, 9.0, 2.9, 0.0024, g);
  addWave(p, 5.5, 14.0, 3.5, 0.0014, g);
  g += 0.0035 * vec2(sin(p.x * 21.0 + p.y * 13.0 + uTime * 3.1), cos(p.y * 19.0 - p.x * 11.0 + uTime * 2.6));
  return normalize(vec3(-g.x, 1.0, -g.y));
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = waterNormal(vWorld.xz);
  vec3 Ng = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.6));
  float cosv = max(dot(V, Ng), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 refl = skyBase(normalize(R));

  float depth = mix(1.65, 0.42, 1.0 - smoothstep(uShelfX - 0.35, uShelfX + 0.35, vWorld.x));
  float absorb = 1.0 - exp(-depth * 1.15);
  float day = 1.0 - uNight;
  vec3 body = mix(vec3(0.012, 0.20, 0.28), vec3(0.015, 0.34, 0.47), day);
  body += vec3(0.0, 0.62, 0.85) * uNight * 1.05;

  vec3 H = normalize(normalize(uSunDir) + V);
  float nh = max(dot(N, H), 0.0);
  float spec = (pow(nh, 1200.0) * 26.0 + pow(nh, 70.0) * 0.22) * uSunVis;

  vec3 col = refl * fres + body * (1.0 - fres) * absorb + uSunColor * spec;
  float a = 1.0 - (1.0 - absorb) * (1.0 - fres);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function buildPool(ctx) {
  const { scene, M, env, ambience } = ctx;
  const group = new THREE.Group();
  group.name = 'piscine';
  scene.add(group);
  const S = new Batcher();
  const G = new Batcher();
  const F = new Batcher();
  const LL = new Local(F);
  const R = rng(777);
  const P = POOL;
  const T0 = 0.3; // épaisseur des parois

  /* ------------------ bassin ------------------ */
  const tile = M.poolTile;
  S.box(tile, P.x0, P.x1, P.floor - T0, P.floor, P.z0, P.z1); // fond
  S.box(tile, P.x0 - T0, P.x1 + T0, P.floor - T0, P.coping, P.z0 - T0, P.z0); // paroi nord
  S.box(tile, P.x0 - T0, P.x1 + T0, P.floor - T0, P.coping, P.z1, P.z1 + T0); // paroi sud
  S.box(tile, P.x0 - T0, P.x0, P.floor - T0, P.coping, P.z0, P.z1); // paroi ouest
  S.box(tile, P.x1, P.x1 + T0, P.floor - T0, P.coping, P.z0, P.z1); // paroi est
  S.box(tile, P.x0, P.shelfX1, P.floor - T0, P.shelfFloor, P.z0, P.z1); // plage immergée (banquette)
  // escalier d'accès (angle nord-est)
  for (let i = 1; i <= 3; i++) S.box(tile, P.x1 - 0.45 * i, P.x1, P.floor - T0, P.floor + 0.4 * i, P.z0, P.z0 + 2.2);

  // margelle (pierre claire) + terrasse environnante en pierre
  const c = 0.42;
  S.box(M.coping, P.x0 - c, P.x1 + c, 0, P.coping, P.z0 - c, P.z0);
  S.box(M.coping, P.x0 - c, P.x1 + c, 0, P.coping, P.z1, P.z1 + c);
  S.box(M.coping, P.x0 - c, P.x0, 0, P.coping, P.z0, P.z1);
  S.box(M.coping, P.x1, P.x1 + c, 0, P.coping, P.z0, P.z1);
  const dx0 = -18.4, dx1 = 6.8, dz0 = 5.85, dz1 = 18.4, dy = 0.1;
  S.box(M.pavers, dx0, dx1, -0.3, dy, dz0, P.z0 - c);
  S.box(M.pavers, dx0, dx1, -0.3, dy, P.z1 + c, dz1);
  S.box(M.pavers, dx0, P.x0 - c, -0.3, dy, P.z0 - c, P.z1 + c);
  S.box(M.pavers, P.x1 + c, dx1, -0.3, dy, P.z0 - c, P.z1 + c);

  // spots immergés (bord nord et sud)
  const lampGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 18);
  lampGeo.rotateX(Math.PI / 2);
  const halo = new THREE.PlaneGeometry(1.7, 1.7);
  for (const x of [-12.2, -8, -3.8]) {
    S.geo(lampGeo, M.poolLamp, x, -0.62, P.z0 + 0.015);
    G.geo(halo, M.haloCool, x, -0.62, P.z0 + 0.03);
    S.geo(lampGeo, M.poolLamp, x + 1.8, -0.62, P.z1 - 0.015);
    G.geo(halo, M.haloCool, x + 1.8, -0.62, P.z1 - 0.03, 0, Math.PI);
  }
  // lueur lumineuse du fond
  const floorHalo = new THREE.PlaneGeometry(5.2, 5.2);
  floorHalo.rotateX(-Math.PI / 2);
  for (const x of [-9, -4.2]) G.geo(floorHalo, M.haloCool, x, P.floor + 0.02, (P.z0 + P.z1) / 2);

  /* ------------------ mobilier de plage ------------------ */
  const y0 = dy;
  for (const [x, z] of [[-12.3, 15.4], [-10.9, 15.4], [-6.3, 15.4], [-4.9, 15.4]]) {
    lounger(LL, F, M, x, y0, z, Math.PI);
    // serviette
    LL.at(x, y0, z, Math.PI);
    LL.box(R() < 0.5 ? M.cushionTeal : M.cushionRust, -0.28, 0.28, 0.41, 0.425, -0.1, 0.8);
  }
  // transats immergés sur la plage
  lounger(LL, F, M, -13.6, P.shelfFloor, 10.5, Math.PI / 2 + 0.05, 0.7);
  lounger(LL, F, M, -12.3, P.shelfFloor, 10.5, Math.PI / 2 + 0.05, 0.7);
  // tables d'appoint
  for (const x of [-11.6, -5.6]) {
    F.cyl(M.steel, x, y0, 15.4, 0.02, 0.02, 0.48, 8);
    F.cyl(M.ceramic, x, y0 + 0.48, 15.4, 0.26, 0.26, 0.025, 20);
    F.cyl(M.ceramic, x + 0.06, y0 + 0.505, 15.35, 0.035, 0.03, 0.1, 10);
  }
  // parasols
  for (const x of [-11.6, -5.6]) {
    const z = 15.9;
    F.cyl(M.concreteDark, x, y0, z, 0.32, 0.36, 0.1, 18);
    F.cyl(M.steel, x, y0 + 0.1, z, 0.03, 0.035, 2.5, 10);
    const cone = new THREE.ConeGeometry(1.95, 0.5, 8, 1, true);
    F.geo(cone, M.canvas, x, y0 + 2.62, z, 0, 0.39, 0);
    F.cyl(M.steel, x, y0 + 2.86, z, 0.02, 0.02, 0.1, 6);
  }
  // jardinières le long de la plage
  const grass = new THREE.MeshStandardMaterial({ color: 0x6d8f4a, roughness: 0.9, side: THREE.DoubleSide, name: 'graminées' });
  for (const [x, z] of [[-17.2, 8.2], [-17.2, 13.0], [5.6, 8.2], [5.6, 13.0], [-8, 17.6], [-1.5, 17.6], [-15.6, 17.2]]) {
    F.cyl(M.concreteDark, x, y0, z, 0.38, 0.32, 0.6, 18);
    for (let i = 0; i < 11; i++) {
      const g = new THREE.ConeGeometry(0.07, 1.0 + R() * 0.7, 4);
      g.scale(1, 1, 0.4);
      g.rotateX(0.2 + R() * 0.45);
      g.rotateY(R() * TAU);
      g.translate(x, y0 + 1.0, z);
      F._push(grass, g);
    }
  }

  S.build(group, { name: 'piscine' });
  F.build(group, { name: 'mobilier-piscine' });
  G.build(group, { cast: false, receive: false, name: 'halo-piscine' }).forEach((m) => (m.renderOrder = 4));

  /* ------------------ caustiques sur le carrelage ------------------ */
  const causticU = { uTime: env.uniforms.uTime, uCaust: { value: 0.5 } };
  tile.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = causticU.uTime;
    sh.uniforms.uCaust = causticU.uCaust;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWP;
uniform float uTime;
uniform float uCaust;
float caustic(vec2 uv, float time) {
  vec2 p = mod(uv * 6.28318530718, 6.28318530718) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.5, 0.92, 1.0) * caustic(vWP.xz * 0.22, uTime * 0.55) * uCaust * step(vWP.y, 0.0);`
      );
  };
  tile.customProgramCacheKey = () => 'pool-caustics';
  tile.needsUpdate = true;

  /* ------------------ eau ------------------ */
  const u = {
    uZenith: env.uniforms.uZenith, uHorizon: env.uniforms.uHorizon, uGround: env.uniforms.uGround,
    uSunDir: env.uniforms.uSunDir, uSunColor: env.uniforms.uSunColor, uSunVis: env.uniforms.uSunVis,
    uTime: env.uniforms.uTime,
    uNight: { value: 0 },
    uShelfX: { value: P.shelfX1 },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0, 1, 1), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set((P.x0 + P.x1) / 2, P.water, (P.z0 + P.z1) / 2);
  water.renderOrder = 5;
  water.name = 'eau';
  group.add(water);

  /* ------------------ ballon flottant ------------------ */
  const ballGeo = new THREE.SphereGeometry(0.24, 20, 14);
  const cols = [];
  const palette = [new THREE.Color(0xf4efe4), new THREE.Color(0xd9534a), new THREE.Color(0xf4efe4), new THREE.Color(0x2f7fc4), new THREE.Color(0xf4efe4), new THREE.Color(0xe8b43a)];
  const pos = ballGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI;
    const col = palette[Math.floor((a / TAU) * 6) % 6];
    cols.push(col.r, col.g, col.b);
  }
  ballGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, name: 'ballon' }));
  ball.castShadow = true;
  group.add(ball);

  /* ------------------ lumières de la piscine ------------------ */
  const under = new THREE.PointLight(0x3fd8ff, 0, 13, 1.3);
  under.position.set(-7.5, -0.9, 10.6);
  group.add(under);
  ambience.light(under, 55, 0.6, 0.9);
  const glow = new THREE.PointLight(0x58e0ff, 0, 11, 1.5);
  glow.position.set(-7.5, 0.9, 10.6);
  group.add(glow);
  ambience.light(glow, 9, 0.6, 0.9);

  function update(dt, t) {
    const tod = ambience.tod;
    u.uNight.value = tod;
    causticU.uCaust.value = 0.5 * (1 - tod) + 0.12;
    ball.position.set(-6.5 + Math.sin(t * 0.11) * 4.4 + Math.sin(t * 0.37) * 0.25, P.water + 0.12 + Math.sin(t * 1.6) * 0.012, 10.7 + Math.cos(t * 0.083) * 1.9);
    ball.rotation.y = t * 0.2;
    ball.rotation.x = Math.sin(t * 0.7) * 0.15;
  }
  return { group, update, water };
}
