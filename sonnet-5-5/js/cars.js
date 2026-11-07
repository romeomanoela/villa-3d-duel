// Voitures de luxe 100 % procédurales (aucun logo, aucune marque) : coque lofée par sections,
// habitacle vitré, jantes, étriers, phares/feux émissifs, intérieur sommaire.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU } from './utils.js';

/* ------------------------------------------------------------------ */
/*  Courbes 1D monotones (profil de la carrosserie le long de l'axe)   */
/* ------------------------------------------------------------------ */
function curve1D(pts) {
  const points = [...pts].sort((a, b) => a[0] - b[0]);
  const n = points.length;
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (s) => {
    s = Math.min(points[n - 1][0], Math.max(points[0][0], s));
    let i = 0;
    while (i < n - 2 && s > points[i + 1][0]) i++;
    const [s0, v0] = points[i], [s1, v1] = points[i + 1];
    const h = s1 - s0, t = (s - s0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m[i + 1];
  };
}

/* ------------------------------------------------------------------ */
/*  Définition des deux modèles                                        */
/* ------------------------------------------------------------------ */
const COUPE = {
  id: 'coupe',
  L: 4.62,
  paint: 0x8e0c1c,
  halfW: [[0, 0.5], [0.015, 0.66], [0.05, 0.84], [0.12, 0.935], [0.22, 0.98], [0.4, 0.955], [0.55, 0.93], [0.7, 0.955], [0.8, 0.975], [0.9, 0.93], [0.96, 0.82], [0.99, 0.66], [1, 0.5]],
  top: [[0, 0.56], [0.015, 0.72], [0.05, 0.86], [0.12, 0.945], [0.22, 0.99], [0.34, 0.97], [0.46, 0.93], [0.58, 0.905], [0.68, 0.89], [0.8, 0.87], [0.9, 0.78], [0.96, 0.64], [1, 0.46]],
  floor: [[0, 0.4], [0.02, 0.27], [0.06, 0.16], [0.9, 0.13], [0.96, 0.17], [1, 0.25]],
  axles: [{ x: 1.38, R: 0.345, W: 0.3 }, { x: -1.3, R: 0.355, W: 0.33 }],
  track: 0.8,
  cabin: {
    s0: 0.665, s1: 0.265,
    roof: [[0.665, 0.905], [0.62, 1.03], [0.58, 1.14], [0.555, 1.18], [0.5, 1.2], [0.44, 1.195], [0.38, 1.16], [0.32, 1.08], [0.265, 0.99]],
    wb: 0.76, wr: 0.58,
    roofS: [0.4, 0.555], bPillar: [0.488, 0.512], rearSide: 'paint', rearGlassTo: 0.4,
  },
  seats: [{ x: -0.1, z: 0.36 }, { x: -0.1, z: -0.36 }],
  intFloor: 0.34,
  seams: [0.69, 0.47],
  sills: [[0.47, 0.69]],
  rim: 'spoke10', rimColor: 0xa2a8b0, caliper: 0xd7261e,
};

const SEDAN = {
  id: 'berline',
  L: 5.02,
  paint: 0x17305c,
  halfW: [[0, 0.52], [0.015, 0.68], [0.05, 0.85], [0.12, 0.935], [0.22, 0.975], [0.5, 0.97], [0.78, 0.975], [0.88, 0.955], [0.95, 0.88], [0.985, 0.72], [1, 0.55]],
  top: [[0, 0.64], [0.015, 0.82], [0.05, 0.95], [0.12, 1.02], [0.22, 1.04], [0.32, 1.025], [0.42, 1.005], [0.6, 0.985], [0.7, 0.985], [0.82, 0.965], [0.91, 0.9], [0.965, 0.76], [1, 0.58]],
  floor: [[0, 0.42], [0.02, 0.29], [0.06, 0.18], [0.92, 0.16], [0.97, 0.2], [1, 0.28]],
  axles: [{ x: 1.55, R: 0.37, W: 0.27 }, { x: -1.48, R: 0.37, W: 0.29 }],
  track: 0.8,
  cabin: {
    s0: 0.645, s1: 0.265,
    roof: [[0.645, 0.99], [0.6, 1.13], [0.56, 1.3], [0.535, 1.385], [0.5, 1.42], [0.44, 1.43], [0.38, 1.4], [0.33, 1.31], [0.29, 1.17], [0.265, 1.03]],
    wb: 0.8, wr: 0.66,
    roofS: [0.38, 0.535], bPillar: [0.455, 0.475], rearSide: 'glass', rearGlassTo: 0.38,
  },
  seats: [{ x: 0.0, z: 0.38 }, { x: 0.0, z: -0.38 }, { x: -0.85, z: 0.38 }, { x: -0.85, z: -0.38 }],
  intFloor: 0.4,
  seams: [0.71, 0.5, 0.31],
  sills: [[0.31, 0.71]],
  rim: 'spoke5', rimColor: 0xc9ccd1, caliper: 0x2b2f36,
};

/* ------------------------------------------------------------------ */
/*  Coque : loft par sections avec passages de roues                   */
/* ------------------------------------------------------------------ */
function makeProfile(spec) {
  const fW = curve1D(spec.halfW), fT = curve1D(spec.top), fF = curve1D(spec.floor);
  const sample = (s) => {
    const x = (s - 0.5) * spec.L;
    const w = fW(s), yT = fT(s), yF = fF(s);
    let yS = yF + 0.07;
    for (const ax of spec.axles) {
      const dx = x - ax.x, ra = ax.R + 0.08;
      if (Math.abs(dx) < ra) yS = Math.max(yS, ax.R + Math.sqrt(ra * ra - dx * dx) * 0.98);
    }
    return { x, w, yT, yF, yS };
  };
  return { sample, fW, fT, fF };
}

function buildHull(spec, prof) {
  const NS = 140, K = 22;
  const ringSize = 2 * K;
  const pos = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    const { x, w, yT, yF, yS } = prof.sample(s);
    const h = yT - yS;
    const ctrl = [
      new THREE.Vector2(0, yF),
      new THREE.Vector2(0.45 * w, yF),
      new THREE.Vector2(0.8 * w, yF + (yS - yF) * 0.6),
      new THREE.Vector2(0.97 * w, yS + 0.012),
      new THREE.Vector2(1.0 * w, yS + 0.2 * h),
      new THREE.Vector2(1.0 * w, yS + 0.56 * h),
      new THREE.Vector2(0.975 * w, yS + 0.8 * h),
      new THREE.Vector2(0.88 * w, yT - 0.008),
      new THREE.Vector2(0.55 * w, yT + 0.008 * w),
      new THREE.Vector2(0, yT + 0.022),
    ];
    const pts = new THREE.SplineCurve(ctrl).getPoints(K);
    for (let j = 0; j <= K; j++) pos.push(x, pts[j].y, Math.max(0, pts[j].x));
    for (let j = K - 1; j >= 1; j--) pos.push(x, pts[j].y, -Math.max(0, pts[j].x));
  }
  const idx = [];
  const side = [];
  const cab = spec.cabin;
  for (let i = 0; i < NS; i++) {
    const sMid = (i + 0.5) / NS;
    const inCab = sMid > cab.s1 + 0.012 && sMid < cab.s0 - 0.012;
    const pm = prof.sample(sMid);
    const holeW = cab.wb * pm.w * 0.9;
    for (let j = 0; j < ringSize; j++) {
      const a = i * ringSize + j, b = i * ringSize + ((j + 1) % ringSize);
      const c = (i + 1) * ringSize + j, d = (i + 1) * ringSize + ((j + 1) % ringSize);
      if (inCab) {
        // ouverture du toit de la coque sous l'habitacle (l'intérieur devient visible à travers les vitres)
        const za = Math.abs(pos[a * 3 + 2]), zb = Math.abs(pos[b * 3 + 2]);
        const ya = pos[a * 3 + 1], yb2 = pos[b * 3 + 1];
        if (za < holeW && zb < holeW && ya > pm.yT - 0.05 && yb2 > pm.yT - 0.05) continue;
      }
      side.push([a, c, b], [b, c, d]);
    }
  }
  // orientation : la normale d'une facette du dessus doit pointer vers +y
  const ia = K, ib = (K + 1) % ringSize; // segment du haut, station médiane
  const mid = Math.floor(NS / 2);
  const A = new THREE.Vector3().fromArray(pos, (mid * ringSize + ia) * 3);
  const C = new THREE.Vector3().fromArray(pos, ((mid + 1) * ringSize + ia) * 3);
  const Bv = new THREE.Vector3().fromArray(pos, (mid * ringSize + ib) * 3);
  const n = C.clone().sub(A).cross(Bv.clone().sub(A));
  const flip = n.y < 0;
  for (const t of side) idx.push(...(flip ? [t[0], t[2], t[1]] : t));
  // bouchons avant / arrière
  for (const [st, dir] of [[0, -1], [NS, 1]]) {
    const cIdx = pos.length / 3;
    let cx = 0, cy = 0;
    for (let j = 0; j < ringSize; j++) {
      cx += pos[(st * ringSize + j) * 3];
      cy += pos[(st * ringSize + j) * 3 + 1];
    }
    pos.push(cx / ringSize, cy / ringSize, 0);
    for (let j = 0; j < ringSize; j++) {
      const a = st * ringSize + j, b = st * ringSize + ((j + 1) % ringSize);
      const va = new THREE.Vector3().fromArray(pos, a * 3), vb = new THREE.Vector3().fromArray(pos, b * 3), vc = new THREE.Vector3().fromArray(pos, cIdx * 3);
      const nn = vb.clone().sub(vc).cross(va.clone().sub(vc));
      if (nn.x * dir > 0) idx.push(cIdx, b, a);
      else idx.push(cIdx, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Habitacle : loft ouvert, deux groupes de faces (verre / peinture : toit, montants). */
function buildCabin(spec, prof) {
  const cab = spec.cabin;
  const fR = curve1D(cab.roof);
  const NS = 60, M = 9;
  const ringSize = 2 * M + 1;
  const pos = [];
  const ss = [];
  for (let i = 0; i <= NS; i++) {
    const s = cab.s1 + ((cab.s0 - cab.s1) * i) / NS;
    ss.push(s);
    const { x, w, yT } = prof.sample(s);
    const yb = yT - 0.015;
    const yr = fR(s) + 0.0;
    const hc = Math.max(0.02, yr - yb);
    const wb = cab.wb * w, wr = cab.wr * w;
    const ctrl = [
      new THREE.Vector2(wb, yb),
      new THREE.Vector2(wb + (wr - wb) * 0.1, yb + 0.28 * hc),
      new THREE.Vector2(wb + (wr - wb) * 0.5, yb + 0.7 * hc),
      new THREE.Vector2(wr, yb + 0.93 * hc),
      new THREE.Vector2(wr * 0.62, yb + 0.992 * hc),
      new THREE.Vector2(0, yb + hc),
    ];
    const pts = new THREE.SplineCurve(ctrl).getPoints(M);
    for (let j = 0; j <= M; j++) pos.push(x, pts[j].y, pts[j].x);
    for (let j = M - 1; j >= 0; j--) pos.push(x, pts[j].y, -pts[j].x);
  }
  const glassIdx = [], paintIdx = [];
  const kRoof = 6; // segments (côté) à partir desquels on est sur le toit
  for (let i = 0; i < NS; i++) {
    const sMid = (ss[i] + ss[i + 1]) / 2;
    for (let j = 0; j < ringSize - 1; j++) {
      const k = j < M ? j : ringSize - 2 - j; // indice de segment côté droit équivalent (0 = bas)
      const a = i * ringSize + j, b = a + 1, c = (i + 1) * ringSize + j, d = c + 1;
      let paint = false;
      const inRoof = sMid >= cab.roofS[0] && sMid <= cab.roofS[1];
      const inWS = sMid > cab.roofS[1];
      const inRear = sMid < cab.roofS[0];
      if (inRoof && k >= kRoof) paint = true; // toit
      if ((inWS || inRear) && k === 4) paint = true; // montants A / C
      if (inRoof && k < kRoof && sMid >= cab.bPillar[0] && sMid <= cab.bPillar[1]) paint = true; // montant B
      if (inRear && sMid < cab.rearGlassTo - 0.07 && k >= 4) paint = true; // cache-moteur / hayon
      if (inRear && cab.rearSide === 'paint' && k < 4) paint = true; // ailes arrière pleines
      (paint ? paintIdx : glassIdx).push([a, c, b], [b, c, d]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // orientation : première facette du toit vers +y
  const mid = Math.floor(NS / 2);
  const jt = M - 1; // près du sommet
  const A = new THREE.Vector3().fromArray(pos, (mid * ringSize + jt) * 3);
  const C = new THREE.Vector3().fromArray(pos, ((mid + 1) * ringSize + jt) * 3);
  const Bv = new THREE.Vector3().fromArray(pos, (mid * ringSize + jt + 1) * 3);
  const flip = C.clone().sub(A).cross(Bv.clone().sub(A)).y < 0;
  const idx = [];
  const push = (list) => list.forEach((t) => idx.push(...(flip ? [t[0], t[2], t[1]] : t)));
  push(glassIdx);
  const glassCount = idx.length;
  push(paintIdx);
  g.setIndex(idx);
  g.addGroup(0, glassCount, 0);
  g.addGroup(glassCount, idx.length - glassCount, 1);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/*  Roue                                                               */
/* ------------------------------------------------------------------ */
function buildWheel(R, W, style, mats) {
  const g = new THREE.Group();
  const rr = R * 0.72;
  // pneu (profil de révolution)
  const tp = [
    [rr, -0.44 * W], [rr * 1.07, -0.5 * W], [R * 0.9, -0.5 * W], [R * 0.975, -0.42 * W], [R, -0.28 * W],
    [R, 0.28 * W], [R * 0.975, 0.42 * W], [R * 0.9, 0.5 * W], [rr * 1.07, 0.5 * W], [rr, 0.44 * W],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.LatheGeometry(tp, 40);
  tire.rotateX(Math.PI / 2); // axe de la roue -> z
  const tireMesh = new THREE.Mesh(tire, mats.rubber);
  tireMesh.castShadow = true;
  g.add(tireMesh);

  // jante : fût + lèvre + rayons
  const rim = [];
  const barrel = new THREE.LatheGeometry([[rr * 0.96, -0.4 * W], [rr * 1.02, -0.45 * W], [rr * 1.02, 0.44 * W], [rr * 0.99, 0.46 * W], [rr * 0.9, 0.42 * W], [rr * 0.2, 0.3 * W]].map(([r, y]) => new THREE.Vector2(r, y)), 36);
  barrel.rotateX(Math.PI / 2);
  rim.push(barrel);
  const nSp = style === 'spoke10' ? 10 : 5;
  for (let k = 0; k < nSp; k++) {
    const a = (k / nSp) * TAU;
    const len = rr * 0.86, wd = style === 'spoke10' ? 0.04 : 0.085;
    const sp = new THREE.BoxGeometry(len, wd, 0.026);
    sp.translate(len / 2 + rr * 0.14, 0, 0);
    if (style === 'spoke5') {
      // rayon en Y : deux branches
      const sp2 = sp.clone();
      sp2.rotateZ(0.14);
      sp2.scale(0.9, 0.8, 1);
      const sp3 = sp.clone();
      sp3.rotateZ(-0.14);
      sp3.scale(0.9, 0.8, 1);
      sp2.rotateZ(a); sp3.rotateZ(a);
      sp2.translate(0, 0, 0.36 * W); sp3.translate(0, 0, 0.36 * W);
      rim.push(sp2, sp3);
      continue;
    }
    sp.rotateZ(a);
    sp.translate(0, 0, 0.36 * W);
    rim.push(sp);
  }
  const cap = new THREE.CylinderGeometry(rr * 0.2, rr * 0.2, 0.03, 20);
  cap.rotateX(Math.PI / 2);
  cap.translate(0, 0, 0.38 * W);
  rim.push(cap);
  const rimMesh = new THREE.Mesh(mergeGeometries(rim.map((x) => (x.index ? x.toNonIndexed() : x))), mats.rim);
  rimMesh.castShadow = true;
  g.add(rimMesh);

  // fond de jante sombre, disque et étrier de frein
  const dark = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.95, rr * 0.95, 0.02, 28).rotateX(Math.PI / 2).translate(0, 0, 0.2 * W), mats.dark);
  g.add(dark);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.82, rr * 0.82, 0.03, 32).rotateX(Math.PI / 2).translate(0, 0, 0.26 * W), mats.disc);
  g.add(disc);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(rr * 0.5, rr * 0.34, 0.06).translate(rr * 0.52, rr * 0.42, 0.3 * W), mats.caliper);
  cal.rotation.z = 0.6;
  g.add(cal);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Assemblage d'une voiture                                           */
/* ------------------------------------------------------------------ */
export function createCar(spec, M, T, ambience) {
  const prof = makeProfile(spec);
  const car = new THREE.Group();
  car.name = `voiture-${spec.id}`;
  const body = new THREE.Group();
  car.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.paint, metalness: 0.62, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25, name: `peinture-${spec.id}`,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0x050a10, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, envMapIntensity: 1.5, name: 'vitre-voiture',
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.45, metalness: 0.3, name: 'noir-satiné' });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.12, metalness: 1, name: 'chrome', envMapIntensity: 1.4 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.55, name: 'cuir-noir' });
  const rimMat = new THREE.MeshStandardMaterial({ color: spec.rimColor, roughness: 0.28, metalness: 1, name: 'jante', envMapIntensity: 1.3 });
  const wheelMats = {
    rubber: new THREE.MeshStandardMaterial({ color: 0x101112, roughness: 0.82, name: 'pneu' }),
    rim: rimMat,
    dark: new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.8, name: 'fond-jante' }),
    disc: new THREE.MeshStandardMaterial({ color: 0x8d9298, roughness: 0.4, metalness: 0.9, name: 'disque' }),
    caliper: new THREE.MeshStandardMaterial({ color: spec.caliper, roughness: 0.35, metalness: 0.3, name: 'étrier' }),
  };
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, emissive: 0xfff4dc, emissiveIntensity: 0, roughness: 0.2, name: 'phare' });
  ambience.emissive(headMat, 2.6, 0.68, 0.95, 0.1);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0508, emissive: 0xff1c14, emissiveIntensity: 0, roughness: 0.3, name: 'feu-arrière' });
  ambience.emissive(tailMat, 3.2, 0.68, 0.95, 0.1);

  // coque et habitacle
  const hullGeo = buildHull(spec, prof);
  const hull = new THREE.Mesh(hullGeo, paint);
  hull.castShadow = true;
  hull.receiveShadow = true;
  body.add(hull);
  const cabGeo = buildCabin(spec, prof);
  const cabin = new THREE.Mesh(cabGeo, [glass, paint]);
  cabin.castShadow = true;
  cabin.renderOrder = 7;
  body.add(cabin);

  const L = spec.L;
  const at = (s) => prof.sample(s);

  // intérieur : face interne sombre de la coque, plancher, sièges, planche de bord, volant
  {
    const c = spec.cabin;
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 0.9, side: THREE.BackSide, name: 'intérieur-coque' });
    body.add(new THREE.Mesh(hullGeo, dark));
    const fy = spec.intFloor;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0c0b, roughness: 0.95 });
    const f0 = at(c.s1 + 0.03), f1 = at(c.s0 - 0.03);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(f1.x - f0.x, 0.02, c.wb * f0.w * 1.6), floorMat);
    fl.position.set((f0.x + f1.x) / 2, fy, 0);
    body.add(fl);
    for (const st of spec.seats) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.44), leather);
      back.position.set(st.x - 0.2, fy + 0.34, st.z);
      back.rotation.z = 0.26;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.19, 0.2), leather);
      head.position.set(st.x - 0.3, fy + 0.66, st.z);
      head.rotation.z = 0.2;
      const cush = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.46), leather);
      cush.position.set(st.x + 0.1, fy + 0.1, st.z);
      const tunnel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.14), leather);
      tunnel.position.set(st.x + 0.1, fy + 0.1, 0);
      body.add(back, head, cush, tunnel);
    }
    const dp = at(c.s0 - 0.015);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.5, dp.yT - fy - 0.04, c.wb * dp.w * 1.75), leather);
    dash.position.set(dp.x - 0.22, fy + (dp.yT - fy - 0.04) / 2, 0);
    body.add(dash);
    const wheelG = new THREE.TorusGeometry(0.17, 0.016, 8, 28);
    wheelG.rotateY(Math.PI / 2);
    wheelG.rotateZ(-0.45);
    const sw = new THREE.Mesh(wheelG, leather);
    sw.position.set(dp.x - 0.5, dp.yT - 0.06, spec.seats[0].z);
    body.add(sw);
  }

  // roues
  const wheels = [];
  for (const ax of spec.axles) {
    for (const sgn of [1, -1]) {
      const w = buildWheel(ax.R, ax.W, spec.rim, wheelMats);
      w.position.set(ax.x, ax.R, sgn * (spec.track + (spec.id === 'coupe' ? 0.0 : 0.0)));
      if (sgn < 0) w.rotation.y = Math.PI;
      car.add(w);
      wheels.push(w);
      // passage de roue : demi-cylindre sombre
      const liner = new THREE.Mesh(
        new THREE.CylinderGeometry(ax.R + 0.07, ax.R + 0.07, ax.W + 0.14, 28, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.95, side: THREE.DoubleSide })
      );
      liner.position.set(ax.x, ax.R, sgn * (spec.track - 0.02));
      car.add(liner);
    }
  }

  /* ----- détails dépendants du modèle ----- */
  const front = at(0.97), rear = at(0.03);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, shadow = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = shadow;
    body.add(m);
    return m;
  };
  const ell = (rx, ry, rz) => new THREE.SphereGeometry(1, 16, 10).scale(rx, ry, rz);

  // joints de portes (lignes sombres suivant le flanc de la caisse)
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.7, name: 'joint' });
  for (const s of spec.seams) {
    const p = at(s);
    const h = p.yT - p.yS;
    for (const sg of [1, -1]) {
      add(new THREE.BoxGeometry(0.008, 0.3 * h, 0.006), seamMat, p.x, p.yS + 0.4 * h, sg * (p.w + 0.0008));
      add(new THREE.BoxGeometry(0.008, 0.26 * h, 0.006), seamMat, p.x, p.yS + 0.68 * h, sg * (p.w * 0.993 + 0.0008));
    }
  }
  // seuil de porte : trait horizontal entre les passages de roue
  for (const [sa, sb] of spec.sills) {
    const pa = at(sa), pb = at(sb);
    for (const sg of [1, -1]) {
      add(new THREE.BoxGeometry(pb.x - pa.x, 0.008, 0.006), seamMat, (pa.x + pb.x) / 2, pa.yS + 0.1, sg * (pa.w * 0.99));
    }
  }

  for (const sg of [1, -1]) {
    if (spec.id === 'coupe') {
      // phares : fentes LED
      add(ell(0.34, 0.034, 0.075), trim, 2.1, 0.66, sg * 0.58, 0, -sg * 0.62, -0.62);
      add(ell(0.31, 0.022, 0.05), headMat, 2.11, 0.676, sg * 0.58, 0, -sg * 0.62, -0.62);
      // entrées d'air latérales du bouclier
      add(new THREE.BoxGeometry(0.1, 0.1, 0.36), trim, 2.12, 0.33, sg * 0.5, 0, -sg * 0.18, 0);
      // feux arrière : barre à LED + blocs
      add(new THREE.BoxGeometry(0.05, 0.075, 0.5), tailMat, -2.292, 0.585, sg * 0.27, 0, sg * 0.12, 0);
      add(new THREE.BoxGeometry(0.1, 0.05, 0.22), tailMat, -2.12, 0.78, sg * 0.66, 0, sg * 0.5, 0.35);
      // sorties d'échappement
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 16).rotateZ(Math.PI / 2), chrome, -2.3, 0.3, sg * 0.28);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.17, 16).rotateZ(Math.PI / 2), trim, -2.3, 0.3, sg * 0.28);
      // supports d'aileron
      add(new THREE.BoxGeometry(0.05, 0.16, 0.05), trim, -2.0, 1.04, sg * 0.5);
      // rétroviseurs
      const mp = at(0.665);
      add(ell(0.1, 0.045, 0.065), paint, mp.x - 0.12, mp.yT + 0.06, sg * (mp.w * 0.78 + 0.12), 0, 0, 0, true);
      // prises d'air arrière (ouïes)
      add(new THREE.BoxGeometry(0.5, 0.012, 0.12), trim, -1.1, 0.97, sg * 0.5, 0, 0, 0);
      // poignées
      add(new THREE.BoxGeometry(0.16, 0.018, 0.012), trim, 0.18, 0.7, sg * (at(0.54).w + 0.005));
    } else {
      // berline : feux effilés, double calandre, chrome
      add(ell(0.3, 0.05, 0.16), trim, 2.3, 0.775, sg * 0.64, 0, -sg * 0.5, -0.55);
      add(ell(0.26, 0.027, 0.11), headMat, 2.31, 0.795, sg * 0.64, 0, -sg * 0.5, -0.55);
      add(ell(0.11, 0.02, 0.07), headMat, 2.4, 0.7, sg * 0.5, 0, -sg * 0.3, -0.55);
      add(new THREE.BoxGeometry(0.1, 0.12, 0.34), trim, 2.38, 0.36, sg * 0.56, 0, -sg * 0.2, 0);
      add(new THREE.BoxGeometry(0.05, 0.085, 0.62), tailMat, -2.47, 0.68, sg * 0.34, 0, sg * 0.14, 0);
      add(new THREE.BoxGeometry(0.12, 0.05, 0.3), tailMat, -2.3, 0.93, sg * 0.7, 0, sg * 0.5, 0.35);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 16).rotateZ(Math.PI / 2), chrome, -2.52, 0.3, sg * 0.5);
      const mp = at(0.645);
      add(ell(0.11, 0.05, 0.07), paint, mp.x - 0.15, mp.yT + 0.07, sg * (mp.w * 0.8 + 0.12), 0, 0, 0, true);
      add(new THREE.BoxGeometry(0.2, 0.02, 0.012), chrome, 0.3, 0.86, sg * (at(0.56).w + 0.005));
      add(new THREE.BoxGeometry(0.2, 0.02, 0.012), chrome, -0.65, 0.88, sg * (at(0.4).w + 0.005));
      // baguettes chromées autour des vitres
      add(new THREE.BoxGeometry(1.2, 0.014, 0.014), chrome, 0.05, 1.01, sg * (at(0.5).w * 0.8 + 0.008));
    }
  }
  if (spec.id === 'coupe') {
    // aileron + lame de bouclier
    add(new THREE.BoxGeometry(0.36, 0.028, 1.62), paint, -2.05, 1.13, 0, 0, 0, -0.06, true);
    add(new THREE.BoxGeometry(0.1, 0.025, 1.2), trim, 2.27, 0.2, 0);
    // calandre basse
    add(new THREE.BoxGeometry(0.06, 0.1, 0.62), trim, 2.28, 0.42, 0);
    // diffuseur
    add(new THREE.BoxGeometry(0.16, 0.05, 1.05), trim, -2.25, 0.27, 0);
    // jupes latérales
    for (const sg of [1, -1]) add(new THREE.BoxGeometry(2.0, 0.045, 0.04), trim, 0.0, 0.17, sg * (at(0.5).w - 0.02));
  } else {
    // calandre verticale chromée + jupes
    for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.03, 0.15, 0.025), chrome, 2.43, 0.5, -0.24 + i * 0.08);
    add(new THREE.BoxGeometry(0.04, 0.2, 0.62), trim, 2.41, 0.5, 0);
    add(new THREE.BoxGeometry(0.12, 0.03, 1.5), trim, 2.38, 0.2, 0);
    for (const sg of [1, -1]) add(new THREE.BoxGeometry(2.6, 0.05, 0.04), trim, 0.0, 0.2, sg * (at(0.5).w - 0.02));
  }
  // plaques d'immatriculation (texte générique, sans marque)
  const plateMat = new THREE.MeshStandardMaterial({ map: T.plate, roughness: 0.4, name: 'plaque' });
  const plateGeo = new THREE.PlaneGeometry(0.46, 0.115);
  const pr = add(plateGeo, plateMat, -L / 2 - 0.0 + 0.0, spec.id === 'coupe' ? 0.5 : 0.7, 0);
  pr.rotation.y = -Math.PI / 2;
  pr.position.x = -L / 2 - 0.012;
  const pf = add(plateGeo, plateMat, L / 2 + 0.0, 0.3, 0);
  pf.rotation.y = Math.PI / 2;
  pf.position.x = L / 2 + (spec.id === 'coupe' ? 0.02 : 0.03);

  // projecteur des phares (réel, un seul par voiture) + ombre portée douce au sol
  const spot = new THREE.SpotLight(0xfff1d6, 0, 22, 0.62, 0.65, 1.5);
  spot.position.set(L / 2 + 0.45, 0.62, 0);
  const target = new THREE.Object3D();
  target.position.set(L / 2 + 9, 0.05, 0);
  car.add(spot, target);
  spot.target = target;
  ambience.light(spot, 70, 0.68, 0.95);

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(L * 1.25, spec.track * 3.1),
    new THREE.MeshBasicMaterial({ map: T.glow, color: 0x000000, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  blob.renderOrder = 2;
  car.add(blob);

  return { car, paint, wheels, spec, prof };
}

export { COUPE, SEDAN };
