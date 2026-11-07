// Outils génériques : RNG déterministe, UVs en unités monde, fusion de géométries.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Générateur pseudo-aléatoire déterministe (mulberry32) : la scène est identique à chaque chargement. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

/**
 * Remet les UVs d'une BoxGeometry (1 segment par face) en unités monde,
 * pour qu'une texture répétée ait la même échelle sur chaque objet.
 */
export function uvBox(geom, w, h, d) {
  const uv = geom.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv);
    }
  }
  uv.needsUpdate = true;
  return geom;
}

export function box(w, h, d) {
  return uvBox(new THREE.BoxGeometry(w, h, d), w, h, d);
}

export function uvScale(geom, su, sv) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geom;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Accumule des géométries par matériau puis les fusionne en un seul Mesh
 * par matériau : réduit fortement le nombre de draw calls (clôture, meubles…).
 */
export class Merger {
  constructor() { this.map = new Map(); }

  add(geom, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = null) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    _p.set(pos[0], pos[1], pos[2]);
    _e.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ');
    _q.setFromEuler(_e);
    if (scale) _s.set(scale[0], scale[1], scale[2]); else _s.set(1, 1, 1);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(g);
    return this;
  }

  /**
   * Raccourci : boîte en unités monde, centrée sur pos.
   * Si `this.sink` est un tableau, les boîtes non tournées y sont aussi enregistrées comme AABB (collisions).
   */
  box(w, h, d, material, pos, rot) {
    if (this.sink && !rot) {
      this.sink.push({ x0: pos[0] - w / 2, x1: pos[0] + w / 2, y0: pos[1] - h / 2, y1: pos[1] + h / 2, z0: pos[2] - d / 2, z1: pos[2] + d / 2 });
    }
    return this.add(box(w, h, d), material, pos, rot);
  }

  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [mat, list] of this.map) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.map.clear();
    return meshes;
  }
}
