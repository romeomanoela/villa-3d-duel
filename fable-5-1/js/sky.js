// Ciel procédural : dôme en dégradé (shader), soleil, lune, étoiles, et environnement PMREM.
import * as THREE from 'three';
import { rng } from './utils.js';

const DAY = {
  top: new THREE.Color(0x2160cf), horizon: new THREE.Color(0xc4dcf2), ground: new THREE.Color(0x7d8a70),
  sunColor: new THREE.Color(0xfff1cf),
};
const NIGHT = {
  top: new THREE.Color(0x020510), horizon: new THREE.Color(0x0b1530), ground: new THREE.Color(0x05070b),
  sunColor: new THREE.Color(0x000000),
};

const vert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */`
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunColor;
  uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform float uSunVis; uniform float uMoonVis;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.4));
    col = mix(col, uGround, smoothstep(0.0, -0.12, h));
    float ds = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(ds, 1200.0) * 4.0 + pow(ds, 14.0) * 0.35 + pow(ds, 3.0) * 0.08) * uSunVis;
    float dm = max(dot(d, uMoonDir), 0.0);
    col += vec3(0.8, 0.86, 1.0) * (smoothstep(0.99935, 0.9996, dm) * 1.6 + pow(dm, 60.0) * 0.12) * uMoonVis;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(scene, renderer) {
  const uniforms = {
    uTop: { value: DAY.top.clone() }, uHorizon: { value: DAY.horizon.clone() }, uGround: { value: DAY.ground.clone() },
    uSunColor: { value: DAY.sunColor.clone() },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
    uMoonDir: { value: new THREE.Vector3(-0.5, 0.6, -0.5).normalize() },
    uSunVis: { value: 1 }, uMoonVis: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  // Étoiles : nuage de points sur l'hémisphère supérieur.
  const r = rng(7);
  const n = 2600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.98 + 0.02);
    const R = 430;
    pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = R * Math.cos(ph);
    pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // Environnement (réflexions du verre, du chrome, de la peinture) : PMREM du dôme, jour et nuit.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(dome.geometry, mat);
  envScene.add(envDome);
  const envDay = pmrem.fromScene(envScene, 0.02, 1, 2000).texture;
  applyColors(uniforms, 1);
  const envNight = pmrem.fromScene(envScene, 0.02, 1, 2000).texture;
  applyColors(uniforms, 0);
  pmrem.dispose();
  scene.environment = envDay;

  return {
    uniforms,
    /** k : 0 = jour, 1 = nuit */
    update(k, sunDir, moonDir) {
      applyColors(uniforms, k);
      uniforms.uSunDir.value.copy(sunDir);
      uniforms.uMoonDir.value.copy(moonDir);
      uniforms.uSunVis.value = 1 - k;
      uniforms.uMoonVis.value = k;
      starMat.opacity = Math.max(0, k * 1.2 - 0.2);
      stars.position.copy(dome.position);
      scene.environment = k > 0.5 ? envNight : envDay;
    },
    follow(cameraPos) { dome.position.copy(cameraPos); stars.position.copy(cameraPos); },
  };
}

function applyColors(u, k) {
  u.uTop.value.lerpColors(DAY.top, NIGHT.top, k);
  u.uHorizon.value.lerpColors(DAY.horizon, NIGHT.horizon, k);
  u.uGround.value.lerpColors(DAY.ground, NIGHT.ground, k);
  u.uSunColor.value.lerpColors(DAY.sunColor, NIGHT.sunColor, k);
}
