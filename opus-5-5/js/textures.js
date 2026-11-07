import * as THREE from 'three';
import { rnd, rr } from './utils.js';
import { cv, tex, wrap, speckle, blotches, hsl, grey } from './texture-kit.js';
import { grass, palmLeaf, leafCard, foliage, palmBark } from './textures-nature.js';

// Toutes les textures sont générées dans des <canvas> : aucune image externe.

/* Pavés — 1 tuile = 2 m (pavés 50 × 25 cm, appareil à joints décalés) */
function pavers() {
  const S = 512, rows = 8, cols = 4, pw = S / cols, ph = S / rows, j = 4;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  x.fillStyle = '#6b665e';
  x.fillRect(0, 0, S, S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * pw * 0.5;
    const cols8 = Array.from({ length: cols }, () => [rr(28, 40), rr(6, 12), rr(58, 72)]);
    for (let k = -1; k <= cols; k++) {
      const cc = cols8[(k + cols) % cols];
      const px = k * pw + off, py = r * ph;
      x.fillStyle = hsl(cc[0], cc[1], cc[2]);
      x.fillRect(px + j / 2, py + j / 2, pw - j, ph - j);
      y.fillStyle = grey(215);
      y.fillRect(px + j / 2, py + j / 2, pw - j, ph - j);
    }
  }
  speckle(x, S, S, 9000, 1, 2.5, () => hsl(35, 8, rr(40, 85), 0.3));
  speckle(y, S, S, 6000, 1, 2, () => grey(rr(160, 255), 0.4));
  return { map: tex(c), bump: tex(b, false) };
}

/* Travertin — 1 tuile = 2 m (blocs 1 m × 0,5 m) */
function travertine(light = false) {
  const S = 512, rows = 4, cols = 2, pw = S / cols, ph = S / rows, j = 2;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  x.fillStyle = light ? '#d9cfbd' : '#cbbca3';
  x.fillRect(0, 0, S, S);
  y.fillStyle = grey(120);
  y.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * pw * 0.5;
    const tones = Array.from({ length: cols }, () => [rr(34, 42), rr(18, 30), rr(light ? 76 : 68, light ? 84 : 77)]);
    for (let k = -1; k <= cols; k++) {
      const t = tones[(k + cols) % cols];
      const px = k * pw + off, py = r * ph;
      x.fillStyle = hsl(t[0], t[1], t[2]);
      x.fillRect(px + j / 2, py + j / 2, pw - j, ph - j);
      y.fillStyle = grey(220);
      y.fillRect(px + j / 2, py + j / 2, pw - j, ph - j);
    }
    // veines horizontales caractéristiques du travertin
    for (let v = 0; v < 9; v++) {
      const yy = r * ph + rr(4, ph - 4);
      x.strokeStyle = hsl(35, 25, rr(55, 88), rr(0.15, 0.4));
      x.lineWidth = rr(0.6, 2.2);
      x.beginPath();
      for (let xx = 0; xx <= S; xx += 16) x.lineTo(xx, yy + Math.sin(xx * 0.02 + v) * 2.5 + rr(-0.8, 0.8));
      x.stroke();
    }
  }
  speckle(x, S, S, 1500, 1, 3.5, () => hsl(30, 25, rr(40, 55), 0.45)); // pores
  speckle(y, S, S, 1500, 1, 3, () => grey(60, 0.8));
  return { map: tex(c), bump: tex(b, false) };
}

/* Enduit blanc — 1 tuile = 2 m */
function stucco() {
  const S = 256;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  x.fillStyle = '#efebe3';
  x.fillRect(0, 0, S, S);
  blotches(x, S, S, 30, 20, 60, () => hsl(38, 15, rr(84, 96), 0.25));
  speckle(x, S, S, 5000, 1, 2, () => hsl(36, 10, rr(80, 98), 0.4));
  y.fillStyle = grey(128);
  y.fillRect(0, 0, S, S);
  speckle(y, S, S, 12000, 1, 2, () => grey(rr(90, 170), 0.5));
  return { map: tex(c), bump: tex(b, false) };
}

/* Bois de terrasse (teck) — 1 tuile = 2 m, lames horizontales */
function deckWood(h = 28, s = 42, lmin = 30, lmax = 42, planks = 14) {
  const S = 512, ph = S / planks;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  for (let i = 0; i < planks; i++) {
    const py = i * ph;
    const L = rr(lmin, lmax);
    x.fillStyle = hsl(h + rr(-3, 3), s + rr(-6, 6), L);
    x.fillRect(0, py, S, ph);
    for (let g = 0; g < 14; g++) {
      const gy = py + rr(1, ph - 1), amp = rr(0.5, 2), fr = rr(1, 4);
      x.strokeStyle = hsl(h, s, L + rr(-10, 8), rr(0.15, 0.35));
      x.lineWidth = rr(0.5, 1.5);
      x.beginPath();
      for (let xx = 0; xx <= S; xx += 8) x.lineTo(xx, gy + Math.sin((xx / S) * Math.PI * 2 * fr) * amp);
      x.stroke();
    }
    y.fillStyle = grey(200);
    y.fillRect(0, py + 2, S, ph - 4);
    const jx = rr(0, S);
    x.fillStyle = 'rgba(20,12,6,0.8)';
    x.fillRect(jx, py, 2, ph);
    y.fillStyle = '#000';
    y.fillRect(jx, py, 2, ph);
    x.fillStyle = 'rgba(20,12,6,0.85)';
    x.fillRect(0, py, S, 2);
  }
  return { map: tex(c), bump: tex(b, false) };
}

/* Bardage à claire-voie vertical (cèdre) — 1 tuile = 1 m */
function slats() {
  const S = 512, n = 14, pw = S / n, gap = 7;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  x.fillStyle = '#1b130d';
  x.fillRect(0, 0, S, S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const px = i * pw;
    const L = rr(36, 46);
    x.fillStyle = hsl(rr(24, 30), rr(40, 52), L);
    x.fillRect(px + gap / 2, 0, pw - gap, S);
    for (let g = 0; g < 8; g++) {
      const gx = px + gap / 2 + rr(1, pw - gap - 1);
      x.strokeStyle = hsl(26, 45, L + rr(-12, 8), 0.3);
      x.lineWidth = rr(0.5, 1.4);
      x.beginPath();
      for (let yy = 0; yy <= S; yy += 16) x.lineTo(gx + Math.sin(yy * 0.03 + g) * 1.2, yy);
      x.stroke();
    }
    y.fillStyle = grey(230);
    y.fillRect(px + gap / 2, 0, pw - gap, S);
  }
  return { map: tex(c), bump: tex(b, false) };
}

/* Mosaïque de piscine — 1 tuile = 1 m (carreaux de 6,25 cm) */
function poolTiles() {
  const S = 512, n = 16, p = S / n, j = 2;
  const [c, x] = cv(S);
  const [b, y] = cv(S);
  x.fillStyle = '#d8e8e6';
  x.fillRect(0, 0, S, S);
  y.fillStyle = '#000';
  y.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      x.fillStyle = hsl(rr(182, 198), rr(40, 68), rr(46, 64));
      x.fillRect(i * p + j, k * p + j, p - j * 2, p - j * 2);
      y.fillStyle = grey(210);
      y.fillRect(i * p + j, k * p + j, p - j * 2, p - j * 2);
    }
  }
  speckle(x, S, S, 2000, 1, 2, () => hsl(190, 50, rr(60, 85), 0.3));
  return { map: tex(c), bump: tex(b, false) };
}

/* Caustiques (Voronoï F2-F1), texture de données linéaire */
function caustics() {
  const S = 256, N = 24;
  const [c, x] = cv(S);
  const img = x.createImageData(S, S);
  const pts = Array.from({ length: N }, () => [rnd() * S, rnd() * S]);
  const offs = [-S, 0, S];
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let f1 = 1e9, f2 = 1e9;
      for (const [qx, qy] of pts) {
        for (const ox of offs) {
          const dx = px - qx - ox;
          if (Math.abs(dx) > 90) continue;
          for (const oy of offs) {
            const dy = py - qy - oy;
            const d = dx * dx + dy * dy;
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
      }
      const e = Math.sqrt(f2) - Math.sqrt(f1);
      const v = Math.pow(Math.max(0, 1 - e / 16), 3.2) * 255;
      const i = (py * S + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return tex(c, false);
}

/* Marbre blanc veiné */
function marble() {
  const S = 512;
  const [c, x] = cv(S);
  x.fillStyle = '#f2f0ec';
  x.fillRect(0, 0, S, S);
  blotches(x, S, S, 20, 40, 120, () => hsl(30, 6, rr(86, 94), 0.4));
  x.filter = 'blur(0.6px)';
  for (let v = 0; v < 22; v++) {
    let px = rnd() * S, py = rnd() * S, a = rr(-0.6, 0.6);
    x.strokeStyle = hsl(30, 5, rr(45, 70), rr(0.15, 0.45));
    x.lineWidth = rr(0.6, 2.5);
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 60; k++) {
      a += rr(-0.35, 0.35);
      px += Math.cos(a) * 9;
      py += Math.sin(a) * 9;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  x.filter = 'none';
  return tex(c);
}

/* Béton lissé (garage) — 1 tuile = 4 m */
function concrete() {
  const S = 512;
  const [c, x] = cv(S);
  x.fillStyle = '#9a9894';
  x.fillRect(0, 0, S, S);
  blotches(x, S, S, 60, 20, 110, () => grey(rr(120, 175), 0.18));
  speckle(x, S, S, 9000, 1, 2, () => grey(rr(110, 190), 0.25));
  return tex(c);
}

/* Enrobé de la rue */
function asphalt() {
  const S = 256;
  const [c, x] = cv(S);
  x.fillStyle = '#3a3b3d';
  x.fillRect(0, 0, S, S);
  speckle(x, S, S, 9000, 1, 2, () => grey(rr(30, 110), 0.6));
  blotches(x, S, S, 20, 20, 60, () => grey(rr(20, 80), 0.15));
  return tex(c);
}

/* Lin / tissu (canapés, coussins) */
function fabric() {
  const S = 128;
  const [c, x] = cv(S);
  x.fillStyle = '#d8d3c9';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) {
    x.fillStyle = grey(rr(190, 235), 0.35);
    x.fillRect(0, i, S, 1);
    x.fillStyle = grey(rr(180, 230), 0.3);
    x.fillRect(i, 0, 1, S);
  }
  return tex(c);
}

/* Rainures horizontales de la porte de garage sectionnelle (bump) */
function grooves() {
  const S = 128;
  const [c, x] = cv(S);
  x.fillStyle = grey(200);
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = grey(40);
    x.fillRect(0, i * 32 + 15, S, 3);
  }
  return tex(c, false);
}

/* Halo radial (lumières, flaques de lumière au sol) */
function glow() {
  const S = 128;
  const [c, x] = cv(S);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const t = tex(c, false, false);
  return t;
}

export function createTextures() {
  return {
    grass: grass(),
    pavers: pavers(),
    travertine: travertine(false),
    travLight: travertine(true),
    stucco: stucco(),
    deck: deckWood(28, 42, 30, 42, 14),
    oak: deckWood(34, 36, 58, 68, 10),
    walnut: deckWood(24, 34, 18, 26, 18),
    slats: slats(),
    poolTiles: poolTiles(),
    caustics: caustics(),
    palmLeaf: palmLeaf(),
    oliveCard: leafCard(78, 18, 30, 55),
    shrubCard: leafCard(100, 40, 18, 38),
    hedge: foliage(105, 40, 26),
    cypress: foliage(118, 34, 20),
    palmBark: palmBark(),
    marble: marble(),
    concrete: concrete(),
    asphalt: asphalt(),
    fabric: fabric(),
    grooves: grooves(),
    glow: glow(),
  };
}

// Clone une texture avec une répétition propre (1 / taille de motif en mètres).
export function rep(t, sx, sy = sx) {
  const c = t.clone();
  c.repeat.set(sx, sy);
  c.needsUpdate = true;
  return c;
}
