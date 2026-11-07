// Architecture de la villa : volumes, dalles, murs, baies vitrées, toiture, terrasses, éclairage d'architecture.
import * as THREE from 'three';
import { Batcher, slabGeometry } from './utils.js';
import { F0, CEIL0, F1, ROOF_BOT, ROOF_TOP, HOUSE, GARAGE } from './config.js';

// Escalier du séjour (montée vers l'ouest, le long du mur nord)
export const STAIR = { xBottom: 1.0, rise: 0.175, run: 0.28, count: 20, z0: -9.7, z1: -8.55 };
export const STAIR_HOLE = [-4.4, -0.6, -9.75, -8.5];

export function buildVilla(ctx) {
  const { scene, M, ambience } = ctx;
  const group = new THREE.Group();
  group.name = 'villa';
  scene.add(group);

  const S = new Batcher(); // structure opaque
  const GL = new Batcher(); // vitrages
  const LT = new Batcher(); // luminaires émissifs

  const solar = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.25, metalness: 0.6, name: 'photovoltaïque' });

  const X0 = HOUSE.x0, X1 = HOUSE.x1, Z0 = HOUSE.z0, Z1 = HOUSE.z1;
  const U = HOUSE.up;
  const WT = 0.25; // épaisseur des murs

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /** Mur plein percé d'ouvertures. axis 'z' : mur le long de x, occupant z∈[c0,c1] ; axis 'x' : le long de z. */
  function wall(axis, c0, c1, a0, a1, y0, y1, openings, mat) {
    const box = (p0, p1, q0, q1) => (axis === 'z' ? S.box(mat, p0, p1, q0, q1, c0, c1) : S.box(mat, c0, c1, q0, q1, p0, p1));
    const ops = [...openings].sort((p, q) => p.a0 - q.a0);
    let cur = a0;
    for (const o of ops) {
      if (o.a0 > cur) box(cur, o.a0, y0, y1);
      if (o.y0 > y0) box(o.a0, o.a1, y0, o.y0);
      if (o.y1 < y1) box(o.a0, o.a1, o.y1, y1);
      cur = o.a1;
    }
    if (cur < a1) box(cur, a1, y0, y1);
  }

  /** Baie vitrée à profilés noirs : un plan de verre, traverses haute/basse et meneaux. */
  function glazed(axis, c, a0, a1, y0, y1, bays, { rail = 0.09, mull = 0.06, d = 0.14, handles = true } = {}) {
    GL.plane(M.glass, axis, c, a0, a1, y0, y1);
    const bx = (p0, p1, q0, q1, dd = d) => (axis === 'z' ? S.box(M.blackMetal, p0, p1, q0, q1, c - dd / 2, c + dd / 2) : S.box(M.blackMetal, c - dd / 2, c + dd / 2, q0, q1, p0, p1));
    bx(a0, a1, y0, y0 + rail);
    bx(a0, a1, y1 - rail, y1);
    for (let i = 0; i <= bays; i++) {
      const a = a0 + ((a1 - a0) * i) / bays;
      bx(a - mull / 2, a + mull / 2, y0, y1);
    }
    if (handles) {
      for (let i = 0; i < bays; i++) {
        const a = a0 + ((a1 - a0) * (i + (i % 2 ? 0.08 : 0.92))) / bays;
        const ym = y0 + (y1 - y0) * 0.45;
        if (axis === 'z') S.box(M.steel, a - 0.015, a + 0.015, ym - 0.3, ym + 0.3, c + 0.05, c + 0.075);
        else S.box(M.steel, c + 0.05, c + 0.075, ym - 0.3, ym + 0.3, a - 0.015, a + 0.015);
      }
    }
  }

  /** Embrasure ouverte (porte-fenêtre coulissante ouverte, porte sans vantail) : montants et traverse seulement. */
  function opening(axis, c, a0, a1, y0, y1, d = 0.14) {
    const bx = (p0, p1, q0, q1) => (axis === 'z' ? S.box(M.blackMetal, p0, p1, q0, q1, c - d / 2, c + d / 2) : S.box(M.blackMetal, c - d / 2, c + d / 2, q0, q1, p0, p1));
    bx(a0 - 0.03, a0 + 0.03, y0, y1);
    bx(a1 - 0.03, a1 + 0.03, y0, y1);
    bx(a0, a1, y1 - 0.09, y1);
  }

  /** Garde-corps en verre avec lisse inox. axis 'z' : le long de x à z=c ; 'x' : le long de z à x=c. */
  function balustrade(axis, c, a0, a1, y, h = 1.05) {
    GL.plane(M.glass, axis, c, a0, a1, y + 0.1, y + h);
    if (axis === 'z') {
      S.box(M.blackMetal, a0, a1, y, y + 0.1, c - 0.05, c + 0.05);
      S.box(M.steel, a0, a1, y + h, y + h + 0.045, c - 0.03, c + 0.03);
    } else {
      S.box(M.blackMetal, c - 0.05, c + 0.05, y, y + 0.1, a0, a1);
      S.box(M.steel, c - 0.03, c + 0.03, y + h, y + h + 0.045, a0, a1);
    }
    const n = Math.max(2, Math.round(Math.abs(a1 - a0) / 1.6));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      if (axis === 'z') S.box(M.steel, a - 0.02, a + 0.02, y + 0.1, y + h, c - 0.02, c + 0.02);
      else S.box(M.steel, c - 0.02, c + 0.02, y + 0.1, y + h, a - 0.02, a + 0.02);
    }
  }

  const disc = (x, y, z, r = 0.09) => LT.cyl(M.downlight, x, y, z, r, r, 0.02, 14);

  /* ------------------------------------------------------------------ */
  /*  Fondations, sols, dalles                                           */
  /* ------------------------------------------------------------------ */
  S.box(M.concreteDark, X0 - 0.12, X1 + 0.12, -0.35, F0 - 0.02, Z0 - 0.12, Z1 + 0.12); // soubassement
  S.box(M.marble, X0 + WT, 7.0, F0 - 0.02, F0, Z0 + WT, Z1 - WT); // séjour + hall
  S.box(M.garageFloor, 7.0, X1 - WT, F0 - 0.02, F0, Z0 + WT, Z1 - WT); // garage (résine)

  // dalle haute du rez-de-chaussée (réservation de l'escalier)
  S.geo(slabGeometry(X0 - 0.15, X1 + 0.15, Z0 - 0.15, Z1 + 0.15, CEIL0, F1, [STAIR_HOLE], 3), M.render);
  // volume d'étage : dalle en porte-à-faux au sud (3 m) + débord au nord
  S.box(M.render, U.x0 - 0.2, U.x1 + 0.2, CEIL0, F1, U.z0 - 0.2, Z0 - 0.15);
  S.box(M.render, U.x0 - 0.2, U.x1 + 0.2, CEIL0, F1, Z1 + 0.15, U.z1 + 0.2);
  S.box(M.render, U.x0 - 0.2, U.x1 + 0.2, F1 - 0.02, F1 + 0.14, U.z1 + 0.1, U.z1 + 0.2); // relevé de rive (balcon)
  // plafond blanc du rez-de-chaussée
  S.geo(slabGeometry(X0 + WT, X1 - WT, Z0 + WT, Z1 - WT, CEIL0 - 0.04, CEIL0, [STAIR_HOLE], 3), M.render);
  // sous-face bois de la terrasse couverte
  S.box(M.deck, U.x0 - 0.2, U.x1 + 0.2, CEIL0 - 0.05, CEIL0, Z1 + 0.15, U.z1 + 0.1);

  // plancher de l'étage (parquet) avec réservation
  S.geo(slabGeometry(U.x0 + WT, U.x1 - WT, U.z0 + WT, Z1, F1, F1 + 0.03, [STAIR_HOLE], 2.4), M.floorOak);

  /* ------------------------------------------------------------------ */
  /*  Rez-de-chaussée : murs                                            */
  /* ------------------------------------------------------------------ */
  const yb = F0, yt = CEIL0;
  // nord
  wall('z', Z0, Z0 + WT, X0, X1, yb, yt, [
    { a0: -15.8, a1: -11.4, y0: 1.2, y1: 3.0 },
    { a0: -9.6, a1: -4.6, y0: 1.5, y1: 3.0 },
    { a0: 2.0, a1: 3.8, y0: 1.5, y1: 3.0 },
    { a0: 9.5, a1: 14.5, y0: 2.3, y1: 3.1 },
  ], M.render);
  glazed('z', Z0 + WT / 2, -15.8, -11.4, 1.2, 3.0, 2, { handles: false });
  glazed('z', Z0 + WT / 2, -9.6, -4.6, 1.5, 3.0, 2, { handles: false });
  glazed('z', Z0 + WT / 2, 2.0, 3.8, 1.5, 3.0, 1, { handles: false });
  glazed('z', Z0 + WT / 2, 9.5, 14.5, 2.3, 3.1, 3, { handles: false });
  // ouest (parement pierre)
  wall('x', X0, X0 + WT, Z0, Z1, yb, yt, [], M.render);
  S.box(M.stone, X0 - 0.1, X0, F0 - 0.02, F1, Z0, Z1);
  S.box(M.stone, X0 - 0.1, X0, F0 - 0.02, F1, Z0 - 0.1, Z0);
  // sud : séjour (verre), hall (bardage bois + porte pivotante), garage (enduit)
  const hallOp = [
    { a0: 4.65, a1: 6.05, y0: F0, y1: F0 + 2.6 },
    { a0: 6.35, a1: 6.75, y0: F0, y1: F0 + 2.6 },
  ];
  wall('z', Z1 - WT, Z1, X0, 3.8, yb, yt, [{ a0: -15.4, a1: 3.8, y0: yb, y1: yt }], M.render);
  S.box(M.stone, X0 - 0.1, X0 + 1.7, F0 - 0.02, F1, Z1 - WT, Z1 + 0.08); // retour de pierre
  glazed('z', Z1 - 0.12, -15.4, -9.0, yb, yt, 2);
  opening('z', Z1 - 0.12, -9.0, -5.8, yb, yt); // baie coulissante ouverte : accès à la terrasse (visite)
  glazed('z', Z1 - 0.12, -5.8, 3.8, yb, yt, 3);
  wall('z', Z1 - WT, Z1 + 0.04, 3.8, 7.0, yb, yt, hallOp, M.slats);
  wall('z', Z1 - WT, Z1, 7.0, X1, yb, yt, [{ a0: 9.5, a1: 14.5, y0: 2.3, y1: 3.15 }], M.render);
  glazed('z', Z1 - WT / 2, 9.5, 14.5, 2.3, 3.15, 3, { handles: false });
  glazed('z', Z1 - 0.1, 6.35, 6.75, F0, F0 + 2.6, 1, { handles: false });
  // porte d'entrée (bois) + poignée
  S.box(M.walnut, 4.67, 6.03, F0, F0 + 2.58, Z1 - 0.12, Z1 - 0.04);
  S.box(M.steel, 5.8, 5.84, F0 + 0.5, F0 + 2.0, Z1 + 0.0, Z1 + 0.05);
  S.box(M.blackMetal, 4.6, 4.67, F0, F0 + 2.62, Z1 - 0.14, Z1 + 0.02);
  S.box(M.blackMetal, 6.03, 6.1, F0, F0 + 2.62, Z1 - 0.14, Z1 + 0.02);
  S.box(M.blackMetal, 4.6, 6.1, F0 + 2.58, F0 + 2.66, Z1 - 0.14, Z1 + 0.02);
  // est : porte de garage
  const dz0 = GARAGE.doorZ0, dz1 = GARAGE.doorZ1;
  wall('x', X1 - WT, X1, Z0, Z1, yb, yt, [{ a0: dz0, a1: dz1, y0: F0, y1: F0 + GARAGE.doorH }], M.render);
  S.box(M.stone, X1, X1 + 0.1, F0 - 0.02, CEIL0, dz1, Z1 + 0.1);
  S.box(M.stone, X1, X1 + 0.1, F0 - 0.02, CEIL0, Z0 - 0.1, dz0);
  // cadre de porte
  S.box(M.blackMetal, X1 - WT - 0.02, X1 + 0.04, F0 + GARAGE.doorH, F0 + GARAGE.doorH + 0.09, dz0 - 0.09, dz1 + 0.09);
  S.box(M.blackMetal, X1 - WT - 0.02, X1 + 0.04, F0, F0 + GARAGE.doorH, dz0 - 0.09, dz0);
  S.box(M.blackMetal, X1 - WT - 0.02, X1 + 0.04, F0, F0 + GARAGE.doorH, dz1, dz1 + 0.09);
  // cloison hall / garage avec porte
  wall('x', 6.9, 7.15, Z0 + WT, Z1 - WT, yb, yt, [{ a0: -3.8, a1: -2.2, y0: F0, y1: F0 + 2.2 }], M.render);
  opening('x', 7.025, -3.8, -2.2, F0, F0 + 2.2, 0.26); // passage hall / garage

  /* ------------------------------------------------------------------ */
  /*  Étage                                                              */
  /* ------------------------------------------------------------------ */
  const uy0 = F1, uy1 = ROOF_BOT;
  // nord
  wall('z', U.z0, U.z0 + WT, U.x0, U.x1, uy0, uy1, [
    { a0: -12.6, a1: -8.0, y0: uy0 + 0.9, y1: uy0 + 2.5 },
    { a0: -5.6, a1: 0.4, y0: uy0 + 0.9, y1: uy0 + 2.5 },
    { a0: 2.2, a1: 6.0, y0: uy0 + 0.9, y1: uy0 + 2.5 },
  ], M.render);
  glazed('z', U.z0 + WT / 2, -12.6, -8.0, uy0 + 0.9, uy0 + 2.5, 2, { handles: false });
  glazed('z', U.z0 + WT / 2, -5.6, 0.4, uy0 + 0.9, uy0 + 2.5, 2, { handles: false });
  glazed('z', U.z0 + WT / 2, 2.2, 6.0, uy0 + 0.9, uy0 + 2.5, 2, { handles: false });
  // ouest
  wall('x', U.x0, U.x0 + WT, U.z0, Z1, uy0, uy1, [{ a0: -8.2, a1: -3.6, y0: uy0 + 0.9, y1: uy0 + 2.5 }], M.render);
  glazed('x', U.x0 + WT / 2, -8.2, -3.6, uy0 + 0.9, uy0 + 2.5, 2, { handles: false });
  // écran bois côté loggia (ouest)
  S.box(M.slats, U.x0, U.x0 + 0.14, uy0, uy1, Z1, U.z1 + 0.1);
  // est : baies coulissantes vers la terrasse du garage
  wall('x', U.x1 - WT, U.x1, U.z0, Z1, uy0, uy1, [{ a0: -9.3, a1: 1.5, y0: uy0, y1: uy0 + 2.6 }], M.render);
  glazed('x', U.x1 - WT / 2, -6.6, 1.5, uy0, uy0 + 2.6, 3);
  opening('x', U.x1 - WT / 2, -9.3, -6.6, uy0, uy0 + 2.6); // baie ouverte vers la terrasse du garage
  S.box(M.slats, U.x1 - WT - 0.05, U.x1 + 0.06, uy0, uy1, U.z0, -9.3); // pan bois (angle NE)
  // sud : mur-rideau (les deux niveaux partagent l'alignement z = 2)
  glazed('z', Z1 - 0.12, U.x0 + WT, -6.9167, uy0, uy1, 2);
  opening('z', Z1 - 0.12, -6.9167, -3.5, uy0, uy1); // baie ouverte sur la loggia
  glazed('z', Z1 - 0.12, -3.5, U.x1 - WT, uy0, uy1, 3);
  S.box(M.render, U.x0, U.x0 + WT, uy0, uy1, Z1 - WT, Z1);
  S.box(M.render, U.x1 - WT, U.x1, uy0, uy1, Z1 - WT, Z1);

  // cloisons d'étage (chambre parentale / palier / chambre 2) + salle de bains
  const part = (x, z0, z1, ops = []) => wall('x', x - 0.075, x + 0.075, z0, z1, uy0, uy1, ops, M.render);
  part(-6.5, U.z0 + WT, -2.0, [{ a0: -5.4, a1: -4.0, y0: uy0, y1: uy0 + 2.2 }]);
  part(1.0, U.z0 + WT, -2.0, [{ a0: -5.4, a1: -4.0, y0: uy0, y1: uy0 + 2.2 }]);
  wall('x', -10.675, -10.525, U.z0 + WT, -7.2, uy0, uy1, [], M.render);
  wall('z', -7.275, -7.125, U.x0 + WT, -10.6, uy0, uy1, [{ a0: -12.3, a1: -11.0, y0: uy0, y1: uy0 + 2.2 }], M.render);
  opening('z', -7.2, -12.3, -11.0, uy0, uy0 + 2.2, 0.2); // porte de la salle de bain

  // loggia (balcon couvert) : terrasse bois + garde-corps verre
  S.box(M.deck, U.x0 - 0.1, U.x1 + 0.1, F1 - 0.02, F1 + 0.05, Z1, U.z1 + 0.1);
  balustrade('z', U.z1 + 0.05, U.x0 + 0.14, U.x1 + 0.1, F1 + 0.05);
  balustrade('x', U.x1 + 0.1, Z1, U.z1 + 0.1, F1 + 0.05);

  /* ------------------------------------------------------------------ */
  /*  Toiture                                                            */
  /* ------------------------------------------------------------------ */
  const rx0 = U.x0 - 0.7, rx1 = U.x1 + 0.7, rz0 = U.z0 - 0.7, rz1 = U.z1 + 0.7;
  S.box(M.render, rx0, rx1, ROOF_BOT, ROOF_TOP, rz0, rz1);
  S.box(M.render, rx0, rx1, ROOF_TOP, ROOF_TOP + 0.26, rz0, rz0 + 0.16);
  S.box(M.render, rx0, rx1, ROOF_TOP, ROOF_TOP + 0.26, rz1 - 0.16, rz1);
  S.box(M.render, rx0, rx0 + 0.16, ROOF_TOP, ROOF_TOP + 0.26, rz0, rz1);
  S.box(M.render, rx1 - 0.16, rx1, ROOF_TOP, ROOF_TOP + 0.26, rz0, rz1);
  S.box(M.roofMembrane, rx0 + 0.16, rx1 - 0.16, ROOF_TOP, ROOF_TOP + 0.03, rz0 + 0.16, rz1 - 0.16);
  // panneaux photovoltaïques, lanterneaux, groupes
  for (let i = 0; i < 6; i++) S.boxC(solar, -9 + i * 2.1, ROOF_TOP + 0.45, -6.5, 1.9, 0.05, 1.1, 0, -0.38);
  for (let i = 0; i < 6; i++) S.boxC(solar, -9 + i * 2.1, ROOF_TOP + 0.45, -4.6, 1.9, 0.05, 1.1, 0, -0.38);
  S.box(M.blackMetal, -3.3, -0.3, ROOF_TOP, ROOF_TOP + 0.3, -1.6, 0.4);
  GL.plane(M.glass, 'y', ROOF_TOP + 0.3, -3.2, -0.4, -1.5, 0.3);
  S.box(M.steel, 3.2, 4.6, ROOF_TOP, ROOF_TOP + 0.7, -9, -8);
  S.box(M.steel, 3.2, 4.6, ROOF_TOP, ROOF_TOP + 0.7, -7.5, -6.5);

  /* ------------------------------------------------------------------ */
  /*  Terrasses                                                          */
  /* ------------------------------------------------------------------ */
  // terrasse couverte sud (rez-de-chaussée) : deck bois + marches vers la plage de la piscine
  S.box(M.deck, X0 - 0.3, U.x1 + 0.3, -0.12, 0.33, Z1 - 0.05, 5.4);
  S.box(M.deck, X0 - 0.3, U.x1 + 0.3, -0.12, 0.22, 5.4, 5.85);
  // terrasse sur le garage : deck + garde-corps + pergola
  S.box(M.deck, 7.15, X1 + 0.12, F1 - 0.02, F1 + 0.05, Z0 - 0.15, Z1 + 0.15);
  balustrade('x', X1 + 0.05, Z0 - 0.1, Z1 + 0.1, F1 + 0.05);
  balustrade('z', Z0 - 0.08, 7.2, X1 + 0.05, F1 + 0.05);
  balustrade('z', Z1 + 0.08, 7.2, X1 + 0.05, F1 + 0.05);
  // pergola bois
  for (const px of [8.3, 14.2]) for (const pz of [-9.4, -4.2]) S.box(M.blackMetal, px - 0.08, px + 0.08, F1 + 0.05, F1 + 2.75, pz - 0.08, pz + 0.08);
  for (const pz of [-9.4, -4.2]) S.box(M.deck, 8.1, 14.6, F1 + 2.75, F1 + 2.95, pz - 0.1, pz + 0.1);
  for (let x = 8.2; x < 14.5; x += 0.3) S.box(M.deck, x, x + 0.12, F1 + 2.95, F1 + 3.05, -9.6, -4.0);

  // acrotère haut + auvent d'entrée en béton
  S.box(M.concrete, 3.5, 7.35, F0 + 2.85, F0 + 3.0, Z1, Z1 + 1.2);

  /* ------------------------------------------------------------------ */
  /*  Éclairage d'architecture (émissif) + sources réelles               */
  /* ------------------------------------------------------------------ */
  // spots encastrés sous la dalle en porte-à-faux (terrasse couverte)
  for (let x = -15.5; x <= 6.5; x += 2.2) for (const z of [3.0, 4.5]) disc(x, CEIL0 - 0.055, z);
  // gorges LED périphériques sous la dalle (nez de dalle)
  LT.box(M.ledStrip, U.x0, U.x1, CEIL0 - 0.07, CEIL0 - 0.05, U.z1 - 0.12, U.z1 - 0.06);
  LT.box(M.ledStrip, U.x1 - 0.12, U.x1 - 0.06, CEIL0 - 0.07, CEIL0 - 0.05, Z1, U.z1 - 0.06);
  LT.box(M.ledStrip, U.x0 + 0.06, U.x0 + 0.12, CEIL0 - 0.07, CEIL0 - 0.05, Z1, U.z1 - 0.06);
  // linteau lumineux de la porte de garage et applique d'entrée
  LT.box(M.ledStrip, X1 + 0.0, X1 + 0.06, F0 + GARAGE.doorH + 0.1, F0 + GARAGE.doorH + 0.15, dz0, dz1);
  LT.box(M.bollard, 6.2, 6.28, F0 + 1.6, F0 + 2.1, Z1 + 0.04, Z1 + 0.1);
  LT.box(M.bollard, 4.3, 4.38, F0 + 1.6, F0 + 2.1, Z1 + 0.04, Z1 + 0.1);
  // plafonniers intérieurs (rez-de-chaussée)
  for (let x = -15; x <= 2; x += 2.6) for (const z of [-8, -4.5, -1.2]) {
    if (x > -4.8 && x < -0.2 && z < -7) continue;
    disc(x, CEIL0 - 0.06, z, 0.1);
  }
  disc(5.5, CEIL0 - 0.06, -2, 0.1); disc(5.5, CEIL0 - 0.06, -7, 0.1);
  // garage : réglettes LED
  for (const z of [-7.5, -4, -0.5]) LT.box(M.garageLed, 8.2, 15, CEIL0 - 0.08, CEIL0 - 0.05, z - 0.05, z + 0.05);
  // plafonniers étage
  for (let x = -12; x <= 5; x += 2.8) for (const z of [-9, -5.5, -2.0, 0.6]) {
    if (x > -4.5 && x < -0.4 && z < -7) continue;
    disc(x, ROOF_BOT - 0.03, z, 0.1);
  }
  // étage : gorge LED sur la rive du toit
  LT.box(M.ledStrip, rx0 + 0.3, rx1 - 0.3, ROOF_BOT - 0.04, ROOF_BOT - 0.02, rz1 - 0.55, rz1 - 0.5);
  // terrasse du garage : spots de pergola
  for (let x = 8.8; x < 14; x += 1.7) disc(x, F1 + 2.74, -6.8, 0.07);

  const mk = (color, I, dist, a, b, x, y, z, decay = 1.6, base = 0) => {
    const l = new THREE.PointLight(color, 0, dist, decay);
    l.position.set(x, y, z);
    group.add(l);
    ambience.light(l, I, a, b, base);
    return l;
  };
  mk(0xffd9a8, 15, 17, 0.55, 0.85, -12, 2.2, -3.5); // séjour
  mk(0xffdcb0, 14, 15, 0.55, 0.85, -6.5, 2.2, -5.5); // cuisine
  mk(0xffd9a8, 13, 14, 0.55, 0.85, -1, 2.2, -3.5); // salle à manger / escalier
  mk(0xffe2bd, 11, 11, 0.55, 0.85, 5.5, 2.2, -4); // hall
  mk(0xffd9a8, 13, 15, 0.6, 0.9, -10, 5.6, -4.5); // chambre parentale
  mk(0xffdcb0, 12, 14, 0.6, 0.9, -2.5, 5.6, -4.5); // palier / salon haut
  mk(0xffd9a8, 11, 12, 0.6, 0.9, 3.8, 5.6, -4.5); // chambre 2
  mk(0xfff0d8, 18, 13, 0.55, 0.85, 11.5, 2.3, -4, 1.6, 9); // garage : toujours un peu éclairé
  mk(0xffc98a, 19, 15, 0.45, 0.8, -4, 3.0, 4.0); // terrasse couverte
  mk(0xffc98a, 15, 13, 0.5, 0.85, 11.5, 5.8, -5); // terrasse du garage
  mk(0xffcf96, 14, 15, 0.4, 0.75, 22, 2.4, -4); // parvis / allée

  S.build(group, { name: 'villa' });
  const glass = GL.build(group, { cast: false, receive: false, name: 'vitrage' });
  glass.forEach((m) => (m.renderOrder = 6));
  LT.build(group, { cast: false, receive: false, name: 'luminaires' });

  return { group };
}
