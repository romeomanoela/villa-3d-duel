import * as THREE from 'three';
import { L } from './config.js';
import { Batcher, boxGeo, easeInOut } from './utils.js';
import { facade } from './villa.js';

// Garage double : volume enduit, façade en bardage bois, porte sectionnelle motorisée
// dont les 6 panneaux suivent un rail (vertical, quart de cercle, horizontal sous plafond).
const PANELS = 6;
const R = 0.45; // rayon du rail
const DURATION = 3.6;

export function buildGarage(scene, M) {
  const group = new THREE.Group();
  group.name = 'garage';
  scene.add(group);
  const b = new Batcher();
  const G = L.GAR, top = L.FL1 - L.SLAB;
  const y0 = G.floor, Hv = G.doorH, zd = G.z1 - 0.24; // plan de la porte, juste derrière le mur
  const dx0 = G.doorX0, dx1 = G.doorX1;

  /* --- Gros œuvre --- */
  b.boxB(M.concreteFloor, G.x0 + 0.15, G.x1 + 0.15, 0, y0, G.z0 - 0.15, G.z1 + 0.15);
  facade(b, M, { axis: 'z', at: G.x1, from: G.z0, y0: 0, h: top, segs: [{ type: 'w', len: 3.0, mat: M.stucco }, { type: 'g', len: 0.6, sill: 1.0, head: 0.6 }, { type: 'w', len: 6.4, mat: M.stucco }], inner: -1 });
  facade(b, M, { axis: 'x', at: G.z0, from: G.x0, y0: 0, h: top, segs: [{ type: 'w', len: 8, mat: M.stucco }], inner: 1 });
  // Doublage intérieur : mur mitoyen avec la maison et face intérieure de la façade bois
  b.boxB(M.stuccoInt, G.x0 + 0.15, G.x0 + 0.162, 0, top, G.z0 + 0.15, G.z1 - 0.15, { cast: false });
  const zf0 = G.z1 - 0.15, zf1 = G.z1 + 0.15;
  b.boxB(M.cladding, G.x0 + 0.15, dx0, 0, top, zf0, zf1);
  b.boxB(M.cladding, dx1, G.x1 + 0.15, 0, top, zf0, zf1);
  b.boxB(M.cladding, dx0, dx1, y0 + Hv, top, zf0, zf1);
  for (const [x0, x1, ya] of [[G.x0 + 0.15, dx0, 0], [dx1, G.x1 - 0.15, 0], [dx0, dx1, y0 + Hv]]) b.boxB(M.stuccoInt, x0, x1, ya, top, zf0 - 0.012, zf0, { cast: false });
  b.boxB(M.frame, dx0 - 0.06, dx0, 0, y0 + Hv + 0.06, zf0 - 0.01, zf1 + 0.02);
  b.boxB(M.frame, dx1, dx1 + 0.06, 0, y0 + Hv + 0.06, zf0 - 0.01, zf1 + 0.02);
  b.boxB(M.frame, dx0 - 0.06, dx1 + 0.06, y0 + Hv, y0 + Hv + 0.06, zf0 - 0.01, zf1 + 0.02);

  /* --- Rails de la porte + moteur au plafond --- */
  const yTop = y0 + Hv + R;
  for (const x of [dx0 + 0.04, dx1 - 0.04]) {
    b.boxB(M.steel, x - 0.03, x + 0.03, y0, y0 + Hv, zd - 0.06, zd - 0.03);
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * Math.PI / 2, a1 = ((k + 1) / 5) * Math.PI / 2;
      const ya = y0 + Hv + R * Math.sin(a0), za = zd - R + R * Math.cos(a0);
      const yb = y0 + Hv + R * Math.sin(a1), zb = zd - R + R * Math.cos(a1);
      b.mesh(boxGeo(0.06, Math.hypot(yb - ya, zb - za) + 0.01, 0.03), M.steel, [x, (ya + yb) / 2, (za + zb) / 2 - 0.045], [Math.atan2(zb - za, yb - ya), 0, 0]);
    }
    b.boxB(M.steel, x - 0.03, x + 0.03, yTop + 0.03, yTop + 0.06, -3.4, zd - R);
    b.boxB(M.steel, x - 0.015, x + 0.015, yTop + 0.06, top, -3.3, -3.2);
  }
  b.boxB(M.blackMatte, 9.7, 10.3, top - 0.25, top, -3.9, -3.1);
  b.boxB(M.steel, 9.97, 10.03, top - 0.12, top - 0.08, -3.1, zd - 0.2);

  /* --- Aménagement : bornes de recharge, établi, rangements, marquage --- */
  for (const x of [8.5, 11.5]) {
    b.boxB(M.ceramic, x - 0.2, x + 0.2, 1.1, 1.6, G.z0 + 0.15, G.z0 + 0.27);
    b.boxB(M.ledStrip, x - 0.12, x + 0.12, 1.5, 1.52, G.z0 + 0.27, G.z0 + 0.275, { cast: false });
    b.mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 20), M.blackMatte, [x, 1.0, G.z0 + 0.32]);
    b.boxB(M.paint, x - 1.25, x - 1.17, y0, y0 + 0.004, -4.8, 2.8, { cast: false });
    b.boxB(M.paint, x + 1.17, x + 1.25, y0, y0 + 0.004, -4.8, 2.8, { cast: false });
  }
  b.boxB(M.walnut, G.x1 - 0.75, G.x1 - 0.15, y0, y0 + 2.2, -5.7, -3.6);
  b.boxB(M.walnut, G.x1 - 0.75, G.x1 - 0.15, y0 + 0.85, y0 + 0.9, -3.5, -1.7);
  b.boxB(M.blackMatte, G.x1 - 0.17, G.x1 - 0.15, y0 + 1.2, y0 + 2.2, -3.5, -1.7);

  /* --- Éclairage : réglettes LED, appliques extérieures --- */
  const led = M.ledStrip.clone(); // piloté par le garage (allumé si porte ouverte ou nuit)
  for (const x of [8.5, 11.5]) b.boxB(led, x - 0.06, x + 0.06, top - 0.03, top, -4.8, 2.8, { cast: false });
  const glow = new THREE.PlaneGeometry(1, 1);
  for (const x of [G.x0 + 0.55, G.x1 - 0.45]) {
    b.boxB(M.blackMetal, x - 0.07, x + 0.07, 1.8, 2.22, zf1, zf1 + 0.12);
    b.boxB(M.lampWarm, x - 0.05, x + 0.05, 1.79, 1.8, zf1 + 0.02, zf1 + 0.1, { cast: false });
    b.boxB(M.lampWarm, x - 0.05, x + 0.05, 2.22, 2.23, zf1 + 0.02, zf1 + 0.1, { cast: false });
    b.mesh(glow, M.glowWarm, [x, 2.0, zf1 + 0.012], [0, 0, 0], [0.9, 3.4, 1], { cast: false, receive: false });
  }
  const blink = new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff8a1a, emissiveIntensity: 0 });
  b.boxB(M.blackMetal, dx1 + 0.15, dx1 + 0.35, y0 + Hv + 0.15, y0 + Hv + 0.3, zf1, zf1 + 0.08);
  b.boxB(blink, dx1 + 0.17, dx1 + 0.33, y0 + Hv + 0.17, y0 + Hv + 0.28, zf1 + 0.08, zf1 + 0.1, { cast: false });

  b.build(group, 'garage');

  /* --- Porte sectionnelle --- */
  const ph = Hv / PANELS;
  const doorW = dx1 - dx0 - 0.04;
  const panelGeo = boxGeo(doorW, ph - 0.006, 0.05);
  const handleGeo = boxGeo(0.4, 0.04, 0.04);
  const panels = [];
  for (let i = 0; i < PANELS; i++) {
    const m = new THREE.Mesh(panelGeo, M.doorPanel);
    m.castShadow = m.receiveShadow = true;
    if (i === 0) {
      const h = new THREE.Mesh(handleGeo, M.steel);
      h.position.set(0, 0.05, 0.045);
      m.add(h);
    }
    group.add(m);
    panels.push(m);
  }
  const arcLen = (Math.PI / 2) * R;
  const track = (s, out) => {
    if (s <= Hv) return out.set(y0 + s, zd);
    if (s <= Hv + arcLen) {
      const a = (s - Hv) / R;
      return out.set(y0 + Hv + R * Math.sin(a), zd - R + R * Math.cos(a));
    }
    return out.set(yTop, zd - R - (s - Hv - arcLen));
  };
  const pa = new THREE.Vector2(), pb = new THREE.Vector2();
  const layout = (o) => {
    const shift = o * (Hv + 0.12);
    panels.forEach((m, i) => {
      track(i * ph + shift, pa);
      track((i + 1) * ph + shift, pb);
      m.position.set((dx0 + dx1) / 2, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
      m.rotation.x = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    });
  };
  layout(0);

  const light = new THREE.PointLight(0xfff1dd, 0, 12, 2);
  light.position.set(10, 3.0, -0.8);
  group.add(light);

  let target = 0, o = 0;
  return {
    get isOpen() { return target === 1; },
    toggle() { target = target ? 0 : 1; return target === 1; },
    update(state, dt) {
      const moving = o !== target;
      if (moving) {
        o = target > o ? Math.min(1, o + dt / DURATION) : Math.max(0, o - dt / DURATION);
        layout(easeInOut(o));
        state.shadowDirty = true;
      }
      const e = easeInOut(o);
      state.door = e;
      const on = Math.max(state.lights, Math.min(1, e * 1.5));
      led.emissiveIntensity = 4.5 * on;
      light.intensity = 16 * on;
      blink.emissiveIntensity = moving ? (Math.sin(state.time * 9) > 0 ? 5 : 0.2) : 0;
    },
  };
}
