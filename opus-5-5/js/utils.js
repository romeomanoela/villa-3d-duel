import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- Bruit pseudo-aléatoire déterministe ---------- */
let _seed = 987654321;
export function rnd() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}
export const rr = (a, b) => a + rnd() * (b - a);
export const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const l = THREE.MathUtils.lerp;
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}
export const fbm = (x, y, z) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.1;

/* ---------- Géométries ---------- */
// Boîte dont les UV sont exprimées en mètres (texture répétée à l'échelle réelle).
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
    }
  }
  return g;
}

// Déplace les sommets selon un bruit fonction de la position (pas de fissures aux arêtes).
export function displace(geo, amp, freq, center = new THREE.Vector3(), radialOnly = false) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const off = rr(0, 100);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    dir.copy(v).sub(center);
    if (radialOnly) dir.y = 0;
    if (dir.lengthSq() < 1e-8) continue;
    dir.normalize();
    const n = fbm(v.x * freq + off, v.y * freq, v.z * freq) - 0.5;
    v.addScaledVector(dir, n * amp * 2);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  return geo;
}

export function smoothNormals(geo) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const g = mergeVertices(geo, 1e-3);
  g.computeVertexNormals();
  return g;
}

/* ---------- Fusion de géométries statiques par matériau ---------- */
const KEEP = ['position', 'normal', 'uv'];
export class Batcher {
  constructor() {
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }
  get top() { return this.stack[this.stack.length - 1]; }
  // Empile un repère local (position + rotation Y) pour construire mobilier & objets.
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      this._q.setFromEuler(this._e.set(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    this.stack.push(this.top.clone().multiply(m));
    return this;
  }
  pop() { if (this.stack.length > 1) this.stack.pop(); return this; }

  add(geo, mat, matrix, opts = {}) {
    const cast = opts.cast ?? true;
    const recv = opts.receive ?? true;
    const key = `${mat.uuid}|${cast}|${recv}`;
    let b = this.buckets.get(key);
    if (!b) { b = { mat, cast, recv, geos: [] }; this.buckets.set(key, b); }
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = this.top.clone();
    if (matrix) m.multiply(matrix);
    g.applyMatrix4(m);
    g.clearGroups();
    b.geos.push(g);
  }
  // Boîte centrée en (x,y,z), rotation éventuelle autour de Y.
  box(mat, w, h, d, x, y, z, ry = 0, opts) {
    if (w <= 1e-4 || h <= 1e-4 || d <= 1e-4) return;
    this._m.makeRotationY(ry).setPosition(x, y, z);
    this.add(boxGeo(w, h, d), mat, this._m, opts);
  }
  // Boîte définie par ses bornes (alignée sur les axes).
  boxB(mat, x0, x1, y0, y1, z0, z1, opts) {
    this.box(mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, opts);
  }
  // Géométrie quelconque avec position / rotation (Euler) / échelle.
  mesh(geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], opts) {
    this._m.compose(
      new THREE.Vector3(...p),
      this._q.setFromEuler(this._e.set(r[0], r[1], r[2])),
      new THREE.Vector3(...s)
    );
    this.add(geo, mat, this._m, opts);
  }
  // Dalle rectangulaire percée d'une trémie rectangulaire.
  slabHole(mat, x0, x1, z0, z1, hx0, hx1, hz0, hz1, y0, y1, opts) {
    this.boxB(mat, x0, x1, y0, y1, z0, hz0, opts);
    this.boxB(mat, x0, x1, y0, y1, hz1, z1, opts);
    this.boxB(mat, x0, hx0, y0, y1, hz0, hz1, opts);
    this.boxB(mat, hx1, x1, y0, y1, hz0, hz1, opts);
  }
  build(parent, name = 'batch') {
    const out = [];
    for (const b of this.buckets.values()) {
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos, false);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.name = name;
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.recv;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      out.push(mesh);
      for (const g of b.geos) g.dispose();
    }
    this.buckets.clear();
    return out;
  }
}

/* ---------- Divers ---------- */
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const smooth01 = (t) => t * t * (3 - 2 * t);
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const sstep = (a, b, x) => smooth01(clamp01((x - a) / (b - a)));
