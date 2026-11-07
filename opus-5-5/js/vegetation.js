import * as THREE from 'three';
import { L } from './config.js';
import { Batcher, displace, smoothNormals, rnd, rr } from './utils.js';

const V3 = THREE.Vector3;

// Feuille de palmier : plan cintré (retombée) et plié en V le long de la nervure.
function frondGeometry() {
  const g = new THREE.PlaneGeometry(1.15, 3.4, 4, 14);
  g.translate(0, 1.7, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / 3.4;
    p.setZ(i, 1.5 * t * t - Math.abs(x) * 0.45);
    p.setX(i, x * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5 + 0.2)));
  }
  g.computeVertexNormals();
  return g;
}

// Remet les UV d'une BoxGeometry segmentée à l'échelle métrique.
function metricBoxUV(g, w, h, d) {
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = g.attributes.uv, idx = g.index.array;
  g.groups.forEach((gr, gi) => {
    const seen = new Set();
    for (let k = gr.start; k < gr.start + gr.count; k++) {
      const v = idx[k];
      if (seen.has(v)) continue;
      seen.add(v);
      uv.setXY(v, uv.getX(v) * dims[gi][0], uv.getY(v) * dims[gi][1]);
    }
  });
}

export function buildVegetation(scene, M) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  scene.add(group);
  const b = new Batcher();
  const fronds = [];
  const cards = { olive: [], shrub: [] };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();

  /* --- Palmiers --- */
  const palm = (x, z, y0, H, lean, yaw) => {
    const dx = Math.cos(yaw), dz = Math.sin(yaw);
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5, off = lean * H * Math.pow(t, 1.7);
      pts.push(new V3(x + dx * off, y0 + H * t, z + dz * off));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = 28, rad = 10;
    const tg = new THREE.TubeGeometry(curve, seg, 0.2, rad, false);
    const pos = tg.attributes.position, c = new V3(), v = new V3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.getPointAt(t, c);
      const r = (0.24 * (1 - 0.32 * t) + 0.16 * Math.exp(-t * 16) + 0.012 * Math.sin(t * 120)) / 0.2;
      for (let j = 0; j <= rad; j++) {
        const k = i * (rad + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    tg.computeVertexNormals();
    b.add(tg, M.palmTrunk);
    const top = pts[5];
    b.mesh(new THREE.SphereGeometry(0.34, 12, 8), M.palmTrunk, [top.x, top.y - 0.05, top.z], [0, 0, 0], [1, 1.3, 1]);
    const n = 15;
    for (let i = 0; i < n; i++) {
      const inner = i >= 11;
      const pitch = inner ? rr(0.25, 0.55) : rr(0.95, 1.45);
      const sc = inner ? rr(0.6, 0.8) : rr(0.85, 1.12);
      e.set(0, (i / n) * Math.PI * 2 * (inner ? 2.7 : 1) + rr(-0.15, 0.15), 0, 'YXZ');
      e.x = pitch;
      e.z = rr(-0.15, 0.15);
      m4.compose(top, q.setFromEuler(e), new V3(sc, sc, sc));
      fronds.push(m4.clone());
    }
  };
  const palms = [
    [-12.2, -21.6, 0, 6.6, 0.06, 0.6], [2.7, -19.3, L.FL0, 7.4, 0.08, 2.4], [8.6, -13, 0, 6.8, 0.1, 0.2],
    [-17, 0.5, 0, 7.2, 0.07, 3.6], [-12.4, 9.5, 0, 6.2, 0.09, 4.2], [16.6, 0.2, 0, 7.6, 0.06, 5.5],
    [-9.5, 16.5, 0, 6.6, 0.1, 1.2], [-19.5, -13.5, 0, 8.0, 0.05, 1.0],
  ];
  palms.forEach((p) => palm(...p));

  /* --- Oliviers : tronc tortueux + houppier en cartes de feuillage --- */
  const olive = (x, z, s) => {
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rr(-0.3, 0.3);
      const pts = [new V3(x, 0, z), new V3(x + rr(-0.15, 0.15), 0.9 * s, z + rr(-0.15, 0.15)),
        new V3(x + Math.cos(a) * 0.5 * s, 1.7 * s, z + Math.sin(a) * 0.5 * s),
        new V3(x + Math.cos(a) * 0.9 * s, 2.5 * s, z + Math.sin(a) * 0.9 * s)];
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.13 * s, 7, false);
      b.add(displace(tg, 0.05, 3), M.bark);
    }
    const blobs = 5;
    for (let k = 0; k < blobs; k++) {
      const a = (k / blobs) * Math.PI * 2;
      const c = new V3(x + Math.cos(a) * 0.9 * s, (2.9 + rr(-0.2, 0.5)) * s, z + Math.sin(a) * 0.9 * s);
      if (k === 0) c.set(x, 3.4 * s, z);
      const r = rr(0.85, 1.1) * s;
      const ico = smoothNormals(displace(new THREE.IcosahedronGeometry(r * 0.8, 2), 0.18 * s, 1.4, new V3()));
      b.mesh(ico, M.oliveCore, [c.x, c.y, c.z], [0, 0, 0], [1, 0.75, 1]);
      for (let i = 0; i < 34; i++) {
        const d = new V3(rr(-1, 1), rr(-0.6, 1), rr(-1, 1)).normalize().multiplyScalar(r * rr(0.65, 1.05));
        e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
        m4.compose(c.clone().add(d.multiply(new V3(1, 0.75, 1))), q.setFromEuler(e), new V3(1, 1, 1).multiplyScalar(rr(0.8, 1.2) * s));
        cards.olive.push(m4.clone());
      }
    }
  };
  [[-22, 12, 1.1], [-21, -9, 1.0], [20, -18, 1.15], [21.5, 3, 0.95], [-4, 15.5, 0.85], [22, 15.5, 0.9], [-24, -18, 1.05]]
    .forEach((o) => olive(...o));

  /* --- Cyprès d'Italie le long des limites latérales --- */
  const cyp = (x, z, H) => {
    const prof = [[0.01, 0], [0.42, 0.25], [0.6, 0.18 * H], [0.6, 0.45 * H], [0.42, 0.75 * H], [0.18, 0.93 * H], [0.01, H]]
      .map(([r, y]) => new THREE.Vector2(r * (H / 8), y));
    const g = new THREE.LatheGeometry(prof, 14);
    displace(g, 0.13, 1.8, new V3(), true);
    g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.5, uv.getY(i) * H);
    b.mesh(g, M.cypress, [x, 0, z], [0, rnd() * 6, 0]);
  };
  for (let z = -21; z <= 19; z += 5) {
    cyp(-28.4, z + rr(-0.4, 0.4), rr(7, 9));
    cyp(28.4, z + rr(-0.4, 0.4), rr(7, 9));
  }

  /* --- Haies taillées (bruit léger pour l'aspect végétal) --- */
  const hedge = (x0, x1, z0, z1, h) => {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.BoxGeometry(w, h, d, Math.ceil(w / 0.5), Math.ceil(h / 0.4), Math.ceil(d / 0.5));
    metricBoxUV(g, w, h, d);
    g.translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    displace(g, 0.07, 1.7, new V3((x0 + x1) / 2, -2, (z0 + z1) / 2));
    g.computeVertexNormals();
    b.add(g, M.hedge);
  };
  const P = L.PLOT;
  hedge(P.x0 + 0.4, P.x0 + 1.3, P.z0 + 0.4, 21.4, 1.8);
  hedge(P.x1 - 1.3, P.x1 - 0.4, P.z0 + 0.4, 21.4, 1.8);
  hedge(P.x0 + 1.3, P.x1 - 1.3, P.z0 + 0.4, P.z0 + 1.3, 1.8);
  hedge(-29.4, -8.2, 20.6, 21.5, 0.95);
  hedge(-3.6, 5.8, 20.6, 21.5, 0.95);
  hedge(20.4, 29.4, 20.6, 21.5, 0.95);

  /* --- Massifs : lavandes et buis taillés en boule --- */
  const lav = smoothNormals(displace(new THREE.IcosahedronGeometry(0.3, 2), 0.06, 4, new V3()));
  const ball = smoothNormals(displace(new THREE.IcosahedronGeometry(0.45, 3), 0.04, 5, new V3()));
  for (let x = -13.4; x < -8.3; x += 0.62) {
    b.mesh(lav, M.lavender, [x + rr(-0.1, 0.1), 0.22, 4.75 + rr(-0.1, 0.1)], [0, rnd() * 6, 0], [1, 0.75, 1]);
    b.mesh(lav, M.lavender, [x + 0.3 + rr(-0.1, 0.1), 0.22, 5.55 + rr(-0.1, 0.1)], [0, rnd() * 6, 0], [1, 0.75, 1]);
  }
  for (let x = -3.1; x < 5.4; x += 1.4) b.mesh(ball, M.box, [x, 0.45, 5.2], [0, rnd() * 6, 0], [1, 0.95, 1]);
  // Arbustes en pied de muret
  const shrub = (x, z, s) => {
    const c = new V3(x, 0.55 * s, z);
    b.mesh(smoothNormals(displace(new THREE.IcosahedronGeometry(0.6 * s, 2), 0.12 * s, 2, new V3())), M.foliageCore, [c.x, c.y, c.z], [0, 0, 0], [1.2, 0.9, 1.2]);
    for (let i = 0; i < 16; i++) {
      const d = new V3(rr(-1, 1), rr(-0.2, 1), rr(-1, 1)).normalize().multiplyScalar(0.62 * s);
      e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      m4.compose(c.clone().add(d), q.setFromEuler(e), new V3(0.7, 0.7, 0.7).multiplyScalar(s));
      cards.shrub.push(m4.clone());
    }
  };
  [[-26, 20.2, 1.1], [-19, 20.4, 1], [24, 20.2, 1.2], [26, -21.5, 1.2], [-8, -22.2, 1.1], [7, -22.2, 1.3], [17, -22.0, 1], [-17, 4.8, 1.1], [16.8, -4.2, 1.2]]
    .forEach((s) => shrub(...s));

  b.build(group, 'vegetation');

  /* --- Instances : palmes et cartes de feuillage --- */
  const inst = (geo, mat, list) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
    return im;
  };
  inst(frondGeometry(), M.palmLeaf, fronds);
  const card = new THREE.PlaneGeometry(1.1, 1.1);
  inst(card, M.oliveLeaf, cards.olive);
  inst(card, M.shrubLeaf, cards.shrub);
  return {};
}
