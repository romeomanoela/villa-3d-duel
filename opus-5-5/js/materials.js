import * as THREE from 'three';
import { rep } from './textures.js';

// Bibliothèque de matériaux partagés. Les matériaux émissifs sont enregistrés dans
// M.night (intensité jour / nuit) et les halos additifs dans M.glows (opacité nuit).
export function createMaterials(T) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = { night: [], glows: [] };
  const lit = (mat, day, night) => { M.night.push([mat, day, night]); return mat; };

  /* --- Architecture --- */
  M.stucco = std({ color: 0xffffff, map: rep(T.stucco.map, 0.5), bumpMap: rep(T.stucco.bump, 0.5), bumpScale: 0.5, roughness: 0.92 });
  M.stuccoInt = std({ color: 0xf1ede6, roughness: 0.95 });
  M.ceiling = std({ color: 0xf6f4f0, roughness: 0.95 });
  M.travertine = std({ map: rep(T.travertine.map, 0.5), bumpMap: rep(T.travertine.bump, 0.5), bumpScale: 0.8, roughness: 0.8 });
  M.travPave = std({ map: rep(T.travLight.map, 0.5), bumpMap: rep(T.travLight.bump, 0.5), bumpScale: 0.6, roughness: 0.72 });
  M.coping = std({ color: 0xf2ebdf, map: rep(T.travLight.map, 0.9), roughness: 0.55 });
  M.cladding = std({ map: rep(T.slats.map, 1), bumpMap: rep(T.slats.bump, 1), bumpScale: 1.5, roughness: 0.72 });
  M.deck = std({ map: rep(T.deck.map, 0.5), bumpMap: rep(T.deck.bump, 0.5), bumpScale: 0.8, roughness: 0.78 });
  M.oak = std({ map: rep(T.oak.map, 0.45), color: 0xfff0dc, roughness: 0.58, envMapIntensity: 0.6 });
  M.walnut = std({ map: rep(T.walnut.map, 0.8), roughness: 0.5 });
  M.frame = std({ color: 0x23262a, roughness: 0.35, metalness: 0.7 });
  M.steel = std({ color: 0xc4c7cb, roughness: 0.25, metalness: 1.0 });
  M.blackMetal = std({ color: 0x141517, roughness: 0.45, metalness: 0.6 });
  M.glass = std({
    color: 0xb8d0d8, roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.2,
    envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide,
  });
  M.glassRail = M.glass.clone();
  M.glassRail.opacity = 0.16;
  M.concreteFloor = std({ map: rep(T.concrete, 0.25), roughness: 0.38 });
  M.wallGrey = std({ color: 0xdedcd7, roughness: 0.9 });
  M.doorPanel = std({ color: 0x2e3135, roughness: 0.42, metalness: 0.55, bumpMap: rep(T.grooves, 1, 1), bumpScale: 2 });

  /* --- Intérieur --- */
  M.marble = std({ map: rep(T.marble, 0.5), roughness: 0.16 });
  M.fabric = std({ color: 0xebe5da, map: rep(T.fabric, 2), roughness: 0.96 });
  M.fabricDark = std({ color: 0x5d6064, map: rep(T.fabric, 2), roughness: 0.96 });
  M.cushion = std({ color: 0xf7f4ee, map: rep(T.fabric, 2), roughness: 0.92 });
  M.cushionAccent = std({ color: 0x3f6f7a, map: rep(T.fabric, 2), roughness: 0.92 });
  M.leather = std({ color: 0x8b5a35, roughness: 0.5 });
  M.rug = std({ color: 0xb8ab97, map: rep(T.fabric, 3), roughness: 1 });
  M.linen = std({ color: 0xf5f2ec, map: rep(T.fabric, 2), roughness: 1 });
  M.blackMatte = std({ color: 0x1c1d1f, roughness: 0.75 });
  M.screen = std({ color: 0x050507, roughness: 0.12, metalness: 0.5 });
  M.brass = std({ color: 0xc9a46a, roughness: 0.3, metalness: 1 });
  M.ceramic = std({ color: 0xf4f2ee, roughness: 0.2 });

  /* --- Extérieur, sols, végétal --- */
  M.grass = std({ map: rep(T.grass, 0.25), roughness: 0.97 });
  M.grass.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos;
float gH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(gH(i), gH(i+vec2(1,0)), f.x), mix(gH(i+vec2(0,1)), gH(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float gn = gN(vWPos.xz * 0.09) * 0.6 + gN(vWPos.xz * 0.37) * 0.4;
diffuseColor.rgb *= mix(0.8, 1.15, gn);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.03, 0.78), smoothstep(0.6, 0.85, gN(vWPos.xz * 0.05 + 7.0)) * 0.6);`);
  };
  M.grass.customProgramCacheKey = () => 'lawn-macro';
  M.pavers = std({ map: rep(T.pavers.map, 0.5), bumpMap: rep(T.pavers.bump, 0.5), bumpScale: 1, roughness: 0.85 });
  M.asphalt = std({ map: rep(T.asphalt, 0.25), roughness: 0.93 });
  M.sidewalk = std({ color: 0xc9c4ba, map: rep(T.concrete, 0.5), roughness: 0.9 });
  M.granite = std({ color: 0x55575a, roughness: 0.65 });
  M.gravel = std({ color: 0xd8d1c4, map: rep(T.concrete, 3), roughness: 1 });
  M.paint = std({ color: 0xf0f0ea, roughness: 0.8 });
  M.hedge = std({ map: rep(T.hedge.map, 0.7), bumpMap: rep(T.hedge.bump, 0.7), bumpScale: 2, roughness: 0.95 });
  M.cypress = std({ map: rep(T.cypress.map, 0.9), bumpMap: rep(T.cypress.bump, 0.9), bumpScale: 2, roughness: 0.95 });
  M.palmTrunk = std({ map: rep(T.palmBark, 3, 1), roughness: 0.95 });
  M.palmLeaf = std({ map: T.palmLeaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  M.oliveLeaf = std({ map: T.oliveCard, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
  M.shrubLeaf = std({ map: T.shrubCard, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
  M.foliageCore = std({ color: 0x3a4a2c, roughness: 1 });
  M.oliveCore = std({ color: 0x55603f, roughness: 1 });
  M.bark = std({ color: 0x5e5044, roughness: 1 });
  M.lavender = std({ color: 0x8c7bc0, roughness: 1 });
  M.box = std({ color: 0x3d5a2a, map: rep(T.hedge.map, 1.5), roughness: 0.95 });
  M.planter = std({ color: 0x393b3e, roughness: 0.7 });
  M.terracotta = std({ color: 0xb06a48, roughness: 0.85 });
  M.soil = std({ color: 0x3b2c21, roughness: 1 });
  M.umbrella = std({ color: 0xf2ece0, map: rep(T.fabric, 2), side: THREE.DoubleSide, roughness: 0.95 });
  M.teak = std({ map: rep(T.deck.map, 1), color: 0xd9b48a, roughness: 0.6 });
  M.poolTile = std({ map: rep(T.poolTiles.map, 1), bumpMap: rep(T.poolTiles.bump, 1), bumpScale: 0.6, roughness: 0.25, emissive: 0x30d8ff, emissiveMap: rep(T.poolTiles.map, 1), emissiveIntensity: 0 });
  lit(M.poolTile, 0, 0.45);

  /* --- Sources lumineuses (émissifs pilotés par le mode nuit) --- */
  M.lampWarm = lit(std({ color: 0xfff3df, emissive: 0xffcf8f, emissiveIntensity: 0, roughness: 0.4 }), 0, 7);
  M.lampSpot = lit(std({ color: 0xfff7ea, emissive: 0xffe2b8, emissiveIntensity: 0, roughness: 0.4 }), 0, 9);
  M.ledStrip = lit(std({ color: 0xffffff, emissive: 0xfff1dc, emissiveIntensity: 0, roughness: 0.4 }), 0, 4);
  M.fire = lit(std({ color: 0x331100, emissive: 0xff7a2a, emissiveIntensity: 0, roughness: 1 }), 0.6, 6);
  M.bollardLamp = lit(std({ color: 0xece6d8, emissive: 0xffc77e, emissiveIntensity: 0, roughness: 0.5 }), 0, 8);
  M.poolLamp = lit(std({ color: 0xdff8ff, emissive: 0x9ff0ff, emissiveIntensity: 0, roughness: 0.3 }), 0, 12);
  M.streetLamp = lit(std({ color: 0xf2efe8, emissive: 0xffd7a0, emissiveIntensity: 0, roughness: 0.5 }), 0, 10);

  const glow = (color, base) => {
    const m = new THREE.MeshBasicMaterial({
      map: T.glow, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, toneMapped: true,
    });
    M.glows.push([m, base]);
    return m;
  };
  M.glowWarm = glow(0xffc27a, 0.85);
  M.glowSoft = glow(0xffd9a8, 0.45);
  M.glowCyan = glow(0x5fe6ff, 0.75);

  return M;
}
