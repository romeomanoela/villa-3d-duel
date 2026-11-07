// Registre des sources lumineuses "nocturnes" : lumières réelles, matériaux émissifs, halos.
// Chaque élément s'allume progressivement selon le paramètre jour/nuit `tod` (0 = jour, 1 = nuit),
// avec des seuils décalés pour un effet naturel (jardin d'abord, puis intérieur, piscine, phares).
import { smoothstep } from './utils.js';

export class Ambience {
  constructor() {
    this.items = [];
    this.tod = 0;
  }

  /** Lumière réelle (PointLight / SpotLight). Toujours présente dans la scène (pas de recompilation). */
  light(light, intensity, a = 0.5, b = 0.85, base = 0) {
    light.intensity = base;
    this.items.push({ k: 'light', obj: light, v: intensity, a, b, base });
    return light;
  }

  /** Matériau émissif dont l'intensité suit la nuit. */
  emissive(mat, intensity, a = 0.5, b = 0.85, base = 0) {
    mat.emissiveIntensity = base;
    this.items.push({ k: 'emissive', obj: mat, v: intensity, a, b, base });
    return mat;
  }

  /** Matériau translucide (halos, taches de lumière au sol) dont l'opacité suit la nuit. */
  glow(mat, opacity, a = 0.5, b = 0.85) {
    mat.opacity = 0;
    mat.visible = false;
    this.items.push({ k: 'glow', obj: mat, v: opacity, a, b });
    return mat;
  }

  /** Rappel libre : fn(k) avec k dans [0,1]. */
  custom(fn, a = 0.5, b = 0.85) {
    this.items.push({ k: 'fn', obj: fn, a, b });
  }

  update(tod) {
    this.tod = tod;
    for (const it of this.items) {
      const k = smoothstep(it.a, it.b, tod);
      switch (it.k) {
        case 'light':
          it.obj.intensity = it.base + (it.v - it.base) * k;
          break;
        case 'emissive':
          it.obj.emissiveIntensity = it.base + (it.v - it.base) * k;
          break;
        case 'glow':
          it.obj.opacity = it.v * k;
          it.obj.visible = k > 0.004;
          break;
        case 'fn':
          it.obj(k);
          break;
      }
    }
  }
}
