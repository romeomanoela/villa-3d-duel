// Terrain : sol, rue, allée carrossable, clôtures, portail, éclairage extérieur, collines, plantations.
import * as THREE from 'three';
import { Batcher, slabGeometry, polyGeometry, rng, TAU } from './utils.js';
import { PLOT, POOL, GATE } from './config.js';

export function buildTerrain(ctx) {
  const { scene, M, T, veg } = ctx;
  const group = new THREE.Group();
  group.name = 'terrain';
  scene.add(group);
  const B = new Batcher();
  const G = new Batcher(); // halos / taches de lumière (additifs, sans ombre)
  const R = rng(99);

  /* ---------- sols ---------- */
  const far = new THREE.PlaneGeometry(2400, 2400);
  far.rotateX(-Math.PI / 2);
  const fuv = far.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 400, fuv.getY(i) * 400);
  const farMesh = new THREE.Mesh(far, M.meadow);
  farMesh.position.y = -0.09;
  farMesh.receiveShadow = true;
  group.add(farMesh);

  // champs cultivés autour du terrain (vignes au sud, blé à l'ouest) : donne de l'échelle au paysage
  function field(mat, x0, x1, z0, z1, tile = 4.8, rot = false) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (rot ? uv.getY(i) : uv.getX(i)) * ((x1 - x0) / tile), (rot ? uv.getX(i) : uv.getY(i)) * ((z1 - z0) / tile));
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, -0.06, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  }
  field(M.vineyard, -150, 26, 27, 150);
  field(M.wheat, -150, -33, -150, 27, 4.8, true);
  field(M.wheat, -33, 150, -150, -27, 4.8);

  // pelouse du terrain (60 x 44 m) percée par le bassin
  const lawnGeo = slabGeometry(PLOT.x0, PLOT.x1, PLOT.z0, PLOT.z1, -0.4, 0, [[POOL.x0, POOL.x1, POOL.z0, POOL.z1]], 3);
  B.geo(lawnGeo, M.lawn);

  /* ---------- rue (à l'est) ---------- */
  B.box(M.asphalt, 32.1, 44.5, -0.4, 0.03, -420, 420);
  B.box(M.concreteDark, 31.9, 32.15, -0.4, 0.14, -420, 420); // bordure
  B.box(M.concreteDark, 44.4, 44.65, -0.4, 0.14, -420, 420);
  B.box(M.pavers, 30.15, 31.9, -0.4, 0.07, -420, 420); // trottoir
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7, name: 'marquage' });
  for (let z = -200; z < 200; z += 8) B.box(white, 38.1, 38.35, 0.03, 0.04, z, z + 3.6);
  // passage bateau devant le portail
  B.box(M.pavers, 30.15, 32.1, -0.4, 0.09, GATE.z0 - 0.6, GATE.z1 + 0.6);

  /* ---------- allée carrossable en entonnoir + parvis ---------- */
  const drive = polyGeometry(
    [[16.3, -9.7], [22, -9.7], [27.2, GATE.z0], [30.2, GATE.z0], [30.2, GATE.z1], [27.2, GATE.z1], [22, 2.0], [16.3, 2.0]],
    -0.1, 0.07, 2.4
  );
  B.geo(drive, M.pavers);
  // bandeaux de rive en pierre sombre
  const edgeMat = M.concreteDark;
  B.boxC(edgeMat, 19.1, 0.075, -9.8, 5.7, 0.16, 0.2, 0);
  B.boxC(edgeMat, 19.1, 0.075, 2.1, 5.7, 0.16, 0.2, 0);

  // cheminement piéton vers l'entrée, le long de la façade du garage
  B.box(M.pavers, 3.8, 19, -0.1, 0.07, 2.2, 3.7);
  B.box(M.pavers, 3.6, 7.8, -0.1, 0.08, 2.0, 4.6); // parvis devant la porte
  // pas japonais entre la terrasse de la piscine et le parvis
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const x = 7.6 + t * 9.6 + Math.sin(i * 1.7) * 0.2;
    const z = 11.2 - t * 6.4;
    B.boxC(M.concrete, x, 0.04, z, 1.0, 0.1, 0.6, -0.5 + Math.sin(i * 2.1) * 0.25);
  }

  /* ---------- clôtures bois à claire-voie (nord, ouest, sud) ---------- */
  const postMat = M.concreteDark;
  function slatFence(x0, z0, x1, z1, rows = 8) {
    const alongX = Math.abs(z1 - z0) < 1e-6;
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const n = Math.ceil(len / 2.7);
    const top = 0.52 + rows * 0.205 + 0.0; // hauteur du chapeau
    // lisses horizontales continues
    for (let k = 0; k < rows; k++) {
      const y = 0.52 + k * 0.205;
      if (alongX) B.box(M.deck, x0, x1, y, y + 0.14, z0 - 0.04, z0 + 0.04);
      else B.box(M.deck, x0 - 0.04, x0 + 0.04, y, y + 0.14, z0, z1);
    }
    // soubassement + chapeau + poteaux
    if (alongX) {
      B.box(M.concrete, x0, x1, -0.3, 0.46, z0 - 0.13, z0 + 0.13);
      B.box(postMat, x0, x1, top, top + 0.04, z0 - 0.11, z0 + 0.11);
    } else {
      B.box(M.concrete, x0 - 0.13, x0 + 0.13, -0.3, 0.46, z0, z1);
      B.box(postMat, x0 - 0.11, x0 + 0.11, top, top + 0.04, z0, z1);
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = alongX ? x0 + (x1 - x0) * t : x0;
      const z = alongX ? z0 : z0 + (z1 - z0) * t;
      B.box(postMat, x - 0.11, x + 0.11, -0.3, top, z - 0.11, z + 0.11);
    }
  }
  slatFence(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z0, 8); // nord
  slatFence(PLOT.x0, PLOT.z1, PLOT.x1, PLOT.z1, 4); // sud : basse, pour dégager la vue sur la façade
  slatFence(PLOT.x0, PLOT.z0, PLOT.x0, PLOT.z1, 8); // ouest

  /* ---------- mur de rue (est) + portail ---------- */
  function streetWall(z0, z1) {
    B.box(M.render, 29.85, 30.15, -0.3, 1.9, z0, z1);
    B.box(M.concreteDark, 29.8, 30.2, 1.9, 2.0, z0, z1);
    const len = Math.abs(z1 - z0);
    const n = Math.max(1, Math.round(len / 5));
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      B.box(M.stone, 29.7, 30.3, -0.3, 2.35, z - 0.28, z + 0.28);
      B.box(M.concreteDark, 29.65, 30.35, 2.35, 2.43, z - 0.34, z + 0.34);
    }
    for (let i = 0; i < n; i++) {
      const za = z0 + ((z1 - z0) * (i + 0.18)) / n, zb = z0 + ((z1 - z0) * (i + 0.82)) / n;
      B.box(M.slats, 30.15, 30.22, 0.35, 1.8, Math.min(za, zb), Math.max(za, zb));
    }
  }
  streetWall(PLOT.z0, GATE.z0 - 0.35);
  streetWall(GATE.z1 + 0.35, PLOT.z1);
  // piliers du portail + luminaires
  for (const z of [GATE.z0 - 0.3, GATE.z1 + 0.3]) {
    B.box(M.stone, 29.6, 30.4, -0.3, 2.6, z - 0.32, z + 0.32);
    B.box(M.concreteDark, 29.52, 30.48, 2.6, 2.7, z - 0.4, z + 0.4);
    B.box(M.bollard, 30.3, 30.5, 2.0, 2.4, z - 0.12, z + 0.12);
  }
  // vantail coulissant ouvert (derrière le mur, côté nord)
  const gz0 = GATE.z0 - 6.2, gz1 = GATE.z0 - 0.45;
  B.box(M.blackMetal, 29.4, 29.55, 0.12, 2.15, gz0, gz1);
  for (let z = gz0 + 0.12; z < gz1 - 0.1; z += 0.2) B.box(M.walnut, 29.55, 29.6, 0.26, 2.0, z, z + 0.13);
  B.box(M.blackMetal, 29.4, 29.62, 0.08, 0.16, gz0, gz1 + 0.2);
  B.box(M.blackMetal, 29.4, 29.62, 2.08, 2.16, gz0, gz1);

  /* ---------- balises d'allée & lumières ---------- */
  const bollards = [];
  const addBollards = (pts) => pts.forEach((p) => bollards.push(p));
  addBollards([[17.5, -9.9], [21, -9.9], [24.6, -8.6], [27.6, -7.1], [29.2, -7.1], [17.5, 2.3], [21, 2.3], [24.6, 1.0], [27.6, -0.9], [29.2, -0.9]]);
  for (let x = 8; x <= 18; x += 2.5) bollards.push([x, 4.1]);
  for (let i = 0; i < 6; i++) bollards.push([8.2 + i * 1.7, 12.5 - i * 1.15 + 0.9]);
  const haloGeo = new THREE.PlaneGeometry(2.6, 2.6);
  haloGeo.rotateX(-Math.PI / 2);
  const hsmall = new THREE.PlaneGeometry(0.7, 0.7);
  for (const [x, z] of bollards) {
    B.cyl(M.blackMetal, x, 0, z, 0.07, 0.08, 0.5, 10);
    B.cyl(M.bollard, x, 0.5, z, 0.07, 0.07, 0.16, 10);
    B.cyl(M.blackMetal, x, 0.66, z, 0.09, 0.09, 0.04, 10);
    G.geo(haloGeo, M.haloWarm, x, 0.095, z);
  }

  // lampadaires de rue
  const lampPts = [[31.3, -14], [31.3, 8], [31.3, 30], [31.3, -40]];
  for (const [x, z] of lampPts) {
    B.cyl(M.blackMetal, x, 0, z, 0.06, 0.09, 6.2, 8);
    B.box(M.blackMetal, x, x + 1.9, 6.1, 6.2, z - 0.04, z + 0.04);
    B.box(M.bollard, x + 1.5, x + 1.95, 6.02, 6.1, z - 0.14, z + 0.14);
    const hg = new THREE.PlaneGeometry(9, 9);
    hg.rotateX(-Math.PI / 2);
    G.geo(hg, M.haloWarm, x + 1.7, 0.06, z);
  }

  B.build(group, { name: 'terrain' });
  const glowMeshes = G.build(group, { cast: false, receive: false, name: 'glow' });
  glowMeshes.forEach((m) => (m.renderOrder = 4));

  /* ---------- collines lointaines ---------- */
  group.add(buildHills());

  /* ---------- plantations ---------- */
  plantGarden(veg, R, M);

  return { group };
}

function buildHills() {
  const seg = 220, rings = 6;
  const pos = [], col = [], idx = [];
  const rr = rng(5);
  const phase = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
  const low = new THREE.Color(0x3f5a3c), high = new THREE.Color(0x6a7d8c), c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU;
    const amp = 34 + 40 * (0.5 + 0.5 * Math.sin(a * 3 + phase[0])) + 22 * Math.sin(a * 7 + phase[1]) * Math.sin(a * 2 + phase[2]) + 10 * Math.sin(a * 17 + phase[3]);
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      const r = 430 + t * 260;
      const h = Math.max(0, amp) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 1.2) * (0.85 + 0.15 * Math.sin(a * 41 + t * 9));
      pos.push(Math.cos(a) * r, h - 2, Math.sin(a) * r);
      c.copy(low).lerp(high, Math.min(1, h / 70));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rings; j++) {
      const a = i * (rings + 1) + j, b = a + rings + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, name: 'collines' }));
  m.name = 'hills';
  return m;
}

function plantGarden(veg, R, M) {
  const { palm, olive, cypress, hedge, bed, tree, shrub } = veg;

  // palmiers (piscine, allée, jardin)
  palm(-20.8, 6.4, 8.6);
  palm(-20.8, 14.8, 7.2, 1.1);
  palm(19.6, 9.2, 9.2, 1.0);
  palm(15.8, 15.6, 7.8, 0.8);
  palm(-10.4, 19.2, 8.4, 1.2);
  palm(25.2, 13.5, 8.8, 1.0);
  palm(26.4, -14.2, 7.6, 0.9);
  palm(-26.5, 2, 9.4, 1.2);
  palm(8.8, -16.5, 8.2, 1.0);

  // oliviers
  olive(22.5, 12.5, 1.15);
  olive(13.5, 11.5, 0.95);
  olive(-24, -5, 1.1);
  olive(-22.5, -16, 1.0);
  olive(22, -16.5, 1.1);
  olive(2, -16.5, 0.95);
  olive(-9, -17, 1.0);
  olive(14, -15.5, 0.9);
  olive(25.5, 7.0, 0.85);

  // cyprès élancés
  for (let z = -19.5; z <= 19.5; z += 4.6) cypress(-27.6, z + (R() - 0.5), 5.2 + R() * 2.3);
  for (let x = -22; x <= 26; x += 6.2) cypress(x, -19.6, 5 + R() * 2.5);
  cypress(-26.5, 20, 5.6);
  cypress(-21, 20.2, 4.8);
  cypress(28.2, 18.5, 6.4);
  cypress(28.2, -19, 6.8);

  // haies taillées
  hedge(-28.4, -20.2, 28.4, -20.2, 1.4, 0.5);
  hedge(-28.4, 20.8, 4, 20.8, 0.9, 0.45);
  hedge(-28.5, -20.2, -28.5, 20.8, 1.4, 0.5);
  hedge(10, 20.8, 28.4, 20.8, 0.9, 0.45);
  hedge(28.6, 2.6, 28.6, 20.8, 1.2, 0.5);
  hedge(28.6, -20.2, 28.6, -8.6, 1.2, 0.5);
  hedge(17.3, 4.6, 29, 4.6, 0.55, 0.35);
  hedge(17.3, -11.2, 29, -11.2, 0.55, 0.35);

  // massifs
  bed(-17.2, -9, 17.2, 19.4, { agave: 5, shrubs: 3 });
  bed(-8.5, 4, 17.4, 19.2, { agave: 3, shrubs: 2 });
  bed(8.8, 16.6, 5.2, 8.6, { flowers: true, shrubs: 2 });
  bed(-17.6, -14, 4.2, 5.6, { shrubs: 2, agave: 2 });
  bed(17.5, 29.2, -11.2, -10.4, { flowers: true });
  bed(17.5, 29, 4.6, 5.4, { flowers: true });
  bed(-21, -18.4, -2, 3.6, { flowers: true, shrubs: 2 });
  bed(-16.6, -13, -12.5, -11, { shrubs: 4, flowers: true });
  bed(8, 16, -13, -11.3, { shrubs: 3, flowers: true });

  // buissons isolés
  for (let i = 0; i < 26; i++) {
    const x = -27 + R() * 54, z = -19 + R() * 38;
    const inside = (x > -19 && x < 18 && z > -12.5 && z < 19.5) || (x > 15 && z > -10.5 && z < 5.2);
    if (inside) continue;
    shrub(x, z, 0.5 + R() * 0.7);
  }

  // décor lointain : lisières d'arbres derrière les clôtures + voisinage côté rue
  const pal = [0x3c6a3a, 0x4a7a3c, 0x355f33, 0x5a8442];
  for (let i = 0; i < 26; i++) tree(-34 + i * 2.9 + R() * 2, -27 - R() * 8, 7 + R() * 5, pal);
  for (let i = 0; i < 20; i++) tree(-34 - R() * 8, -22 + i * 2.8 + R() * 2, 7 + R() * 5, pal);
  for (let i = 0; i < 24; i++) tree(48 + R() * 14, -70 + i * 6 + R() * 3, 8 + R() * 5, pal);

  veg.finalize();
}
