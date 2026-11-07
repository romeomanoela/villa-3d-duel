// Bibliothèque de matériaux partagés (PBR) + enregistrement des émissifs nocturnes.
import * as THREE from 'three';

const std = (o) => new THREE.MeshStandardMaterial(o);

/** Variation macro de couleur (taches de pelouse, usure) calculée en coordonnées monde. */
function addMacro(mat, { scale = 0.045, amount = 0.5, fine = 0.2 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
float mh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mh(i), mh(i+vec2(1,0)), f.x), mix(mh(i+vec2(0,1)), mh(i+vec2(1,1)), f.x), f.y); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float mac = (mn(vWPos.xz * ${scale.toFixed(4)}) - 0.5) * ${amount.toFixed(3)} + (mn(vWPos.xz * ${(scale * 7).toFixed(4)}) - 0.5) * ${fine.toFixed(3)};
diffuseColor.rgb *= 1.0 + mac;
diffuseColor.rgb += vec3(0.0, mac * 0.05, -mac * 0.04);`
      );
  };
  mat.customProgramCacheKey = () => `macro${scale}${amount}${fine}`;
}

export function createMaterials(T, ambience) {
  const M = {};
  const tiled = (m, tile) => {
    m.userData.tile = tile;
    return m;
  };

  /* --- enveloppe du bâtiment --- */
  M.render = tiled(std({ name: 'enduit', color: 0xf3f0e9, roughness: 0.88, map: T.plaster, bumpMap: T.plaster, bumpScale: 0.6 }), 4);
  M.renderWarm = tiled(std({ name: 'enduit-chaud', color: 0xe9e2d4, roughness: 0.9, map: T.plaster }), 4);
  M.concrete = tiled(std({ name: 'béton', color: 0xd9d8d4, roughness: 0.82, map: T.concrete, bumpMap: T.concrete, bumpScale: 0.8 }), 3);
  M.concreteDark = tiled(std({ name: 'béton-sombre', color: 0x7a7b7d, roughness: 0.85, map: T.concrete }), 3);
  M.slats = tiled(std({ name: 'bardage', color: 0xffffff, roughness: 0.7, map: T.slats, bumpMap: T.slats, bumpScale: 1.2 }), 1.6);
  M.stone = tiled(std({ name: 'pierre', color: 0xffffff, roughness: 0.92, map: T.stone, bumpMap: T.stone, bumpScale: 2.0 }), 2.0);
  M.roofMembrane = tiled(std({ name: 'toiture', color: 0x4d4f52, roughness: 0.95, map: T.concrete }), 3);
  M.blackMetal = std({ name: 'alu-noir', color: 0x16181b, roughness: 0.38, metalness: 0.85 });
  M.steel = std({ name: 'inox', color: 0xc4c8cd, roughness: 0.22, metalness: 1.0 });
  M.brass = std({ name: 'laiton', color: 0xc9a25c, roughness: 0.32, metalness: 1.0 });

  /* --- vitrage : transparent, reflets spéculaires additifs (mélange prémultiplié) --- */
  M.glass = std({
    name: 'verre',
    color: 0x000000,
    emissive: 0x0a1c24,
    emissiveIntensity: 0.25,
    roughness: 0.03,
    metalness: 0.0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    envMapIntensity: 1.6,
  });
  M.glassDark = M.glass.clone();
  M.glassDark.name = 'verre-fumé';
  M.glassDark.opacity = 0.55;
  M.glassDark.emissiveIntensity = 0;
  M.glassDark.envMapIntensity = 1.2;

  /* --- sols --- */
  M.deck = tiled(std({ name: 'deck-teck', color: 0xffffff, roughness: 0.62, map: T.deck, bumpMap: T.deck, bumpScale: 1.0 }), 2.0);
  M.floorOak = tiled(std({ name: 'parquet', color: 0xffffff, roughness: 0.42, map: T.oak, bumpMap: T.oak, bumpScale: 0.5 }), 2.4);
  M.walnut = tiled(std({ name: 'noyer', color: 0xffffff, roughness: 0.5, map: T.walnut }), 1.4);
  M.marble = tiled(std({ name: 'marbre', color: 0xfff0dc, roughness: 0.2, metalness: 0.0, map: T.marble, envMapIntensity: 0.75 }), 2.4);
  M.garageFloor = tiled(std({ name: 'résine-garage', color: 0x9a9d9f, roughness: 0.22, map: T.concrete, envMapIntensity: 1.2 }), 4);
  M.pavers = tiled(std({ name: 'pavés', color: 0xffffff, roughness: 0.82, map: T.pavers, bumpMap: T.pavers, bumpScale: 1.4 }), 2.4);
  M.asphalt = tiled(std({ name: 'asphalte', color: 0xffffff, roughness: 0.92, map: T.asphalt }), 4);
  M.coping = tiled(std({ name: 'margelle', color: 0xf0ece2, roughness: 0.55, map: T.concrete }), 3);
  M.lawn = tiled(std({ name: 'pelouse', color: 0xdfe4cc, roughness: 1, map: T.grass }), 3);
  addMacro(M.lawn, { scale: 0.05, amount: 0.55, fine: 0.22 });
  M.meadow = tiled(std({ name: 'prairie', color: 0xa9b58a, roughness: 1, map: T.grass }), 6);
  addMacro(M.meadow, { scale: 0.012, amount: 0.7, fine: 0.2 });
  M.vineyard = std({ name: 'vigne', color: 0xd8d0c0, roughness: 1, map: T.vineyard });
  addMacro(M.vineyard, { scale: 0.02, amount: 0.5, fine: 0.15 });
  M.wheat = std({ name: 'blé', color: 0xa89c78, roughness: 1, map: T.wheat });
  addMacro(M.wheat, { scale: 0.02, amount: 0.45, fine: 0.15 });
  M.mulch = std({ name: 'paillis', color: 0x4a3626, roughness: 1 });
  M.gravel = tiled(std({ name: 'gravier', color: 0xd7d0c0, roughness: 1, map: T.concrete, bumpMap: T.concrete, bumpScale: 2 }), 1.5);

  /* --- piscine --- */
  M.poolTile = tiled(std({ name: 'mosaïque', color: 0xc4e4ee, roughness: 0.18, metalness: 0.0, map: T.poolTile, emissive: 0x38d8ff, emissiveMap: T.poolTile, emissiveIntensity: 0 }), 0.8);
  ambience.emissive(M.poolTile, 1.9, 0.6, 0.9);

  /* --- textiles et mobilier --- */
  M.sofa = std({ name: 'canapé', color: 0xd3cbbd, roughness: 0.95 });
  M.sofaDark = std({ name: 'canapé-sombre', color: 0x3c4148, roughness: 0.95 });
  M.linen = std({ name: 'lin', color: 0xf1ede4, roughness: 0.96 });
  M.cushionTeal = std({ name: 'coussin-sarcelle', color: 0x3f7a80, roughness: 0.95 });
  M.cushionOchre = std({ name: 'coussin-ocre', color: 0xc48a3c, roughness: 0.95 });
  M.cushionRust = std({ name: 'coussin-rouille', color: 0xa4502f, roughness: 0.95 });
  M.leather = std({ name: 'cuir', color: 0x5d3b27, roughness: 0.55 });
  M.rug = std({ name: 'tapis', color: 0xffffff, roughness: 1, map: T.rug });
  M.ceramic = std({ name: 'céramique', color: 0xf6f4ef, roughness: 0.18 });
  M.counter = std({ name: 'plan-travail', color: 0x2c2e31, roughness: 0.25, metalness: 0.1 });
  M.cabinet = std({ name: 'cuisine', color: 0xe7e2d8, roughness: 0.45 });
  M.terracotta = std({ name: 'terre-cuite', color: 0xb8643c, roughness: 0.85 });
  M.canvas = std({ name: 'toile', color: 0xeee4cf, roughness: 0.98, side: THREE.DoubleSide });
  M.rubber = std({ name: 'caoutchouc', color: 0x1a1b1d, roughness: 0.8 });
  M.book = std({ name: 'livres', color: 0x8d6f52, roughness: 0.8 });
  M.paper = std({ name: 'papier', color: 0xe8e0cf, roughness: 0.9 });

  /* --- végétation --- */
  M.leaf = tiled(std({ name: 'feuillage', color: 0xffffff, roughness: 0.9, map: T.foliage, bumpMap: T.foliage, bumpScale: 1.5 }), 1);
  M.leaf.userData.tile = 0; // UV sphère : pas de remappage
  M.bark = std({ name: 'écorce', color: 0x6e5a46, roughness: 1 });
  M.trunkPalm = std({ name: 'stipe', color: 0xffffff, roughness: 0.95, map: T.bark });
  M.frond = std({ name: 'palme', color: 0xffffff, roughness: 0.75, map: T.frond, alphaTest: 0.45, side: THREE.DoubleSide });
  M.agave = std({ name: 'agave', color: 0x7da08a, roughness: 0.7, side: THREE.DoubleSide });
  M.flowerA = std({ name: 'fleur-rose', color: 0xe7a3b8, roughness: 0.8 });
  M.flowerB = std({ name: 'fleur-blanche', color: 0xf5f2ea, roughness: 0.8 });
  M.flowerC = std({ name: 'fleur-jaune', color: 0xe9c24a, roughness: 0.8 });
  M.lavender = std({ name: 'lavande', color: 0x8b6fb8, roughness: 0.9 });

  /* --- éclairages émissifs (suivent le cycle jour/nuit) --- */
  M.lampWarm = std({ name: 'lampe-chaude', color: 0xfff1d6, emissive: 0xffd49a, emissiveIntensity: 0, roughness: 0.5 });
  ambience.emissive(M.lampWarm, 2.3, 0.55, 0.85, 0.05);
  M.ledStrip = std({ name: 'led', color: 0xffefd0, emissive: 0xffd6a0, emissiveIntensity: 0, roughness: 0.5 });
  ambience.emissive(M.ledStrip, 1.35, 0.55, 0.85, 0.0);
  M.garageLed = std({ name: 'led-garage', color: 0xffefd0, emissive: 0xfff0dc, emissiveIntensity: 0, roughness: 0.5 });
  ambience.emissive(M.garageLed, 1.6, 0.55, 0.85, 1.0);
  M.downlight = std({ name: 'spot-encastré', color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 0, roughness: 0.4 });
  ambience.emissive(M.downlight, 1.9, 0.55, 0.85);
  M.bollard = std({ name: 'balise', color: 0xfff1d6, emissive: 0xffc980, emissiveIntensity: 0, roughness: 0.5 });
  ambience.emissive(M.bollard, 3.2, 0.4, 0.7);
  M.fire = std({ name: 'flamme', color: 0xffb060, emissive: 0xff8a2a, emissiveIntensity: 0, roughness: 0.6 });
  ambience.emissive(M.fire, 3.5, 0.6, 0.9);
  M.screen = std({ name: 'écran', color: 0x05070a, emissive: 0x6aa6ff, emissiveIntensity: 0.0, roughness: 0.2, metalness: 0.2 });
  ambience.emissive(M.screen, 1.0, 0.6, 0.9, 0.0);
  M.poolLamp = std({ name: 'spot-piscine', color: 0xe8ffff, emissive: 0x6af0ff, emissiveIntensity: 0, roughness: 0.3 });
  ambience.emissive(M.poolLamp, 5.5, 0.6, 0.9);

  /* --- halos (additifs) --- */
  const glowBase = { map: T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true };
  M.haloWarm = new THREE.MeshBasicMaterial({ ...glowBase, color: 0xffc27a, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  ambience.glow(M.haloWarm, 0.55, 0.4, 0.75);
  M.haloCool = new THREE.MeshBasicMaterial({ ...glowBase, color: 0x4fd9ff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  ambience.glow(M.haloCool, 0.5, 0.6, 0.9);
  M.haloWhite = new THREE.MeshBasicMaterial({ ...glowBase, color: 0xfff4e0 });
  ambience.glow(M.haloWhite, 0.8, 0.7, 0.95);

  return M;
}
