import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { L } from './config.js';
import { Batcher } from './utils.js';
import { addCollider, addFootprint } from './colliders.js';
import * as F from './furniture.js';

// Étage : suite parentale + salle de bain, salon-mezzanine face à la piscine, chambre d'amis,
// et mobilier du toit-terrasse.
export function buildUpstairs(group, M) {
  const b = new Batcher();
  const { FL1, ROOF } = L;
  const y = FL1 + 0.02, Y1 = FL1 + 1.6, PI = Math.PI;
  const at = (x, z, ry, fn, fp, yy = y) => {
    b.push(x, yy, z, ry); fn(); b.pop();
    if (fp) addFootprint(x, z, ry, fp[0], fp[1], FL1, Y1, 'meuble');
  };
  const solid = (mat, x0, x1, y0, y1, z0, z1) => { b.boxB(mat, x0, x1, y0, y1, z0, z1); addCollider(x0, x1, z0, z1, FL1, Math.max(y1, Y1), 'meuble'); };
  const wall = (x0, x1, z0, z1) => { b.boxB(M.stuccoInt, x0, x1, FL1, ROOF, z0, z1); addCollider(x0, x1, z0, z1, FL1, ROOF, 'cloison'); };

  /* --- Cloisons (avec baies de portes) --- */
  wall(-4.56, -4.44, -7.35, -2.3);
  wall(-4.56, -4.44, -1.3, -0.94);
  wall(-9.85, -6.5, -1.06, -0.94);
  wall(-5.7, -4.44, -1.06, -0.94);
  wall(-5.46, -5.34, -0.94, 3.05);
  wall(4.44, 4.56, -7.35, 0.6);
  wall(4.44, 4.56, 1.6, 3.05);

  /* --- Suite parentale --- */
  b.boxB(M.rug, -7.6, -4.6, y, y + 0.01, -5.8, -2.6, { cast: false });
  at(-5.6, -4.2, -PI / 2, () => F.bed(b, M, 1.9, 2.1), [2.2, 2.3]);
  at(-4.85, -5.45, -PI / 2, () => F.nightstand(b, M), [0.45, 0.5]);
  at(-4.85, -2.95, -PI / 2, () => F.nightstand(b, M), [0.45, 0.5]);
  solid(M.fabricDark, -7.15, -6.75, y, y + 0.45, -4.9, -3.5);
  at(-9.0, -6.3, 0.6, () => F.armchair(b, M), [0.9, 0.9]);
  solid(M.walnut, -9.6, -7.0, y, y + 2.6, -1.66, -1.06);
  for (const x of [-8.95, -8.3, -7.65]) b.boxB(M.brass, x, x + 0.02, y + 0.9, y + 1.5, -1.68, -1.66);
  F.painting(b, M, F.artMaterial(['#f1ebe0', '#1f4e5f', '#d58b5f', '#b9c7c4', '#e2c48a']), -4.57, y + 1.75, -4.2, 1.6, 0.9, 'x-');

  /* --- Salle de bain : douche à l'italienne, baignoire îlot, double vasque, WC suspendu --- */
  b.boxB(M.marble, -9.85, -5.46, y, y + 0.01, -0.94, 3.05, { cast: false });
  b.boxB(M.blackMatte, -9.85, -8.3, y + 0.01, y + 0.02, -0.94, 0.7, { cast: false });
  b.boxB(M.travertine, -9.85, -9.82, y, y + 2.4, -0.94, 0.7);
  b.boxB(M.travertine, -9.85, -8.3, y, y + 2.4, -0.94, -0.91);
  b.boxB(M.glassRail, -8.32, -8.3, y, y + 2.1, -0.94, 0.25, { cast: false, receive: false });
  b.boxB(M.steel, -8.33, -8.29, y + 2.1, y + 2.13, -0.94, 0.25);
  addCollider(-8.36, -8.26, -0.94, 0.25, FL1, Y1, 'vitre');
  b.boxB(M.steel, -9.82, -9.3, y + 2.2, y + 2.22, -0.14, -0.1);
  b.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), M.steel, [-9.2, y + 2.19, -0.12]);
  const tub = new RoundedBoxGeometry(1.8, 0.56, 0.84, 4, 0.18);
  b.mesh(tub, M.ceramic, [-8.6, y + 0.28, 2.18]);
  b.boxB(M.glassRail, -9.38, -7.82, y + 0.47, y + 0.48, 1.86, 2.5, { cast: false, receive: false });
  addCollider(-9.5, -7.7, 1.76, 2.6, FL1, Y1, 'baignoire');
  b.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8), M.steel, [-7.45, y + 0.47, 2.18]);
  b.boxB(M.steel, -7.6, -7.43, y + 0.93, y + 0.95, 2.17, 2.19);
  solid(M.walnut, -6.0, -5.46, y + 0.35, y + 0.82, -0.5, 1.3);
  b.boxB(M.marble, -6.05, -5.46, y + 0.82, y + 0.86, -0.55, 1.35);
  for (const z of [-0.05, 0.85]) {
    b.mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.12, 24), M.ceramic, [-5.78, y + 0.92, z]);
    b.boxB(M.steel, -5.56, -5.5, y + 0.86, y + 1.12, z - 0.015, z + 0.015);
    b.boxB(M.steel, -5.66, -5.5, y + 1.1, y + 1.12, z - 0.015, z + 0.015);
  }
  const mirror = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, metalness: 1, roughness: 0.03, envMapIntensity: 1.4 });
  b.boxB(mirror, -5.48, -5.46, y + 1.15, y + 2.05, -0.45, 1.25);
  b.boxB(M.ledStrip, -5.46, -5.45, y + 2.05, y + 2.07, -0.45, 1.25, { cast: false });
  b.mesh(new RoundedBoxGeometry(0.55, 0.36, 0.38, 3, 0.1), M.ceramic, [-5.75, y + 0.42, 2.45]);
  b.boxB(M.walnut, -5.46, -5.42, y, y + 1.1, 2.15, 2.75);
  addCollider(-6.05, -5.46, 2.2, 2.7, FL1, Y1, 'wc');
  for (const yy of [0.3, 0.7, 1.1, 1.5]) b.boxB(M.brass, -7.3, -6.7, y + yy, y + yy + 0.025, -0.85, -0.83);
  b.boxB(M.cushion, -7.25, -6.75, y + 0.75, y + 1.45, -0.86, -0.82);
  at(-9.45, 2.85, 0, () => F.indoorPlant(b, M, 1.2), [0.5, 0.5]);

  /* --- Salon d'étage face à la piscine --- */
  at(0, -4.3, PI, () => F.sofa(b, M, 2.8, { mat: M.fabricDark }), [2.8, 0.95]);
  at(0, -5.6, 0, () => F.coffeeTable(b, M, 1.2, 0.7), [1.2, 0.7]);
  at(2.3, -5.6, -PI / 2 - 0.3, () => F.armchair(b, M), [0.9, 0.9]);
  at(-3.4, -6.5, 0.5, () => F.indoorPlant(b, M, 1.6), [0.6, 0.6]);
  solid(M.walnut, 1.6, 4.3, y, y + 0.6, 2.62, 3.0);
  const bookCols = [M.cushionAccent, M.leather, M.linen, M.fabricDark, M.terracotta];
  for (let i = 0; i < 16; i++) {
    const x = 1.75 + i * 0.09 + (i > 8 ? 0.6 : 0);
    b.boxB(bookCols[i % 5], x, x + 0.07, y + 0.6, y + 0.82 + (i % 3) * 0.04, 2.7, 2.92);
  }
  F.painting(b, M, F.artMaterial(['#ece4d6', '#3d6c74', '#c2553a', '#e3c27f', '#20343c']), 4.43, y + 1.6, -2.8, 1.5, 1.0, 'x-');

  /* --- Chambre d'amis --- */
  at(5.6, -3.4, PI / 2, () => F.bed(b, M, 1.6, 2.0), [2.0, 2.1]);
  at(5.0, -4.75, PI / 2, () => F.nightstand(b, M), [0.45, 0.5]);
  at(5.0, -2.05, PI / 2, () => F.nightstand(b, M), [0.45, 0.5]);
  F.painting(b, M, F.artMaterial(['#f4efe6', '#7f9c8a', '#e0a671', '#2c4752']), 4.57, y + 1.7, -3.4, 1.3, 0.8, 'x+');
  solid(M.walnut, 6.0, 7.6, y + 0.74, y + 0.78, 2.4, 3.0);
  b.boxB(M.blackMetal, 6.05, 6.1, FL1, y + 0.74, 2.45, 2.95);
  b.boxB(M.blackMetal, 7.5, 7.55, FL1, y + 0.74, 2.45, 2.95);
  at(6.8, 1.95, PI, () => F.chair(b, M));
  solid(M.walnut, 9.6, 10.35, y, y + 2.5, 0.2, 2.9);

  /* --- Spots du plafond de l'étage --- */
  const spotGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 14);
  for (let x = -8.8; x < 10; x += 2.4) {
    for (const z of [-6.2, -3.2, 0.2, 2.4]) b.mesh(spotGeo, M.lampSpot, [x, ROOF - 0.007, z], [0, 0, 0], [1, 1, 1], { cast: false });
  }

  /* --- Toit-terrasse : bains de soleil + jardinière --- */
  const yt = FL1 + 0.04;
  at(-12.9, -3.2, PI, () => F.lounger(b, M), null, yt);
  at(-11.4, -3.2, PI, () => F.lounger(b, M), null, yt);
  at(-12.15, -3.9, 0, () => F.sideTable(b, M), null, yt);
  b.boxB(M.planter, -13.8, -10.4, FL1, FL1 + 0.5, 3.2, 3.85);
  const tuft = new THREE.IcosahedronGeometry(0.34, 1);
  for (let x = -13.5; x < -10.6; x += 0.5) b.mesh(tuft, M.box, [x, FL1 + 0.62, 3.52], [0, x * 3, 0], [1, 0.75, 0.9]);

  b.build(group, 'upstairs');
  return { update() {} };
}
