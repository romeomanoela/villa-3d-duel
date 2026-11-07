// Matériaux partagés. Les textures sont en unités monde : repeat = 1 / taille de tuile (m).
import * as THREE from 'three';
import * as T from './textures.js';
import { R } from './registry.js';

function tiled(tex, tile) {
  tex.repeat.set(1 / tile, 1 / tile);
  return tex;
}

export function createMaterials() {
  const std = (opts) => new THREE.MeshStandardMaterial(opts);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfe3f0, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22,
    envMapIntensity: 0.9, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1,
  });
  const glassDark = new THREE.MeshPhysicalMaterial({
    color: 0x1d2a35, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55,
    envMapIntensity: 0.9, depthWrite: false,
  });
  const chrome = std({ color: 0xdddddd, metalness: 1, roughness: 0.15, envMapIntensity: 1.2 });
  R.envMaterials.push(glass, glassDark, chrome);

  const M = {
    grass: std({ map: tiled(T.grass(), 2), roughness: 1 }),
    travertine: std({ map: tiled(T.travertine(), 1.2), roughness: 0.75 }),
    stone: std({ color: 0xe6dccb, roughness: 0.7 }),
    wood: std({ map: tiled(T.wood(), 2), roughness: 0.65 }),
    woodDark: std({ map: tiled(T.wood(true), 2), roughness: 0.6 }),
    pavers: std({ map: tiled(T.pavers(), 2), roughness: 0.9 }),
    asphalt: std({ map: tiled(T.asphalt(), 4), roughness: 0.95 }),
    plaster: std({ map: tiled(T.plaster(), 3), roughness: 0.85 }),
    plasterWarm: std({ color: 0xcdbfa6, roughness: 0.85 }),
    anthracite: std({ color: 0x2b2e33, roughness: 0.55, metalness: 0.2 }),
    concrete: std({ map: tiled(T.concrete(), 3), roughness: 0.9 }),
    poolTiles: std({ map: tiled(T.poolTiles(), 1), roughness: 0.3 }),
    marble: std({ map: tiled(T.marble(), 2), roughness: 0.25 }),
    bark: std({ map: tiled(T.bark(), 1), roughness: 0.95 }),
    hedge: std({ map: tiled(T.hedge(), 1), roughness: 1 }),
    garageDoor: std({ map: tiled(T.garageDoor(), 1), roughness: 0.5, metalness: 0.35 }),
    leaf: std({ map: T.palmFrond(), alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }),
    leafDark: std({ color: 0x24501c, roughness: 0.9 }),
    olive: std({ color: 0x7d9a6a, roughness: 0.9, flatShading: true }),
    trunk: std({ color: 0x5a4634, roughness: 0.95 }),
    glass, glassDark, chrome,
    alu: std({ color: 0x3a3d42, metalness: 0.6, roughness: 0.4 }),
    white: std({ color: 0xf4f4f0, roughness: 0.6 }),
    cream: std({ color: 0xf3e9d2, roughness: 0.8, side: THREE.DoubleSide }),
    fabric: std({ color: 0x8a8f94, roughness: 1 }),
    fabricAccent: std({ color: 0xb8623a, roughness: 1 }),
    teak: std({ color: 0x9a6a3c, roughness: 0.7 }),
    darkMetal: std({ color: 0x1c1d20, metalness: 0.7, roughness: 0.35 }),
    rubber: std({ color: 0x151515, roughness: 0.95 }),
    terracotta: std({ color: 0xb5603a, roughness: 0.9 }),
  };
  return M;
}
