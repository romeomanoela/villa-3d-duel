import * as THREE from 'three';
import { rnd, rr } from './utils.js';
import { cv, tex, wrap, speckle, blotches, hsl, grey } from './texture-kit.js';

// Textures végétales générées sur canvas : pelouse, palmes, feuillages, écorce.

/* Pelouse — 1 tuile = 4 m */
export function grass() {
  const S = 512;
  const [c, x] = cv(S);
  x.fillStyle = hsl(92, 40, 29);
  x.fillRect(0, 0, S, S);
  blotches(x, S, S, 40, 30, 90, () => hsl(rr(80, 105), 40, rr(22, 36), 0.35));
  x.lineWidth = 1.2;
  for (let i = 0; i < 30000; i++) {
    const px = rnd() * S, py = rnd() * S, len = rr(3, 9), a = rr(-0.6, 0.6);
    x.strokeStyle = hsl(rr(78, 108), rr(35, 58), rr(20, 47), 0.75);
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.sin(a) * len, py - Math.cos(a) * len);
    x.stroke();
  }
  return tex(c);
}

/* Palme (feuille pennée) avec transparence */
export function palmLeaf() {
  const [c, x] = cv(128, 512);
  x.lineCap = 'round';
  const n = 64;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const yy = 505 - t * 495;
    const len = 60 * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * t)), 0.6) * (1 - t * 0.25);
    for (const side of [-1, 1]) {
      x.strokeStyle = hsl(rr(82, 102), rr(38, 55), rr(20, 36));
      x.lineWidth = rr(3, 4.5) * (1 - t * 0.5);
      x.beginPath();
      x.moveTo(64, yy);
      x.quadraticCurveTo(64 + side * len * 0.45, yy - 10, 64 + side * len, yy - 22 - rr(0, 10));
      x.stroke();
    }
  }
  x.strokeStyle = hsl(62, 30, 38);
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(64, 512);
  x.lineTo(64, 6);
  x.stroke();
  const t = tex(c, true, false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* Bouquet de feuilles (cartes de feuillage des oliviers) */
export function leafCard(hue, sat, lmin, lmax) {
  const S = 256;
  const [c, x] = cv(S);
  for (let i = 0; i < 340; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 104;
    const px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r;
    const l = rr(9, 18), w = l * 0.26;
    x.save();
    x.translate(px, py);
    x.rotate(rnd() * Math.PI);
    x.fillStyle = hsl(hue + rr(-8, 8), sat + rr(-8, 8), rr(lmin, lmax));
    x.beginPath();
    x.ellipse(0, 0, l, w, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  const t = tex(c, true, false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* Feuillage dense opaque (haies, cyprès) */
export function foliage(hue, sat, base) {
  const S = 256;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  x.fillStyle = hsl(hue, sat, base * 0.45);
  x.fillRect(0, 0, S, S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const px = rnd() * S, py = rnd() * S, l = rr(4, 9), w = l * 0.45, rot = rnd() * Math.PI;
    const L = rr(base * 0.6, base * 1.35);
    wrap(S, S, px, py, l, (X, Y) => {
      x.save(); x.translate(X, Y); x.rotate(rot);
      x.fillStyle = hsl(hue + rr(-10, 10), sat + rr(-8, 8), L);
      x.beginPath(); x.ellipse(0, 0, l, w, 0, 0, Math.PI * 2); x.fill();
      x.restore();
      y.save(); y.translate(X, Y); y.rotate(rot);
      y.fillStyle = grey(L * 4);
      y.beginPath(); y.ellipse(0, 0, l, w, 0, 0, Math.PI * 2); y.fill();
      y.restore();
    });
  }
  return { map: tex(c), bump: tex(b, false) };
}

/* Écorce annelée de palmier (u = longueur du tronc) */
export function palmBark() {
  const W = 256, H = 64;
  const [c, x] = cv(W, H);
  x.fillStyle = hsl(32, 14, 40);
  x.fillRect(0, 0, W, H);
  for (let px = 0; px < W; px += 16) {
    const g = x.createLinearGradient(px, 0, px + 16, 0);
    g.addColorStop(0, hsl(30, 16, 26));
    g.addColorStop(0.3, hsl(34, 16, 48));
    g.addColorStop(1, hsl(30, 14, 34));
    x.fillStyle = g;
    x.fillRect(px, 0, 16, H);
  }
  speckle(x, W, H, 1500, 1, 2.5, () => hsl(30, 12, rr(20, 60), 0.5));
  return tex(c);
}
