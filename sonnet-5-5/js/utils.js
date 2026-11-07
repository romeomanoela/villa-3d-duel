// Utilitaires partagés : maths, aléatoire déterministe, fusion de géométries (Batcher).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const TAU = Math.PI * 2;

/** PRNG déterministe (mulberry32) : la scène est identique à chaque chargement. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
  return f;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * Batcher : accumule des primitives positionnées en repère monde puis les fusionne
 * par matériau pour limiter les draw calls (scène entière < ~400 appels).
 */
export class Batcher {
  constructor() {
    this.map = new Map();
  }

  _push(mat, geo) {
    // Normalise les attributs pour que la fusion soit toujours possible.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    }
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.index) {
      const n = geo.attributes.position.count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    let list = this.map.get(mat);
    if (!list) this.map.set(mat, (list = []));
    list.push(geo);
  }

  /** Ajoute une géométrie (clonée) avec position / rotation (Euler XYZ) / échelle. */
  geo(geometry, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geometry.clone();
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    this._push(mat, g);
    return this;
  }

  /** Parallélépipède défini par ses bornes min/max. UV en mètres si mat.userData.tile. */
  box(mat, x0, x1, y0, y1, z0, z1) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const g = new THREE.BoxGeometry(w, h, d);
    const tile = mat.userData.tile;
    if (tile) {
      const uv = g.attributes.uv;
      const faces = [
        [z0, d, y0, h], // +x
        [z0, d, y0, h], // -x
        [x0, w, z0, d], // +y
        [x0, w, z0, d], // -y
        [x0, w, y0, h], // +z
        [x0, w, y0, h], // -z
      ];
      const tu = Array.isArray(tile) ? tile[0] : tile;
      const tv = Array.isArray(tile) ? tile[1] : tile;
      for (let f = 0; f < 6; f++) {
        const [u0, du, v0, dv] = faces[f];
        for (let i = 0; i < 4; i++) {
          const k = f * 4 + i;
          uv.setXY(k, (u0 + uv.getX(k) * du) / tu, (v0 + uv.getY(k) * dv) / tv);
        }
      }
    }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this._push(mat, g);
    return this;
  }

  /** Boîte centrée, avec rotation autour de Y (et optionnellement X/Z). */
  boxC(mat, cx, cy, cz, w, h, d, ry = 0, rx = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const tile = mat.userData.tile;
    if (tile) {
      const uv = g.attributes.uv;
      const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      const tu = Array.isArray(tile) ? tile[0] : tile;
      const tv = Array.isArray(tile) ? tile[1] : tile;
      for (let f = 0; f < 6; f++) {
        for (let i = 0; i < 4; i++) {
          const k = f * 4 + i;
          uv.setXY(k, (uv.getX(k) * faces[f][0]) / tu, (uv.getY(k) * faces[f][1]) / tv);
        }
      }
    }
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(cx, cy, cz), _q, _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    this._push(mat, g);
    return this;
  }

  /**
   * Plan rectangulaire : axis 'z' -> plan z=c (x:a0..a1, y:b0..b1, normale +z),
   * 'x' -> plan x=c (z:a0..a1, y:b0..b1, normale +x), 'y' -> plan y=c (x:a0..a1, z:b0..b1, normale +y).
   */
  plane(mat, axis, c, a0, a1, b0, b1) {
    const g = new THREE.PlaneGeometry(a1 - a0, b1 - b0);
    const am = (a0 + a1) / 2, bm = (b0 + b1) / 2;
    if (axis === 'z') g.translate(am, bm, c);
    else if (axis === 'x') {
      g.rotateY(Math.PI / 2);
      g.translate(c, bm, am);
    } else {
      g.rotateX(-Math.PI / 2);
      g.translate(am, c, bm);
    }
    this._push(mat, g);
    return this;
  }

  /** Cylindre vertical dont la base est à y. */
  cyl(mat, x, y, z, rTop, rBot, h, seg = 16, open = false) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
    g.translate(x, y + h / 2, z);
    this._push(mat, g);
    return this;
  }

  sphere(mat, x, y, z, r, ws = 12, hs = 8, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, ws, hs);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    this._push(mat, g);
    return this;
  }

  /** Fusionne et ajoute les maillages à `parent`. */
  build(parent, { cast = true, receive = true, name = 'batch' } = {}) {
    const out = [];
    for (const [mat, list] of this.map) {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast && !mat.transparent;
      mesh.receiveShadow = receive;
      mesh.name = `${name}:${mat.name || mat.type}`;
      parent.add(mesh);
      out.push(mesh);
      if (list.length > 1) list.forEach((g) => g.dispose());
    }
    this.map.clear();
    return out;
  }
}

/** Contour rectangulaire (Shape) avec trous rectangulaires éventuels, dans le plan XZ. */
export function rectShape(x0, x1, z0, z1, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(x0, z0);
  s.lineTo(x1, z0);
  s.lineTo(x1, z1);
  s.lineTo(x0, z1);
  s.lineTo(x0, z0);
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h[0], h[2]);
    p.lineTo(h[0], h[3]);
    p.lineTo(h[1], h[3]);
    p.lineTo(h[1], h[2]);
    p.lineTo(h[0], h[2]);
    s.holes.push(p);
  }
  return s;
}

/**
 * Dalle horizontale (avec trous) : extrusion d'un shape XZ entre y0 et y1.
 * Les UV sont en mètres (u = x, v = z) divisés par `tile`.
 */
export function slabGeometry(x0, x1, z0, z1, y0, y1, holes = [], tile = 1) {
  return extrudePlan(rectShape(x0, x1, z0, z1, holes), y0, y1, tile);
}

/** Polygone en plan (liste de [x, z]) extrudé entre y0 et y1. */
export function polyGeometry(pts, y0, y1, tile = 1) {
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
  return extrudePlan(shape, y0, y1, tile);
}

export function extrudePlan(shape, y0, y1, tile = 1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 12 });
  // Extrude: shape (x, y=z) + profondeur sur +z -> on convertit (x, z, depth) en (x, depth, z).
  g.rotateX(Math.PI / 2); // y -> z, z -> -y
  // après rotation: sommets en y = -depth..0 ; on remonte jusqu'à y1
  g.translate(0, y1, 0);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ny = Math.abs(nor.getY(i));
    const nx = Math.abs(nor.getX(i));
    if (ny > 0.5) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
    else if (nx > 0.5) uv.setXY(i, pos.getZ(i) / tile, pos.getY(i) / tile);
    else uv.setXY(i, pos.getX(i) / tile, pos.getY(i) / tile);
  }
  return g;
}

/** Bruit de valeur pseudo-aléatoire 2D rapide (JS, pour les textures canvas). */
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Applique une rotation à un vecteur autour de Y. */
export function rotY(x, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, -x * s + z * c];
}
