// Villa contemporaine à toits plats : deux niveaux, grandes baies, terrasses, intérieur meublé, garage avec porte sectionnelle.
import * as THREE from 'three';
import { Merger, box } from './utils.js';
import { nightLight, nightEmissive } from './registry.js';

const TH = 0.25; // épaisseur des murs

/** AABB de collision (murs, vitres, meubles) remplis pendant la construction — utilisés par la visite intérieure. */
export const VILLA_COLLIDERS = [];
/** Point d'entrée de la visite : œil dans le séjour, regard vers la baie côté piscine. */
export const ENTRY = { pos: [1.5, 0.16 + 1.65, -4.2], look: [9, 1.6, -4] };
const STAIR = { xTop: 0.5, xBottom: 4.5, z0: -9.8, z1: -8.5, yBottom: 0.15, yTop: 3.95 };

/** Hauteur des pieds pour une position (x, z) ; `feet` = hauteur actuelle (pour savoir si l'on est à l'étage). */
export function floorHeight(x, z, feet) {
  if (x >= STAIR.xTop - 0.2 && x <= STAIR.xBottom + 0.1 && z >= STAIR.z0 && z <= STAIR.z1) {
    const t = Math.min(1, Math.max(0, (STAIR.xBottom - x) / (STAIR.xBottom - STAIR.xTop)));
    return STAIR.yBottom + (STAIR.yTop - STAIR.yBottom) * t;
  }
  if (feet > 2 && x > -6 && x < 11 && z > -10 && z < -1) return 3.96;
  if (x < -9 && x > -19 && z > -6 && z < 2) return 0.06;
  if (x > -9 && x < 9 && z > -10 && z < 2) return 0.16;
  return feet;
}

// ---------- Helpers de construction ----------

/** Découpe un mur (longueur len, hauteur h) en segments pleins autour des ouvertures {a,b,y0,y1}. */
function wallSegments(len, h, openings) {
  const segs = [];
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let cur = 0;
  for (const o of ops) {
    if (o.a > cur) segs.push({ a: cur, b: o.a, y0: 0, y1: h });
    if (o.y0 > 0) segs.push({ a: o.a, b: o.b, y0: 0, y1: o.y0 });
    if (o.y1 < h) segs.push({ a: o.a, b: o.b, y0: o.y1, y1: h });
    cur = o.b;
  }
  if (cur < len) segs.push({ a: cur, b: len, y0: 0, y1: h });
  return segs;
}

/** Place une boîte le long d'un mur : u = position le long du mur, dir 'x' ou 'z'. */
function put(m, mat, dir, ox, oz, u, y, w, h, d) {
  if (dir === 'x') m.box(w, h, d, mat, [ox + u, y, oz]);
  else m.box(d, h, w, mat, [ox, y, oz + u]);
}

/** Mur plein à partir de (ox, oy, oz), le long de dir, avec ouvertures (coordonnées locales). */
function addWall(m, mat, ox, oy, oz, len, h, dir, openings = [], th = TH) {
  for (const s of wallSegments(len, h, openings)) {
    const L = s.b - s.a, H = s.y1 - s.y0;
    if (L <= 0.001 || H <= 0.001) continue;
    put(m, mat, dir, ox, oz, s.a + L / 2, oy + s.y0 + H / 2, L, H, th);
  }
}

/** Vitrage dans une ouverture : vitre fine + cadre et meneaux en aluminium. */
function addGlazing(frames, glass, M, ox, oy, oz, dir, o, spacing = 1.8) {
  const L = o.b - o.a, H = o.y1 - o.y0;
  const cu = o.a + L / 2, cy = oy + o.y0 + H / 2;
  put(glass, M.glass, dir, ox, oz, cu, cy, L, H, 0.02);
  put(frames, M.alu, dir, ox, oz, cu, oy + o.y0 + 0.04, L, 0.08, 0.12);
  put(frames, M.alu, dir, ox, oz, cu, oy + o.y1 - 0.04, L, 0.08, 0.12);
  const n = Math.max(1, Math.round(L / spacing));
  for (let i = 0; i <= n; i++) put(frames, M.alu, dir, ox, oz, o.a + (i * L) / n, cy, 0.07, H, 0.12);
}

/** Garde-corps vitré : panneaux de verre + main courante + poteaux. */
function addRailing(frames, glass, M, ax, az, bx, bz, y, h = 1.05) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const rot = [0, Math.atan2(dx, dz), 0];
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  glass.add(box(0.02, h - 0.1, len - 0.1), M.glass, [cx, y + h / 2 - 0.02, cz], rot);
  frames.add(box(0.06, 0.05, len), M.alu, [cx, y + h, cz], rot);
  frames.add(box(0.06, 0.08, len), M.alu, [cx, y + 0.04, cz], rot);
  const n = Math.max(1, Math.round(len / 2.2));
  for (let i = 0; i <= n; i++) frames.box(0.05, h, 0.05, M.alu, [ax + (dx * i) / n, y + h / 2, az + (dz * i) / n]);
}

/** Dalle épaisse avec trous éventuels (ExtrudeGeometry). Posée entre y et y+th. */
function slabGeometry(x0, x1, z0, z1, th, holes = []) {
  const sh = new THREE.Shape();
  sh.moveTo(x0, -z0); sh.lineTo(x1, -z0); sh.lineTo(x1, -z1); sh.lineTo(x0, -z1); sh.closePath();
  for (const hl of holes) {
    const p = new THREE.Path();
    p.moveTo(hl.x0, -hl.z0); p.lineTo(hl.x1, -hl.z0); p.lineTo(hl.x1, -hl.z1); p.lineTo(hl.x0, -hl.z1); p.closePath();
    sh.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (x, y, z) -> (x, z, -y) : la forme est dans le plan XZ, l'épaisseur selon +y
  return g;
}

/** Plan horizontal (sol fini) avec trous éventuels, à y = 0. */
function floorGeometry(x0, x1, z0, z1, holes = []) {
  const sh = new THREE.Shape();
  sh.moveTo(x0, -z0); sh.lineTo(x1, -z0); sh.lineTo(x1, -z1); sh.lineTo(x0, -z1); sh.closePath();
  for (const hl of holes) {
    const p = new THREE.Path();
    p.moveTo(hl.x0, -hl.z0); p.lineTo(hl.x1, -hl.z0); p.lineTo(hl.x1, -hl.z1); p.lineTo(hl.x0, -hl.z1); p.closePath();
    sh.holes.push(p);
  }
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------- Villa ----------

export function createVilla(scene, M) {
  const g = new THREE.Group();
  g.name = 'villa';
  const m = new Merger();        // opaque, projette des ombres
  const glass = new Merger();    // verre, sans ombre portée
  const soft = new Merger();     // intérieur (reçoit, projette)
  m.sink = glass.sink = soft.sink = VILLA_COLLIDERS;

  // Niveaux
  const GF = { x0: -9, x1: 9, z0: -10, z1: 2, y: 0.15, h: 3.5 };        // rez-de-chaussée 18 x 12 m
  const UF = { x0: -6, x1: 11, z0: -10, z1: -1, y: 3.95, h: 3.2 };      // étage 17 x 9 m (porte-à-faux côté piscine)
  const GA = { x0: -19, x1: -9, z0: -6, z1: 2, y: 0.06, h: 3.2 };       // garage 10 x 8 m
  const STAIR_HOLE = { x0: 0.1, x1: 4.6, z0: -9.95, z1: -8.35 };

  // --- Dalles et sols ---
  m.box(GF.x1 - GF.x0 + 0.5, 0.3, GF.z1 - GF.z0 + 0.5, M.stone, [(GF.x0 + GF.x1) / 2, 0, (GF.z0 + GF.z1) / 2]);  // socle (y -0.15..0.15)
  const gfFloor = new THREE.Mesh(floorGeometry(GF.x0 + 0.1, GF.x1 - 0.1, GF.z0 + 0.1, GF.z1 - 0.1), M.marble);
  gfFloor.position.y = GF.y + 0.01; gfFloor.receiveShadow = true; g.add(gfFloor);

  // Plafond RDC / plancher étage (une seule dalle, trou d'escalier) + porte-à-faux côté piscine
  m.add(slabGeometry(GF.x0 - 0.25, GF.x1 + 0.25, GF.z0 - 0.25, GF.z1 + 0.25, 0.3, [STAIR_HOLE]), M.plaster, [0, GF.y + GF.h, 0]);
  m.add(slabGeometry(GF.x1 + 0.25, UF.x1 + 0.25, UF.z0 - 0.25, UF.z1 + 0.25, 0.3), M.plaster, [0, GF.y + GF.h, 0]);
  const ufFloor = new THREE.Mesh(floorGeometry(UF.x0 + 0.1, UF.x1 - 0.1, UF.z0 + 0.1, UF.z1 - 0.1, [STAIR_HOLE]), M.wood);
  ufFloor.position.y = UF.y + 0.01; ufFloor.receiveShadow = true; g.add(ufFloor);
  // Terrasse sur le toit du RDC (deux zones non couvertes par l'étage)
  const deckA = new THREE.Mesh(floorGeometry(GF.x0, GF.x1, UF.z1, GF.z1), M.woodDark);
  deckA.position.y = UF.y + 0.01; deckA.receiveShadow = true; g.add(deckA);
  const deckB = new THREE.Mesh(floorGeometry(GF.x0, UF.x0, GF.z0, UF.z1), M.woodDark);
  deckB.position.y = UF.y + 0.01; deckB.receiveShadow = true; g.add(deckB);
  // Toiture de l'étage + acrotère
  m.box(UF.x1 - UF.x0 + 0.5, 0.3, UF.z1 - UF.z0 + 0.5, M.plaster, [(UF.x0 + UF.x1) / 2, UF.y + UF.h + 0.15, (UF.z0 + UF.z1) / 2]);
  const roofY = UF.y + UF.h + 0.3;
  m.box(UF.x1 - UF.x0 + 0.5, 0.02, UF.z1 - UF.z0 + 0.5, M.concrete, [(UF.x0 + UF.x1) / 2, roofY + 0.01, (UF.z0 + UF.z1) / 2]);
  parapet(m, M.plaster, UF.x0 - 0.25, UF.x1 + 0.25, UF.z0 - 0.25, UF.z1 + 0.25, roofY, 0.45);
  // Équipements de toiture (bloc technique + lanterneau)
  m.box(1.6, 0.7, 1.2, M.anthracite, [-3.5, roofY + 0.35, -8]);
  glass.box(2.0, 0.3, 1.4, M.glass, [6, roofY + 0.2, -8.5]);
  m.box(2.1, 0.06, 1.5, M.alu, [6, roofY + 0.04, -8.5]);

  // --- Murs du RDC ---
  const gy = GF.y, gh = GF.h;
  // Sud (z = 2) : volume d'entrée habillé de bois (x -9..-3) + grande baie du séjour (x -3..8.5)
  const doorOp = { a: 2.4, b: 4.1, y0: 0, y1: 2.6 };
  addWall(m, M.woodDark, GF.x0, gy, GF.z1, 6, gh, 'x', [doorOp]);
  const bayS = { a: 0, b: 11.5, y0: 0, y1: 3.1 };
  addWall(m, M.plaster, -3, gy, GF.z1, 12, gh, 'x', [bayS]);
  addGlazing(m, glass, M, -3, gy, GF.z1, 'x', bayS, 1.9);
  // Porte d'entrée : vantail bois + imposte vitrée latérale
  m.box(0.95, 2.5, 0.08, M.anthracite, [-6.1, gy + 1.25, GF.z1]);
  m.box(0.04, 0.5, 0.06, M.chrome, [-5.75, gy + 1.1, GF.z1 + 0.06]);
  put(glass, M.glass, 'x', GF.x0, GF.z1, 3.675, gy + 1.28, 0.85, 2.5, 0.02);
  put(m, M.alu, 'x', GF.x0, GF.z1, 3.25, gy + 1.3, 0.08, 2.6, 0.12);
  put(m, M.alu, 'x', GF.x0, GF.z1, 3.25, gy + 2.57, 1.7, 0.08, 0.12);
  // Auvent au-dessus de l'entrée
  m.box(3.4, 0.14, 1.7, M.plaster, [-5.75, gy + 2.78, GF.z1 + 0.85]);
  // Est (x = 9) : baie vitrée vers la piscine
  const bayE = { a: 1, b: 11, y0: 0, y1: 3.1 };
  addWall(m, M.plaster, GF.x1, gy, GF.z0, 12, gh, 'z', [bayE]);
  addGlazing(m, glass, M, GF.x1, gy, GF.z0, 'z', bayE, 2.0);
  // Nord (z = -10) : fenêtres cuisine (bandeau) et séjour
  const winK = { a: 0.7, b: 3.9, y0: 1.3, y1: 2.1 };
  const winL = { a: 15, b: 17, y0: 1.65, y1: 2.6 };
  addWall(m, M.plaster, GF.x0, gy, GF.z0, 18, gh, 'x', [winK, winL]);
  addGlazing(m, glass, M, GF.x0, gy, GF.z0, 'x', winK, 1.2);
  addGlazing(m, glass, M, GF.x0, gy, GF.z0, 'x', winL, 1.0);
  // Ouest (x = -9) : mitoyen du garage, avec une porte de service vers le garage (z -1.7..-0.7)
  addWall(m, M.plaster, GF.x0, gy, GF.z0, 12, gh, 'z', [{ a: 8.3, b: 9.3, y0: 0, y1: 2.2 }]);
  put(m, M.alu, 'z', GF.x0, GF.z0, 8.8, gy + 2.24, 1.1, 0.08, 0.3);
  // Cloison hall / séjour
  addWall(soft, M.plaster, -4.5, gy, -3, 5, gh, 'z', [], 0.15);

  // --- Murs de l'étage ---
  const uy = UF.y, uh = UF.h;
  const bayUS = { a: 1.5, b: 16.5, y0: 0, y1: 2.8 };
  addWall(m, M.plaster, UF.x0, uy, UF.z1, 17, uh, 'x', [bayUS]);
  addGlazing(m, glass, M, UF.x0, uy, UF.z1, 'x', bayUS, 1.9);
  const bayUE = { a: 1, b: 8, y0: 0, y1: 2.8 };
  addWall(m, M.plaster, UF.x1, uy, UF.z0, 9, uh, 'z', [bayUE]);
  addGlazing(m, glass, M, UF.x1, uy, UF.z0, 'z', bayUE, 1.75);
  const winUN1 = { a: 2, b: 5, y0: 1.0, y1: 2.3 };
  const winUN2 = { a: 11.5, b: 15, y0: 1.1, y1: 2.3 };
  addWall(m, M.plaster, UF.x0, uy, UF.z0, 17, uh, 'x', [winUN1, winUN2]);
  addGlazing(m, glass, M, UF.x0, uy, UF.z0, 'x', winUN1, 1.5);
  addGlazing(m, glass, M, UF.x0, uy, UF.z0, 'x', winUN2, 1.2);
  // Ouest de l'étage : habillage bois sombre (contraste avec l'enduit blanc)
  addWall(m, M.woodDark, UF.x0, uy, UF.z0, 9, uh, 'z');
  // Cloisons : chambre (x = 5) et salle de bain (z = -6, x -6..-0.5 avec retour)
  addWall(soft, M.plaster, 5, uy, UF.z0, 5, uh, 'z', [{ a: 3.8, b: 4.8, y0: 0, y1: 2.2 }], 0.15);
  addWall(soft, M.plaster, UF.x0, uy, -6, 5.5, uh, 'x', [{ a: 4.3, b: 5.3, y0: 0, y1: 2.2 }], 0.15);
  addWall(soft, M.plaster, -0.5, uy, UF.z0, 4, uh, 'z', [], 0.15);

  // --- Garde-corps de la terrasse sur le toit du RDC ---
  const ry = UF.y + 0.01;
  addRailing(m, glass, M, GF.x0, GF.z1, GF.x1, GF.z1, ry);
  addRailing(m, glass, M, GF.x1, UF.z1, GF.x1, GF.z1, ry);
  addRailing(m, glass, M, GF.x0, GF.z0, GF.x0, GF.z1, ry);
  addRailing(m, glass, M, GF.x0, GF.z0, UF.x0, GF.z0, ry);
  // Garde-corps de la trémie d'escalier à l'étage
  addRailing(m, glass, M, STAIR_HOLE.x0, STAIR_HOLE.z1, STAIR_HOLE.x1, STAIR_HOLE.z1, ry, 1.0);
  addRailing(m, glass, M, STAIR_HOLE.x1, STAIR_HOLE.z0, STAIR_HOLE.x1, STAIR_HOLE.z1, ry, 1.0);

  // --- Escalier (14 marches, de x = 4.5 vers x = 0.5, le long du mur nord) ---
  soft.sink = null;
  buildStairs(soft, glass, M, GF.y, UF.y);
  soft.sink = VILLA_COLLIDERS;
  // Garde-corps de la trémie et flanc ouvert de l'escalier : infranchissables
  VILLA_COLLIDERS.push(
    { x0: 0.0, x1: 4.7, y0: 0, y1: UF.y + 1.2, z0: STAIR_HOLE.z1 - 0.2, z1: STAIR_HOLE.z1 + 0.1 },
    { x0: STAIR_HOLE.x1 - 0.1, x1: STAIR_HOLE.x1 + 0.1, y0: UF.y, y1: UF.y + 1.2, z0: STAIR_HOLE.z0, z1: STAIR_HOLE.z1 },
    // Porte de garage : on ne sort pas de la maison pendant la visite
    { x0: -17.2, x1: -10.8, y0: 0, y1: 3, z0: 1.5, z1: 2.3 },
  );

  // --- Ameublement ---
  furnishGroundFloor(soft, M, GF.y + 0.02);
  furnishUpperFloor(soft, M, UF.y + 0.02);
  furnishRoofTerrace(soft, M, UF.y + 0.02);

  // --- Garage ---
  const door = buildGarage(m, glass, M, GA);

  // --- Luminaires (émissifs) + vraies lumières intérieures ---
  const fixture = nightEmissive(new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe9c4, roughness: 0.5 }), 3.5);
  const ceilGF = GF.y + GF.h - 0.03, ceilUF = UF.y + UF.h - 0.03;
  for (const [x, z] of [[3.6, -3.5], [-1.2, -6.5], [-6.6, -7.2], [-6, 0.3], [6, -7.5]]) soft.add(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16), fixture, [x, ceilGF, z]);
  for (const [x, z] of [[7, -5.5], [-2, -3.5], [-2, -8], [5, -2.5]]) soft.add(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16), fixture, [x, ceilUF, z]);
  for (const [x, z] of [[-16.2, -2], [-11.8, -2]]) soft.add(box(1.4, 0.06, 0.2), fixture, [x, GA.y + GA.h - 0.04, z]);
  // Appliques extérieures (entrée, garage, terrasse)
  const sconce = nightEmissive(new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffd9a0, roughness: 0.5 }), 3);
  for (const [x, z] of [[-7.4, GF.z1 + 0.08], [-4.2, GF.z1 + 0.08], [-18.2, GA.z1 + 0.08], [-9.8, GA.z1 + 0.08]]) soft.box(0.12, 0.3, 0.1, sconce, [x, 2.0, z]);
  soft.box(0.12, 0.3, 0.1, sconce, [GF.x1 + 0.08, 2.4, -9.6]);
  soft.box(0.12, 0.3, 0.1, sconce, [GF.x1 + 0.08, 2.4, 1.6]);

  const warm = 0xffe2b8;
  const l1 = nightLight(new THREE.PointLight(warm, 0, 16, 2), 34); l1.position.set(3.6, GF.y + 3.1, -3.5); g.add(l1);
  const l2 = nightLight(new THREE.PointLight(warm, 0, 16, 2), 30); l2.position.set(-4.5, GF.y + 3.1, -6.5); g.add(l2);
  const l3 = nightLight(new THREE.PointLight(warm, 0, 16, 2), 30); l3.position.set(4, UF.y + 2.8, -5); g.add(l3);
  const l4 = nightLight(new THREE.PointLight(0xdfe8ff, 0, 16, 2), 45); l4.position.set(-14, GA.y + 2.9, -2); g.add(l4);
  const l5 = nightLight(new THREE.PointLight(0xffd9a0, 0, 12, 2), 14); l5.position.set(-5.75, 2.6, 3.2); g.add(l5);

  // Assemblage
  m.build(g);
  soft.build(g);
  glass.build(g, { cast: false, receive: false });
  g.add(door.group);
  scene.add(g);

  return { group: g, garageDoor: door };
}

function parapet(m, mat, x0, x1, z0, z1, y, h, th = 0.2) {
  m.box(x1 - x0, h, th, mat, [(x0 + x1) / 2, y + h / 2, z0 + th / 2]);
  m.box(x1 - x0, h, th, mat, [(x0 + x1) / 2, y + h / 2, z1 - th / 2]);
  m.box(th, h, z1 - z0, mat, [x0 + th / 2, y + h / 2, (z0 + z1) / 2]);
  m.box(th, h, z1 - z0, mat, [x1 - th / 2, y + h / 2, (z0 + z1) / 2]);
}

function buildStairs(m, glass, M, yBottom, yTop) {
  const n = 14, rise = (yTop - yBottom) / n, tread = 4.0 / n;
  const xStart = 4.5, zc = -9.15, width = 1.2;
  for (let i = 0; i < n; i++) {
    const h = rise * (i + 1);
    m.box(tread, h, width, M.white, [xStart - tread * (i + 0.5), yBottom + h / 2, zc]);
    m.box(tread + 0.03, 0.04, width + 0.02, M.woodDark, [xStart - tread * (i + 0.5), yBottom + h + 0.02, zc]);
  }
  // Garde-corps vitré incliné côté séjour + main courante
  const run = 4.0, totalRise = yTop - yBottom;
  const len = Math.hypot(run, totalRise), ang = -Math.atan2(totalRise, run);
  const cx = xStart - run / 2, cy = yBottom + totalRise / 2;
  glass.add(box(len - 0.1, 0.95, 0.02), M.glass, [cx, cy + 0.6, zc + width / 2 + 0.02], [0, 0, ang]);
  m.add(box(len, 0.05, 0.06), M.alu, [cx, cy + 1.1, zc + width / 2 + 0.02], [0, 0, ang]);
  m.add(box(len, 0.06, 0.04), M.alu, [cx, cy + 0.12, zc + width / 2 + 0.02], [0, 0, ang]);
}

function chair(m, M, x, z, dirZ, y) {
  m.box(0.42, 0.05, 0.42, M.anthracite, [x, y + 0.46, z]);
  m.box(0.42, 0.45, 0.04, M.anthracite, [x, y + 0.7, z + dirZ * 0.19]);
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) m.box(0.03, 0.44, 0.03, M.darkMetal, [x + dx, y + 0.22, z + dz]);
}

function table(m, M, x, z, w, d, y, h = 0.75, mat) {
  m.box(w, 0.05, d, mat || M.woodDark, [x, y + h, z]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(0.07, h, 0.07, M.darkMetal, [x + sx * (w / 2 - 0.1), y + h / 2, z + sz * (d / 2 - 0.1)]);
}

function furnishGroundFloor(m, M, y) {
  // Séjour (côté baie est) : tapis, canapé en L, table basse, meuble TV
  m.box(4.6, 0.02, 3.4, M.fabric, [4, y, -3.6]);
  m.box(3.0, 0.42, 0.95, M.white, [3.6, y + 0.21, -2.4]);
  m.box(3.0, 0.42, 0.25, M.white, [3.6, y + 0.63, -2.0]);
  m.box(0.95, 0.42, 2.4, M.white, [6.2, y + 0.21, -3.9]);
  m.box(0.25, 0.42, 2.4, M.white, [6.55, y + 0.63, -3.9]);
  m.box(0.5, 0.14, 0.5, M.fabricAccent, [2.6, y + 0.49, -2.4]);
  m.box(0.5, 0.14, 0.5, M.fabricAccent, [6.2, y + 0.49, -4.6]);
  table(m, M, 3.6, -4.3, 1.4, 0.7, y, 0.42);
  m.box(2.4, 0.45, 0.42, M.woodDark, [7, y + 0.225, -9.55]);
  m.box(1.7, 0.9, 0.05, M.darkMetal, [7, y + 0.98, -9.7]);
  // Lampadaire
  m.box(0.04, 1.6, 0.04, M.darkMetal, [7.9, y + 0.8, -1.2]);
  m.add(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 12, 1, true), M.cream, [7.9, y + 1.6, -1.2]);
  // Salle à manger
  table(m, M, -1.2, -6.5, 2.4, 1.0, y, 0.76);
  for (const x of [-2.0, -1.2, -0.4]) { chair(m, M, x, -7.25, -1, y); chair(m, M, x, -5.75, 1, y); }
  // Cuisine : linéaire sur le mur nord, réfrigérateur, îlot, tabourets
  m.box(3.2, 0.9, 0.65, M.white, [-7.0, y + 0.45, -9.5]);
  m.box(3.25, 0.04, 0.7, M.darkMetal, [-7.0, y + 0.92, -9.5]);
  m.box(0.85, 2.0, 0.7, M.alu, [-4.7, y + 1.0, -9.47]);
  m.box(2.4, 0.9, 1.0, M.woodDark, [-6.6, y + 0.45, -7.2]);
  m.box(2.5, 0.05, 1.1, M.white, [-6.6, y + 0.925, -7.2]);
  for (const x of [-7.4, -6.6, -5.8]) {
    m.add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), M.anthracite, [x, y + 0.72, -6.3]);
    m.add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), M.chrome, [x, y + 0.35, -6.3]);
  }
  m.box(0.8, 0.45, 0.5, M.alu, [-6.6, y + 2.4, -7.2]); // hotte
  // Bibliothèque et tableaux
  m.box(0.35, 2.2, 2.2, M.woodDark, [-4.25, y + 1.1, -1.8]);
  for (let i = 0; i < 4; i++) m.box(0.3, 0.03, 2.1, M.white, [-4.25, y + 0.45 + i * 0.5, -1.8]);
  for (let i = 0; i < 9; i++) m.box(0.22, 0.25 + (i % 3) * 0.04, 0.05, [M.fabricAccent, M.anthracite, M.teak][i % 3], [-4.2, y + 0.6 + Math.floor(i / 3) * 0.5, -2.6 + (i % 3) * 0.55 + Math.floor(i / 3) * 0.1]);
  m.box(1.6, 1.1, 0.04, M.fabricAccent, [-1.2, y + 1.9, -9.85]);
  m.box(1.7, 1.2, 0.03, M.white, [-1.2, y + 1.9, -9.87]);
  m.box(1.0, 1.4, 0.04, M.anthracite, [-4.58, y + 1.7, -0.5]);
  // Hall : console + plante
  m.box(1.2, 0.04, 0.35, M.woodDark, [-7.8, y + 0.85, -2.0]);
  m.box(0.04, 0.83, 0.3, M.darkMetal, [-8.3, y + 0.42, -2.0]);
  m.box(0.04, 0.83, 0.3, M.darkMetal, [-7.3, y + 0.42, -2.0]);
  m.add(new THREE.CylinderGeometry(0.3, 0.24, 0.6, 12), M.terracotta, [-8.0, y + 0.3, 1.0]);
  m.add(new THREE.SphereGeometry(0.5, 10, 8), M.leafDark, [-8.0, y + 1.1, 1.0]);
}

function furnishUpperFloor(m, M, y) {
  // Chambre principale (est)
  m.box(3.2, 0.02, 2.8, M.fabric, [7.5, y, -7.0]);
  m.box(1.9, 0.35, 2.1, M.woodDark, [7.5, y + 0.175, -7.5]);
  m.box(1.8, 0.25, 2.0, M.white, [7.5, y + 0.475, -7.5]);
  m.box(2.2, 1.1, 0.1, M.fabric, [7.5, y + 0.55, -8.62]);
  m.box(0.65, 0.14, 0.4, M.white, [7.1, y + 0.67, -8.2]);
  m.box(0.65, 0.14, 0.4, M.white, [7.9, y + 0.67, -8.2]);
  m.box(1.8, 0.08, 0.9, M.fabricAccent, [7.5, y + 0.64, -6.9]);
  for (const x of [6.15, 8.85]) {
    m.box(0.5, 0.5, 0.45, M.woodDark, [x, y + 0.25, -8.3]);
    m.add(new THREE.CylinderGeometry(0.12, 0.15, 0.25, 10, 1, true), M.cream, [x, y + 0.72, -8.3]);
  }
  m.box(1.6, 0.42, 0.45, M.fabric, [7.5, y + 0.21, -5.6]); // banc
  m.box(0.6, 2.4, 2.4, M.woodDark, [5.4, y + 1.2, -7.5]); // dressing contre la cloison
  // Salle de bain (nord-ouest)
  m.box(1.8, 0.6, 0.85, M.white, [-3.5, y + 0.3, -9.3]);
  m.box(1.6, 0.85, 0.55, M.woodDark, [-1.5, y + 0.425, -9.45]);
  m.box(1.65, 0.05, 0.6, M.white, [-1.5, y + 0.87, -9.45]);
  m.add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14), M.white, [-1.5, y + 0.95, -9.45]);
  m.box(1.2, 0.9, 0.04, M.chrome, [-1.5, y + 1.7, -9.7]); // miroir
  // WC + douche à l'italienne (paroi vitrée)
  m.box(0.4, 0.4, 0.55, M.white, [-5.5, y + 0.2, -6.9]);
  m.add(new THREE.CylinderGeometry(0.2, 0.17, 0.08, 14), M.white, [-5.5, y + 0.44, -6.8]);
  m.box(0.4, 0.5, 0.15, M.white, [-5.5, y + 0.65, -7.15]);
  m.box(1.0, 0.04, 1.0, M.stone, [-3.0, y + 0.02, -6.9]);
  m.box(0.04, 2.0, 1.0, M.glass, [-3.5, y + 1.0, -6.9]);
  m.box(0.05, 2.1, 0.05, M.chrome, [-2.55, y + 1.05, -6.9]);
  m.add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), M.chrome, [-2.75, y + 2.1, -6.9]);
  // Bureau / salon TV (sud-ouest, devant la baie)
  table(m, M, -2.5, -2.6, 1.6, 0.7, y, 0.74, M.white);
  chair(m, M, -2.5, -3.3, -1, y);
  m.box(2.2, 0.42, 0.9, M.fabric, [-2.5, y + 0.21, -4.8]);
  m.box(2.2, 0.4, 0.25, M.fabric, [-2.5, y + 0.6, -5.15]);
  m.box(0.4, 0.14, 0.4, M.fabricAccent, [-3.2, y + 0.49, -4.8]);
  m.add(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 12), M.terracotta, [0.8, y + 0.25, -1.8]);
  m.add(new THREE.SphereGeometry(0.45, 10, 8), M.leafDark, [0.8, y + 0.95, -1.8]);
}

function furnishRoofTerrace(m, M, y) {
  // Deux bains de soleil et une jardinière sur la terrasse du toit
  for (const x of [2.5, 4.3]) {
    m.box(0.7, 0.3, 1.9, M.white, [x, y + 0.2, 0.5]);
    m.box(0.7, 0.55, 0.12, M.white, [x, y + 0.6, -0.4], [-0.5, 0, 0]);
  }
  m.box(1.2, 0.5, 0.5, M.anthracite, [-7.5, y + 0.25, -5]);
  m.box(1.1, 0.5, 0.4, M.leafDark, [-7.5, y + 0.7, -5]);
  m.box(0.6, 0.5, 0.6, M.anthracite, [7.5, y + 0.25, 1.2]);
  m.add(new THREE.SphereGeometry(0.4, 10, 8), M.leafDark, [7.5, y + 0.8, 1.2]);
}

// ---------- Garage + porte sectionnelle ----------

function buildGarage(m, glass, M, GA) {
  const { x0, x1, z0, z1, y, h } = GA;
  const doorW = 5.9, doorH = 2.55, cx = (x0 + x1) / 2;
  m.box(x1 - x0, 0.12, z1 - z0, M.concrete, [cx, 0, (z0 + z1) / 2]); // dalle (y -0.06..0.06)
  // Murs en bardage anthracite : sud (porte), ouest, nord. L'est est le mur de la villa.
  const doorOp = { a: cx - doorW / 2 - x0, b: cx + doorW / 2 - x0, y0: 0, y1: doorH + 0.05 };
  addWall(m, M.anthracite, x0, y, z1, x1 - x0, h, 'x', [doorOp]);
  addWall(m, M.anthracite, x0, y, z0, z1 - z0, h, 'z');
  addWall(m, M.anthracite, x0, y, z0, x1 - x0, h, 'x', [{ a: 2, b: 4, y0: 1.6, y1: 2.4 }]);
  addGlazing(m, glass, M, x0, y, z0, 'x', { a: 2, b: 4, y0: 1.6, y1: 2.4 }, 1.0);
  // Toiture + acrotère
  m.box(x1 - x0 + 0.5, 0.3, z1 - z0 + 0.5, M.anthracite, [cx, y + h + 0.15, (z0 + z1) / 2]);
  parapet(m, M.anthracite, x0 - 0.25, x1 + 0.25, z0 - 0.25, z1 + 0.25, y + h + 0.3, 0.35);
  // Encadrement de la porte
  m.box(doorW + 0.3, 0.12, 0.3, M.alu, [cx, y + doorH + 0.11, z1]);
  m.box(0.12, doorH + 0.1, 0.3, M.alu, [cx - doorW / 2 - 0.08, y + doorH / 2 + 0.05, z1]);
  m.box(0.12, doorH + 0.1, 0.3, M.alu, [cx + doorW / 2 + 0.08, y + doorH / 2 + 0.05, z1]);
  // Rails (verticaux puis horizontaux au plafond)
  const zDoor = z1 - 0.28, yTrack = 2.85, r = 0.45;
  for (const sx of [-1, 1]) {
    m.box(0.06, yTrack - r - y, 0.08, M.alu, [cx + sx * (doorW / 2 + 0.06), y + (yTrack - r - y) / 2, zDoor]);
    m.box(0.06, 0.08, 3.2, M.alu, [cx + sx * (doorW / 2 + 0.06), yTrack, zDoor - r - 1.6]);
  }
  // Mobilier de garage : établi + étagère
  m.box(2.2, 0.9, 0.6, M.anthracite, [x0 + 1.3, y + 0.45, z0 + 0.45]);
  m.box(2.2, 0.05, 0.65, M.woodDark, [x0 + 1.3, y + 0.92, z0 + 0.45]);
  m.box(1.6, 1.8, 0.4, M.alu, [x1 - 1.0, y + 0.9, z0 + 0.35]);

  // Porte sectionnelle : 5 panneaux qui montent puis basculent dans le rail horizontal.
  const group = new THREE.Group();
  const n = 5, ph = doorH / n;
  const panels = [];
  const windowMat = M.glassDark;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    const panel = new THREE.Mesh(box(doorW, ph - 0.02, 0.06), M.garageDoor);
    panel.castShadow = true; panel.receiveShadow = true;
    p.add(panel);
    if (i === n - 1) {
      // hublots sur le panneau supérieur
      for (let k = -1; k <= 1; k++) {
        const w = new THREE.Mesh(box(1.2, ph * 0.45, 0.07), windowMat);
        w.position.x = k * 1.8;
        p.add(w);
      }
    }
    // poignée sur le panneau du bas
    if (i === 0) { const hd = new THREE.Mesh(box(0.3, 0.05, 0.05), M.chrome); hd.position.set(0, -0.05, 0.05); p.add(hd); }
    group.add(p);
    panels.push(p);
  }
  const L1 = (yTrack - r) - y;
  const La = (r * Math.PI) / 2;
  const travel = L1 + La - ph / 2 + 0.05;
  const place = (p, s) => {
    if (s <= L1) { p.position.set(cx, y + s, zDoor); p.rotation.x = 0; }
    else if (s <= L1 + La) {
      const th = (s - L1) / r;
      p.position.set(cx, yTrack - r + r * Math.sin(th), zDoor - r + r * Math.cos(th));
      p.rotation.x = -th;
    } else {
      p.position.set(cx, yTrack, zDoor - r - (s - L1 - La));
      p.rotation.x = -Math.PI / 2;
    }
  };
  const setProgress = (prog) => { for (let i = 0; i < n; i++) place(panels[i], (i + 0.5) * ph + prog * travel); };
  setProgress(0);
  return { group, setProgress };
}
