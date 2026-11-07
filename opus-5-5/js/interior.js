import * as THREE from 'three';
import { L } from './config.js';
import { Batcher } from './utils.js';
import { glassRail } from './villa.js';
import { addCollider, addFootprint } from './colliders.js';
import * as F from './furniture.js';
import { buildUpstairs } from './upstairs.js';

// Rez-de-chaussée : séjour, salle à manger, cuisine, escalier suspendu, éclairage.
export function buildInterior(scene, M) {
  const group = new THREE.Group();
  group.name = 'interior';
  scene.add(group);
  const b = new Batcher();
  const { FL0, FL1, SLAB, STAIR: S } = L;
  const ceil0 = FL1 - SLAB;
  const Y1 = FL0 + 1.6; // hauteur des collisions du mobilier
  const at = (x, z, ry, fn, fp) => {
    b.push(x, FL0, z, ry); fn(); b.pop();
    if (fp) addFootprint(x, z, ry, fp[0], fp[1], FL0, Y1, 'meuble');
  };
  const PI = Math.PI;

  /* --- Séjour : mur de cheminée en noyer, foyer linéaire, tableau --- */
  b.boxB(M.walnut, -13.85, -13.7, FL0, ceil0, -1.6, 2.6);
  b.boxB(M.travertine, -13.85, -13.25, FL0, FL0 + 0.32, -1.6, 2.6);
  addCollider(-13.85, -13.25, -1.6, 2.6, FL0, Y1);
  b.boxB(M.blackMatte, -13.72, -13.6, FL0 + 0.55, FL0 + 1.05, -0.5, 1.7);
  b.boxB(M.fire, -13.62, -13.58, FL0 + 0.6, FL0 + 0.74, -0.4, 1.6, { cast: false });
  F.painting(b, M, F.artMaterial(['#e9e1d3', '#c4693f', '#2f5d6b', '#d9b26a', '#86a39a']), -13.66, 2.35, 0.55, 1.9, 1.15, 'x+');
  b.boxB(M.rug, -12.7, -8.7, FL0, FL0 + 0.012, -1.6, 2.6, { cast: false });
  at(-8.9, 0.5, -PI / 2, () => F.sofa(b, M, 3.3), [3.3, 0.95]);
  at(-11.0, 0.5, 0, () => F.coffeeTable(b, M, 1.5, 0.85), [1.5, 0.85]);
  at(-11.4, -1.25, 0.25, () => F.armchair(b, M), [0.85, 0.85]);
  at(-11.4, 2.3, PI - 0.25, () => F.armchair(b, M), [0.85, 0.85]);
  at(-13.2, -5.2, 0, () => F.indoorPlant(b, M, 1.9), [0.6, 0.6]);
  at(-7.3, -5.3, 0, () => F.indoorPlant(b, M, 1.5), [0.6, 0.6]);
  // Console d'entrée + tableau
  b.boxB(M.walnut, -9.6, -7.6, FL0 + 0.7, FL0 + 0.78, 3.4, 3.8);
  b.boxB(M.blackMetal, -9.55, -9.5, FL0, FL0 + 0.7, 3.45, 3.75);
  b.boxB(M.blackMetal, -7.7, -7.65, FL0, FL0 + 0.7, 3.45, 3.75);
  addCollider(-9.6, -7.6, 3.4, 3.85, FL0, Y1);
  for (let i = 0; i < 3; i++) b.mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.22 + i * 0.08, 14), M.ceramic, [-9.2 + i * 0.22, FL0 + 0.89 + i * 0.04, 3.6]);

  /* --- Salle à manger --- */
  at(-3.0, -3.3, 0, () => F.diningTable(b, M, 2.8, 1.05), [3.0, 2.0]);
  for (const x of [-3.9, -3.0, -2.1]) {
    at(x, -2.55, PI, () => F.chair(b, M));
    at(x, -4.05, 0, () => F.chair(b, M));
  }
  at(-4.75, -3.3, PI / 2, () => F.chair(b, M));
  at(-1.25, -3.3, -PI / 2, () => F.chair(b, M));
  for (const x of [-3.9, -3.0, -2.1]) { b.push(x, 0, -3.3); F.pendant(b, M, ceil0, FL0 + 1.95); b.pop(); }
  for (let i = 0; i < 3; i++) b.mesh(new THREE.SphereGeometry(0.05, 12, 8), M.terracotta, [-3.1 + i * 0.09, FL0 + 0.82, -3.3 + (i % 2) * 0.07]);
  b.mesh(new THREE.CylinderGeometry(0.17, 0.1, 0.08, 20), M.ceramic, [-3.0, FL0 + 0.79, -3.3]);

  /* --- Cuisine : îlot marbre avec plaque et hotte, colonnes, évier sous fenêtre --- */
  b.boxB(M.walnut, 1.5, 4.5, FL0, FL0 + 0.88, -2.15, -1.25);
  b.boxB(M.marble, 1.3, 4.7, FL0 + 0.88, FL0 + 0.92, -2.25, -1.0);
  addCollider(1.3, 4.7, -2.25, -1.0, FL0, Y1);
  b.boxB(M.screen, 3.4, 4.2, FL0 + 0.92, FL0 + 0.925, -2.0, -1.45, { cast: false });
  b.boxB(M.steel, 3.35, 4.25, FL0 + 2.0, FL0 + 2.4, -2.05, -1.4);
  b.boxB(M.steel, 3.75, 3.85, FL0 + 2.4, ceil0, -1.78, -1.68);
  for (const x of [2.0, 3.0, 4.0]) { b.push(x, FL0, -0.62); F.stool(b, M); b.pop(); }
  for (const x of [1.9, 2.6]) { b.push(x, 0, -1.7); F.pendant(b, M, ceil0, FL0 + 1.85, 0.12); b.pop(); }
  b.boxB(M.walnut, 5.2, 5.85, FL0, FL0 + 2.5, -5.2, -1.4);
  addCollider(5.2, 5.85, -5.2, 3.85, FL0, Y1);
  for (const z of [-4.9, -3.6, -2.3]) b.boxB(M.steel, 5.17, 5.2, FL0 + 0.9, FL0 + 1.9, z, z + 0.03);
  b.boxB(M.blackMatte, 5.18, 5.2, FL0 + 1.0, FL0 + 1.55, -3.4, -2.6);
  b.boxB(M.walnut, 5.25, 5.85, FL0, FL0 + 0.88, -1.4, 3.85);
  b.boxB(M.marble, 5.15, 5.85, FL0 + 0.88, FL0 + 0.92, -1.4, 3.85);
  b.boxB(M.walnut, 1.4, 5.25, FL0, FL0 + 0.88, 3.25, 3.85);
  b.boxB(M.marble, 1.4, 5.25, FL0 + 0.88, FL0 + 0.92, 3.15, 3.85);
  addCollider(1.4, 5.85, 3.15, 3.85, FL0, Y1);
  b.boxB(M.steel, 2.9, 3.6, FL0 + 0.905, FL0 + 0.925, 3.3, 3.7);
  const spout = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(3.25, FL0 + 0.92, 3.75), new THREE.Vector3(3.25, FL0 + 1.35, 3.75), new THREE.Vector3(3.25, FL0 + 1.25, 3.45)), 12, 0.014, 8);
  b.add(spout, M.steel);
  for (let i = 0; i < 4; i++) b.mesh(new THREE.SphereGeometry(0.045, 10, 8), M.terracotta, [2.3 + (i % 2) * 0.08, FL0 + 0.97, -1.6 + Math.floor(i / 2) * 0.08]);

  /* --- Spots encastrés du plafond --- */
  const spotGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 14);
  const inVoid = (x, z) => x > -5.3 && x < -0.5 && z > 1.6 && z < 3.3;
  for (let x = -12.6; x < 5.5; x += 2.3) {
    for (const z of [-4.6, -1.6, 1.4, 3.1]) if (!inVoid(x, z)) b.mesh(spotGeo, M.lampSpot, [x, ceil0 - 0.007, z], [0, 0, 0], [1, 1, 1], { cast: false });
  }

  /* --- Escalier suspendu : marches chêne sur limon central acier --- */
  const n = S.steps, rise = (FL1 - FL0) / n, run = (S.x1 - S.x0) / (n - 1);
  const zc = (S.z0 + S.z1) / 2;
  for (let i = 0; i < n - 1; i++) {
    b.box(M.oak, run + 0.03, 0.06, S.z1 - S.z0, S.x0 + run * (i + 0.5), FL0 + rise * (i + 1) - 0.03, zc);
  }
  const ang = Math.atan2(FL1 - FL0, S.x1 - S.x0), len = Math.hypot(FL1 - FL0, S.x1 - S.x0);
  b.push((S.x0 + S.x1) / 2, (FL0 + FL1) / 2 - 0.12, zc, 0, 0, ang);
  b.box(M.blackMetal, len, 0.24, 0.14, 0, 0, 0);
  b.box(M.glassRail, len, 0.95, 0.02, 0, 0.62, S.z0 - zc + 0.02, 0, { cast: false, receive: false });
  b.box(M.steel, len, 0.04, 0.05, 0, 1.11, S.z0 - zc + 0.02);
  b.pop();
  glassRail(b, M, 'x', 1.72, -5.2, -0.62, FL1 + 0.02);
  glassRail(b, M, 'z', -5.22, 1.72, 3.05, FL1 + 0.02);
  // Au RDC, l'escalier ne s'aborde que par sa première marche.
  const G1 = FL1 - 0.4;
  addCollider(S.x0 + 0.5, S.x1 + 0.06, S.z0 - 0.06, S.z0, FL0, G1, 'escalier');
  addCollider(S.x0 + 0.5, S.x1 + 0.06, S.z1, S.z1 + 0.06, FL0, G1, 'escalier');
  addCollider(S.x1, S.x1 + 0.06, S.z0, S.z1, FL0, G1, 'escalier');

  b.build(group, 'interior');
  const up = buildUpstairs(group, M);

  /* --- Lumières intérieures chaudes (sans ombres pour rester fluide) --- */
  const lights = [
    [new THREE.PointLight(0xffc98f, 0, 13, 2), [-10.2, 2.9, 0.4], 14],
    [new THREE.PointLight(0xffc98f, 0, 14, 2), [-0.5, 2.9, -2.4], 16],
    [new THREE.PointLight(0xffc98f, 0, 16, 2), [-2.0, 6.4, -3.8], 16],
  ];
  for (const [l, p] of lights) {
    l.position.set(...p);
    group.add(l);
  }
  return {
    update(state) {
      for (const [l, , i] of lights) l.intensity = i * state.lights;
      up.update(state);
    },
  };
}
