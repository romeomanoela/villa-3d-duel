// Constantes d'implantation (mètres). Repère : x vers l'est, z vers le sud (rue à l'est), y vers le haut.

export const F0 = 0.35; // niveau fini du rez-de-chaussée
export const CEIL0 = 3.55; // sous-face de la dalle haute
export const F1 = 3.85; // niveau fini de l'étage
export const ROOF_BOT = 6.85; // sous-face de la toiture
export const ROOF_TOP = 7.15;

export const PLOT = { x0: -30, x1: 30, z0: -22, z1: 22 }; // 60 x 44 m = 2 640 m²

// Bâtiment : volume séjour (ouest) + hall d'entrée + garage (est), étage en porte-à-faux au sud.
export const HOUSE = {
  x0: -17, x1: 16.3, z0: -10, z1: 2, // emprise du rez-de-chaussée (≈ 400 m²)
  hallX0: 4, hallX1: 7, // hall d'entrée
  up: { x0: -14, x1: 7, z0: -11, z1: 5 }, // étage (≈ 340 m²), porte-à-faux de 3 m au sud
};

export const GARAGE = {
  x0: 7, x1: 16.3, z0: -10, z1: 2,
  doorZ0: -8.3, doorZ1: 0.3, doorH: 2.5, doorX: 16.15,
  carZ: [-6.7, -1.3], carX: 11.2,
};

export const POOL = {
  x0: -14.5, x1: 0.5, z0: 7.8, z1: 13.4,
  floor: -1.6, shelfX1: -11.2, shelfFloor: -0.38, water: 0.04, coping: 0.12,
};

export const GATE = { z0: -6.9, z1: -1.1 };
