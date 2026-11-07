import * as THREE from 'three';
import { L } from './config.js';
import { Batcher } from './utils.js';

const v2 = (x, z) => new THREE.Vector2(x, -z); // plan XZ -> coordonnées de Shape
function rectPath(x0, z0, x1, z1, Ctor = THREE.Path) {
  return new Ctor([v2(x0, z0), v2(x1, z0), v2(x1, z1), v2(x0, z1)]);
}
function flatShape(shape, y) {
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// Terrain, accès, murets, rue et éclairage extérieur.
export function buildSite(scene, M) {
  const group = new THREE.Group();
  group.name = 'site';
  scene.add(group);
  const b = new Batcher();
  const P = L.PLOT, PO = L.POOL;

  /* --- Sol lointain + pelouse percée au droit du bassin --- */
  const outer = rectPath(-600, -600, 600, 600, THREE.Shape);
  outer.holes.push(rectPath(P.x0, P.z0, P.x1, P.z1));
  const ground = new THREE.Mesh(flatShape(outer, -0.005), M.grass);
  ground.receiveShadow = true;
  group.add(ground);
  const lawnShape = rectPath(P.x0, P.z0, P.x1, P.z1, THREE.Shape);
  lawnShape.holes.push(rectPath(PO.x0, PO.z0, PO.x1, PO.z1));
  const lawn = new THREE.Mesh(flatShape(lawnShape, 0), M.grass);
  lawn.receiveShadow = true;
  group.add(lawn);

  /* --- Rue : trottoirs, bordures, chaussée, marquage --- */
  const D = L.DRIVE;
  b.boxB(M.sidewalk, -160, D.x0 - 0.6, 0, 0.12, 22.15, 24.5);
  b.boxB(M.sidewalk, D.x1 + 0.6, 160, 0, 0.12, 22.15, 24.5);
  b.boxB(M.pavers, D.x0 - 0.6, D.x1 + 0.6, 0, 0.06, 22.15, 24.5); // bateau d'accès
  b.boxB(M.granite, -160, D.x0 - 0.6, 0, 0.14, 24.45, 24.65);
  b.boxB(M.granite, D.x1 + 0.6, 160, 0, 0.14, 24.45, 24.65);
  b.boxB(M.granite, D.x0 - 0.6, D.x1 + 0.6, 0, 0.07, 24.45, 24.65);
  b.boxB(M.asphalt, -160, 160, 0, 0.03, 24.65, 33.4);
  b.boxB(M.granite, -160, 160, 0, 0.14, 33.4, 33.6);
  b.boxB(M.sidewalk, -160, 160, 0, 0.12, 33.6, 36.2);
  for (let x = -150; x < 150; x += 6) b.boxB(M.paint, x, x + 3, 0.03, 0.036, 28.95, 29.1, { cast: false });

  /* --- Allée carrossable en pavés + parvis du garage --- */
  b.boxB(M.pavers, D.x0, D.x1, 0, 0.06, 8, 22.15);
  b.boxB(M.pavers, 6.0, 14.6, 0, 0.06, 4.15, 8);
  for (const x of [D.x0 - 0.12, D.x1]) b.boxB(M.granite, x, x + 0.12, 0, 0.08, 8, 22.15);
  b.boxB(M.granite, 14.6, 14.72, 0, 0.08, 4.15, 8);

  /* --- Allée piétonne en pas japonais + perron d'entrée --- */
  const px = L.PATH_X;
  for (let z = 21.3; z > 6.9; z -= 1.0) b.boxB(M.travPave, px - 0.75, px + 0.75, 0, 0.05, z - 0.62, z);
  b.boxB(M.travPave, px - 1.8, px + 1.8, 0, L.FL0, 4.15, 5.7);
  b.boxB(M.travPave, px - 1.8, px + 1.8, 0, 0.3, 5.7, 6.1);
  b.boxB(M.travPave, px - 1.8, px + 1.8, 0, 0.15, 6.1, 6.5);
  // Massifs en gravier devant la façade (bordures acier)
  for (const [x0, x1] of [[-13.8, -8.0], [-3.7, 5.7]]) {
    b.boxB(M.gravel, x0, x1, 0, 0.04, 4.15, 6.3);
    b.boxB(M.planter, x0, x1, 0, 0.12, 6.3, 6.36);
  }

  /* --- Murets périphériques enduits + couvertine travertin --- */
  const H = 1.15;
  const wallX = (x0, x1, z) => {
    b.boxB(M.stucco, x0, x1, 0, H, z - 0.15, z + 0.15);
    b.boxB(M.coping, x0 - 0.03, x1 + 0.03, H, H + 0.06, z - 0.18, z + 0.18);
  };
  const wallZ = (z0, z1, x) => {
    b.boxB(M.stucco, x - 0.15, x + 0.15, 0, H, z0, z1);
    b.boxB(M.coping, x - 0.18, x + 0.18, H, H + 0.06, z0 - 0.03, z1 + 0.03);
  };
  const zf = 22;
  wallX(P.x0, -7.4, zf);
  wallX(-4.4, 6.5, zf);
  wallX(13.5, P.x1, zf);
  wallX(P.x0, P.x1, P.z0);
  wallZ(P.z0, zf, P.x0);
  wallZ(P.z0, zf, P.x1);

  // Piliers de portail avec applique
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  for (const x of [-7.15, -4.65, 6.75, 13.25]) {
    b.boxB(M.stucco, x - 0.25, x + 0.25, 0, 1.75, zf - 0.25, zf + 0.25);
    b.boxB(M.coping, x - 0.29, x + 0.29, 1.75, 1.82, zf - 0.29, zf + 0.29);
    b.boxB(M.blackMetal, x - 0.08, x + 0.08, 1.35, 1.55, zf + 0.25, zf + 0.3);
    b.boxB(M.bollardLamp, x - 0.06, x + 0.06, 1.36, 1.38, zf + 0.25, zf + 0.31, { cast: false });
    b.mesh(glowGeo, M.glowWarm, [x, 1.15, zf + 0.262], [0, 0, 0], [1.1, 1.6, 1], { cast: false, receive: false });
  }
  // Portillon à lames verticales (fermé)
  b.boxB(M.frame, -6.88, -4.92, 0.08, 0.12, zf - 0.03, zf + 0.03);
  b.boxB(M.frame, -6.88, -4.92, 1.5, 1.54, zf - 0.03, zf + 0.03);
  for (let x = -6.85; x < -4.95; x += 0.085) b.boxB(M.frame, x, x + 0.045, 0.12, 1.5, zf - 0.02, zf + 0.02);
  // Portail coulissant ouvert, rangé derrière le muret
  const gz = zf - 0.42;
  b.boxB(M.frame, 13.6, 19.8, 0.1, 0.16, gz - 0.03, gz + 0.03);
  b.boxB(M.frame, 13.6, 19.8, 1.5, 1.56, gz - 0.03, gz + 0.03);
  for (let x = 13.65; x < 19.75; x += 0.1) b.boxB(M.frame, x, x + 0.05, 0.16, 1.5, gz - 0.02, gz + 0.02);
  b.boxB(M.steel, 13.5, 20, 0, 0.03, gz - 0.03, gz + 0.03);

  /* --- Bornes lumineuses (allée + chemin) avec flaques de lumière au sol --- */
  const bollards = [];
  for (const z of [7, 11, 15, 19]) bollards.push([D.x0 - 0.45, z], [D.x1 + 0.45, z]);
  for (const z of [8.5, 12.5, 16.5, 20.5]) bollards.push([px - 1.25, z]);
  const glowFloor = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const [x, z] of bollards) {
    b.box(M.frame, 0.14, 0.62, 0.14, x, 0.31, z);
    b.box(M.bollardLamp, 0.12, 0.08, 0.12, x, 0.66, z, 0, { cast: false });
    b.box(M.frame, 0.16, 0.05, 0.16, x, 0.725, z);
    b.mesh(glowFloor, M.glowWarm, [x, 0.075, z], [0, 0, 0], [2.6, 1, 2.6], { cast: false, receive: false });
  }

  /* --- Lampadaires de rue (côté opposé) --- */
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.6, 10);
  for (const x of [-24, 0, 24]) {
    b.mesh(poleGeo, M.blackMetal, [x, 2.8, 34.6]);
    b.box(M.blackMetal, 0.12, 0.1, 1.6, x, 5.5, 33.9);
    b.box(M.blackMetal, 0.5, 0.12, 0.8, x, 5.45, 33.2);
    b.box(M.streetLamp, 0.42, 0.03, 0.7, x, 5.38, 33.2, 0, { cast: false });
    b.mesh(glowFloor, M.glowSoft, [x, 0.04, 31], [0, 0, 0], [11, 1, 9], { cast: false, receive: false });
  }

  b.build(group, 'site');

  /* --- Lumières réelles (allumées la nuit) --- */
  const lights = [
    [new THREE.PointLight(0xffc98a, 0, 14, 2), [10, 1.0, 11], 9],
    [new THREE.PointLight(0xffc98a, 0, 14, 2), [10, 1.0, 18.5], 9],
    [new THREE.PointLight(0xffc98a, 0, 13, 2), [px, 1.2, 13.5], 7],
  ];
  for (const [l, p] of lights) {
    l.position.set(...p);
    group.add(l);
  }

  return {
    update(state) {
      for (const [l, , i] of lights) l.intensity = i * state.lights;
    },
  };
}
