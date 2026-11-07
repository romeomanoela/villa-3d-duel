// Plan de masse de la villa — toutes les cotes sont en mètres.
// Repère : X vers l'est, Z vers la rue (sud-nord inversé), Y vers le haut.
export const L = {
  FL0: 0.45, // niveau fini du rez-de-chaussée (sur socle)
  H0: 3.3, // hauteur d'étage RDC (plancher à plancher)
  FL1: 3.75, // niveau fini de l'étage
  H1: 3.2,
  SLAB: 0.32, // épaisseur des dalles
  ROOF: 6.95, // sous-face de la toiture
  WALL: 0.3,

  GF: { x0: -14, x1: 6, z0: -6, z1: 4 }, // rez-de-chaussée 200 m²
  UF: { x0: -10, x1: 10.5, z0: -7.5, z1: 3.2 }, // étage ~220 m²
  GAR: { x0: 6, x1: 14, z0: -6, z1: 4, floor: 0.08, doorX0: 7, doorX1: 13, doorH: 2.6 },
  STAIR: { x0: -5.0, x1: -0.62, z0: 1.85, z1: 3.0, steps: 18 }, // trémie x[-5.2,-0.62] z[1.75,3.2]

  PLATFORM: { x0: -14.5, x1: 6, z0: -20, z1: -6 }, // plage + terrasse
  DECK: { x0: -14, x1: 6, z0: -10, z1: -6 }, // terrasse bois
  POOL: { x0: -11.5, x1: 0.5, z0: -17, z1: -12, water: 0.37, floor: -1.25 },

  PLOT: { x0: -30, x1: 30, z0: -24, z1: 22 }, // parcelle 60 × 46 m
  DRIVE: { x0: 7, x1: 13, z0: 4, z1: 22.4 },
  PATH_X: -5.9, // axe de l'allée piétonne / porte d'entrée
  GATE_P: { x0: -6.9, x1: -4.9 },
};
