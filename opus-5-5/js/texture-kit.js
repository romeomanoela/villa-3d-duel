import * as THREE from 'three';
import { rnd, rr } from './utils.js';

// Outils de dessin pour les textures procédurales (canvas 2D, motifs raccordables).

export function cv(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
export function tex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
export const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
export const grey = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

// Dessine f en (x,y) et à ses copies décalées pour que la texture se raccorde.
export function wrap(w, h, x, y, s, f) {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      const X = x + ox, Y = y + oy;
      if (X + s < 0 || X - s > w || Y + s < 0 || Y - s > h) continue;
      f(X, Y);
    }
  }
}
export function speckle(ctx, w, h, n, smin, smax, color) {
  for (let i = 0; i < n; i++) {
    const s = rr(smin, smax), x = rnd() * w, y = rnd() * h;
    ctx.fillStyle = color();
    wrap(w, h, x, y, s, (X, Y) => ctx.fillRect(X, Y, s, s));
  }
}
export function blotches(ctx, w, h, n, rmin, rmax, color) {
  for (let i = 0; i < n; i++) {
    const r = rr(rmin, rmax), x = rnd() * w, y = rnd() * h;
    const col = color();
    wrap(w, h, x, y, r, (X, Y) => {
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(X - r, Y - r, r * 2, r * 2);
    });
  }
}
