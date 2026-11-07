// Textures 100 % procédurales (canvas 2D) : aucun fichier image externe.
import * as THREE from 'three';
import { rng, clamp } from './utils.js';

let MAX_ANISO = 4;
export function setAnisotropy(n) {
  MAX_ANISO = n;
}

/* ------------------------------------------------------------------ */
/*  Bruit de valeur périodique (pour des textures sans raccord)        */
/* ------------------------------------------------------------------ */
function lattice(seed, cx, cy) {
  const r = rng(seed);
  const g = new Float32Array(cx * cy);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return { g, cx, cy };
}
function sampleLat(L, u, v) {
  const x = u * L.cx, y = v * L.cy;
  let xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  xi = ((xi % L.cx) + L.cx) % L.cx;
  yi = ((yi % L.cy) + L.cy) % L.cy;
  const x1 = (xi + 1) % L.cx, y1 = (yi + 1) % L.cy;
  const a = L.g[yi * L.cx + xi], b = L.g[yi * L.cx + x1], c = L.g[y1 * L.cx + xi], d = L.g[y1 * L.cx + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(seed, cx, cy, oct = 4) {
  const lats = [];
  for (let o = 0; o < oct; o++) lats.push(lattice(seed + o * 17, cx << o, cy << o));
  return (u, v) => {
    let s = 0, a = 0.5, n = 0;
    for (let o = 0; o < oct; o++) {
      s += a * sampleLat(lats[o], u, v);
      n += a;
      a *= 0.5;
    }
    return s / n;
  };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function finish(c, { srgb = true, repeat = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = MAX_ANISO;
  t.generateMipmaps = mip;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Remplit un canvas pixel par pixel : fn(u, v, x, y) -> [r, g, b, a?] (0..255). */
function paint(c, ctx, fn) {
  const w = c.width, h = c.height;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let k = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = fn(x / w, y / h, x, y);
      d[k++] = p[0];
      d[k++] = p[1];
      d[k++] = p[2];
      d[k++] = p[3] === undefined ? 255 : p[3];
    }
  }
  ctx.putImageData(img, 0, 0);
}

function wrapStroke(size, x, y, r, draw) {
  const xs = [0], ys = [0];
  if (x < r) xs.push(size);
  if (x > size - r) xs.push(-size);
  if (y < r) ys.push(size);
  if (y > size - r) ys.push(-size);
  for (const dx of xs) for (const dy of ys) draw(x + dx, y + dy);
}

const mix = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/* ------------------------------------------------------------------ */
/*  Générateurs                                                        */
/* ------------------------------------------------------------------ */

function grass() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const n1 = fbm(11, 4, 4, 4), n2 = fbm(23, 16, 16, 3);
  paint(c, ctx, (u, v) => {
    const a = n1(u, v), b = n2(u, v);
    const t = clamp(a * 1.2 - 0.1, 0, 1);
    return [mix(48, 104, t) + b * 12, mix(86, 142, t) + b * 14, mix(34, 58, t), 255];
  });
  const r = rng(5);
  ctx.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, len = 4 + r() * 9, ang = -Math.PI / 2 + (r() - 0.5) * 0.9;
    const g = 90 + r() * 90, shade = r();
    ctx.strokeStyle = `rgba(${Math.round(mix(40, 120, shade))},${Math.round(g)},${Math.round(mix(25, 60, shade))},0.55)`;
    ctx.lineWidth = 0.8 + r() * 0.9;
    wrapStroke(S, x, y, 12, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      ctx.stroke();
    });
  }
  return finish(c);
}

/** Planches de bois (deck, parquet, bardage). Les planches courent selon u (ou v si vertical). */
function planks({ seed = 1, size = 512, planks = 8, base = [150, 108, 70], vary = 0.12, grain = 0.2, gap = 0.04, seams = 1, vertical = false, sat = 1 } = {}) {
  const [c, ctx] = canvas(size);
  const gr = fbm(seed, 2, planks * 8, 3);
  const fine = fbm(seed + 3, 24, 24, 3);
  const r = rng(seed * 7 + 1);
  const rowTint = [], jointX = [];
  for (let i = 0; i < planks; i++) {
    rowTint.push(r());
    const j = [];
    for (let s = 0; s < seams; s++) j.push(r());
    j.sort();
    jointX.push(j);
  }
  const ph = size / planks;
  paint(c, ctx, (u, v, x, y) => {
    const row = Math.floor(y / ph);
    const within = (y % ph) / ph;
    if (within < gap || within > 1 - gap) return [base[0] * 0.28, base[1] * 0.28, base[2] * 0.28, 255];
    const js = jointX[row];
    let seg = 0;
    for (let s = 0; s < js.length; s++) {
      const dx = Math.abs(x - js[s] * size);
      if (dx < 1.2 || Math.abs(dx - size) < 1.2) return [base[0] * 0.3, base[1] * 0.3, base[2] * 0.3, 255];
      if (x > js[s] * size) seg = s + 1;
    }
    const tint = (hashTint(row, seg, seed) - 0.5) * 2 * vary + (rowTint[row] - 0.5) * vary;
    const gv = (gr(u, v) - 0.5) * 2 * grain + (fine(u, v) - 0.5) * 0.12;
    const m = 1 + tint + gv;
    const lum = (base[0] + base[1] + base[2]) / 3;
    return [
      mix(lum, base[0], sat) * m,
      mix(lum, base[1], sat) * m,
      mix(lum, base[2], sat) * m,
      255,
    ];
  });
  if (vertical) {
    const [c2, ctx2] = canvas(size);
    ctx2.translate(size, 0);
    ctx2.rotate(Math.PI / 2);
    ctx2.drawImage(c, 0, 0);
    return finish(c2);
  }
  return finish(c);
}
function hashTint(a, b, seed) {
  let h = (a * 73856093) ^ (b * 19349663) ^ (seed * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function plaster() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const n = fbm(41, 6, 6, 5), f = fbm(43, 64, 64, 2);
  paint(c, ctx, (u, v) => {
    const a = (n(u, v) - 0.5) * 22 + (f(u, v) - 0.5) * 10;
    return [246 + a, 243 + a, 236 + a, 255];
  });
  return finish(c);
}

function concrete() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const n = fbm(51, 5, 5, 5), f = fbm(53, 48, 48, 2);
  const forms = fbm(55, 1, 64, 2);
  paint(c, ctx, (u, v) => {
    const a = (n(u, v) - 0.5) * 46 + (f(u, v) - 0.5) * 16 + (forms(u, v) - 0.5) * 10;
    return [172 + a, 171 + a, 168 + a, 255];
  });
  // joints de banche + trous de tirants
  ctx.strokeStyle = 'rgba(40,40,40,0.28)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const y = (i + 0.5) * (S / 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,40,40,0.35)';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    ctx.beginPath();
    ctx.arc((i + 0.25) * (S / 4), (j + 0.25) * (S / 4), 2.4, 0, 6.3);
    ctx.fill();
  }
  return finish(c);
}

function stoneCladding() {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#403a34';
  ctx.fillRect(0, 0, S, S);
  const r = rng(77);
  const pal = [[186, 176, 160], [166, 157, 144], [201, 190, 172], [148, 140, 130], [176, 164, 146], [214, 204, 186]];
  let y = 0;
  const grainN = fbm(79, 40, 40, 3);
  while (y < S - 4) {
    const h = Math.min(S - y, 34 + Math.floor(r() * 30));
    let x = -Math.floor(r() * 80);
    while (x < S) {
      const w = 70 + Math.floor(r() * 120);
      const p = pal[Math.floor(r() * pal.length)];
      const k = 0.9 + r() * 0.2;
      ctx.fillStyle = `rgb(${p[0] * k | 0},${p[1] * k | 0},${p[2] * k | 0})`;
      const x0 = Math.max(0, x + 2), x1 = Math.min(S, x + w - 2);
      if (x1 > x0) ctx.fillRect(x0, y + 2, x1 - x0, h - 4);
      // bloc débordant : on redessine côté opposé pour la périodicité
      if (x + w > S) {
        ctx.fillRect(0, y + 2, x + w - S - 2, h - 4);
      }
      x += w;
    }
    y += h;
  }
  // grain
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < S * S; i++) {
    const x = i % S, yy = (i / S) | 0;
    const g = (grainN(x / S, yy / S) - 0.5) * 50;
    d[i * 4] = clamp(d[i * 4] + g, 0, 255);
    d[i * 4 + 1] = clamp(d[i * 4 + 1] + g, 0, 255);
    d[i * 4 + 2] = clamp(d[i * 4 + 2] + g, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
}

function pavers() {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#6d6a64';
  ctx.fillRect(0, 0, S, S);
  const r = rng(91);
  const rows = 4, rh = S / rows, bw = S / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = -1; i < 3; i++) {
      const off = (j % 2) * (bw / 2);
      const x = i * bw + off, y = j * rh;
      const k = 0.92 + r() * 0.16;
      ctx.fillStyle = `rgb(${(188 * k) | 0},${(183 * k) | 0},${(172 * k) | 0})`;
      ctx.fillRect(x + 2, y + 2, bw - 4, rh - 4);
    }
  }
  const n = fbm(93, 24, 24, 4);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0;
    const g = (n(x / S, y / S) - 0.5) * 38;
    d[i * 4] = clamp(d[i * 4] + g, 0, 255);
    d[i * 4 + 1] = clamp(d[i * 4 + 1] + g, 0, 255);
    d[i * 4 + 2] = clamp(d[i * 4 + 2] + g, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
}

function marble() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const n = fbm(101, 5, 5, 5);
  paint(c, ctx, (u, v) => {
    const a = (n(u, v) - 0.5) * 24;
    return [232 + a, 226 + a, 214 + a, 255];
  });
  const r = rng(103);
  // veines
  for (let i = 0; i < 26; i++) {
    let x = r() * S, y = r() * S, ang = r() * 6.28;
    ctx.strokeStyle = `rgba(${150 + r() * 40 | 0},${140 + r() * 30 | 0},${120 + r() * 30 | 0},${0.1 + r() * 0.22})`;
    ctx.lineWidth = 0.6 + r() * 1.6;
    wrapStroke(S, x, y, 300, (px0, py0) => {
      ctx.beginPath();
      let px = px0, py = py0, a = ang;
      ctx.moveTo(px, py);
      for (let k = 0; k < 28; k++) {
        a += (r() - 0.5) * 0.7;
        px += Math.cos(a) * 12;
        py += Math.sin(a) * 12;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  }
  // joints des dalles (2 x 2 par tuile)
  ctx.strokeStyle = 'rgba(90,82,70,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, S, S);
  ctx.beginPath();
  ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
  ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
  ctx.stroke();
  return finish(c);
}

function asphalt() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const n = fbm(111, 8, 8, 4), f = fbm(113, 96, 96, 2);
  paint(c, ctx, (u, v) => {
    const a = (n(u, v) - 0.5) * 22 + (f(u, v) - 0.5) * 30;
    return [58 + a, 60 + a, 64 + a, 255];
  });
  const r = rng(115);
  for (let i = 0; i < 2600; i++) {
    const g = 110 + r() * 90;
    ctx.fillStyle = `rgba(${g},${g},${g},${0.15 + r() * 0.3})`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  return finish(c);
}

function poolTile() {
  const S = 512, N = 32;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#cfe9ec';
  ctx.fillRect(0, 0, S, S);
  const r = rng(121);
  const cs = S / N;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const t = r();
      const R = mix(30, 90, t) | 0, G = mix(160, 205, t) | 0, B = mix(190, 225, t) | 0;
      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.fillRect(i * cs + 1, j * cs + 1, cs - 2, cs - 2);
    }
  }
  return finish(c);
}

function foliage() {
  const S = 256;
  const [c, ctx] = canvas(S);
  const n = fbm(131, 6, 6, 3);
  paint(c, ctx, (u, v) => {
    const a = n(u, v);
    return [mix(26, 62, a), mix(62, 112, a), mix(24, 42, a), 255];
  });
  const r = rng(133);
  for (let i = 0; i < 1800; i++) {
    const x = r() * S, y = r() * S, a = r() * 6.28, len = 4 + r() * 7;
    const g = 80 + r() * 100;
    ctx.fillStyle = `rgba(${mix(30, 100, r()) | 0},${g | 0},${mix(24, 56, r()) | 0},${0.5 + r() * 0.4})`;
    wrapStroke(S, x, y, 12, (px, py) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, len * 0.38, 0, 0, 6.3);
      ctx.fill();
      ctx.restore();
    });
  }
  return finish(c);
}

function palmFrond() {
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  const r = rng(141);
  const cx = W / 2;
  // nervure centrale
  const rib = ctx.createLinearGradient(0, H, 0, 0);
  rib.addColorStop(0, '#6a5a2e');
  rib.addColorStop(1, '#4e7a34');
  ctx.strokeStyle = rib;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, H);
  ctx.lineTo(cx, 4);
  ctx.stroke();
  const pairs = 46;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    const y = H - 10 - t * (H - 24);
    const len = (W / 2 - 3) * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.15 + 0.05) * Math.PI * 0.62 + 0.25)) * (1 - 0.35 * t * t);
    for (const side of [-1, 1]) {
      const droop = 0.3 + 0.3 * t;
      const ex = cx + side * len;
      const ey = y - len * (0.55 + droop * 0.25) * 0.9;
      const mx = cx + side * len * 0.55, my = y - len * 0.1;
      const g = 110 + r() * 60;
      const grd = ctx.createLinearGradient(cx, y, ex, ey);
      grd.addColorStop(0, `rgb(${40 + r() * 20 | 0},${g - 20 | 0},${34 | 0})`);
      grd.addColorStop(1, `rgb(${76 + r() * 28 | 0},${g + 22 | 0},${44 | 0})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.quadraticCurveTo(mx, my - 3, ex, ey);
      ctx.quadraticCurveTo(mx, my + 5, cx, y + 3);
      ctx.fill();
    }
  }
  return finish(c, { repeat: false });
}

function bark() {
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  const n = fbm(151, 4, 8, 4), f = fbm(153, 12, 64, 3);
  paint(c, ctx, (u, v, x, y) => {
    const ring = Math.sin(v * 140) * 0.5 + 0.5;
    const a = (n(u, v) - 0.5) * 36 + (f(u, v) - 0.5) * 24;
    const k = 0.74 + ring * 0.26;
    return [(120 + a) * k, (100 + a) * k, (80 + a * 0.8) * k, 255];
  });
  return finish(c);
}

/** Champ cultivé en rangs (vignes, blé) : sol nu + deux rangs de végétation par tuile. */
function cropRows({ seed = 1, soil = [150, 118, 84], leaf = [60, 100, 40], rows = 2, band = 0.34 } = {}) {
  const S = 256;
  const [c, ctx] = canvas(S);
  const n = fbm(seed, 6, 6, 4), f = fbm(seed + 5, 40, 40, 2);
  paint(c, ctx, (u, v) => {
    const a = (n(u, v) - 0.5) * 36 + (f(u, v) - 0.5) * 18;
    return [soil[0] + a, soil[1] + a * 0.9, soil[2] + a * 0.8, 255];
  });
  const r = rng(seed * 3 + 1);
  const bh = (S / rows) * band;
  for (let k = 0; k < rows; k++) {
    const yc = ((k + 0.5) * S) / rows;
    for (let i = 0; i < 1100; i++) {
      const x = r() * S, y = yc + (r() - 0.5) * bh * 1.6;
      const rad = 2 + r() * 5;
      const shade = 0.7 + r() * 0.6;
      ctx.fillStyle = `rgba(${leaf[0] * shade | 0},${leaf[1] * shade | 0},${leaf[2] * shade | 0},${0.5 + r() * 0.4})`;
      wrapStroke(S, x, y, rad + 2, (px, py) => {
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, 6.3);
        ctx.fill();
      });
    }
  }
  return finish(c);
}

function glow() {
  const S = 128;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish(c, { repeat: false });
}

function rug() {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#d9d2c3';
  ctx.fillRect(0, 0, S, S);
  const r = rng(161);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(${120 + r() * 40 | 0},${110 + r() * 30 | 0},${96 + r() * 30 | 0},${0.1 + r() * 0.2})`;
    ctx.fillRect(r() * S, 0, 6 + r() * 20, S);
  }
  ctx.strokeStyle = '#8a7f6c';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, S - 20, S - 20);
  ctx.strokeStyle = '#b7ab94';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, S - 44, S - 44);
  return finish(c, { repeat: false });
}

function plate() {
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = '#f2f0ea';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#1c2a52';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 250, 58);
  ctx.fillStyle = '#10131a';
  ctx.font = '700 40px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SOLENE', 128, 34);
  return finish(c, { repeat: false });
}

/** Création du jeu de textures complet. */
export function createTextures() {
  return {
    grass: grass(),
    deck: planks({ seed: 3, planks: 8, base: [146, 104, 68], vary: 0.14, grain: 0.22, seams: 1 }),
    oak: planks({ seed: 8, planks: 6, base: [200, 164, 120], vary: 0.09, grain: 0.14, seams: 2, sat: 0.85 }),
    walnut: planks({ seed: 12, planks: 5, base: [88, 58, 40], vary: 0.1, grain: 0.2, seams: 1 }),
    slats: planks({ seed: 17, planks: 10, base: [176, 132, 90], vary: 0.12, grain: 0.18, seams: 1, vertical: true, gap: 0.08 }),
    garageWood: planks({ seed: 21, planks: 4, base: [168, 120, 78], vary: 0.06, grain: 0.18, seams: 0, gap: 0.05 }),
    plaster: plaster(),
    concrete: concrete(),
    stone: stoneCladding(),
    pavers: pavers(),
    marble: marble(),
    asphalt: asphalt(),
    poolTile: poolTile(),
    foliage: foliage(),
    frond: palmFrond(),
    bark: bark(),
    vineyard: cropRows({ seed: 31, soil: [158, 124, 88], leaf: [58, 104, 42], rows: 2, band: 0.42 }),
    wheat: cropRows({ seed: 37, soil: [176, 156, 98], leaf: [196, 172, 84], rows: 4, band: 0.5 }),
    glow: glow(),
    rug: rug(),
    plate: plate(),
  };
}
