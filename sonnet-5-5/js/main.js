// Point d'entrée : renderer, post-traitement, construction de la scène, boucle de rendu.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createTextures, setAnisotropy } from './textures.js';
import { createMaterials } from './materials.js';
import { Ambience } from './ambience.js';
import { Environment } from './sky.js';
import { createVegetation } from './vegetation.js';
import { buildTerrain } from './terrain.js';
import { buildVilla } from './villa.js';
import { buildInterior } from './interior.js';
import { buildPool } from './pool.js';
import { buildGarage } from './garage.js';
import { buildRooms } from './rooms.js';
import { buildWalkMap } from './walkmap.js';
import { Walker } from './walk.js';
import { initTourUI } from './walkui.js';
import { CameraRig } from './camera.js';
import { initUI } from './ui.js';
import { smoothstep } from './utils.js';

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const loaderFill = document.getElementById('loader-fill');

// Laisse respirer le navigateur entre deux étapes de construction ; le minuteur de secours évite tout blocage
// si l'onglet est en arrière-plan (requestAnimationFrame y est suspendu).
const nextFrame = () =>
  new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(() => setTimeout(go, 0));
    setTimeout(go, 60);
  });
async function step(label, pct, fn) {
  loaderText.textContent = label;
  loaderFill.style.width = `${pct}%`;
  await nextFrame();
  return fn();
}

async function boot() {
  performance.mark('villa-boot');
  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 2600);

  const ambience = new Ambience();
  const T = await step('Textures procédurales…', 6, () => createTextures());
  performance.mark('villa-textures');
  const M = createMaterials(T, ambience);
  const env = new Environment({ renderer, scene, camera, ambience, shadowSize: 4096 });

  const veg = createVegetation({ scene, M });
  const ctx = { renderer, scene, camera, T, M, ambience, env, veg };

  await step('Terrain, rue, clôtures et jardin…', 18, () => buildTerrain(ctx));
  await step('Architecture de la villa…', 38, () => buildVilla(ctx));
  await step('Intérieur et mobilier…', 56, () => buildInterior(ctx));
  await step('Salle de bain et pièces de la visite…', 62, () => buildRooms(ctx));
  const pool = await step('Piscine et eau animée…', 72, () => buildPool(ctx));
  const garage = await step('Garage et voitures de luxe…', 84, () => buildGarage(ctx));
  performance.mark('villa-built');

  env.apply(env.tod);
  env.updateEnv();

  /* ---------- caméra & UI ---------- */
  const rig = new CameraRig(camera, canvas);
  rig.snapTo('aerienne');
  const walker = new Walker({ camera, rig, canvas, map: buildWalkMap() });
  initUI({ env, garage, rig, walker });
  initTourUI({ walker, rig, panel: document.getElementById('panel') });

  /* ---------- post-traitement (MSAA + bloom nocturne) ---------- */
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.0, 0.45, 1.35);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < 2 || h < 2) return; // fenêtre masquée / réduite : on garde les tailles précédentes
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // Décalage du centre de projection : la scène reste centrée dans la zone libre à droite du panneau (desktop).
  const panelEl = document.getElementById('panel');
  let vOff = 0, vOffApplied = null;
  function updateViewOffset(dt) {
    const w = window.innerWidth, h = window.innerHeight;
    const target = w > 900 && !walker.active && !panelEl.classList.contains('is-collapsed') ? (panelEl.offsetWidth + 24) / 2 : 0;
    vOff += (target - vOff) * Math.min(1, dt * 6);
    if (Math.abs(target - vOff) < 0.3) vOff = target;
    if (vOff !== vOffApplied) {
      if (vOff === 0) camera.clearViewOffset();
      else camera.setViewOffset(w, h, -vOff, 0, w, h);
      vOffApplied = vOff;
    }
  }
  window.addEventListener('resize', () => {
    resize();
    vOffApplied = null;
  });
  resize();

  /* ---------- adaptation dynamique des performances ---------- */
  const perf = { acc: 0, frames: 0, fps: 60, level: 0, cool: 3 };
  function adapt(dt) {
    perf.acc += dt;
    perf.frames++;
    if (perf.acc < 1.5) return;
    perf.fps = perf.frames / perf.acc;
    perf.acc = 0;
    perf.frames = 0;
    if (perf.cool > 0) {
      perf.cool--;
      return;
    }
    if (perf.fps < 40 && pixelRatio > 0.8) {
      pixelRatio = Math.max(0.75, pixelRatio - 0.25);
      resize();
      perf.cool = 2;
      if (pixelRatio < 1.1) env.setShadowSize(2048);
    } else if (perf.fps > 58 && pixelRatio < Math.min(window.devicePixelRatio || 1, 2) - 0.01 && perf.level === 0) {
      pixelRatio = Math.min(Math.min(window.devicePixelRatio || 1, 2), pixelRatio + 0.25);
      resize();
      perf.cool = 4;
    }
  }

  /* ---------- intro : survol d'arrivée vers la façade ---------- */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) rig.snapTo('facade');
  else rig.goTo('facade', 4.2);

  loaderText.textContent = 'Prêt';
  loaderFill.style.width = '100%';
  loaderEl.classList.add('is-done');

  // Les ombres ne dépendent pas de la caméra : on ne les recalcule que si la scène change
  // (cycle jour/nuit, porte de garage) ou à 8 Hz pour le léger balancement des palmes.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  let shadowClock = 0;

  const clock = new THREE.Clock();
  let time = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    if (walker.active) walker.update(dt);
    else rig.update(dt);
    updateViewOffset(dt);
    const lightChanged = env.update(dt, time);
    veg.update(dt, time);
    pool.update(dt, time);
    garage.update(dt);
    shadowClock += dt;
    if (lightChanged || garage.moving || shadowClock > 0.125) {
      renderer.shadowMap.needsUpdate = true;
      shadowClock = 0;
    }
    bloom.strength = 0.34 * smoothstep(0.5, 0.95, env.tod);
    bloom.enabled = bloom.strength > 0.01;
    if (window.innerWidth > 1 && window.innerHeight > 1) composer.render();
    if (!window.__firstFrame) {
      window.__firstFrame = true;
      performance.mark('villa-first-frame');
    }
    adapt(dt);
    requestAnimationFrame(frame);
  }
  frame();

  // poignée de débogage (inspection depuis la console)
  window.villa = { THREE, renderer, scene, camera, env, ambience, M, T, rig, garage, pool, perf, walker, get pixelRatio() { return pixelRatio; } };
}

boot().catch((e) => {
  console.error(e);
  loaderText.textContent = 'Erreur : ' + e.message;
});
