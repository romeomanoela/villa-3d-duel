// Intérieur & mobilier simplifié : séjour, cuisine, salle à manger, escalier, chambres, garage, terrasses.
import * as THREE from 'three';
import { Batcher, rng } from './utils.js';
import { F0, F1, CEIL0, GARAGE } from './config.js';
import { STAIR, STAIR_HOLE } from './villa.js';

/** Repère local : permet de décrire un meuble une fois et de le poser (x, y, z, rotation Y). */
export class Local {
  constructor(batcher) {
    this.b = batcher;
    this.m = new THREE.Matrix4();
  }
  at(x, y, z, ry = 0) {
    this.m.makeRotationY(ry);
    this.m.setPosition(x, y, z);
    return this;
  }
  box(mat, x0, x1, y0, y1, z0, z1) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.applyMatrix4(this.m);
    this.b._push(mat, g);
    return this;
  }
  cyl(mat, x, y, z, rT, rB, h, seg = 14) {
    const g = new THREE.CylinderGeometry(rT, rB, h, seg);
    g.translate(x, y + h / 2, z);
    g.applyMatrix4(this.m);
    this.b._push(mat, g);
    return this;
  }
  sph(mat, x, y, z, r, sx = 1, sy = 1, sz = 1, seg = 12) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    g.applyMatrix4(this.m);
    this.b._push(mat, g);
    return this;
  }
  /** boîte tournée localement autour de Z (rampe, dossier incliné) */
  tilt(mat, cx, cy, cz, w, h, d, rz = 0, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(cx, cy, cz);
    g.applyMatrix4(this.m);
    this.b._push(mat, g);
    return this;
  }
}

export function buildInterior(ctx) {
  const { scene, M, ambience } = ctx;
  const group = new THREE.Group();
  group.name = 'interior';
  scene.add(group);

  const I = new Batcher(); // mobilier
  const IG = new Batcher(); // verre (garde-corps d'escalier)
  const L = new Local(I);
  const R = rng(321);

  const plantMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3c, roughness: 0.8, name: 'plante-intérieur', side: THREE.DoubleSide });
  const plantMat2 = new THREE.MeshStandardMaterial({ color: 0x59904a, roughness: 0.8, name: 'plante-2', side: THREE.DoubleSide });
  const potMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.6, name: 'pot-blanc' });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.6, name: 'marquage-garage' });
  const chrome = M.steel;

  /* ---------------------------- éléments réutilisables ---------------------------- */
  function plant(x, y, z, h = 1.3, pot = potMat) {
    L.at(x, y, z, 0);
    L.cyl(pot, 0, 0, 0, 0.2, 0.15, 0.42, 12);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + R();
      const t = new THREE.ConeGeometry(0.13, h * (0.55 + R() * 0.45), 5);
      t.scale(1, 1, 0.35);
      t.rotateX(0.45 + R() * 0.25);
      t.rotateY(a);
      t.translate(0, 0.42 + h * 0.28, 0);
      t.translate(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04);
      t.translate(x, y, z);
      I._push(i % 2 ? plantMat : plantMat2, t);
    }
  }

  function chair(x, y, z, ry, mat = M.walnut, seatMat = M.sofa) {
    L.at(x, y, z, ry);
    L.box(seatMat, -0.22, 0.22, 0.42, 0.49, -0.22, 0.22);
    L.box(mat, -0.22, 0.22, 0.49, 0.52, -0.22, 0.22);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(M.blackMetal, sx * 0.19 - 0.015, sx * 0.19 + 0.015, 0, 0.42, sz * 0.19 - 0.015, sz * 0.19 + 0.015);
    L.tilt(seatMat, 0, 0.78, -0.23, 0.42, 0.42, 0.05, 0, -0.12);
  }

  function sofa(x, y, z, ry, w = 3.4, mat = M.sofa, arm = true) {
    L.at(x, y, z, ry);
    const hw = w / 2;
    L.box(M.blackMetal, -hw + 0.05, hw - 0.05, 0, 0.1, -0.42, 0.42);
    L.box(mat, -hw, hw, 0.1, 0.34, -0.45, 0.45);
    const n = Math.max(2, Math.round(w / 0.95));
    for (let i = 0; i < n; i++) {
      const x0 = -hw + 0.08 + ((w - 0.16) * i) / n, x1 = -hw + 0.08 + ((w - 0.16) * (i + 1)) / n - 0.02;
      L.box(mat, x0, x1, 0.34, 0.5, -0.38, 0.42);
      L.tilt(mat, (x0 + x1) / 2, 0.72, -0.4, x1 - x0, 0.46, 0.2, 0, -0.14);
    }
    if (arm) {
      L.box(mat, -hw, -hw + 0.18, 0.1, 0.66, -0.45, 0.45);
      L.box(mat, hw - 0.18, hw, 0.1, 0.66, -0.45, 0.45);
    }
    L.box(M.cushionTeal, -hw + 0.3, -hw + 0.7, 0.5, 0.88, -0.2, 0.0);
    L.box(M.cushionOchre, hw - 0.7, hw - 0.3, 0.5, 0.88, -0.2, 0.0);
  }

  function armchair(x, y, z, ry, mat = M.sofaDark) {
    L.at(x, y, z, ry);
    L.box(M.blackMetal, -0.4, 0.4, 0, 0.14, -0.4, 0.4);
    L.box(mat, -0.45, 0.45, 0.14, 0.4, -0.45, 0.45);
    L.box(mat, -0.4, 0.4, 0.4, 0.52, -0.38, 0.42);
    L.tilt(mat, 0, 0.78, -0.4, 0.9, 0.55, 0.16, 0, -0.18);
    L.box(mat, -0.45, -0.3, 0.14, 0.62, -0.45, 0.45);
    L.box(mat, 0.3, 0.45, 0.14, 0.62, -0.45, 0.45);
  }

  function table(x, y, z, ry, w, d, h = 0.74, top = M.walnut, legs = M.blackMetal) {
    L.at(x, y, z, ry);
    L.box(top, -w / 2, w / 2, h - 0.05, h, -d / 2, d / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(legs, sx * (w / 2 - 0.08) - 0.03, sx * (w / 2 - 0.08) + 0.03, 0, h - 0.05, sz * (d / 2 - 0.08) - 0.03, sz * (d / 2 - 0.08) + 0.03);
  }

  function bed(x, y, z, ry, w = 2.0, len = 2.15, duvet = M.cushionTeal) {
    L.at(x, y, z, ry); // tête de lit côté -z local ; pieds vers +z
    L.box(M.walnut, -w / 2 - 0.08, w / 2 + 0.08, 0.08, 0.36, -len / 2, len / 2 + 0.08);
    L.box(M.linen, -w / 2, w / 2, 0.36, 0.62, -len / 2 + 0.05, len / 2);
    L.box(duvet, -w / 2 - 0.03, w / 2 + 0.03, 0.62, 0.69, -len / 2 + 0.7, len / 2 + 0.03);
    L.box(M.walnut, -w / 2 - 0.15, w / 2 + 0.15, 0.1, 1.28, -len / 2 - 0.1, -len / 2);
    L.box(M.linen, -w / 2 + 0.1, -0.05, 0.62, 0.78, -len / 2 + 0.1, -len / 2 + 0.55);
    L.box(M.linen, 0.05, w / 2 - 0.1, 0.62, 0.78, -len / 2 + 0.1, -len / 2 + 0.55);
    // chevets + lampes
    for (const s of [-1, 1]) {
      const cx = s * (w / 2 + 0.55);
      L.box(M.walnut, cx - 0.25, cx + 0.25, 0.04, 0.5, -len / 2 + 0.0, -len / 2 + 0.5);
      L.cyl(M.lampWarm, cx, 0.5, -len / 2 + 0.25, 0.1, 0.13, 0.22, 12);
    }
  }

  function bookcase(x0, x1, z, y, h, depth = 0.35, dirSign = 1) {
    const n = Math.round(h / 0.38);
    I.box(M.walnut, x0, x0 + 0.03, y, y + h, z, z + dirSign * depth);
    I.box(M.walnut, x1 - 0.03, x1, y, y + h, z, z + dirSign * depth);
    I.box(M.walnut, x0, x1, y, y + h, z, z + dirSign * 0.02);
    for (let i = 0; i <= n; i++) {
      const yy = y + (h * i) / n;
      I.box(M.walnut, x0, x1, yy - 0.015, yy + 0.015, z, z + dirSign * depth);
      if (i < n && R() < 0.85) {
        let xx = x0 + 0.06;
        while (xx < x1 - 0.25) {
          const bw = 0.03 + R() * 0.05, bh = 0.2 + R() * 0.14;
          I.box(R() < 0.5 ? M.book : R() < 0.5 ? M.cushionRust : M.paper, xx, xx + bw, yy + 0.02, yy + 0.02 + bh, z + dirSign * 0.04, z + dirSign * (depth - 0.06));
          xx += bw + 0.005 + (R() < 0.12 ? 0.25 : 0);
        }
      }
    }
  }

  function pendant(x, y, z, h = 1.0, r = 0.22) {
    I.box(M.blackMetal, x - 0.006, x + 0.006, y, y + h, z - 0.006, z + 0.006);
    I.sphere(M.lampWarm, x, y - 0.02, z, r, 14, 10, 1, 0.8, 1);
  }

  /* =============================== RDC : séjour =============================== */
  // tapis & salon
  I.box(M.rug, -15.4, -9.4, F0, F0 + 0.012, -6.0, -0.4);
  sofa(-12.4, F0, -4.9, 0, 3.8);
  sofa(-15.9, F0, -2.2, Math.PI / 2, 2.2, M.sofa, true);
  armchair(-9.3, F0, -2.4, -Math.PI / 2 - 0.35);
  table(-12.4, F0, -2.5, 0, 1.5, 0.8, 0.36, M.walnut);
  I.cyl(M.ceramic, -12.2, F0 + 0.36, -2.4, 0.07, 0.1, 0.24, 12);
  I.box(M.book, -12.9, -12.5, F0 + 0.36, F0 + 0.4, -2.7, -2.35);
  I.box(M.cushionRust, -12.84, -12.55, F0 + 0.4, F0 + 0.43, -2.65, -2.4);
  // cheminée linéaire + écran (mur ouest)
  I.box(M.concreteDark, -16.75, -16.4, F0, F0 + 0.55, -6.2, -1.2);
  I.box(M.blackMetal, -16.75, -16.45, F0 + 0.55, F0 + 1.2, -6.2, -1.2);
  I.box(M.fire, -16.6, -16.5, F0 + 0.62, F0 + 0.72, -5.7, -1.7);
  I.box(M.screen, -16.74, -16.68, F0 + 1.5, F0 + 2.35, -5.2, -2.2);
  // bibliothèque et lampadaire
  bookcase(-16.7, -11.8, -9.75, F0, 2.7, 0.4, 1);
  I.cyl(M.blackMetal, -9.1, F0, -5.5, 0.015, 0.015, 1.7, 6);
  I.cyl(M.blackMetal, -9.1, F0, -5.5, 0.18, 0.18, 0.02, 12);
  I.sphere(M.lampWarm, -9.1, F0 + 1.75, -5.5, 0.22, 14, 10, 1, 0.8, 1);
  plant(-16.2, F0, -9.0, 1.7);
  plant(-8.2, F0, 0.9, 1.4);
  plant(-16.3, F0, 0.7, 1.5);

  /* =============================== RDC : cuisine =============================== */
  I.box(M.cabinet, -10.5, -4.8, F0, F0 + 0.88, -9.75, -9.1);
  I.box(M.counter, -10.55, -4.75, F0 + 0.88, F0 + 0.92, -9.75, -9.05);
  I.box(M.cabinet, -10.5, -9.7, F0 + 0.95, F0 + 2.2, -9.75, -9.35);
  I.box(M.steel, -11.7, -10.55, F0, F0 + 2.25, -9.75, -9.1); // grand frigo inox
  I.box(M.blackMetal, -8.1, -6.2, F0 + 0.92, F0 + 0.95, -9.55, -9.2); // plaque
  I.box(M.steel, -8.4, -5.9, F0 + 2.0, F0 + 2.18, -9.75, -9.35); // hotte
  // îlot
  I.box(M.cabinet, -9.6, -5.9, F0, F0 + 0.88, -7.1, -5.9);
  I.box(M.counter, -9.7, -5.8, F0 + 0.88, F0 + 0.93, -7.15, -5.65);
  for (let i = 0; i < 4; i++) {
    const sx = -9.0 + i * 0.95;
    I.cyl(M.leather, sx, F0 + 0.58, -5.15, 0.19, 0.19, 0.06, 14);
    I.cyl(M.blackMetal, sx, F0, -5.15, 0.02, 0.02, 0.58, 6);
    I.cyl(M.blackMetal, sx, F0, -5.15, 0.15, 0.15, 0.02, 12);
  }
  for (const px of [-8.7, -7.75, -6.8]) pendant(px, F0 + 2.0, -6.5, 1.0, 0.2);
  I.cyl(M.ceramic, -8.0, F0 + 0.93, -6.5, 0.12, 0.09, 0.2, 10);
  I.box(M.cushionOchre, -7.2, -6.9, F0 + 0.93, F0 + 0.97, -6.4, -6.1);

  /* =============================== RDC : salle à manger =============================== */
  I.box(M.rug, -3.9, 0.8, F0, F0 + 0.012, -5.5, -1.4);
  table(-1.5, F0, -3.5, 0, 3.0, 1.1, 0.75, M.walnut);
  for (let i = 0; i < 3; i++) {
    const cx = -2.4 + i * 0.9;
    chair(cx, F0, -4.35, 0, M.walnut, M.sofaDark);
    chair(cx, F0, -2.65, Math.PI, M.walnut, M.sofaDark);
  }
  chair(-3.2, F0, -3.5, Math.PI / 2, M.walnut, M.sofaDark);
  chair(0.2, F0, -3.5, -Math.PI / 2, M.walnut, M.sofaDark);
  I.box(M.ledStrip, -2.7, -0.3, F0 + 2.55, F0 + 2.6, -3.62, -3.38); // suspension linéaire
  I.box(M.blackMetal, -2.62, -2.58, F0 + 2.6, CEIL0 - 0.04, -3.51, -3.49);
  I.box(M.blackMetal, -0.42, -0.38, F0 + 2.6, CEIL0 - 0.04, -3.51, -3.49);
  I.cyl(M.ceramic, -1.5, F0 + 0.75, -3.5, 0.13, 0.09, 0.28, 12);
  plant(-3.6, F0, -0.4, 1.5);
  // hall : console, miroir, banc
  I.box(M.walnut, 4.4, 5.4, F0 + 0.7, F0 + 0.76, -9.65, -9.25);
  I.box(M.blackMetal, 4.45, 4.5, F0, F0 + 0.7, -9.6, -9.55);
  I.box(M.blackMetal, 5.3, 5.35, F0, F0 + 0.7, -9.6, -9.55);
  I.box(M.steel, 4.5, 5.3, F0 + 0.95, F0 + 2.1, -9.72, -9.69);
  I.cyl(M.ceramic, 4.9, F0 + 0.76, -9.45, 0.07, 0.1, 0.3, 10);
  I.box(M.rug, 4.2, 6.7, F0, F0 + 0.012, -2.5, 1.2);
  I.box(M.leather, 6.1, 6.8, F0, F0 + 0.4, -6.8, -5.5);
  plant(6.4, F0, 0.9, 1.6);

  /* =============================== Escalier =============================== */
  for (let i = 1; i < STAIR.count; i++) {
    const xc = STAIR.xBottom - STAIR.run * (i - 0.5);
    const top = F0 + STAIR.rise * i;
    I.box(M.walnut, xc - 0.16, xc + 0.16, top - 0.07, top, STAIR.z0, STAIR.z1);
  }
  const sLen = Math.hypot(STAIR.run * 19, STAIR.rise * 19);
  const sAng = Math.atan2(STAIR.rise * 19, STAIR.run * 19);
  const sxm = STAIR.xBottom - (STAIR.run * 19) / 2 - 0.02, sym = F0 + (STAIR.rise * 19) / 2 - 0.1;
  L.at(0, 0, 0, 0);
  L.tilt(M.blackMetal, sxm, sym, STAIR.z1 + 0.02, sLen + 0.2, 0.2, 0.04, -sAng);
  L.tilt(M.steel, sxm, sym + 1.0, STAIR.z1 + 0.02, sLen + 0.2, 0.04, 0.05, -sAng);
  for (let i = 2; i < STAIR.count; i += 2) {
    const xc = STAIR.xBottom - STAIR.run * (i - 0.5);
    const top = F0 + STAIR.rise * i;
    I.box(M.steel, xc - 0.012, xc + 0.012, top, top + 1.0, STAIR.z1 + 0.0, STAIR.z1 + 0.04);
  }
  // verre de la rampe (parallélogramme approximé par des lames étroites)
  for (let i = 1; i < STAIR.count - 1; i++) {
    const xc = STAIR.xBottom - STAIR.run * (i - 0.5);
    const top = F0 + STAIR.rise * i;
    IG.box(M.glass, xc - STAIR.run / 2, xc + STAIR.run / 2, top, top + 0.98, STAIR.z1 + 0.02, STAIR.z1 + 0.03);
  }
  // garde-corps de la trémie à l'étage
  const h0 = STAIR_HOLE;
  IG.plane(M.glass, 'z', h0[3] + 0.04, h0[0], h0[1], F1 + 0.05, F1 + 1.05);
  IG.plane(M.glass, 'x', h0[1] + 0.04, h0[2] + 0.2, h0[3], F1 + 0.05, F1 + 1.05);
  I.box(M.steel, h0[0], h0[1], F1 + 1.05, F1 + 1.09, h0[3] + 0.02, h0[3] + 0.07);
  I.box(M.steel, h0[1] + 0.02, h0[1] + 0.07, F1 + 1.05, F1 + 1.09, h0[2] + 0.2, h0[3] + 0.07);
  IG.plane(M.glass, 'z', h0[2] - 0.03, h0[0], h0[1], F1 + 0.05, F1 + 1.05); // côté mur : la trémie est protégée sur trois côtés
  I.box(M.steel, h0[0], h0[1], F1 + 1.05, F1 + 1.09, h0[2] - 0.06, h0[2] - 0.0);

  /* =============================== Étage =============================== */
  // chambre parentale
  I.box(M.rug, -12.6, -6.9, F1 + 0.03, F1 + 0.045, -10.2, -5.6);
  bed(-9.8, F1 + 0.03, -9.4, 0, 2.0, 2.2, M.cushionTeal);
  I.box(M.leather, -11.1, -8.5, F1 + 0.03, F1 + 0.45, -7.0, -6.5); // banquette
  armchair(-12.7, F1 + 0.03, -4.4, Math.PI / 2 - 0.4, M.sofa);
  table(-12.2, F1 + 0.03, -3.4, 0, 0.6, 0.6, 0.5, M.walnut);
  I.box(M.walnut, -6.7, -6.3, F1 + 0.03, F1 + 2.4, -10.5, -6.5); // dressing
  I.cyl(M.blackMetal, -13.2, F1 + 0.03, -2.6, 0.015, 0.015, 1.6, 6);
  I.sphere(M.lampWarm, -13.2, F1 + 1.7, -2.6, 0.2, 12, 9, 1, 0.8, 1);
  plant(-7.3, F1 + 0.03, -1.0, 1.4);
  // palier / salon haut
  I.box(M.rug, -5.6, -1.4, F1 + 0.03, F1 + 0.045, -6.7, -1.9);
  sofa(-3.4, F1 + 0.03, -2.6, Math.PI, 3.2, M.sofaDark);
  sofa(-5.9, F1 + 0.03, -5.2, Math.PI / 2, 2.0, M.sofaDark);
  table(-3.4, F1 + 0.03, -4.6, 0, 1.3, 0.8, 0.34, M.walnut);
  I.box(M.screen, -6.4, -6.35, F1 + 1.2, F1 + 2.0, -5.9, -3.7); // petit écran (sur cloison)
  plant(0.2, F1 + 0.03, -1.0, 1.5);
  bookcase(-5.2, -2.0, -10.72, F1 + 0.03, 2.4, 0.3, 1);
  // chambre 2
  I.box(M.rug, 1.8, 5.8, F1 + 0.03, F1 + 0.045, -9.6, -5.6);
  bed(3.9, F1 + 0.03, -9.4, 0, 1.6, 2.1, M.cushionOchre);
  table(5.9, F1 + 0.03, -3.3, -Math.PI / 2, 1.5, 0.7, 0.74, M.walnut);
  chair(5.2, F1 + 0.03, -3.3, Math.PI / 2, M.walnut, M.sofa);
  I.box(M.walnut, 1.15, 1.55, F1 + 0.03, F1 + 2.3, -9.8, -6.0);
  plant(1.8, F1 + 0.03, 0.9, 1.3);

  /* =============================== Garage =============================== */
  // atelier : étagères & meubles côté nord / fond
  I.box(M.blackMetal, 7.2, 7.65, F0, F0 + 2.2, -9.7, -5.0);
  for (let i = 0; i < 5; i++) I.box(M.steel, 7.2, 7.65, F0 + 0.4 + i * 0.45, F0 + 0.44 + i * 0.45, -9.7, -5.0);
  for (let i = 0; i < 10; i++) I.box(i % 3 ? M.cushionRust : M.book, 7.3, 7.6, F0 + 0.44 + (i % 4) * 0.45, F0 + 0.74 + (i % 4) * 0.45, -9.5 + (i % 5) * 0.8, -9.1 + (i % 5) * 0.8);
  I.box(M.cabinet, 7.2, 7.8, F0, F0 + 0.9, -4.8, -3.6);
  I.box(M.steel, 7.2, 7.85, F0 + 0.9, F0 + 0.94, -4.85, -3.55);
  // jeu de pneus et vélo
  for (let i = 0; i < 3; i++) I.cyl(M.rubber, 8.4, F0 + i * 0.24, -9.2, 0.33, 0.33, 0.22, 16);
  I.box(M.cushionRust, 12.4, 13.4, F0, F0 + 0.7, -9.7, -9.3);
  I.box(M.steel, 12.4, 13.4, F0 + 0.7, F0 + 0.74, -9.7, -9.3);
  // borne de recharge murale (voyant vert)
  const evLed = new THREE.MeshStandardMaterial({ color: 0x0a2a14, emissive: 0x2dff7a, emissiveIntensity: 1.2, name: 'voyant' });
  I.box(M.render, 15.7, 16.0, F0 + 1.0, F0 + 1.55, 0.8, 1.35);
  I.box(evLed, 15.68, 15.7, F0 + 1.4, F0 + 1.46, 0.95, 1.2);
  // marquage des places
  for (const z of GARAGE.carZ) {
    I.box(lineMat, 8.2, 14.9, F0, F0 + 0.006, z - 1.2, z - 1.17);
    I.box(lineMat, 8.2, 14.9, F0, F0 + 0.006, z + 1.17, z + 1.2);
  }

  /* =============================== Terrasses =============================== */
  // terrasse couverte (rez-de-chaussée) : salon d'extérieur + table de repas
  I.box(M.rug, -3.6, 1.4, 0.335, 0.348, 2.55, 4.9);
  sofa(-1.1, 0.345, 4.4, Math.PI, 3.2, M.sofa);
  armchair(-3.0, 0.345, 3.1, Math.PI / 2 + 0.3, M.sofa);
  armchair(0.9, 0.345, 3.1, -Math.PI / 2 - 0.3, M.sofa);
  table(-1.1, 0.345, 3.2, 0, 1.3, 0.8, 0.36, M.walnut);
  table(-11.5, 0.345, 3.9, 0, 2.8, 1.0, 0.75, M.walnut);
  for (let i = 0; i < 3; i++) {
    chair(-12.4 + i * 0.9, 0.345, 3.1, 0, M.walnut, M.linen);
    chair(-12.4 + i * 0.9, 0.345, 4.7, Math.PI, M.walnut, M.linen);
  }
  plant(-16.2, 0.345, 2.6, 1.6, M.terracotta);
  plant(6.5, 0.345, 4.6, 1.5, M.terracotta);
  plant(-4.7, 0.345, 2.55, 1.4);

  // terrasse du garage : salon lounge + foyer
  I.box(M.rug, 8.6, 12.6, F1 + 0.05, F1 + 0.062, -9.3, -5.4);
  sofa(10.6, F1 + 0.05, -9.2, 0, 3.4, M.sofa);
  sofa(8.9, F1 + 0.05, -7.2, Math.PI / 2, 2.4, M.sofa);
  armchair(12.7, F1 + 0.05, -7.0, -Math.PI / 2 - 0.3, M.sofa);
  I.cyl(M.concreteDark, 10.8, F1 + 0.05, -7.1, 0.5, 0.5, 0.36, 24);
  I.cyl(M.fire, 10.8, F1 + 0.41, -7.1, 0.28, 0.28, 0.03, 18);
  I.sphere(M.cushionRust, 12.0, F1 + 0.3, -5.6, 0.25, 12, 8, 1, 0.8, 1);
  I.sphere(M.cushionOchre, 9.6, F1 + 0.3, -5.5, 0.25, 12, 8, 1, 0.8, 1);
  for (let x = 8; x < 16; x += 1.5) {
    I.box(M.concreteDark, x, x + 0.8, F1 + 0.05, F1 + 0.5, 1.0, 1.5);
    plant(x + 0.4, F1 + 0.5, 1.25, 0.9, M.terracotta);
  }
  I.box(M.rug, 8.6, 10.6, F1 + 0.05, F1 + 0.062, -3.2, -0.6);
  // loggia de l'étage : salon d'extérieur tourné vers la piscine
  I.box(M.rug, -12.6, -8.4, F1 + 0.05, F1 + 0.062, 2.45, 4.45);
  sofa(-10.5, F1 + 0.05, 3.0, 0, 3.2, M.sofa);
  table(-10.5, F1 + 0.05, 3.95, 0, 1.1, 0.55, 0.36, M.walnut);
  armchair(-8.0, F1 + 0.05, 3.7, Math.PI + 0.5, M.sofa);
  plant(-13.35, F1 + 0.05, 4.4, 1.5, M.terracotta);
  plant(6.4, F1 + 0.05, 4.4, 1.5, M.terracotta);
  // chaises longues de la terrasse haute (vue sur la piscine)
  for (let i = 0; i < 2; i++) lounger(L, I, M, 9.6 + i * 1.1, F1 + 0.05, -1.4, Math.PI);

  I.build(group, { name: 'mobilier' });
  const g = IG.build(group, { cast: false, receive: false, name: 'verre-intérieur' });
  g.forEach((m) => (m.renderOrder = 6));
  return { group };
}

/** Transat réutilisable (terrasse haute et plage de la piscine). */
export function lounger(L, B, M, x, y, z, ry, back = 0.9) {
  L.at(x, y, z, ry); // pieds vers +z local, dossier vers -z
  const w = 0.62, len = 1.95;
  for (const sx of [-1, 1]) {
    L.box(M.steel, sx * (w / 2) - 0.02, sx * (w / 2) + 0.02, 0, 0.32, -len / 2 + 0.7, -len / 2 + 0.75);
    L.box(M.steel, sx * (w / 2) - 0.02, sx * (w / 2) + 0.02, 0, 0.32, len / 2 - 0.1, len / 2 - 0.05);
    L.box(M.steel, sx * (w / 2) - 0.02, sx * (w / 2) + 0.02, 0.3, 0.34, -len / 2 + 0.6, len / 2);
  }
  L.box(M.linen, -w / 2 - 0.03, w / 2 + 0.03, 0.34, 0.4, -len / 2 + 0.7, len / 2);
  L.tilt(M.linen, 0, 0.62, -len / 2 + 0.35, w + 0.06, 0.07, 1.0, 0, back * 0.9 - 0.2);
  L.tilt(M.steel, -w / 2 - 0.0, 0.58, -len / 2 + 0.35, 0.04, 0.04, 1.0, 0, back * 0.9 - 0.2);
  L.tilt(M.steel, w / 2 + 0.0, 0.58, -len / 2 + 0.35, 0.04, 0.04, 1.0, 0, back * 0.9 - 0.2);
}
