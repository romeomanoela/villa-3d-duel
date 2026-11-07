import * as THREE from 'three';
import { L } from './config.js';
import { Batcher } from './utils.js';
import { addCollider } from './colliders.js';

/*
  Façade paramétrique : une suite de segments le long d'un axe.
  axis 'x' -> mur parallèle à X en z = at ; axis 'z' -> mur parallèle à Z en x = at.
  Segments : w (plein), g (vitrage : sill/head = allège/imposte, mull = pas des montants),
             d (porte pivotante bois + impostes vitrées latérales).
*/
export function facade(b, M, { axis, at, from, y0, h, t = 0.3, segs, inner = 0 }) {
  const put = (mat, u0, u1, ya, yb, thick = t, opts, off = 0) => {
    if (axis === 'x') b.boxB(mat, u0, u1, ya, yb, at + off - thick / 2, at + off + thick / 2, opts);
    else b.boxB(mat, at + off - thick / 2, at + off + thick / 2, ya, yb, u0, u1, opts);
  };
  // Doublage intérieur lisse (côté `inner` = ±1) pour ne pas voir l'enduit extérieur depuis l'intérieur.
  const lining = (u0, u1, ya, yb) => { if (inner) put(M.stuccoInt, u0, u1, ya, yb, 0.012, { cast: false }, inner * (t / 2 + 0.006)); };
  const GL = { cast: false, receive: false };
  const F = 0.06, FD = 0.12;
  const total = segs.reduce((a, s) => a + s.len, 0);
  if (axis === 'x') addCollider(from, from + total, at - t / 2, at + t / 2, y0, y0 + h, 'mur');
  else addCollider(at - t / 2, at + t / 2, from, from + total, y0, y0 + h, 'mur');
  let u = from;
  for (const s of segs) {
    const u0 = u, u1 = u + s.len;
    u = u1;
    if (s.type === 'w') { put(s.mat, u0, u1, y0, y0 + h); lining(u0, u1, y0, y0 + h); continue; }
    const ys = y0 + (s.sill || 0), ye = y0 + h - (s.head || 0);
    if (s.sill) { put(s.wall || M.stucco, u0, u1, y0, ys); lining(u0, u1, y0, ys); }
    if (s.head) { put(s.wall || M.stucco, u0, u1, ye, y0 + h); lining(u0, u1, ye, y0 + h); }
    put(M.frame, u0, u0 + F, ys, ye, FD);
    put(M.frame, u1 - F, u1, ys, ye, FD);
    put(M.frame, u0, u1, ys, ys + F, FD);
    put(M.frame, u0, u1, ye - F, ye, FD);
    if (s.type === 'd') {
      const c = (u0 + u1) / 2, d0 = c - s.dw / 2, d1 = c + s.dw / 2;
      put(M.walnut, d0, d1, ys + F, ye - F, 0.09);
      put(M.frame, d0 - F, d0, ys, ye, FD);
      put(M.frame, d1, d1 + F, ys, ye, FD);
      put(M.steel, d1 - 0.2, d1 - 0.16, ys + 0.5, ys + 2.0, 0.24);
      put(M.glass, u0 + F, d0 - F, ys + F, ye - F, 0.024, GL);
      put(M.glass, d1 + F, u1 - F, ys + F, ye - F, 0.024, GL);
      continue;
    }
    const n = Math.max(1, Math.round(s.len / (s.mull || 99)));
    for (let i = 1; i < n; i++) {
      const um = u0 + (i * s.len) / n;
      put(M.frame, um - F / 2, um + F / 2, ys, ye, FD);
    }
    put(M.glass, u0 + F, u1 - F, ys + F, ye - F, 0.024, GL);
  }
}

// Garde-corps en verre feuilleté avec main courante inox.
export function glassRail(b, M, axis, at, u0, u1, y, h = 1.05) {
  if (axis === 'x') addCollider(u0, u1, at - 0.05, at + 0.05, y, y + h, 'garde-corps');
  else addCollider(at - 0.05, at + 0.05, u0, u1, y, y + h, 'garde-corps');
  if (axis === 'x') {
    b.boxB(M.glassRail, u0, u1, y, y + h, at - 0.012, at + 0.012, { cast: false, receive: false });
    b.boxB(M.steel, u0, u1, y + h, y + h + 0.04, at - 0.03, at + 0.03);
    b.boxB(M.frame, u0, u1, y, y + 0.08, at - 0.04, at + 0.04);
  } else {
    b.boxB(M.glassRail, at - 0.012, at + 0.012, y, y + h, u0, u1, { cast: false, receive: false });
    b.boxB(M.steel, at - 0.03, at + 0.03, y + h, y + h + 0.04, u0, u1);
    b.boxB(M.frame, at - 0.04, at + 0.04, y, y + 0.08, u0, u1);
  }
}

export function buildVilla(scene, M) {
  const group = new THREE.Group();
  group.name = 'villa';
  scene.add(group);
  const b = new Batcher();
  const { FL0, FL1, ROOF, GF, UF, SLAB } = L;
  const top0 = FL1 - SLAB, h0 = top0 - FL0, h1 = ROOF - FL1;
  const w = (len, mat = M.stucco) => ({ type: 'w', len, mat });
  const g = (len, mull, o = {}) => ({ type: 'g', len, mull, ...o });

  /* --- Socle en travertin + plancher bas --- */
  b.boxB(M.travertine, GF.x0 - 0.15, GF.x1 + 0.15, 0, FL0 - 0.02, GF.z0 - 0.15, GF.z1 + 0.15);
  b.boxB(M.oak, GF.x0 + 0.15, GF.x1 - 0.15, FL0 - 0.02, FL0, GF.z0 + 0.15, GF.z1 - 0.15);

  /* --- Rez-de-chaussée : baies coulissantes côté piscine, façade d'entrée côté rue --- */
  facade(b, M, { axis: 'x', at: GF.z0, from: GF.x0, y0: FL0, h: h0, inner: 1, segs: [w(0.5), g(6.4, 1.6), w(0.5), g(7.2, 1.8), w(0.6), g(4.0, 2.0), w(0.8)] });
  facade(b, M, {
    axis: 'x', at: GF.z1, from: GF.x0, y0: FL0, h: h0, inner: -1,
    segs: [w(3, M.travertine), g(4, 2), { type: 'd', len: 2.2, dw: 1.4 }, g(4.4, 1.1), w(2.4), g(2.4, 1.2, { sill: 0.9 }), w(1.6)],
  });
  facade(b, M, { axis: 'z', at: GF.x0, from: GF.z0, y0: FL0, h: h0, inner: 1, segs: [w(0.8, M.travertine), g(3.0, 1.5), w(6.2, M.travertine)] });
  facade(b, M, { axis: 'z', at: GF.x1, from: GF.z0, y0: FL0, h: h0, inner: -1, segs: [w(10)] });

  /* --- Dalle intermédiaire (trémie d'escalier) + porte-à-faux arrière --- */
  b.slabHole(M.stucco, GF.x0 - 0.2, 14.2, GF.z0 - 0.2, GF.z1 + 0.2, -5.2, -0.62, 1.75, UF.z1, top0, FL1);
  b.boxB(M.stucco, UF.x0 - 0.2, UF.x1 + 0.2, top0, FL1, UF.z0 - 0.2, GF.z0 - 0.2);
  b.boxB(M.stucco, -8.2, -3.6, top0, FL1, GF.z1 + 0.2, 6.6); // auvent d'entrée
  b.slabHole(M.oak, UF.x0 + 0.15, UF.x1 - 0.15, UF.z0 + 0.15, UF.z1 - 0.15, -5.2, -0.62, 1.75, UF.z1, FL1, FL1 + 0.02);

  // Faux-plafonds lisses (intérieur)
  b.slabHole(M.ceiling, GF.x0 + 0.15, GF.x1 - 0.15, GF.z0 + 0.15, GF.z1 - 0.15, -5.2, -0.62, 1.75, UF.z1, top0 - 0.012, top0, { cast: false });
  b.boxB(M.ceiling, UF.x0 + 0.15, UF.x1 - 0.15, ROOF - 0.012, ROOF, UF.z0 + 0.15, UF.z1 - 0.15, { cast: false });

  /* --- Étage : volume en porte-à-faux, bardage bois et vitrages toute hauteur --- */
  facade(b, M, {
    axis: 'x', at: UF.z0, from: UF.x0, y0: FL1, h: h1, inner: 1,
    segs: [w(0.5), g(5.6, 1.4), w(1.0, M.cladding), g(5.0, 1.25), w(1.0, M.cladding), g(5.4, 1.35), w(2.0)],
  });
  facade(b, M, {
    axis: 'x', at: UF.z1, from: UF.x0, y0: FL1, h: h1, inner: -1,
    segs: [w(1.2, M.cladding), g(0.8, 1, { sill: 1.1, head: 0.3, wall: M.cladding }), w(3.0, M.cladding), g(4.5, 1.5), w(2, M.cladding), g(6.5, 1.3, { sill: 0.9, head: 0.4, wall: M.cladding }), w(2.5, M.cladding)],
  });
  facade(b, M, { axis: 'z', at: UF.x0, from: UF.z0, y0: FL1, h: h1, inner: 1, segs: [w(1.2), g(5.4, 1.8), w(4.1)] });
  facade(b, M, { axis: 'z', at: UF.x1, from: UF.z0, y0: FL1, h: h1, inner: -1, segs: [w(3.0), g(2.8, 1.4, { sill: 0.9 }), w(4.9)] });
  // Garde-corps intérieurs devant les baies toute hauteur de l'étage
  glassRail(b, M, 'x', UF.z0 + 0.2, UF.x0 + 0.5, UF.x1 - 2, FL1, 1.0);

  /* --- Toiture plate débordante + acrotère --- */
  const R = { x0: UF.x0 - 0.6, x1: UF.x1 + 0.6, z0: UF.z0 - 0.6, z1: UF.z1 + 0.6 };
  b.boxB(M.stucco, R.x0, R.x1, ROOF, ROOF + 0.36, R.z0, R.z1);
  b.boxB(M.gravel, R.x0 + 0.3, R.x1 - 0.3, ROOF + 0.36, ROOF + 0.38, R.z0 + 0.3, R.z1 - 0.3, { cast: false });
  for (const [x0, x1, z0, z1] of [[R.x0, R.x1, R.z0, R.z0 + 0.2], [R.x0, R.x1, R.z1 - 0.2, R.z1], [R.x0, R.x0 + 0.2, R.z0, R.z1], [R.x1 - 0.2, R.x1, R.z0, R.z1]]) {
    b.boxB(M.stucco, x0, x1, ROOF + 0.36, ROOF + 0.5, z0, z1);
  }

  // Lanterneaux et groupe technique en toiture
  for (const [x0, x1, z0, z1] of [[-3.6, -1.2, -4.6, -2.2], [-8.6, -7.2, 0.6, 2.0], [1.6, 4.0, -4.6, -2.2]]) {
    b.boxB(M.stucco, x0, x1, ROOF + 0.36, ROOF + 0.6, z0, z1);
    b.boxB(M.frame, x0 + 0.05, x1 - 0.05, ROOF + 0.6, ROOF + 0.64, z0 + 0.05, z1 - 0.05);
    b.boxB(M.glass, x0 + 0.1, x1 - 0.1, ROOF + 0.64, ROOF + 0.66, z0 + 0.1, z1 - 0.1, { cast: false, receive: false });
  }
  b.boxB(M.wallGrey, 6.4, 8.2, ROOF + 0.36, ROOF + 1.1, 0.4, 1.6);
  b.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 24), M.blackMetal, [7.3, ROOF + 1.12, 1.0]);

  /* --- Toit-terrasse sur le séjour (côté ouest) --- */
  b.boxB(M.deck, GF.x0 - 0.15, UF.x0 - 0.15, FL1, FL1 + 0.04, GF.z0 - 0.15, GF.z1 + 0.15);
  glassRail(b, M, 'z', GF.x0 - 0.1, GF.z0 - 0.15, GF.z1 + 0.15, FL1 + 0.04);
  glassRail(b, M, 'x', GF.z0 - 0.1, GF.x0 - 0.15, UF.x0 - 0.15, FL1 + 0.04);
  glassRail(b, M, 'x', GF.z1 + 0.1, GF.x0 - 0.15, UF.x0 - 0.15, FL1 + 0.04);
  b.boxB(M.travertine, GF.x0 + 0.2, GF.x0 + 0.85, FL1, 5.6, -0.6, 1.0); // souche de cheminée
  b.boxB(M.blackMetal, GF.x0 + 0.3, GF.x0 + 0.75, 5.6, 5.75, -0.5, 0.9);

  /* --- Jardinière filante entre les niveaux (façade rue) --- */
  b.boxB(M.planter, UF.x0 + 0.2, GF.x1 + 4.2, FL1, FL1 + 0.42, UF.z1 + 0.22, GF.z1 + 0.15);
  b.boxB(M.soil, UF.x0 + 0.26, GF.x1 + 4.14, FL1 + 0.42, FL1 + 0.43, UF.z1 + 0.28, GF.z1 + 0.09, { cast: false });
  const tuft = new THREE.IcosahedronGeometry(0.32, 1);
  for (let x = UF.x0 + 0.5; x < GF.x1 + 4; x += 0.55) {
    b.mesh(tuft, M.box, [x, FL1 + 0.55, (UF.z1 + GF.z1) / 2 + 0.05], [0, x, 0], [1, 0.6 + 0.25 * Math.sin(x * 3.1), 0.8]);
  }

  /* --- Toit du garage : gravier + acrotère --- */
  b.boxB(M.gravel, UF.x1 + 0.3, 14.1, FL1, FL1 + 0.03, GF.z0 - 0.1, GF.z1 + 0.1, { cast: false });
  b.boxB(M.stucco, 14.0, 14.2, FL1, FL1 + 0.35, GF.z0 - 0.2, GF.z1 + 0.2);

  /* --- Éclairage architectural : appliques et spots en sous-face --- */
  const glow = new THREE.PlaneGeometry(1, 1);
  const glowDown = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const sconce = (x, y, z, ry) => {
    b.push(x, y, z, ry);
    b.box(M.blackMetal, 0.14, 0.42, 0.12, 0, 0, 0.06);
    b.box(M.lampWarm, 0.1, 0.02, 0.08, 0, 0.2, 0.08, 0, { cast: false });
    b.box(M.lampWarm, 0.1, 0.02, 0.08, 0, -0.2, 0.08, 0, { cast: false });
    b.mesh(glow, M.glowWarm, [0, 0, 0.012], [0, 0, 0], [0.9, 3.2, 1], { cast: false, receive: false });
    b.pop();
  };
  const zf = GF.z1 + 0.15;
  sconce(-12.5, 2.0, zf, 0);
  sconce(0.8, 2.0, zf, 0);
  sconce(5.2, 2.0, zf, 0);
  sconce(GF.x0 - 0.15, 2.0, 2.5, -Math.PI / 2);
  sconce(GF.x0 - 0.15, 2.0, -4.6, -Math.PI / 2);
  // Spots encastrés sous le porte-à-faux arrière et sous l'auvent d'entrée
  const spot = (x, z, yc, floorY, size = 2.4) => {
    b.box(M.lampSpot, 0.16, 0.012, 0.16, x, yc - 0.006, z, 0, { cast: false });
    b.mesh(glowDown, M.glowSoft, [x, floorY + 0.02, z], [0, 0, 0], [size, 1, size], { cast: false, receive: false });
  };
  for (let x = UF.x0 + 1.2; x < UF.x1 - 0.5; x += 2.6) spot(x, (UF.z0 + GF.z0) / 2 - 0.1, top0, L.FL0 + 0.04, 2.8);
  spot(-6.9, 5.6, top0, 0.45, 2.2);
  spot(-4.9, 5.6, top0, 0.45, 2.2);

  b.build(group, 'villa');
  return {};
}
