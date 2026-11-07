// Pièces supplémentaires pour la visite intérieure : salle de bain complète (baignoire îlot, double vasque,
// douche vitrée, WC, miroir rétro-éclairé) et détails de cuisine (évier, robinetterie).
import * as THREE from 'three';
import { Batcher } from './utils.js';
import { F0, F1 } from './config.js';

/** Emprise de la salle de bain (niveau 1) : utilisée aussi par la carte de collisions. */
export const BATH = { x0: -13.75, x1: -10.675, z0: -10.75, z1: -7.275 };

export function buildRooms(ctx) {
  const { scene, M } = ctx;
  const group = new THREE.Group();
  group.name = 'pieces-visite';
  scene.add(group);

  const I = new Batcher();
  const IG = new Batcher();

  const mirror = new THREE.MeshStandardMaterial({ name: 'miroir', color: 0xe8eef2, metalness: 1, roughness: 0.04, envMapIntensity: 1.5 });
  const water = new THREE.MeshStandardMaterial({ name: 'eau-bain', color: 0xa9d8e4, metalness: 0, roughness: 0.05, envMapIntensity: 1.4 });
  const tileWall = M.marble;

  /* ------------------------------ salle de bain ------------------------------ */
  const y = F1 + 0.03; // dessus du parquet
  const yf = y + 0.02; // dessus du carrelage
  const { x0, x1, z0, z1 } = BATH;

  // sol en dalles de marbre + faïence murale (ouest, est, sud sauf la porte)
  I.box(M.marble, x0, x1, y, yf, z0, z1);
  I.box(tileWall, x0, x0 + 0.02, yf, yf + 2.4, z0, z1);
  I.box(tileWall, x1 - 0.02, x1, yf, yf + 2.4, z0, z1);
  I.box(tileWall, x0, -12.3, yf, yf + 2.4, z1 - 0.02, z1);
  I.box(tileWall, -11.0, x1, yf, yf + 2.4, z1 - 0.02, z1);

  // baignoire îlot (cuve elliptique) + remplissage
  const tubGeo = new THREE.CylinderGeometry(0.4, 0.35, 0.58, 40);
  I.geo(tubGeo, M.ceramic, -12.75, yf + 0.29, -10.28, 0, 0, 0, 2.1, 1, 1.05);
  I.geo(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 40), water, -12.75, yf + 0.5, -10.28, 0, 0, 0, 2.0, 1, 0.98);
  I.cyl(M.steel, -11.86, yf, -10.28, 0.014, 0.014, 0.82, 8);
  I.box(M.steel, -12.02, -11.85, yf + 0.8, yf + 0.82, -10.29, -10.27);

  // double vasque suspendue + miroir rétro-éclairé
  I.box(M.walnut, x0, x0 + 0.5, yf + 0.38, yf + 0.82, -9.25, -7.85);
  I.box(M.marble, x0, x0 + 0.56, yf + 0.82, yf + 0.86, -9.28, -7.82);
  for (const zz of [-8.85, -8.25]) {
    I.geo(new THREE.CylinderGeometry(0.17, 0.14, 0.11, 28), M.ceramic, x0 + 0.34, yf + 0.915, zz);
    I.cyl(M.steel, x0 + 0.1, yf + 0.86, zz, 0.012, 0.012, 0.26, 8);
    I.box(M.steel, x0 + 0.1, x0 + 0.2, yf + 1.1, yf + 1.12, zz - 0.01, zz + 0.01);
  }
  I.box(mirror, x0 + 0.005, x0 + 0.02, yf + 1.1, yf + 2.2, -9.25, -7.85);
  I.box(M.ledStrip, x0 + 0.02, x0 + 0.04, yf + 1.08, yf + 2.22, -9.3, -9.26);
  I.box(M.ledStrip, x0 + 0.02, x0 + 0.04, yf + 1.08, yf + 2.22, -7.84, -7.8);

  // WC suspendu
  I.geo(new THREE.CylinderGeometry(0.19, 0.17, 0.42, 28), M.ceramic, x1 - 0.42, yf + 0.31, -8.65, 0, 0, 0, 1.45, 1, 1);
  I.box(M.ceramic, x1 - 0.22, x1 - 0.03, yf + 0.3, yf + 0.95, -8.88, -8.42);
  I.box(M.steel, x1 - 0.045, x1 - 0.03, yf + 0.85, yf + 0.87, -8.7, -8.6);
  I.geo(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 28), M.linen, x1 - 0.43, yf + 0.535, -8.65, 0, 0, 0, 1.4, 1, 1);

  // douche à l'italienne (angle nord-est) : receveur, parois de verre, pomme de douche
  I.box(M.concreteDark, -11.75, x1, yf, yf + 0.02, z0, -9.65);
  IG.plane(M.glass, 'z', -9.65, -11.75, x1, yf, yf + 2.15);
  IG.plane(M.glass, 'x', -11.75, z0, -9.65, yf, yf + 2.15);
  I.box(M.steel, -11.77, -11.73, yf, yf + 2.15, -9.67, -9.63);
  I.box(M.steel, -11.78, -11.72, yf + 1.0, yf + 1.04, -10.3, -10.1);
  I.cyl(M.steel, x1 - 0.1, yf + 1.1, -10.2, 0.012, 0.012, 1.1, 8);
  I.geo(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 24), M.steel, x1 - 0.1, yf + 2.2, -10.2);
  I.box(M.steel, x1 - 0.12, x1 - 0.02, yf + 1.15, yf + 1.2, -10.24, -10.16);

  // détails : tapis de bain, serviettes, plante
  I.box(M.linen, -12.55, -11.75, yf, yf + 0.02, -8.9, -8.3);
  I.box(M.cushionTeal, -13.7, -13.35, yf + 0.88, yf + 0.95, -8.0, -7.9);
  I.box(M.linen, -13.7, -13.35, yf + 0.86, yf + 0.88, -8.95, -8.7);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8a46, roughness: 0.8, side: THREE.DoubleSide, name: 'plante-sdb' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.09, 0.9, 5);
    g.scale(1, 1, 0.4);
    g.rotateX(0.35);
    g.rotateY(a);
    g.translate(-13.45, yf + 0.65, -10.45);
    I._push(leafMat, g);
  }
  I.cyl(M.terracotta, -13.45, yf, -10.45, 0.17, 0.13, 0.4, 14);

  /* ------------------------------ cuisine : évier ------------------------------ */
  const cy = F0 + 0.92;
  I.box(M.steel, -6.0, -5.25, cy, cy + 0.006, -9.55, -9.2);
  I.box(M.blackMetal, -5.9, -5.35, cy + 0.006, cy + 0.008, -9.5, -9.25);
  I.cyl(M.steel, -5.62, cy, -9.66, 0.013, 0.013, 0.3, 8);
  I.box(M.steel, -5.63, -5.61, cy + 0.28, cy + 0.3, -9.66, -9.5);

  I.build(group, { name: 'pieces' });
  const g = IG.build(group, { cast: false, receive: false, name: 'verre-sdb' });
  g.forEach((m) => (m.renderOrder = 6));
  return { group };
}
