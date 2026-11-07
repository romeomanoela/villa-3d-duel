import * as THREE from 'three';

// Ciel procédural : dégradé zénith/horizon, halo et disque solaire, lueur du couchant,
// étoiles scintillantes et lune la nuit. Couleurs en espace linéaire (HDR).
const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // collé au plan lointain
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uDay;
uniform float uSunset;
uniform float uTime;
uniform float uSunDisc;
varying vec3 vDir;

float h31(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(1.0 - clamp(h, 0.0, 1.0), 4.0);
  vec3 col = mix(uZenith, uHorizon, t);

  vec3 sd = normalize(uSunDir);
  float cs = max(dot(d, sd), 0.0);
  vec2 sAz = normalize(sd.xz + 1e-5);
  float az = max(dot(normalize(d.xz + 1e-5), sAz), 0.0);
  col += uSunset * vec3(1.0, 0.38, 0.1) * pow(az, 4.0) * exp(-max(h, 0.0) * 6.0) * 0.8;
  col += vec3(1.0, 0.82, 0.6) * pow(cs, 18.0) * 0.35 * uDay;
  col += vec3(1.0, 0.93, 0.8) * smoothstep(0.99955, 0.99982, cs) * uSunDisc * step(-0.03, sd.y);

  float night = 1.0 - uDay;
  if (night > 0.001 && h > 0.0) {
    vec3 p = d * 230.0;
    vec3 c = floor(p);
    float r = h31(c);
    float star = step(0.9962, r) * smoothstep(0.32, 0.0, length(fract(p) - 0.5));
    float tw = 0.6 + 0.4 * sin(uTime * (1.3 + r * 5.0) + r * 80.0);
    col += star * tw * night * smoothstep(0.02, 0.3, h) * vec3(0.85, 0.92, 1.0) * (1.2 + 3.0 * fract(r * 97.0));
    vec3 md = normalize(uMoonDir);
    float cm = max(dot(d, md), 0.0);
    col += night * vec3(0.9, 0.93, 1.0) * smoothstep(0.99945, 0.99965, cm) * 5.0;
    col += night * vec3(0.18, 0.24, 0.42) * pow(cm, 40.0) * 0.6;
  }
  col = mix(col, uGround, smoothstep(0.0, -0.06, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(-0.5, 0.8, 0.4) },
    uMoonDir: { value: new THREE.Vector3(0.45, 0.5, -0.74).normalize() },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uDay: { value: 1 },
    uSunset: { value: 0 },
    uTime: { value: 0 },
    uSunDisc: { value: 40 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  // Version réduite pour générer la carte d'environnement (réflexions, éclairage ambiant).
  const envMat = mat.clone();
  envMat.uniforms = uniforms;
  const envMesh = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), envMat);
  return { mesh, envMesh, uniforms };
}
