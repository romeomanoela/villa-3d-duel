// Registre partagé : tout ce qui réagit au cycle jour/nuit ou au temps s'y inscrit.
export const R = {
  /** { light, intensity } : intensité = k * intensity (k = 0 jour, 1 nuit) */
  nightLights: [],
  /** { material, intensity } : emissiveIntensity = k * intensity */
  nightEmissives: [],
  /** matériaux dont envMapIntensity suit l'ambiance */
  envMaterials: [],
  /** fonctions appelées chaque frame : fn(dt, elapsed, k) */
  updaters: [],
};

export function nightLight(light, intensity) {
  light.intensity = 0;
  R.nightLights.push({ light, intensity });
  return light;
}

export function nightEmissive(material, intensity = 1) {
  material.emissiveIntensity = 0;
  R.nightEmissives.push({ material, intensity });
  return material;
}
