// Terrain : pelouse, route, allée pavée, cheminement, clôture et portail, bornes lumineuses.
import * as THREE from 'three';
import { Merger, box, uvScale } from './utils.js';
import { POOL } from './pool.js';
import { nightLight, nightEmissive } from './registry.js';

// Emprise de la propriété : 64 x 48 m (x ∈ [-32, 32], z ∈ [-24, 24]). La rue est au sud (z > 24).
export const LOT = { x0: -32, x1: 32, z0: -24, z1: 24 };

export function createTerrain(scene, M) {
  const g = new THREE.Group();
  g.name = 'terrain';

  // Grand plan de pelouse (déborde largement pour l'horizon), avec un trou sous le bassin de la piscine.
  const sh = new THREE.Shape();
  sh.moveTo(-250, 250); sh.lineTo(250, 250); sh.lineTo(250, -250); sh.lineTo(-250, -250); sh.closePath();
  const hole = new THREE.Path(); // coordonnées (x, -z)
  hole.moveTo(POOL.x0, -POOL.z0); hole.lineTo(POOL.x1, -POOL.z0); hole.lineTo(POOL.x1, -POOL.z1); hole.lineTo(POOL.x0, -POOL.z1); hole.closePath();
  sh.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(sh);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, M.grass);
  ground.receiveShadow = true;
  g.add(ground);

  const m = new Merger();

  // Rue au sud + trottoir + bordure.
  m.add(uvScale(new THREE.PlaneGeometry(220, 9), 220, 9), M.asphalt, [0, 0.01, 30.5], [-Math.PI / 2, 0, 0]);
  m.box(220, 0.14, 2.4, M.concrete, [0, 0.07, 25.2]);
  // Marquage central (émissif très léger pour rester visible de nuit)
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.9 });
  for (let x = -100; x < 100; x += 6) m.box(3, 0.005, 0.15, lineMat, [x, 0.02, 30.5]);

  // Allée carrossable (pavés) : du portail (z = 24) au garage (z = 2).
  m.box(7.2, 0.08, 22.4, M.pavers, [-14, 0.04, 13]);
  // Évasement devant le portail
  m.box(10, 0.08, 1.6, M.pavers, [-14, 0.04, 24.2]);
  // Bordures de l'allée
  m.box(0.2, 0.14, 22, M.stone, [-17.7, 0.07, 13]);
  m.box(0.2, 0.14, 22, M.stone, [-10.3, 0.07, 13]);

  // Cheminement piéton vers l'entrée (dalles travertin) : du bord de l'allée à la porte (x ≈ -5.75, z = 2).
  for (let i = 0; i < 5; i++) m.box(1.1, 0.08, 0.7, M.travertine, [-9.6 + i * 1.1, 0.04, 3.4]);
  m.box(1.6, 0.08, 1.4, M.travertine, [-5.75, 0.04, 2.9]);
  // Marche d'entrée
  m.box(2.4, 0.15, 0.6, M.stone, [-5.75, 0.075, 2.45]);

  // Clôture : muret bas + piliers + lisses métalliques, avec portail côté rue.
  buildFence(m, M);

  m.build(g);

  // Bornes lumineuses le long de l'allée (émissives + 1 vraie lumière).
  const bollardTop = nightEmissive(new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe2a8, roughness: 0.6 }), 2.5);
  const bm = new Merger();
  for (let z = 5; z <= 22; z += 4.2) {
    for (const x of [-18.2, -9.8]) {
      bm.box(0.14, 0.75, 0.14, M.anthracite, [x, 0.42, z]);
      bm.box(0.16, 0.12, 0.16, bollardTop, [x, 0.84, z]);
      bm.box(0.2, 0.03, 0.2, M.anthracite, [x, 0.92, z]);
    }
  }
  // Spots de jardin au pied des arbres (émissifs seulement).
  bm.build(g);

  const driveLight = nightLight(new THREE.PointLight(0xffd9a0, 0, 26, 2), 28);
  driveLight.position.set(-14, 2.2, 14);
  g.add(driveLight);

  scene.add(g);
  return g;
}

function buildFence(m, M) {
  const { x0, x1, z0, z1 } = LOT;
  const wallH = 0.6, pillarH = 1.7, step = 4;
  const gateA = -18.6, gateB = -9.4; // ouverture du portail (sud)

  const pillar = (x, z, h = pillarH) => {
    m.box(0.42, h, 0.42, M.plaster, [x, h / 2, z]);
    m.box(0.52, 0.08, 0.52, M.anthracite, [x, h + 0.04, z]);
  };
  const rails = (ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const rot = [0, Math.atan2(dx, dz), 0];
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    for (const y of [0.85, 1.15, 1.45]) m.add(box(0.05, 0.05, len), M.anthracite, [cx, y, cz], rot);
    // barreaux verticaux fins
    const n = Math.floor(len / 0.5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      m.box(0.03, 0.9, 0.03, M.anthracite, [ax + dx * t, 1.15, az + dz * t]);
    }
  };
  const run = (ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const rot = [0, Math.atan2(dx, dz), 0];
    m.add(box(0.3, wallH, len), M.plaster, [(ax + bx) / 2, wallH / 2, (az + bz) / 2], rot);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const px = ax + dx * i / n, pz = az + dz * i / n;
      pillar(px, pz);
      if (i < n) rails(px, pz, ax + dx * (i + 1) / n, az + dz * (i + 1) / n);
    }
  };

  run(x0, z0, x1, z0);       // nord
  run(x1, z0, x1, z1);       // est
  run(x0, z0, x0, z1);       // ouest
  run(x0, z1, gateA, z1);    // sud, à gauche du portail
  run(gateB, z1, x1, z1);    // sud, à droite du portail

  // Piliers du portail (plus hauts) + portail à deux vantaux ouverts.
  pillar(gateA, z1, 2.3); pillar(gateB, z1, 2.3);
  // Vantail articulé sur (px, z1), axe local +x tourné de `a` autour de Y : direction (cos a, 0, -sin a).
  const leaf = (px, dir) => {
    const w = (gateB - gateA) / 2 - 0.35;
    const a = dir === 1 ? 1.25 : Math.PI - 1.25;
    const ux = Math.cos(a), uz = -Math.sin(a);
    const rot = [0, a, 0];
    const cx = px + ux * w / 2, cz = z1 + uz * w / 2;
    for (const y of [0.3, 1.0, 1.7]) m.add(box(w, 0.08, 0.06), M.anthracite, [cx, y, cz], rot);
    const n = Math.floor(w / 0.16);
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * w;
      m.add(box(0.04, 1.75, 0.04), M.anthracite, [px + ux * t, 1.0, z1 + uz * t], rot);
    }
  };
  leaf(gateA + 0.3, 1);
  leaf(gateB - 0.3, -1);
}
