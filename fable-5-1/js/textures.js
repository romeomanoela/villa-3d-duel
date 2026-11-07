// Textures 100 % procédurales dessinées sur canvas (aucune image externe).
import * as THREE from 'three';
import { rng } from './utils.js';

let maxAniso = 4;
export function setAnisotropy(v) { maxAniso = v; }

function canvasTexture(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

function speckle(ctx, w, h, count, rand, color) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = color(rand);
    const s = 1 + rand() * 2.5;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Pelouse : base verte, mouchetis et brins. Tuile = 2 m. */
export function grass() {
  const r = rng(11);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4b7a2a';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 30000, r, (rn) => `hsl(${88 + rn() * 26}, ${38 + rn() * 25}%, ${20 + rn() * 26}%)`);
    ctx.lineWidth = 1;
    for (let i = 0; i < 2500; i++) {
      ctx.strokeStyle = `hsla(${95 + r() * 20}, 45%, ${35 + r() * 25}%, 0.7)`;
      const x = r() * w, y = r() * h, l = 3 + r() * 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - l); ctx.stroke();
    }
  });
}

/** Travertin : dalles 60 cm, veines, joints clairs. Tuile = 1.2 m (2x2 dalles). */
export function travertine() {
  const r = rng(23);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d9cdb7';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsla(${34 + r() * 10}, ${20 + r() * 15}%, ${70 + r() * 18}%, 0.35)`;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 8 + r() * 40, 4 + r() * 14, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, w, h, 6000, r, (rn) => `hsla(${30 + rn() * 15}, 25%, ${55 + rn() * 30}%, 0.5)`);
    ctx.strokeStyle = 'rgba(120,105,85,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      let x = r() * w, y = r() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = '#bfb39c';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  });
}

/** Lames de bois (terrasse / parquet). Tuile = 2 m (8 lames de 25 cm). */
export function wood(dark = false) {
  const r = rng(dark ? 37 : 31);
  return canvasTexture(512, 512, (ctx, w, h) => {
    const planks = 8, ph = h / planks;
    for (let p = 0; p < planks; p++) {
      const base = dark ? 22 + r() * 8 : 36 + r() * 12;
      ctx.fillStyle = `hsl(${26 + r() * 8}, ${35 + r() * 15}%, ${base}%)`;
      ctx.fillRect(0, p * ph, w, ph);
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `hsla(${25 + r() * 10}, 35%, ${base + (r() - 0.5) * 18}%, 0.55)`;
        ctx.lineWidth = 0.5 + r() * 1.5;
        ctx.beginPath();
        let x = 0, y = p * ph + r() * ph;
        ctx.moveTo(x, y);
        while (x < w) { x += 20 + r() * 40; y += (r() - 0.5) * 3; ctx.lineTo(x, Math.min(p * ph + ph - 1, Math.max(p * ph + 1, y))); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(20,12,6,0.8)';
      ctx.fillRect(0, p * ph, w, 2);
    }
  });
}

/** Pavés de l'allée (pose en rangées décalées). Tuile = 2 m. */
export function pavers() {
  const r = rng(41);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5d5a55';
    ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, ph = h / rows, pw = w / cols;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * pw / 2;
      for (let x = -1; x < cols; x++) {
        const l = 48 + r() * 18;
        ctx.fillStyle = `hsl(${30 + r() * 20}, ${6 + r() * 8}%, ${l}%)`;
        ctx.fillRect(x * pw + off + 3, y * ph + 3, pw - 6, ph - 6);
      }
    }
    speckle(ctx, w, h, 9000, r, (rn) => `hsla(30, 8%, ${35 + rn() * 45}%, 0.35)`);
  });
}

/** Enrobé de la route. Tuile = 4 m. */
export function asphalt() {
  const r = rng(53);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3a3b3e';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 20000, r, (rn) => `hsl(220, 4%, ${18 + rn() * 30}%)`);
  });
}

/** Enduit blanc des façades (micro-grain). Tuile = 3 m. */
export function plaster() {
  const r = rng(61);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efebe3';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 5000, r, (rn) => `hsla(40, 15%, ${80 + rn() * 18}%, 0.5)`);
  });
}

/** Béton brut (sol garage, murets). Tuile = 3 m. */
export function concrete() {
  const r = rng(71);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#9d9c98';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 14000, r, (rn) => `hsla(40, 5%, ${50 + rn() * 30}%, 0.45)`);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `hsla(40, 8%, ${45 + r() * 20}%, 0.2)`;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  });
}

/** Carrelage de piscine (mosaïque bleue). Tuile = 1 m (8x8 carreaux). */
export function poolTiles() {
  const r = rng(83);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#dfeff5';
    ctx.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = `hsl(${192 + r() * 14}, ${55 + r() * 25}%, ${58 + r() * 16}%)`;
      ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    }
  });
}

/** Marbre clair (sol intérieur). Tuile = 2 m. */
export function marble() {
  const r = rng(97);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ece9e4';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 25; i++) {
      ctx.strokeStyle = `hsla(${30 + r() * 20}, 10%, ${55 + r() * 25}%, ${0.25 + r() * 0.3})`;
      ctx.lineWidth = 0.5 + r() * 2;
      ctx.beginPath();
      let x = r() * w, y = r() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    speckle(ctx, w, h, 3000, r, (rn) => `hsla(30, 8%, ${80 + rn() * 15}%, 0.4)`);
    ctx.strokeStyle = 'rgba(150,145,138,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  });
}

/** Écorce de palmier (anneaux). Tuile = 1 m. */
export function bark() {
  const r = rng(101);
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a6248';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10 + r() * 8) {
      ctx.fillStyle = `hsl(${28 + r() * 10}, ${25 + r() * 15}%, ${28 + r() * 18}%)`;
      ctx.fillRect(0, y, w, 4 + r() * 6);
    }
    speckle(ctx, w, h, 1500, r, (rn) => `hsla(30, 25%, ${25 + rn() * 35}%, 0.6)`);
  });
}

/** Feuillage de haie (vert dense). Tuile = 1 m. */
export function hedge() {
  const r = rng(113);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2f5a1e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `hsl(${95 + r() * 30}, ${35 + r() * 30}%, ${18 + r() * 30}%)`;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 3 + r() * 6, 2 + r() * 4, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  });
}

/** Panneau de porte de garage (rainures horizontales). Tuile = 1 m. */
export function garageDoor() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3c3f44';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      ctx.fillStyle = '#2a2c30'; ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = '#4a4e54'; ctx.fillRect(0, y + 4, w, 2);
    }
  });
}

/** Palme : rachis + folioles obliques sur fond transparent (alphaTest). v = 0 à la base, v = 1 à la pointe. */
export function palmFrond() {
  const r = rng(131);
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let y = 8; y < h - 4; y += 8) {
      const t = 1 - y / h; // 0 à la base, 1 à la pointe
      const len = 26 + 48 * Math.sin(Math.min(1, t * 1.15) * Math.PI);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(w / 2, y);
        ctx.rotate(side === 1 ? -0.95 : Math.PI + 0.95);
        ctx.fillStyle = `hsl(${92 + r() * 22}, ${42 + r() * 20}%, ${26 + r() * 16}%)`;
        ctx.fillRect(0, -2.6, len, 5.2);
        ctx.restore();
      }
    }
    ctx.fillStyle = '#7a9a40';
    ctx.fillRect(w / 2 - 3, 0, 6, h);
  });
}
