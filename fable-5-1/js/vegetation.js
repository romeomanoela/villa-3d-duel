// Végétation procédurale : palmiers, cyprès, oliviers, haies, buissons, jardinières.
import * as THREE from 'three';
import { Merger, box, rng } from './utils.js';

/** Géométrie d'une palme : plan effilé courbé vers le bas, base à l'origine, s'étend le long de +y. */
function frondGeometry() {
  const g = new THREE.PlaneGeometry(0.7, 3.0, 1, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + 1.5;      // y ∈ [0, 3]
    const t = y / 3;
    p.setX(i, x * (0.25 + 0.75 * Math.sin(t * Math.PI) * (1 - t * 0.3)));
    p.setY(i, y);
    p.setZ(i, t * t * 1.6);                         // retombée (vers +z, qui devient « vers le bas » après inclinaison)
  }
  g.computeVertexNormals();
  return g;
}

export function createVegetation(scene, M) {
  const g = new THREE.Group();
  g.name = 'vegetation';
  const m = new Merger();
  const r = rng(2024);
  const frond = frondGeometry();

  const palm = (x, z, h = 6, lean = 0.08) => {
    const segs = 6;
    let px = x, pz = z, py = 0;
    const dirX = (r() - 0.5) * lean, dirZ = (r() - 0.5) * lean;
    for (let i = 0; i < segs; i++) {
      const t = i / segs, sh = h / segs;
      const rb = 0.3 - 0.12 * t, rt = 0.3 - 0.12 * (t + 1 / segs);
      const cyl = new THREE.CylinderGeometry(rt, rb, sh * 1.05, 10, 1);
      m.add(cyl, M.bark, [px + dirX * (i + 0.5) * sh, py + sh / 2, pz + dirZ * (i + 0.5) * sh], [dirZ * 0.9, 0, -dirX * 0.9]);
      py += sh;
    }
    const top = [px + dirX * h, h, pz + dirZ * h];
    const nF = 11;
    for (let i = 0; i < nF; i++) {
      const a = (i / nF) * Math.PI * 2 + r() * 0.3;
      const tilt = 0.55 + r() * 0.6; // inclinaison depuis la verticale
      // rotation : d'abord basculer la palme (axe x), puis l'orienter autour de y
      m.add(frond, M.leaf, [top[0], top[1] - 0.1, top[2]], [tilt, a, 0, 'YXZ']);
    }
    // noix de coco
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2;
      m.add(new THREE.SphereGeometry(0.11, 8, 6), M.trunk, [top[0] + Math.cos(a) * 0.2, top[1] - 0.25, top[2] + Math.sin(a) * 0.2]);
    }
  };

  const cypress = (x, z, h = 6) => {
    const pts = [];
    const prof = [[0, 0], [0.22, 0.02], [0.5, 0.15], [0.62, 0.35], [0.55, 0.6], [0.38, 0.82], [0.14, 0.96], [0, 1]];
    for (const [rr, t] of prof) pts.push(new THREE.Vector2(rr * (h / 6), t * h));
    const geo = new THREE.LatheGeometry(pts, 9);
    m.add(geo, M.leafDark, [x, 0, z], [0, r() * Math.PI, 0]);
  };

  const olive = (x, z, s = 1) => {
    m.add(new THREE.CylinderGeometry(0.14 * s, 0.26 * s, 1.8 * s, 8), M.trunk, [x, 0.9 * s, z]);
    m.add(new THREE.CylinderGeometry(0.08 * s, 0.13 * s, 1.2 * s, 6), M.trunk, [x + 0.35 * s, 2.2 * s, z], [0, 0, -0.6]);
    m.add(new THREE.CylinderGeometry(0.08 * s, 0.13 * s, 1.2 * s, 6), M.trunk, [x - 0.3 * s, 2.2 * s, z + 0.2 * s], [0.4, 0, 0.5]);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = 0.9 * s;
      m.add(new THREE.IcosahedronGeometry((0.8 + r() * 0.4) * s, 2), M.olive,
        [x + Math.cos(a) * rr, (2.6 + (r() - 0.5) * 0.5) * s, z + Math.sin(a) * rr]);
    }
    m.add(new THREE.IcosahedronGeometry(1.0 * s, 2), M.olive, [x, 3.2 * s, z]);
  };

  const bush = (x, z, s = 1) => {
    for (let i = 0; i < 3; i++) {
      m.add(new THREE.SphereGeometry((0.45 + r() * 0.25) * s, 10, 8), M.leafDark,
        [x + (r() - 0.5) * 0.7 * s, 0.4 * s, z + (r() - 0.5) * 0.7 * s]);
    }
  };

  const hedgeBox = (cx, cz, w, d, h = 1.1) => {
    m.box(w, h, d, M.hedge, [cx, h / 2, cz]);
  };

  // --- Implantation ---
  // Palmiers autour de la piscine et au bord de l'allée
  palm(27.5, -8, 7); palm(26, 6.5, 6.2); palm(12, 7, 5.5); palm(29, -1, 6.8);
  palm(-22, 6, 6.5); palm(-22.5, 16, 5.8); palm(-6.5, 10, 6.4); palm(12, -14, 6);
  // Cyprès le long des murs nord et ouest
  for (let x = -28; x <= 28; x += 4.5) cypress(x, -22, 5.5 + r() * 2);
  for (let z = -18; z <= 0; z += 4) cypress(-30, z, 5 + r() * 2);
  for (let z = -18; z <= 18; z += 4.5) cypress(30.5, z, 5 + r() * 2);
  // Oliviers sur la pelouse
  olive(4, 14, 1.1); olive(-26, -8, 1.0); olive(22, 15, 0.9); olive(-3, -16, 1.0);
  // Haies : le long du mur sud (intérieur) et autour de la terrasse piscine
  hedgeBox(-25, 22.5, 12, 0.8); hedgeBox(0, 22.5, 16, 0.8); hedgeBox(20, 22.5, 20, 0.8);
  hedgeBox(-5, 7.5, 9, 0.7, 0.7);
  hedgeBox(26.5, -3, 0.8, 14, 1.3);
  hedgeBox(-20.5, -2, 0.8, 8, 0.9);
  // Buissons
  bush(-7, 5, 0.8); bush(-3, 5.2, 0.9); bush(1, 5.1, 0.7); bush(5, 5.3, 0.9);
  bush(-20, 21, 1.1); bush(14, 10, 1.0); bush(-12, -14, 1.2); bush(18, -16, 1.1);
  bush(-20, 10, 0.9); bush(-8, 13, 0.8); bush(8, 19, 1.0);
  // Jardinières en terre cuite près de l'entrée
  for (const x of [-7.6, -3.9]) {
    m.add(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 12), M.terracotta, [x, 0.45, 2.9]);
    m.add(new THREE.SphereGeometry(0.42, 10, 8), M.leafDark, [x, 1.05, 2.9]);
  }

  m.build(g);
  scene.add(g);
  return g;
}
