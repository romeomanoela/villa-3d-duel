// Piscine : plage en travertin, bassin carrelé, margelle, eau animée (shader), transats, parasol, éclairage.
import * as THREE from 'three';
import { Merger, box } from './utils.js';
import { R, nightLight } from './registry.js';

export const POOL = { x0: 13, x1: 23, z0: -6, z1: -1.5, depth: 1.6, waterY: -0.1 };
const DECK = { x0: 9, x1: 26.5, z0: -10.5, z1: 4.5, y: 0.1 };

const waterVert = /* glsl */`
  uniform float uTime;
  varying vec3 vWorldPos; varying vec3 vNormal;
  #include <fog_pars_vertex>
  void main() {
    vec3 pos = position;
    vec2 p = pos.xz;
    float h = 0.0; vec2 grad = vec2(0.0);
    vec2 d1 = normalize(vec2(1.0, 0.6));  float w1 = dot(p, d1) * 2.2 + uTime * 1.5;  h += 0.022 * sin(w1); grad += 0.022 * 2.2 * cos(w1) * d1;
    vec2 d2 = normalize(vec2(-0.7, 1.0)); float w2 = dot(p, d2) * 3.7 + uTime * 2.0;  h += 0.012 * sin(w2); grad += 0.012 * 3.7 * cos(w2) * d2;
    vec2 d3 = normalize(vec2(0.3, -1.0)); float w3 = dot(p, d3) * 6.1 + uTime * 2.7;  h += 0.006 * sin(w3); grad += 0.006 * 6.1 * cos(w3) * d3;
    pos.y += h;
    vNormal = normalize(vec3(-grad.x, 1.0, -grad.y));
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterFrag = /* glsl */`
  uniform float uTime; uniform float uNight;
  uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor;
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uGlow;
  varying vec3 vWorldPos; varying vec3 vNormal;
  #include <fog_pars_fragment>
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    vec2 q = vWorldPos.xz;
    float c1 = sin(q.x * 7.0 + uTime * 1.1) * sin(q.y * 6.2 - uTime * 0.9);
    float c2 = sin((q.x + q.y) * 9.5 + uTime * 1.7);
    float c = 0.5 + 0.3 * c1 + 0.2 * c2;
    vec3 base = mix(uDeep, uShallow, 0.42 + 0.16 * c1 + 0.1 * c2);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 col = mix(base, uSkyColor, fres * 0.75);
    vec3 r = reflect(-uSunDir, n);
    float spec = pow(max(dot(r, v), 0.0), 220.0);
    col += uSunColor * spec * 2.0 * (1.0 - uNight * 0.85);
    col = mix(col, uGlow * (0.85 + 0.25 * c), uNight * 0.85);
    float alpha = mix(0.74, 0.95, fres);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createPool(scene, M) {
  const g = new THREE.Group();
  g.name = 'pool';
  const m = new Merger();
  const { x0, x1, z0, z1, depth } = POOL;

  // Plage en travertin avec trou pour le bassin (ExtrudeGeometry)
  const sh = new THREE.Shape();
  sh.moveTo(DECK.x0, -DECK.z0); sh.lineTo(DECK.x1, -DECK.z0); sh.lineTo(DECK.x1, -DECK.z1); sh.lineTo(DECK.x0, -DECK.z1); sh.closePath();
  const hole = new THREE.Path();
  hole.moveTo(x0, -z0); hole.lineTo(x1, -z0); hole.lineTo(x1, -z1); hole.lineTo(x0, -z1); hole.closePath();
  sh.holes.push(hole);
  const deckGeo = new THREE.ExtrudeGeometry(sh, { depth: DECK.y + 0.05, bevelEnabled: false });
  deckGeo.rotateX(-Math.PI / 2);
  m.add(deckGeo, M.travertine, [0, -0.05, 0]);

  // Bassin : fond + parois carrelées (faces intérieures)
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const floorY = DECK.y - depth;
  m.box(w, 0.1, d, M.poolTiles, [cx, floorY - 0.05, cz]);
  m.box(0.1, depth, d, M.poolTiles, [x0 + 0.05, floorY + depth / 2, cz]);
  m.box(0.1, depth, d, M.poolTiles, [x1 - 0.05, floorY + depth / 2, cz]);
  m.box(w, depth, 0.1, M.poolTiles, [cx, floorY + depth / 2, z0 + 0.05]);
  m.box(w, depth, 0.1, M.poolTiles, [cx, floorY + depth / 2, z1 - 0.05]);
  // Marches d'accès dans l'angle sud-ouest
  for (let i = 0; i < 3; i++) {
    const top = DECK.y - 0.4 * (i + 1), h = top - floorY;
    m.box(1.8, h, 0.6, M.poolTiles, [x0 + 1.0, floorY + h / 2, z1 - 0.4 - i * 0.6]);
  }
  // Margelle en pierre claire (léger débord sur l'eau)
  const mg = 0.45, my = DECK.y + 0.035;
  m.box(w + 2 * mg, 0.07, mg, M.stone, [cx, my, z0 - mg / 2 + 0.05]);
  m.box(w + 2 * mg, 0.07, mg, M.stone, [cx, my, z1 + mg / 2 - 0.05]);
  m.box(mg, 0.07, d, M.stone, [x0 - mg / 2 + 0.05, my, cz]);
  m.box(mg, 0.07, d, M.stone, [x1 + mg / 2 - 0.05, my, cz]);

  // Douche extérieure + muret bas côté est
  m.box(0.08, 2.3, 0.08, M.chrome, [25.6, DECK.y + 1.15, -8.5]);
  m.add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 14), M.chrome, [25.3, DECK.y + 2.25, -8.5]);
  m.box(0.4, 0.4, 0.4, M.plaster, [25.6, DECK.y + 0.2, -8.5]);

  // Transats (2) et parasol, côté sud du bassin, orientés vers l'eau
  lounger(m, M, 15.5, 1.4);
  lounger(m, M, 17.6, 1.4);
  m.add(new THREE.CylinderGeometry(0.25, 0.22, 0.45, 12), M.teak, [16.55, DECK.y + 0.225, 1.6]);
  parasol(m, M, 19.6, 1.6);
  // Transat supplémentaire au nord + plante en pot
  lounger(m, M, 20.5, -9.0, Math.PI);
  m.add(new THREE.CylinderGeometry(0.4, 0.32, 0.8, 12), M.terracotta, [24.5, DECK.y + 0.4, 3.2]);
  m.add(new THREE.SphereGeometry(0.6, 10, 8), M.leafDark, [24.5, DECK.y + 1.3, 3.2]);
  m.add(new THREE.CylinderGeometry(0.4, 0.32, 0.8, 12), M.terracotta, [10.2, DECK.y + 0.4, -10]);
  m.add(new THREE.SphereGeometry(0.6, 10, 8), M.leafDark, [10.2, DECK.y + 1.3, -10]);

  m.build(g);

  // Eau animée
  const waterGeo = new THREE.PlaneGeometry(w - 0.2, d - 0.2, 72, 36);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uNight: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1cf) },
      uSkyColor: { value: new THREE.Color(0x9fc8f0) },
      uDeep: { value: new THREE.Color(0x0b7cb3) },
      uShallow: { value: new THREE.Color(0x4fd2ec) },
      uGlow: { value: new THREE.Color(0x1aa8e8) },
      ...THREE.UniformsLib.fog,
    },
    vertexShader: waterVert, fragmentShader: waterFrag, transparent: true, fog: true, depthWrite: false,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(cx, DECK.y + POOL.waterY, cz);
  water.renderOrder = 1;
  g.add(water);

  // Éclairage : projecteur immergé (bleu) + lampe d'ambiance de la plage
  const poolLight = nightLight(new THREE.PointLight(0x3fc8ff, 0, 18, 2), 70);
  poolLight.position.set(cx, floorY + 0.6, cz);
  g.add(poolLight);
  const deckLight = nightLight(new THREE.PointLight(0xffd9a0, 0, 20, 2), 18);
  deckLight.position.set(19.6, DECK.y + 2.0, 1.6);
  g.add(deckLight);

  R.updaters.push((dt, t, k, env) => {
    waterMat.uniforms.uTime.value = t;
    waterMat.uniforms.uNight.value = k;
    waterMat.uniforms.uSunDir.value.copy(env.sunDir);
    waterMat.uniforms.uSkyColor.value.copy(env.skyColor);
  });

  scene.add(g);
  return g;
}

/** Transat en teck : châssis, lattes, dossier incliné, coussin. Orienté vers -z (la piscine) par défaut. */
function lounger(m, M, x, z, yaw = 0) {
  const y = DECK.y;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const L = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  // ordre YXZ : inclinaison locale (X) puis orientation du transat (Y)
  const add = (geom, mat, lp, lrot = [0, 0, 0]) => m.add(geom, mat, L(...lp), [lrot[0], yaw + lrot[1], lrot[2], 'YXZ']);
  const tilt = -0.95; // dossier à ~54° de l'horizontale, vers +z
  // châssis
  add(box(0.06, 0.06, 1.95), M.teak, [-0.34, 0.33, 0]);
  add(box(0.06, 0.06, 1.95), M.teak, [0.34, 0.33, 0]);
  for (const lz of [-0.8, 0.8]) for (const lx of [-0.3, 0.3]) add(box(0.05, 0.3, 0.05), M.teak, [lx, 0.15, lz]);
  // lattes de l'assise (plates, partie avant vers -z)
  for (let i = 0; i < 9; i++) add(box(0.66, 0.025, 0.1), M.teak, [0, 0.37, -0.9 + i * 0.14]);
  // dossier incliné (arrière, vers +z)
  for (let i = 0; i < 5; i++) {
    const t = 0.07 + i * 0.14;
    add(box(0.66, 0.025, 0.1), M.teak, [0, 0.37 + t * Math.sin(0.95), 0.4 + t * Math.cos(0.95)], [tilt, 0, 0]);
  }
  // coussin
  add(box(0.6, 0.06, 1.2), M.cream, [0, 0.42, -0.3]);
  add(box(0.6, 0.06, 0.7), M.cream, [0, 0.42 + 0.35 * Math.sin(0.95), 0.4 + 0.35 * Math.cos(0.95)], [tilt, 0, 0]);
}

/** Parasol : mât, canopée conique à pans, baleines. */
function parasol(m, M, x, z) {
  const y = DECK.y;
  m.add(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8), M.alu, [x, y + 1.25, z]);
  m.add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), M.anthracite, [x, y + 0.04, z]);
  const canopy = new THREE.ConeGeometry(1.7, 0.5, 8, 1, true);
  m.add(canopy, M.cream, [x, y + 2.45, z]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const len = Math.hypot(1.7, 0.5);
    const ang = Math.atan2(0.5, 1.7);
    m.add(box(len, 0.025, 0.025), M.alu, [x + Math.cos(a) * 0.85, y + 2.45 - 0.0, z + Math.sin(a) * 0.85], [0, -a, -ang]);
  }
  m.add(new THREE.SphereGeometry(0.05, 8, 6), M.alu, [x, y + 2.72, z]);
}
