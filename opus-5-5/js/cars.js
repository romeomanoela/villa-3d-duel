import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batcher } from './utils.js';

// Deux voitures de luxe au design original (sans logo) : un coupé GT et un SUV grand tourisme.
// Repère local : longueur selon X (avant en +X), largeur selon Z, puis voiture tournée vers +Z.
const V2 = (x, y) => new THREE.Vector2(x, y);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function extrudeProfile(shape, width, bevel, taper) {
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 4, curveSegments: 40 });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * taper(p.getX(i), p.getY(i)));
  return g;
}

// Profil latéral : ligne haute en spline + bas de caisse avec passages de roue.
function bodyShape(top, wheels, ra, wy, yb) {
  const s = new THREE.Shape();
  s.moveTo(...top[0]);
  s.splineThru(top.slice(1).map((p) => V2(...p)));
  s.lineTo(top[top.length - 1][0], yb);
  for (const wx of [...wheels].sort((a, b) => b - a)) {
    const dx = Math.sqrt(ra * ra - (wy - yb) ** 2);
    const a0 = Math.atan2(yb - wy, dx);
    s.lineTo(wx + dx, yb);
    s.absarc(wx, wy, ra, a0, Math.PI - a0, false);
  }
  s.lineTo(top[0][0], yb);
  s.closePath();
  return s;
}

function cabinShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  s.splineThru(pts.slice(1).map((p) => V2(...p)));
  s.closePath();
  return s;
}

function wheel(b, mats, r, w, style) {
  const ri = r * 0.68, h = w / 2, c = 0.05;
  const prof = [V2(ri, -h), V2(r - c, -h)];
  for (let k = 1; k <= 4; k++) { const a = (k / 4) * Math.PI / 2; prof.push(V2(r - c + Math.sin(a) * c, -h + c - Math.cos(a) * c)); }
  for (let k = 0; k <= 4; k++) { const a = (k / 4) * Math.PI / 2; prof.push(V2(r - c + Math.cos(a) * c, h - c + Math.sin(a) * c)); }
  prof.push(V2(ri, h));
  b.mesh(new THREE.LatheGeometry(prof, 40), mats.tire, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const face = h - 0.02;
  b.mesh(new THREE.CylinderGeometry(ri, ri, w * 0.8, 32, 1, true), mats.trim, [0, 0, 0], [Math.PI / 2, 0, 0]);
  b.mesh(new THREE.CylinderGeometry(ri * 0.82, ri * 0.82, 0.02, 32), mats.steel, [0, 0, face - 0.12], [Math.PI / 2, 0, 0]);
  b.box(mats.caliper, 0.12, 0.16, 0.08, ri * 0.55, ri * 0.35, face - 0.09);
  b.mesh(new THREE.TorusGeometry(ri - 0.015, 0.018, 8, 40), mats.rim, [0, 0, face]);
  b.mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 16), mats.rim, [0, 0, face], [Math.PI / 2, 0, 0]);
  const n = style === 'ten' ? 10 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const offs = style === 'ten' ? [0] : [-0.09, 0.09];
    for (const o of offs) {
      b.push(0, 0, face - 0.01, 0, 0, a + o);
      b.box(mats.rim, ri - 0.06, style === 'ten' ? 0.035 : 0.05, 0.03, (ri - 0.06) / 2 + 0.05, 0, 0);
      b.pop();
    }
  }
}

function makeMats(paintColor, rimColor, caliper) {
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: paintColor, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x070a0d, metalness: 0.15, roughness: 0.05, transparent: true, opacity: 0.8, envMapIntensity: 1.1, depthWrite: false }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.45, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8d9095, roughness: 0.35, metalness: 1 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.08, metalness: 1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 }),
    rim: new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.22, metalness: 1 }),
    caliper: new THREE.MeshStandardMaterial({ color: caliper, roughness: 0.4 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x2b1e17, roughness: 0.55 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }),
    head: new THREE.MeshStandardMaterial({ color: 0xf4f8ff, emissive: 0xe6efff, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x4a0508, emissive: 0xff1a22, emissiveIntensity: 0.4, roughness: 0.2 }),
  };
  return M;
}

function buildCar(spec) {
  const g = new THREE.Group();
  const b = new Batcher();
  const m = makeMats(spec.color, spec.rimColor, spec.caliper);
  const { L: len, W, r, wheels, belt } = spec;
  const half = len / 2;

  const body = extrudeProfile(bodyShape(spec.top, wheels, r + 0.08, r, spec.yb), W, 0.1, (x, y) =>
    (1 - 0.16 * sstep(half - 0.75, half + 0.05, Math.abs(x))) * (1 - 0.09 * sstep(belt - 0.35, belt + 0.1, y)));
  b.add(body, m.paint);
  const cab = extrudeProfile(cabinShape(spec.cabin), spec.cabW, 0.08, (x, y) => 1 - 0.24 * sstep(belt - 0.05, spec.roofY, y));
  b.add(cab, m.glass, null, { cast: true, receive: false });
  if (spec.roof) {
    const [x0, x1, y] = spec.roof;
    b.mesh(new RoundedBoxGeometry(x1 - x0, 0.07, spec.cabW * 0.8, 3, 0.03), m.paint, [(x0 + x1) / 2, y, 0]);
    for (const s of [-1, 1]) {
      b.box(m.steel, x1 - x0 - 0.3, 0.035, 0.035, (x0 + x1) / 2, y + 0.07, s * spec.cabW * 0.33);
      b.box(m.trim, 0.12, spec.roofY - belt, 0.05, spec.bPillar, (belt + spec.roofY) / 2, s * spec.cabW * 0.41, 0, { cast: false });
    }
  }
  // Intérieur visible à travers les vitres
  for (const s of [-1, 1]) {
    b.box(m.seat, 0.55, 0.12, 0.5, spec.seatX, belt - 0.32, s * 0.38);
    b.push(spec.seatX - 0.25, belt - 0.26, s * 0.38, 0, 0, -0.25);
    b.box(m.seat, 0.12, 0.65, 0.48, 0, 0.3, 0);
    b.pop();
  }
  if (spec.rearSeat) b.box(m.seat, 0.55, 0.5, W - 0.5, spec.seatX - 1.0, belt - 0.15, 0);
  b.box(m.trim, 0.4, 0.12, W - 0.4, spec.dashX, belt - 0.02, 0);
  b.mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24), m.trim, [spec.dashX - 0.22, belt + 0.05, 0.38], [0, Math.PI / 2, 0.35]);

  // Signature lumineuse, calandre, détails
  const fz = W / 2 - 0.28;
  for (const s of [-1, 1]) {
    for (const [x, y, ln, h, rz] of spec.heads) {
      b.push(x, y, s * (fz - 0.05), 0, 0, rz);
      b.box(m.head, 0.1, h, ln, 0, 0, 0, 0, { cast: false });
      b.pop();
    }
    for (const [x, y, ln, h] of spec.tails) b.box(m.tail, 0.08, h, ln, x, y, s * (fz - ln / 2 + 0.2), 0, { cast: false });
    b.push(spec.mirror[0], spec.mirror[1], s * (W / 2 + 0.02), 0);
    b.box(m.paint, 0.16, 0.1, 0.2, 0, 0, s * 0.05);
    b.box(m.trim, 0.08, 0.03, 0.12, 0.02, -0.07, -s * 0.03);
    b.pop();
    b.box(m.trim, len - 1.2, 0.08, 0.06, 0, spec.yb + 0.04, s * (W / 2 - 0.04));
    b.box(m.chrome, 0.2, 0.02, 0.02, spec.handleX, belt - 0.12, s * (W / 2 - 0.02));
  }
  if (spec.fullTail) b.box(m.tail, 0.06, 0.04, W - 0.5, -half - 0.02, spec.fullTail, 0, 0, { cast: false });
  b.box(m.trim, 0.1, spec.grille[1], spec.grille[0], half + 0.02, spec.grille[2], 0);
  if (spec.grilleChrome) {
    b.box(m.chrome, 0.11, 0.025, spec.grille[0] + 0.04, half + 0.02, spec.grille[2] + spec.grille[1] / 2, 0);
    for (let k = 1; k < 7; k++) b.box(m.chrome, 0.105, spec.grille[1] - 0.04, 0.012, half + 0.02, spec.grille[2], -spec.grille[0] / 2 + (k * spec.grille[0]) / 7);
  }
  b.box(m.trim, 0.3, 0.12, W - 0.5, -half + 0.1, spec.yb + 0.12, 0);
  for (const z of spec.exhaust) b.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 14), m.chrome, [-half - 0.02, spec.yb + 0.1, z], [0, 0, Math.PI / 2]);
  b.box(m.plate, 0.02, 0.11, 0.5, -half - 0.06, spec.plateY, 0);
  if (spec.frontPlate) b.box(m.plate, 0.02, 0.11, 0.5, half + 0.06, spec.yb + 0.16, 0);
  if (spec.beltChrome) for (const s of [-1, 1]) b.box(m.chrome, spec.beltChrome[0], 0.025, 0.02, spec.beltChrome[1], belt + 0.02, s * (spec.cabW / 2 - 0.03));

  for (const wx of wheels) for (const s of [-1, 1]) {
    b.push(wx, r, s * (W / 2 - spec.tireW / 2 - 0.02), s > 0 ? 0 : Math.PI);
    wheel(b, m, r, spec.tireW, spec.rim);
    b.pop();
  }
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2;
  b.build(inner, spec.name);
  g.add(inner);

  // Projecteurs réels (nuit) : orientés vers l'avant, portée sur l'allée
  const spot = new THREE.SpotLight(0xeaf2ff, 0, 32, 0.42, 0.6, 1.4);
  spot.position.set(0, spec.heads[0][1], half - 0.1);
  spot.target.position.set(0, 0, half + 12);
  g.add(spot, spot.target);
  return { group: g, mats: m, spot };
}

const GT = {
  name: 'coupe-gt', color: 0x7d0e14, rimColor: 0x2a2c30, caliper: 0xd8b04a, rim: 'ten',
  L: 4.62, W: 1.96, r: 0.35, tireW: 0.27, wheels: [1.4, -1.36], belt: 0.9, yb: 0.17,
  top: [[-2.3, 0.3], [-2.34, 0.56], [-2.24, 0.84], [-1.6, 0.94], [-0.6, 0.94], [0.5, 0.86], [1.3, 0.76], [1.95, 0.66], [2.3, 0.5], [2.32, 0.3]],
  cabin: [[0.66, 0.82], [0.1, 1.14], [-0.5, 1.23], [-1.2, 1.15], [-2.0, 0.9], [-0.6, 0.88]],
  cabW: 1.56, roofY: 1.23, seatX: -0.55, dashX: 0.35, handleX: -0.25,
  heads: [[2.1, 0.64, 0.42, 0.045, -0.32], [2.27, 0.48, 0.3, 0.03, -0.9]],
  tails: [[-2.31, 0.72, 0.36, 0.05]], fullTail: 0.73, mirror: [0.45, 0.92],
  grille: [1.2, 0.16, 0.3], exhaust: [-0.62, -0.5, 0.5, 0.62], plateY: 0.48,
};
const SUV = {
  name: 'suv', color: 0x23302b, rimColor: 0xc9ccd1, caliper: 0x1a1a1a, rim: 'five',
  L: 4.98, W: 2.02, r: 0.4, tireW: 0.29, wheels: [1.52, -1.48], belt: 1.08, yb: 0.25, rearSeat: true,
  top: [[-2.45, 0.42], [-2.5, 0.78], [-2.42, 1.08], [-1.4, 1.12], [0.6, 1.1], [1.4, 1.02], [2.2, 0.94], [2.46, 0.78], [2.49, 0.45]],
  cabin: [[1.0, 1.0], [0.3, 1.56], [-0.4, 1.64], [-2.1, 1.62], [-2.4, 1.1], [-0.6, 1.06]],
  cabW: 1.76, roofY: 1.62, roof: [-2.15, 0.25, 1.65], bPillar: -0.45, seatX: -0.3, dashX: 0.62, handleX: -0.35,
  heads: [[2.38, 0.86, 0.38, 0.05, -0.2], [2.44, 0.74, 0.32, 0.025, -0.2]],
  tails: [[-2.47, 0.98, 0.22, 0.22], [-2.48, 1.06, 0.5, 0.04]], mirror: [0.75, 1.1],
  grille: [1.0, 0.3, 0.62], grilleChrome: true, exhaust: [-0.55, 0.55], plateY: 0.62, frontPlate: true, beltChrome: [3.0, -0.75],
};

export function buildCars(scene) {
  const cars = [buildCar(GT), buildCar(SUV)];
  cars[0].group.position.set(8.45, 0.08, -1.0);
  cars[1].group.position.set(11.55, 0.08, -1.25);
  for (const c of cars) scene.add(c.group);
  return {
    update(state) {
      for (const c of cars) {
        c.mats.head.emissiveIntensity = 0.6 + 6 * state.lights;
        c.mats.tail.emissiveIntensity = 0.35 + 2.6 * state.lights;
        c.spot.intensity = 90 * state.lights * state.door;
      }
    },
  };
}
