// Point d'entrée : rendu, scène, construction des modules, interface et boucle d'animation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setAnisotropy } from './textures.js';
import { createMaterials } from './materials.js';
import { createSky } from './sky.js';
import { createTerrain } from './terrain.js';
import { createVegetation } from './vegetation.js';
import { createVilla, VILLA_COLLIDERS, floorHeight, ENTRY } from './villa.js';
import { createPool } from './pool.js';
import { createCars, CAR_COLLIDERS } from './cars.js';
import { createWalker } from './walk.js';
import { createTouchControls } from './touch.js';
import { createLighting } from './lighting.js';
import { createCameraRig, VIEWS } from './cameraViews.js';
import { R } from './registry.js';
import { easeInOut } from './utils.js';

// ---------- Rendu ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.12, 900);
camera.position.set(...VIEWS.facade.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...VIEWS.facade.target);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 3;
controls.maxDistance = 120;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.035;   // jamais sous l'horizon
controls.screenSpacePanning = false;
controls.autoRotateSpeed = 0.7;
controls.update();

// ---------- Construction ----------
const M = createMaterials();
const sky = createSky(scene, renderer);
createTerrain(scene, M);
createVegetation(scene, M);
const villa = createVilla(scene, M);
createPool(scene, M);
createCars(scene, M);
const lighting = createLighting(scene, renderer, sky);
const rig = createCameraRig(camera, controls);

// ---------- Porte de garage (animation) ----------
const garage = { progress: 0, target: 0, speed: 1 / 3.2 };
R.updaters.push((dt) => {
  if (garage.progress === garage.target) return;
  const dir = Math.sign(garage.target - garage.progress);
  garage.progress = Math.min(1, Math.max(0, garage.progress + dir * dt * garage.speed));
  villa.garageDoor.setProgress(easeInOut(garage.progress));
});

// ---------- Visite intérieure (1re personne) ----------
const walker = createWalker({
  camera, canvas, colliders: [...VILLA_COLLIDERS, ...CAR_COLLIDERS], floorHeight, entry: ENTRY,
  onExit: (lookTarget) => {
    // Retour en orbite : la cible part du point regardé pour une transition sans à-coup.
    controls.target.copy(lookTarget);
    controls.autoRotate = false;
    setRotateUI(false);
    rig.flyTo(lastView);
    setActiveView(lastView);
    btnVisit.textContent = 'Visiter l\'intérieur';
    btnVisit.classList.remove('active');
    touch.reset();
  },
});
const touch = createTouchControls(walker);

// ---------- Interface ----------
const $ = (id) => document.getElementById(id);
const btnDay = $('btn-day'), btnNight = $('btn-night'), btnGarage = $('btn-garage'), btnRotate = $('btn-rotate'), btnVisit = $('btn-visit');
const viewButtons = [...document.querySelectorAll('[data-view]')];
let lastView = 'facade';

btnVisit.addEventListener('click', () => {
  if (walker.isActive()) { walker.exit(); return; }
  controls.enabled = false;
  controls.autoRotate = false;
  setRotateUI(false);
  walker.enter(controls.target);
  btnVisit.textContent = 'Vue extérieure';
  btnVisit.classList.add('active');
  // Sur petit écran, on replie le panneau pour dégager la scène (le bouton « Vue extérieure » tactile reste visible).
  if (window.innerWidth <= 480) setPanelCollapsed(true);
});
$('btn-exit-touch').addEventListener('click', () => walker.exit());

function setMode(night) {
  lighting.setNight(night);
  btnDay.classList.toggle('active', !night);
  btnNight.classList.toggle('active', night);
  btnDay.setAttribute('aria-pressed', String(!night));
  btnNight.setAttribute('aria-pressed', String(night));
}
btnDay.addEventListener('click', () => setMode(false));
btnNight.addEventListener('click', () => setMode(true));

btnGarage.addEventListener('click', () => {
  garage.target = garage.target === 1 ? 0 : 1;
  const open = garage.target === 1;
  btnGarage.textContent = open ? 'Fermer le garage' : 'Ouvrir le garage';
  btnGarage.classList.toggle('active', open);
  btnGarage.setAttribute('aria-pressed', String(open));
});

function setActiveView(name) {
  viewButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}
viewButtons.forEach((b) => b.addEventListener('click', () => {
  lastView = b.dataset.view;
  if (walker.isActive()) { walker.exit(); return; } // la sortie vole vers lastView
  rig.flyTo(b.dataset.view);
  setActiveView(b.dataset.view);
}));
controls.addEventListener('start', () => { if (!rig.isFlying()) setActiveView(null); });

function setRotateUI(on) {
  btnRotate.textContent = `Rotation auto : ${on ? 'on' : 'off'}`;
  btnRotate.classList.toggle('active', on);
  btnRotate.setAttribute('aria-pressed', String(on));
}
btnRotate.addEventListener('click', () => {
  if (walker.isActive()) walker.exit();
  controls.autoRotate = !controls.autoRotate;
  setRotateUI(controls.autoRotate);
});

function setPanelCollapsed(collapsed) {
  $('ui').classList.toggle('collapsed', collapsed);
  document.body.classList.toggle('panel-open', !collapsed);
  $('btn-panel-toggle').setAttribute('aria-expanded', String(!collapsed));
}
document.body.classList.add('panel-open');
$('btn-panel-toggle').addEventListener('click', () => setPanelCollapsed(!$('ui').classList.contains('collapsed')));

window.addEventListener('keydown', (e) => {
  if (e.key === 'n' || e.key === 'N') setMode(!lighting.isNight());
  if (e.key === 'g' || e.key === 'G') btnGarage.click();
  if (e.key === 'r' || e.key === 'R') btnRotate.click();
  if (e.key === 'v' || e.key === 'V') btnVisit.click();
  const idx = ['1', '2', '3', '4'].indexOf(e.key);
  if (idx >= 0) viewButtons[idx].click();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Boucle ----------
const clock = new THREE.Clock();
const fpsEl = $('fps');
let frames = 0, fpsTimer = 0, firstFrame = true;

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  lighting.update(dt);
  if (walker.isActive()) walker.update(dt, t);
  else rig.update(dt);
  sky.follow(camera.position);
  for (const fn of R.updaters) fn(dt, t, lighting.state.k, lighting.state);

  renderer.render(scene, camera);

  frames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) { fpsEl.textContent = `${Math.round(frames / fpsTimer)} fps`; frames = 0; fpsTimer = 0; }
  if (firstFrame) { firstFrame = false; document.body.classList.add('ready'); }
}
renderer.setAnimationLoop(animate);

// Exposé pour inspection / tests manuels dans la console (non utilisé par l'UI).
window.__villa = { scene, camera, controls, lighting, garage, renderer, walker };
