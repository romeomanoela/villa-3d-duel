import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CameraRig } from './camera.js';
import { initUI } from './ui.js';
import { createTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { Atmosphere } from './atmosphere.js';
import { buildSite } from './site.js';
import { buildVegetation } from './vegetation.js';
import { buildVilla } from './villa.js';
import { buildInterior } from './interior.js';
import { buildPool } from './pool.js';
import { buildGarage } from './garage.js';
import { buildCars } from './cars.js';
import { Tour } from './tour.js';
import { VIEWS } from './camera.js';

/* ---------- Rendu ---------- */
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
const MAX_DPR = Math.min(window.devicePixelRatio || 1, 1.75);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.2, 1500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.475; // jamais sous l'horizon du point visé
controls.minDistance = 4;
controls.maxDistance = 130;
controls.autoRotateSpeed = 0.55;
controls.zoomSpeed = 0.9;

const rig = new CameraRig(camera, controls);

/* ---------- Post-traitement (MSAA + bloom léger) ---------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let tour = null; // visite intérieure (créée plus bas)

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  if (!tour || tour.mode === 'off') camera.fov = w / h < 0.8 ? 55 : 42; // champ plus large en portrait
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  updateViewOffset();
}

// Sur mobile, le panneau occupe le bas de l'écran : on remonte le cadrage d'autant.
function updateViewOffset() {
  const w = window.innerWidth, h = window.innerHeight;
  const panel = document.getElementById('panel');
  if (w <= 640 && (!tour || tour.mode === 'off') && panel) {
    camera.setViewOffset(w, h, 0, panel.getBoundingClientRect().height * 0.42, w, h);
  } else camera.clearViewOffset();
}
document.getElementById('btn-collapse').addEventListener('click', () => requestAnimationFrame(updateViewOffset));
window.addEventListener('resize', resize);
resize();

/* ---------- Monde ---------- */
const state = { time: 0, dt: 0, night: 0, lights: 0, door: 0 };
const updaters = [];

let atmo = null;
let garage = null;
function buildWorld() {
  const T = createTextures();
  const M = createMaterials(T);
  atmo = new Atmosphere(scene, renderer, M);
  updaters.push((st, dt) => atmo.update(dt, st, camera, bloom));
  garage = buildGarage(scene, M, T);
  const parts = [
    buildSite(scene, M, T), buildVegetation(scene, M, T), buildVilla(scene, M, T), buildInterior(scene, M, T),
    buildPool(scene, M, T), garage, buildCars(scene, M, T),
  ];
  for (const p of parts) if (p && p.update) updaters.push((st, dt) => p.update(st, dt));
}

/* ---------- Interface ---------- */
let wantNight = false;
let garageOpen = false;
let rotating = false;
const ui = initUI({
  setNight: (n) => { wantNight = n; atmo.setNight(n); ui.showNight(n); },
  toggleNight: () => { wantNight = !wantNight; atmo.setNight(wantNight); ui.showNight(wantNight); },
  toggleGarage: () => { garageOpen = garage.toggle(); ui.showGarage(garageOpen); },
  toggleRotate: () => { rotating = !rotating; rig.setAutoRotate(rotating); ui.showRotate(rotating); },
  goTo: (name) => {
    if (tour.mode !== 'off') {
      const v = VIEWS[name];
      tour.exit({ pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) });
    } else rig.goTo(name);
    ui.showView(name);
  },
  toggleTour: () => (tour.active ? tour.exit() : tour.enter()),
  teleport: (name) => tour.teleport(name),
});
rig.onDone = (name) => { if (!name) ui.showView(null); };

tour = new Tour({
  camera, controls,
  canvas: renderer.domElement,
  joystick: document.getElementById('joystick'),
  fade: document.getElementById('fade'),
  onChange: (on) => { ui.showTour(on); if (on) rig.cancel(); requestAnimationFrame(updateViewOffset); },
  onRoom: (name) => ui.showRoom(name),
});

/* ---------- Boucle ---------- */
const clock = new THREE.Clock();
let frames = 0, acc = 0, slow = 0, fast = 0;
const drops = {}; // niveaux de résolution déjà abandonnés (évite les oscillations)

// Résolution adaptative : baisse si < 50 fps, remonte prudemment si la marge revient.
function adaptQuality(dt) {
  frames++;
  acc += dt;
  if (acc < 2) return;
  const fps = Math.round(frames / acc);
  frames = 0;
  acc = 0;
  ui.showFps(fps, dpr);
  if (document.hidden) return;
  slow = fps < 50 ? slow + 1 : 0;
  fast = fps >= 58 ? fast + 1 : 0;
  if (slow >= 2 && dpr > 1) {
    drops[dpr] = (drops[dpr] || 0) + 1;
    dpr = Math.max(1, dpr - 0.25);
    slow = 0;
    resize();
  } else if (fast >= 4 && dpr < MAX_DPR && (drops[dpr + 0.25] || 0) < 2) {
    dpr = Math.min(MAX_DPR, dpr + 0.25);
    fast = 0;
    resize();
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  state.dt = dt;
  state.time += dt;
  state.wantNight = wantNight;
  state.garageOpen = garageOpen;
  for (const u of updaters) u(state, dt);
  if (tour.mode !== 'off') tour.update(dt);
  else rig.update(dt);
  composer.render();
  adaptQuality(dt);
}

buildWorld();
rig.jump('facade');
ui.showView('facade');
renderer.setAnimationLoop(frame);
requestAnimationFrame(() => document.getElementById('loader').classList.add('done'));
window.__villa = { tour, state, renderer, scene, camera, composer }; // accès de débogage
