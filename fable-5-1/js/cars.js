// Deux voitures de luxe procédurales (designs originaux, sans marque) : coupé GT et SUV grand tourisme.
// Profil latéral extrudé (x = avant, y = haut), extrusion selon z = largeur.
import * as THREE from 'three';
import { box } from './utils.js';
import { R, nightLight, nightEmissive } from './registry.js';

function profileShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  return s;
}

function extrude(pts, width, bevel = 0.08, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(profileShape(pts), {
    depth: Math.max(0.05, width - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments,
  });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  g.computeVertexNormals();
  return g;
}

function wheel(M, r, w, rimMat) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), M.rubber);
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.64, r * 0.64, w + 0.02, 28), rimMat);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w + 0.03, 28), M.darkMetal);
  inner.rotation.x = Math.PI / 2;
  g.add(inner);
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 1.1, w + 0.05), rimMat);
    sp.rotation.z = (i / 7) * Math.PI;
    g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.14, r * 0.14, w + 0.06, 16), M.chrome);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w * 0.3, 20), M.chrome);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  return g;
}

/**
 * spec : { length, width, bodyPts, cabinPts, roofPts, wheelR, wheelX, paint, headY, tailY, ... }
 * Retourne un Group ; avant vers +x, sol à y = 0.
 */
function buildCar(M, spec) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.paint, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4,
  });
  R.envMaterials.push(paint);
  const rimMat = new THREE.MeshStandardMaterial({ color: spec.rim || 0xd8d8de, metalness: 1, roughness: 0.25, envMapIntensity: 1.2 });
  R.envMaterials.push(rimMat);

  const body = new THREE.Mesh(extrude(spec.bodyPts, spec.width, 0.09), paint);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(extrude(spec.cabinPts, spec.width - 0.22, 0.05), M.glassDark);
  cabin.castShadow = true;
  g.add(cabin);

  const roof = new THREE.Mesh(extrude(spec.roofPts, spec.width - 0.3, 0.03), paint);
  roof.castShadow = true;
  g.add(roof);

  // Montants de pare-brise / custodes (fines bandes sombres)
  for (const [x, y, h, a] of spec.pillars || []) {
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(box(0.05, h, 0.04), M.darkMetal);
      p.position.set(x, y, side * (spec.width / 2 - 0.16));
      p.rotation.z = a;
      g.add(p);
    }
  }

  // Roues
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = wheel(M, spec.wheelR, 0.26, rimMat);
    w.position.set(sx * spec.wheelX, spec.wheelR, sz * (spec.width / 2 - 0.1));
    g.add(w);
  }

  // Détails : calandre, pare-chocs, bas de caisse, rétroviseurs, poignées, échappement
  const L = spec.length / 2;
  const grille = new THREE.Mesh(box(0.08, spec.grille[1], spec.grille[2]), M.darkMetal);
  grille.position.set(L - 0.02, spec.grille[0], 0);
  g.add(grille);
  const bumperF = new THREE.Mesh(box(0.12, 0.16, spec.width - 0.3), M.anthracite);
  bumperF.position.set(L - 0.06, 0.32, 0);
  g.add(bumperF);
  const bumperR = new THREE.Mesh(box(0.12, 0.16, spec.width - 0.3), M.anthracite);
  bumperR.position.set(-L + 0.06, 0.34, 0);
  g.add(bumperR);
  const skirt = new THREE.Mesh(box(spec.length * 0.6, 0.08, spec.width - 0.1), M.anthracite);
  skirt.position.set(0, spec.skirtY, 0);
  g.add(skirt);
  for (const side of [-1, 1]) {
    const mir = new THREE.Mesh(box(0.14, 0.09, 0.22), paint);
    mir.position.set(spec.mirrorX, spec.mirrorY, side * (spec.width / 2 + 0.08));
    g.add(mir);
    const handle = new THREE.Mesh(box(0.18, 0.03, 0.03), M.chrome);
    handle.position.set(spec.mirrorX - 1.0, spec.mirrorY - 0.3, side * (spec.width / 2 + 0.01));
    g.add(handle);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), M.chrome);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-L + 0.02, 0.3, side * (spec.width / 2 - 0.35));
    g.add(exhaust);
  }
  const plate = new THREE.Mesh(box(0.02, 0.12, 0.5), M.white);
  plate.position.set(-L - 0.02, 0.5, 0);
  g.add(plate);

  // Phares (blancs) et feux (rouges) : émissifs la nuit + un projecteur réel par voiture
  const headMat = nightEmissive(new THREE.MeshStandardMaterial({ color: 0xf2f6ff, emissive: 0xeaf2ff, roughness: 0.2 }), 6);
  const tailMat = nightEmissive(new THREE.MeshStandardMaterial({ color: 0x6a0a12, emissive: 0xff2030, roughness: 0.3 }), 3);
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(box(0.06, spec.headSize[0], spec.headSize[1]), headMat);
    hl.position.set(L - 0.04, spec.headY, side * (spec.width / 2 - 0.3));
    hl.rotation.y = side * -0.25;
    g.add(hl);
  }
  const tail = new THREE.Mesh(box(0.05, 0.08, spec.width - 0.5), tailMat);
  tail.position.set(-L - 0.0, spec.tailY, 0);
  g.add(tail);

  const spot = nightLight(new THREE.SpotLight(0xe8f0ff, 0, 30, 0.42, 0.55, 2), 90);
  spot.position.set(L - 0.1, spec.headY, 0);
  spot.target.position.set(L + 12, -0.5, 0);
  g.add(spot); g.add(spot.target);

  return g;
}

export const COUPE = {
  length: 4.6, width: 1.98, wheelR: 0.36, wheelX: 1.42, paint: 0xa8101e,
  bodyPts: [
    [-2.3, 0.4], [-2.3, 0.74], [-2.2, 0.82, -1.95, 0.84], [-1.4, 0.86], [-0.3, 0.88], [0.9, 0.82],
    [1.8, 0.7], [2.25, 0.6, 2.3, 0.5], [2.3, 0.38], [2.0, 0.28], [-2.0, 0.28],
  ],
  cabinPts: [[-1.6, 0.84], [-1.3, 1.2, -0.9, 1.26], [-0.1, 1.28], [0.55, 1.22], [1.25, 0.84]],
  roofPts: [[-1.05, 1.21], [-0.5, 1.27], [0.3, 1.26], [0.35, 1.3], [-0.5, 1.31], [-1.05, 1.25]],
  pillars: [[-1.3, 1.02, 0.42, 0.72], [1.0, 1.02, 0.46, -0.9]],
  grille: [0.52, 0.16, 1.0], skirtY: 0.3, mirrorX: 0.75, mirrorY: 0.98, headY: 0.64, headSize: [0.08, 0.34], tailY: 0.72,
};

export const SUV = {
  length: 4.95, width: 2.02, wheelR: 0.42, wheelX: 1.55, paint: 0x121b3a, rim: 0x2a2d33,
  bodyPts: [
    [-2.45, 0.5], [-2.45, 1.0], [-2.35, 1.1, -2.1, 1.12], [1.5, 1.08], [2.2, 0.98, 2.45, 0.82],
    [2.45, 0.46], [2.1, 0.34], [-2.1, 0.34],
  ],
  cabinPts: [[-2.25, 1.1], [-2.05, 1.7, -1.7, 1.76], [-0.4, 1.8], [0.9, 1.74], [1.5, 1.1]],
  roofPts: [[-1.75, 1.72], [-0.4, 1.78], [0.8, 1.73], [0.82, 1.78], [-0.4, 1.84], [-1.75, 1.78]],
  pillars: [[-2.1, 1.4, 0.6, 0.35], [1.25, 1.4, 0.62, -0.55]],
  grille: [0.7, 0.3, 1.1], skirtY: 0.36, mirrorX: 1.0, mirrorY: 1.32, headY: 0.86, headSize: [0.14, 0.4], tailY: 0.95,
};

/** AABB des voitures (collisions de la visite intérieure). */
export const CAR_COLLIDERS = [];

/** Place les deux voitures dans le garage, face à la porte (vers +z). */
export function createCars(scene, M) {
  const g = new THREE.Group();
  g.name = 'cars';
  const coupe = buildCar(M, COUPE);
  coupe.position.set(-16.3, 0.06, -2.2);
  coupe.rotation.y = -Math.PI / 2;
  g.add(coupe);
  const suv = buildCar(M, SUV);
  suv.position.set(-11.8, 0.06, -2.0);
  suv.rotation.y = -Math.PI / 2;
  g.add(suv);
  // Rails de toit du SUV
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(box(2.2, 0.05, 0.05), M.alu);
    rail.position.set(-0.4, 1.86, side * 0.7);
    suv.add(rail);
  }
  // Aileron du coupé
  const wing = new THREE.Mesh(box(0.3, 0.03, 1.3), M.anthracite);
  wing.position.set(-2.15, 0.95, 0);
  coupe.add(wing);
  for (const [car, spec] of [[coupe, COUPE], [suv, SUV]]) {
    CAR_COLLIDERS.push({
      x0: car.position.x - spec.width / 2, x1: car.position.x + spec.width / 2, y0: 0, y1: 2,
      z0: car.position.z - spec.length / 2, z1: car.position.z + spec.length / 2,
    });
  }
  scene.add(g);
  return g;
}
