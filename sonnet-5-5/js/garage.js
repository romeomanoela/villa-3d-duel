// Garage : porte sectionnelle animée (rails courbes), voitures de luxe, éclairage.
import * as THREE from 'three';
import { Batcher, easeInOutCubic } from './utils.js';
import { F0, GARAGE } from './config.js';
import { createCar, COUPE, SEDAN } from './cars.js';

export function buildGarage(ctx) {
  const { scene, M, T, ambience } = ctx;
  const group = new THREE.Group();
  group.name = 'garage';
  scene.add(group);

  /* ---------------- voitures ---------------- */
  const coupe = createCar(COUPE, M, T, ambience);
  coupe.car.position.set(GARAGE.carX + 0.3, F0, GARAGE.carZ[0]);
  coupe.car.rotation.y = 0.015;
  const sedan = createCar(SEDAN, M, T, ambience);
  sedan.car.position.set(GARAGE.carX + 0.1, F0, GARAGE.carZ[1]);
  sedan.car.rotation.y = -0.012;
  group.add(coupe.car, sedan.car);

  /* ---------------- porte sectionnelle ---------------- */
  const H = GARAGE.doorH;
  const N = 5;
  const ph = H / N;
  const width = GARAGE.doorZ1 - GARAGE.doorZ0 - 0.04;
  const zc = (GARAGE.doorZ0 + GARAGE.doorZ1) / 2;
  const x0 = GARAGE.doorX;
  const r = 0.45; // rayon de courbure du rail
  const arc = (Math.PI / 2) * r;
  const travel = H + 0.06;

  const panelMat = M.garageDoor || (M.garageDoor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, map: T.garageWood, bumpMap: T.garageWood, bumpScale: 1.2, name: 'porte-garage' }));
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.6, name: 'porte-garage-int' });
  const doorGroup = new THREE.Group();
  doorGroup.name = 'porte-de-garage';
  group.add(doorGroup);
  const panels = [];
  for (let i = 0; i < N; i++) {
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, ph - 0.012, width), [panelMat, innerMat, panelMat, panelMat, panelMat, panelMat]);
    body.castShadow = true;
    body.receiveShadow = true;
    p.add(body);
    // rainures
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, width), M.blackMetal);
    groove.position.y = -ph / 2 + 0.006;
    p.add(groove);
    if (i === N - 1) {
      // bandeau vitré fumé sur le panneau haut
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.075, ph * 0.5, width - 0.5), M.glassDark);
      gl.renderOrder = 6;
      p.add(gl);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.08, ph * 0.56, width - 0.42), M.blackMetal);
      fr.position.x = -0.002;
      p.add(fr);
      gl.position.x = 0.002;
    }
    p.position.z = zc;
    doorGroup.add(p);
    panels.push(p);
  }

  // rails (statiques) : verticaux + horizontaux au plafond
  const B = new Batcher();
  for (const z of [GARAGE.doorZ0 - 0.02, GARAGE.doorZ1 + 0.02]) {
    B.box(M.blackMetal, x0 - 0.05, x0 + 0.02, F0, F0 + H, z - 0.02, z + 0.02);
    B.box(M.blackMetal, x0 - r - 2.9, x0 - r, F0 + H + r - 0.04, F0 + H + r + 0.03, z - 0.02, z + 0.02);
    for (let k = 0; k < 4; k++) {
      const th = ((k + 0.5) / 4) * (Math.PI / 2);
      B.boxC(M.blackMetal, x0 - r + r * Math.cos(th), F0 + H + r * Math.sin(th), z, 0.06, r * 0.45, 0.04, 0, 0, th);
    }
  }
  B.box(M.blackMetal, x0 - r - 1.5, x0 - r - 0.7, F0 + H + r + 0.04, F0 + H + r + 0.24, zc - 0.25, zc + 0.25); // motorisation
  B.build(group, { name: 'rails' });

  function place(prog) {
    const e = easeInOutCubic(prog);
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * ph + e * travel;
      const p = panels[i];
      if (s <= H) {
        p.position.set(x0, F0 + s, zc);
        p.rotation.z = 0;
      } else if (s <= H + arc) {
        const th = (s - H) / r;
        p.position.set(x0 - r + r * Math.cos(th), F0 + H + r * Math.sin(th), zc);
        p.rotation.z = th;
      } else {
        p.position.set(x0 - r - (s - H - arc), F0 + H + r, zc);
        p.rotation.z = Math.PI / 2;
      }
    }
  }
  place(0);

  const state = { progress: 0, target: 0, onChange: null, last: 'closed' };
  const DURATION = 3.4;

  function status() {
    if (state.progress <= 0 && state.target === 0) return 'closed';
    if (state.progress >= 1 && state.target === 1) return 'open';
    return state.target === 1 ? 'opening' : 'closing';
  }
  function notify() {
    const st = status();
    if (st !== state.last) {
      state.last = st;
      state.onChange && state.onChange(st);
    }
  }

  return {
    group,
    cars: [coupe, sedan],
    get isOpen() {
      return state.target === 1;
    },
    get moving() {
      return state.progress !== state.target;
    },
    set onChange(fn) {
      state.onChange = fn;
    },
    open() {
      state.target = 1;
      notify();
    },
    close() {
      state.target = 0;
      notify();
    },
    toggle() {
      state.target = state.target === 1 ? 0 : 1;
      notify();
      return state.target === 1;
    },
    setProgress(p) {
      state.progress = state.target = p;
      place(p);
      notify();
    },
    update(dt) {
      if (state.progress === state.target) return;
      const dir = Math.sign(state.target - state.progress);
      state.progress = THREE.MathUtils.clamp(state.progress + (dir * dt) / DURATION, 0, 1);
      if ((dir > 0 && state.progress >= state.target) || (dir < 0 && state.progress <= state.target)) state.progress = state.target;
      place(state.progress);
      notify();
    },
  };
}
