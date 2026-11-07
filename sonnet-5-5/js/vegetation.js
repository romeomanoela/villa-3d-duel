// Végétation procédurale : palmiers, oliviers, cyprès, haies, massifs fleuris, agaves.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batcher, rng, TAU } from './utils.js';

/** Boule de feuillage irrégulière (icosaèdre déplacé, normales lisses). */
function blobGeometry(detail, seed, bump = 0.22) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const r = rng(seed);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const noise = [];
  for (let i = 0; i < 12; i++) noise.push([r() * 6, r() * 6, r() * 6, 1.5 + r() * 3]);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let n = 0;
    for (const [a, b, c, f] of noise) n += Math.sin(v.x * f + a) * Math.sin(v.y * f + b) * Math.sin(v.z * f + c);
    const k = 1 + (n / noise.length) * bump * 4;
    pos.setXYZ(i, v.x * k, v.y * k * 0.92, v.z * k);
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return g;
}

function makeLeafMaterial(rough = 0.92) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 wpL = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpL = instanceMatrix * wpL;
#endif
vWPos = (modelMatrix * wpL).xyz;`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
float lh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ln(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(lh(i), lh(i+vec3(1,0,0)), f.x), mix(lh(i+vec3(0,1,0)), lh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(lh(i+vec3(0,0,1)), lh(i+vec3(1,0,1)), f.x), mix(lh(i+vec3(0,1,1)), lh(i+vec3(1,1,1)), f.x), f.y), f.z); }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
normal = normalize(normal + 0.5 * vec3(ln(vWPos * 9.0) - 0.5, ln(vWPos * 9.0 + 5.2) - 0.5, ln(vWPos * 9.0 + 9.7) - 0.5));`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float sp = ln(vWPos * 7.0) * 0.55 + ln(vWPos * 19.0) * 0.45;
diffuseColor.rgb *= 0.62 + 0.8 * sp;
diffuseColor.rgb *= 0.78 + 0.22 * smoothstep(0.0, 5.0, vWPos.y);`
      );
  };
  m.customProgramCacheKey = () => 'leaf-speckle';
  return m;
}

class InstanceSet {
  constructor(geometry, material, { cast = true, receive = true } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.cast = cast;
    this.receive = receive;
    this.items = [];
  }
  add(x, y, z, sx, sy, sz, color, rotY = 0) {
    this.items.push([x, y, z, sx, sy, sz, color, rotY]);
  }
  build(parent) {
    if (!this.items.length) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const c = new THREE.Color();
    const yAxis = new THREE.Vector3(0, 1, 0);
    this.items.forEach((it, i) => {
      q.setFromAxisAngle(yAxis, it[7]);
      m.compose(p.set(it[0], it[1], it[2]), q, s.set(it[3], it[4], it[5]));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(it[6]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = this.cast;
    mesh.receiveShadow = this.receive;
    parent.add(mesh);
    return mesh;
  }
}

/** Palme : ruban cintré avec nervure (texture à canal alpha). */
function frondGeometry(len, width, bend, seed) {
  const N = 9;
  const pos = [], uv = [], idx = [];
  let x = 0, y = 0, a = 0.95;
  const fold = 0.16 * width;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = width * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.1 + 0.08) * Math.PI * 0.8 + 0.2)) * (1 - 0.3 * t);
    for (let j = 0; j < 3; j++) {
      const s = j - 1;
      pos.push(x, y + Math.abs(s) * fold * (0.4 + t), s * w * 0.5);
      uv.push(j * 0.5, t);
    }
    if (i < N) {
      const b = i * 3;
      idx.push(b, b + 1, b + 4, b, b + 4, b + 3, b + 1, b + 2, b + 5, b + 1, b + 5, b + 4);
    }
    a -= bend / N;
    x += Math.cos(a) * (len / N);
    y += Math.sin(a) * (len / N);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createVegetation({ scene, M }) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  scene.add(group);

  const leafMat = makeLeafMaterial();
  const hedgeSet = new InstanceSet(blobGeometry(1, 3, 0.26), leafMat);
  const canopySet = new InstanceSet(blobGeometry(2, 7, 0.26), leafMat);
  const shrubSet = new InstanceSet(blobGeometry(1, 11, 0.24), leafMat, { cast: true });
  const wood = new Batcher();
  const palms = [];
  const flowers = { A: [], B: [], C: [], L: [] };
  const R = rng(2024);

  const GREENS = [0x3f6b36, 0x4a7a3c, 0x365f31, 0x55853f, 0x2f5a30];
  const OLIVE = [0x74835c, 0x6b7c58, 0x818f68, 0x5f7050];
  const CYPRESS = [0x244a2c, 0x2b5532, 0x1f4128];

  /* ---------------------------------- palmier ---------------------------------- */
  function palm(x, z, h = 8, lean = 0.9) {
    const ang = R() * TAU;
    const bx = Math.cos(ang) * lean, bz = Math.sin(ang) * lean;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0, z),
      new THREE.Vector3(x + bx * 0.15, h * 0.35, z + bz * 0.15),
      new THREE.Vector3(x + bx * 0.6, h * 0.7, z + bz * 0.6),
      new THREE.Vector3(x + bx, h, z + bz),
    ]);
    const seg = 28, rad = 8;
    const tube = new THREE.TubeGeometry(curve, seg, 0.24, rad, false);
    const pos = tube.attributes.position, uv = tube.attributes.uv;
    for (let i = 0; i <= seg; i++) {
      const c = curve.getPointAt(i / seg);
      const k = 1.45 - 0.75 * (i / seg) + (i < 3 ? (3 - i) * 0.12 : 0);
      for (let j = 0; j <= rad; j++) {
        const id = i * (rad + 1) + j;
        pos.setXYZ(id, c.x + (pos.getX(id) - c.x) * k, c.y + (pos.getY(id) - c.y) * k, c.z + (pos.getZ(id) - c.z) * k);
        uv.setXY(id, j / rad, ((i / seg) * h) / 2.6);
      }
    }
    tube.computeVertexNormals();
    const trunk = new THREE.Mesh(tube, M.trunkPalm);
    trunk.castShadow = trunk.receiveShadow = true;
    group.add(trunk);

    // couronne
    const top = curve.getPointAt(1);
    const crown = new THREE.Group();
    crown.position.copy(top);
    const geos = [];
    const n = 15;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const g = frondGeometry(3.1 + R() * 1.1, 1.25 + R() * 0.25, 0.75 + R() * 0.55, i);
      const up = i % 3 === 0 ? 0.55 : i % 3 === 1 ? 0.15 : -0.2; // étagement
      g.rotateX(0);
      g.rotateZ(up * 0.8);
      g.rotateY(t * TAU + R() * 0.3);
      geos.push(g);
    }
    // jeunes palmes dressées
    for (let i = 0; i < 4; i++) {
      const g = frondGeometry(2.2, 0.9, 0.25, 30 + i);
      g.rotateZ(1.0);
      g.rotateY(i * 1.6 + R());
      geos.push(g);
    }
    const crownMesh = new THREE.Mesh(mergeGeometries(geos), M.frond);
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crown.add(crownMesh);
    // cocos
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M.bark);
      s.position.set(Math.cos(a) * 0.3, -0.25, Math.sin(a) * 0.3);
      s.castShadow = true;
      crown.add(s);
    }
    group.add(crown);
    palms.push({ crown, phase: R() * TAU, amp: 0.012 + R() * 0.01 });
  }

  /* ---------------------------------- oliviers ---------------------------------- */
  function olive(x, z, s = 1) {
    const h = (2.0 + R() * 0.6) * s;
    const lean = (R() - 0.5) * 0.5;
    const t = new THREE.Vector3(x, 0, z);
    // tronc noueux en 2 branches principales
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * TAU + R() * 0.6;
      const ox = Math.cos(a) * 0.5 * s, oz = Math.sin(a) * 0.5 * s;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x + lean * 0.1, 0, z),
        new THREE.Vector3(x + lean * 0.3 + ox * 0.15, h * 0.45, z + oz * 0.15),
        new THREE.Vector3(x + lean + ox, h * 1.0, z + oz),
      ]);
      const g = new THREE.TubeGeometry(curve, 8, 0.16 * s * (b === 0 ? 1.15 : 0.85), 6, false);
      wood.geo(g, M.bark);
    }
    const n = 15 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 2.1 * s;
      const sz = (0.62 + R() * 0.5) * s;
      const y = h * 1.08 + (R() - 0.35) * 1.0 * s + (1 - d / (2.1 * s)) * 0.55 * s;
      canopySet.add(x + Math.cos(a) * d, y, z + Math.sin(a) * d, sz * 1.2, sz * 0.78, sz * 1.2, OLIVE[(R() * OLIVE.length) | 0], R() * TAU);
    }
    return t;
  }

  /** Grand arbre générique (décor lointain / ombrage) : tronc + houppier de grosses boules. */
  function tree(x, z, h = 9, palette = GREENS) {
    wood.cyl(M.bark, x, 0, z, 0.18 * (h / 9), 0.32 * (h / 9), h * 0.55, 7);
    const n = 6 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = R() * h * 0.2;
      const sz = h * (0.2 + R() * 0.12);
      canopySet.add(x + Math.cos(a) * d, h * 0.62 + (R() - 0.2) * h * 0.3, z + Math.sin(a) * d, sz, sz * 0.85, sz, palette[(R() * palette.length) | 0], R() * TAU);
    }
  }

  /* ---------------------------------- cyprès ---------------------------------- */
  function cypress(x, z, h = 6) {
    const col = CYPRESS[(R() * CYPRESS.length) | 0];
    const w = 0.55 + R() * 0.15;
    const n = Math.round(h / 1.2);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = w * (1.0 - Math.pow(t, 2.2) * 0.85) * (0.8 + 0.2 * Math.sin(t * 3));
      shrubSet.add(x + (R() - 0.5) * 0.08, 0.8 + t * (h - 1.4), z + (R() - 0.5) * 0.08, r * 1.15, 1.0 + (1 - t) * 0.2, r * 1.15, col, R() * TAU);
    }
    wood.cyl(M.bark, x, 0, z, 0.06, 0.1, 0.8, 5);
  }

  /* ---------------------------------- arbustes & haies ---------------------------------- */
  function shrub(x, z, r = 0.7, color = GREENS[(R() * GREENS.length) | 0], y = 0) {
    shrubSet.add(x, y + r * 0.62, z, r, r * 0.78, r, color, R() * TAU);
  }

  /** Haie taillée entre deux points (axe aligné). */
  function hedge(x0, z0, x1, z1, h = 1.5, w = 0.55) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 0.7));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const col = GREENS[(R() * GREENS.length) | 0];
      hedgeSet.add(x, h * 0.5, z, w * 1.1, h * 0.62, w * 1.05, col, R() * TAU);
      hedgeSet.add(x + (R() - 0.5) * 0.2, h * 0.9, z + (R() - 0.5) * 0.2, w * 0.95, h * 0.4, w * 0.95, col, R() * TAU);
    }
  }

  /** Massif fleuri (rectangle) : paillis, graminées et fleurs. */
  function bed(x0, x1, z0, z1, { flowers: f = true, agave: a = 0, shrubs = 0 } = {}) {
    wood.box(M.mulch, x0, x1, 0, 0.1, z0, z1);
    const area = (x1 - x0) * (z1 - z0);
    const nF = f ? Math.round(area * 7) : 0;
    for (let i = 0; i < nF; i++) {
      const x = x0 + 0.15 + R() * (x1 - x0 - 0.3), z = z0 + 0.15 + R() * (z1 - z0 - 0.3);
      const k = R();
      const list = k < 0.35 ? flowers.A : k < 0.6 ? flowers.B : k < 0.8 ? flowers.C : flowers.L;
      list.push([x, 0.22 + R() * 0.3, z, 0.034 + R() * 0.03]);
      if (R() < 0.5) shrubSet.add(x, 0.14, z, 0.2, 0.16, 0.2, GREENS[(R() * GREENS.length) | 0], R() * TAU);
    }
    for (let i = 0; i < shrubs; i++) shrub(x0 + 0.3 + R() * (x1 - x0 - 0.6), z0 + 0.3 + R() * (z1 - z0 - 0.6), 0.45 + R() * 0.4);
    for (let i = 0; i < a; i++) agave(x0 + 0.4 + R() * (x1 - x0 - 0.8), z0 + 0.4 + R() * (z1 - z0 - 0.8), 0.7 + R() * 0.5);
  }

  const agaves = [];
  function agave(x, z, s = 1) {
    agaves.push([x, z, s, R() * TAU]);
  }

  function finalize() {
    hedgeSet.build(group);
    canopySet.build(group);
    shrubSet.build(group);
    wood.build(group, { name: 'tree-wood' });

    // fleurs : petites sphères instanciées (4 teintes)
    const sg = new THREE.SphereGeometry(1, 6, 5);
    const mats = { A: M.flowerA, B: M.flowerB, C: M.flowerC, L: M.lavender };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const key of Object.keys(flowers)) {
      const list = flowers[key];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(sg, mats[key], list.length);
      list.forEach((f, i) => {
        m.compose(p.set(f[0], f[1], f[2]), q, s.setScalar(f[3]));
        im.setMatrixAt(i, m);
      });
      im.castShadow = false;
      im.receiveShadow = true;
      group.add(im);
    }

    // agaves : rosette de lames fusionnées, instanciées
    if (agaves.length) {
      const blades = [];
      const r = rng(8);
      for (let i = 0; i < 16; i++) {
        const g = new THREE.ConeGeometry(0.1, 0.9, 4, 1, true);
        g.translate(0, 0.45, 0);
        g.scale(1, 1, 0.35);
        g.rotateX(0.55 + (i % 3) * 0.3);
        g.rotateY(i * 2.4 + r() * 0.3);
        blades.push(g);
      }
      const ag = mergeGeometries(blades);
      const im = new THREE.InstancedMesh(ag, M.agave, agaves.length);
      agaves.forEach((a, i) => {
        m.compose(p.set(a[0], 0.05, a[1]), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a[3]), s.setScalar(a[2]));
        im.setMatrixAt(i, m);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      group.add(im);
    }
  }

  function update(dt, t) {
    for (const p of palms) {
      p.crown.rotation.z = Math.sin(t * 0.7 + p.phase) * p.amp;
      p.crown.rotation.x = Math.cos(t * 0.55 + p.phase * 1.3) * p.amp * 0.8;
    }
  }

  return { group, palm, olive, tree, cypress, shrub, hedge, bed, agave, finalize, update, R };
}
