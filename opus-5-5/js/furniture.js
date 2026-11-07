import * as THREE from 'three';
import { rr } from './utils.js';

// Mobilier simplifié. Chaque fonction construit dans le repère local courant du Batcher :
// origine au sol, au centre de l'objet, face avant vers +Z.

const cyl = (r, h, s = 20) => new THREE.CylinderGeometry(r, r, h, s);

export function sofa(b, M, len, { depth = 0.95, mat = M.fabric, accent = M.cushionAccent } = {}) {
  const d = depth;
  b.box(M.blackMatte, len - 0.1, 0.08, d - 0.1, 0, 0.04, 0);
  b.box(mat, len, 0.32, d, 0, 0.24, 0);
  b.box(mat, len, 0.42, 0.22, 0, 0.61, -d / 2 + 0.11);
  b.box(mat, 0.2, 0.26, d, -len / 2 + 0.1, 0.53, 0);
  b.box(mat, 0.2, 0.26, d, len / 2 - 0.1, 0.53, 0);
  const n = Math.max(1, Math.round((len - 0.4) / 0.85));
  const cw = (len - 0.4) / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.2 + cw * (i + 0.5);
    b.box(mat, cw - 0.03, 0.12, d - 0.3, x, 0.46, 0.08);
    b.box(mat, cw - 0.05, 0.36, 0.14, x, 0.66, -d / 2 + 0.29, 0);
  }
  b.push(-len / 2 + 0.45, 0.66, -d / 2 + 0.4, 0.3, -0.25);
  b.box(accent, 0.42, 0.38, 0.12, 0, 0, 0);
  b.pop();
  b.push(len / 2 - 0.45, 0.66, -d / 2 + 0.4, -0.25, -0.25);
  b.box(accent, 0.42, 0.38, 0.12, 0, 0, 0);
  b.pop();
}

export function armchair(b, M) {
  b.box(M.leather, 0.85, 0.36, 0.85, 0, 0.26, 0);
  b.box(M.leather, 0.85, 0.42, 0.16, 0, 0.62, -0.35);
  b.box(M.leather, 0.12, 0.2, 0.85, -0.37, 0.53, 0);
  b.box(M.leather, 0.12, 0.2, 0.85, 0.37, 0.53, 0);
  b.box(M.blackMatte, 0.7, 0.08, 0.7, 0, 0.04, 0);
}

export function coffeeTable(b, M, w, d, h = 0.36) {
  b.box(M.marble, w, 0.05, d, 0, h - 0.025, 0);
  b.box(M.walnut, w - 0.3, h - 0.05, d - 0.25, 0, (h - 0.05) / 2, 0);
}

export function diningTable(b, M, w, d) {
  b.box(M.walnut, w, 0.05, d, 0, 0.735, 0);
  for (const s of [-1, 1]) b.box(M.blackMetal, 0.06, 0.71, d - 0.2, s * (w / 2 - 0.35), 0.355, 0);
}

export function chair(b, M) {
  b.box(M.leather, 0.46, 0.06, 0.46, 0, 0.46, 0);
  b.push(0, 0.49, -0.21, 0, -0.12);
  b.box(M.leather, 0.46, 0.42, 0.05, 0, 0.22, 0);
  b.pop();
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box(M.blackMetal, 0.025, 0.44, 0.025, x, 0.22, z);
}

export function stool(b, M) {
  b.mesh(cyl(0.19, 0.07), M.leather, [0, 0.76, 0]);
  b.mesh(cyl(0.025, 0.72, 8), M.steel, [0, 0.38, 0]);
  b.mesh(cyl(0.2, 0.02), M.steel, [0, 0.01, 0]);
}

export function pendant(b, M, ceilY, y, r = 0.17) {
  b.box(M.blackMetal, 0.008, ceilY - y, 0.008, 0, (ceilY + y) / 2, 0, 0, { cast: false });
  b.mesh(new THREE.CylinderGeometry(r * 0.55, r, 0.26, 20, 1, true), M.brass, [0, y, 0], [0, 0, 0], [1, 1, 1], { cast: false });
  b.mesh(cyl(r * 0.95, 0.01), M.lampWarm, [0, y - 0.12, 0], [0, 0, 0], [1, 1, 1], { cast: false });
}

export function bed(b, M, w, l) {
  b.box(M.fabricDark, w + 0.1, 0.25, l, 0, 0.125, 0);
  b.box(M.linen, w - 0.04, 0.22, l - 0.12, 0, 0.36, 0.02);
  b.box(M.linen, w + 0.04, 0.06, l * 0.62, 0, 0.49, l * 0.17);
  b.box(M.cushionAccent, w + 0.06, 0.07, 0.45, 0, 0.5, l / 2 - 0.35);
  b.box(M.fabricDark, w + 0.4, 1.15, 0.1, 0, 0.575, -l / 2 - 0.02);
  const pw = w > 1.7 ? 0.62 : 0.55;
  for (const s of [-1, 1]) {
    b.push(s * (w / 4), 0.6, -l / 2 + 0.28, 0, -0.35);
    b.box(M.cushion, pw, 0.36, 0.14, 0, 0, 0);
    b.pop();
  }
}

export function nightstand(b, M, lamp = true) {
  b.box(M.walnut, 0.5, 0.42, 0.42, 0, 0.21, 0);
  if (!lamp) return;
  b.mesh(cyl(0.06, 0.25, 12), M.ceramic, [0, 0.545, 0]);
  b.mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.22, 20), M.lampWarm, [0, 0.77, 0], [0, 0, 0], [1, 1, 1], { cast: false });
}

export function indoorPlant(b, M, h = 1.8) {
  b.mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 20), M.planter, [0, 0.25, 0]);
  b.mesh(cyl(0.012, h - 0.5, 6), M.bark, [0, 0.25 + h / 2, 0]);
  const ico = new THREE.IcosahedronGeometry(0.32, 1);
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4, y = 0.9 + (i / 6) * (h - 0.8);
    b.mesh(ico, M.foliageCore, [Math.cos(a) * 0.18, y, Math.sin(a) * 0.18], [i, i * 2, 0], [1, 0.7, 1]);
  }
}

// Chaise longue en teck avec matelas, dossier relevé côté -Z.
export function lounger(b, M) {
  for (const s of [-1, 1]) {
    b.box(M.teak, 0.05, 0.06, 2.0, s * 0.33, 0.32, 0);
    b.box(M.teak, 0.05, 0.3, 0.05, s * 0.33, 0.15, 0.9);
    b.box(M.teak, 0.05, 0.3, 0.05, s * 0.33, 0.15, -0.85);
  }
  for (let z = -0.85; z <= 0.9; z += 0.25) b.box(M.teak, 0.66, 0.025, 0.08, 0, 0.36, z);
  b.box(M.cushion, 0.68, 0.08, 1.3, 0, 0.41, 0.32);
  b.push(0, 0.36, -0.32, 0, 0.9);
  b.box(M.teak, 0.66, 0.03, 0.72, 0, 0, -0.36);
  b.box(M.cushion, 0.68, 0.08, 0.7, 0, 0.055, -0.36);
  b.pop();
  b.push(0, 0.75, -0.62, 0, 0.9);
  b.box(M.cushionAccent, 0.5, 0.09, 0.22, 0, 0, 0);
  b.pop();
}

// Parasol déporté-droit : pied lesté, mât, toile octogonale et baleines.
export function parasol(b, M, r = 1.6, h = 2.5) {
  b.box(M.travertine, 0.5, 0.12, 0.5, 0, 0.06, 0);
  b.mesh(cyl(0.025, h, 10), M.teak, [0, h / 2, 0]);
  b.mesh(new THREE.ConeGeometry(r, 0.5, 8, 1, true), M.umbrella, [0, h + 0.05, 0]);
  b.mesh(new THREE.SphereGeometry(0.05, 10, 6), M.teak, [0, h + 0.32, 0]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.push(0, h + 0.28, 0, -a);
    b.push(r * 0.5, -0.24, 0, 0, 0, -Math.atan2(0.5, r));
    b.box(M.teak, r, 0.02, 0.02, 0, -0.02, 0);
    b.pop();
    b.pop();
  }
}

export function sideTable(b, M) {
  b.mesh(cyl(0.25, 0.03), M.travertine, [0, 0.45, 0]);
  b.mesh(cyl(0.03, 0.44, 8), M.blackMetal, [0, 0.22, 0]);
  b.mesh(cyl(0.18, 0.02), M.blackMetal, [0, 0.01, 0]);
}

// Tableau abstrait généré sur canvas (palette méditerranéenne).
export function artMaterial(palette, w = 512, h = 384) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = palette[0];
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    x.globalAlpha = rr(0.55, 0.95);
    x.fillStyle = palette[1 + (i % (palette.length - 1))];
    x.beginPath();
    if (i % 3 === 0) x.arc(rr(0, w), rr(0, h), rr(40, 150), 0, Math.PI * 2);
    else x.rect(rr(-40, w), rr(-40, h), rr(60, 260), rr(20, 140));
    x.fill();
  }
  x.globalAlpha = 0.85;
  x.strokeStyle = '#1d1a17';
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(rr(0, w * 0.3), rr(0, h));
  x.bezierCurveTo(rr(0, w), rr(0, h), rr(0, w), rr(0, h), rr(w * 0.7, w), rr(0, h));
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}

// Pose un cadre + toile ; n = normale du mur ('x+', 'x-', 'z+', 'z-').
export function painting(b, M, mat, x, y, z, w, h, n) {
  const ry = { 'z+': 0, 'z-': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 }[n];
  b.push(x, y, z, ry);
  b.box(M.blackMatte, w + 0.08, h + 0.08, 0.04, 0, 0, 0.02);
  b.box(mat, w, h, 0.01, 0, 0, 0.045, 0, { cast: false });
  b.pop();
}
