// Carte de la visite intérieure : collisions 2D (rectangles) par niveau, hauteur du sol (escalier compris),
// zones nommées (étiquette de pièce) et point d'entrée. Les cotes reprennent celles de villa.js / interior.js / rooms.js.
import { F0, F1, GARAGE } from './config.js';
import { STAIR, STAIR_HOLE } from './villa.js';
import { BATH } from './rooms.js';

const R = (x0, x1, z0, z1) => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

const STAIR_RECT = { x0: STAIR_HOLE[0], x1: STAIR.xBottom + 0.12, z0: STAIR_HOLE[2], z1: STAIR_HOLE[3] };
const FLOOR_TERRACE = 0.345;
const FLOOR_UP = F1 + 0.03;
const FLOOR_UP_DECK = F1 + 0.05;

/** Hauteur du sol sous (x, z) pour le niveau donné. Dans la cage d'escalier : marche par marche. */
export function floorAt(x, z, level) {
  const s = STAIR_RECT;
  if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) {
    const u = (STAIR.xBottom - x) / STAIR.run;
    if (u <= 0) return F0;
    const i = Math.min(STAIR.count, Math.ceil(u));
    return F0 + STAIR.rise * i;
  }
  if (level === 0) return z > 2.05 ? FLOOR_TERRACE : F0;
  return x > 7.05 || z > 2.0 ? FLOOR_UP_DECK : FLOOR_UP;
}

export function buildWalkMap() {
  const g = []; // niveau 0 (rez-de-chaussée, garage, terrasse couverte)
  const u = []; // niveau 1 (étage, loggia, terrasse du garage)

  /* ------------------------ rez-de-chaussée : enveloppe ------------------------ */
  g.push(R(-17.1, 16.3, -10.1, -9.75)); // mur nord
  g.push(R(-17.1, -16.75, -10.1, 2.06)); // mur ouest
  g.push(R(16.0, 16.4, -10.1, 2.06)); // mur est + porte de garage (toujours condamnée pour la visite)
  g.push(R(-17.1, -9.0, 1.72, 2.06)); // façade sud : verre + retour de pierre
  g.push(R(-5.8, 16.4, 1.72, 2.06)); // façade sud : verre, hall (porte d'entrée fermée), garage
  g.push(R(6.88, 7.17, -10.1, -3.8)); // cloison hall / garage
  g.push(R(6.88, 7.17, -2.2, 2.06)); // (passage libre entre z = -3,8 et -2,2)
  // limites de la terrasse couverte (marches vers la plage de la piscine)
  g.push(R(-17.9, 7.9, 5.4, 5.8));
  g.push(R(-17.9, -17.4, 2.0, 5.8));
  g.push(R(7.4, 7.9, 2.0, 5.8));

  /* ------------------------ rez-de-chaussée : mobilier ------------------------ */
  g.push(R(-16.8, -16.35, -6.2, -1.2)); // cheminée
  g.push(R(-16.75, -11.75, -9.8, -9.35)); // bibliothèque
  g.push(R(-14.35, -10.45, -5.4, -4.4)); // canapé
  g.push(R(-16.4, -15.4, -3.35, -1.05)); // canapé d'angle
  g.push(R(-9.8, -8.8, -2.9, -1.9)); // fauteuil
  g.push(R(-13.2, -11.6, -2.95, -2.05)); // table basse
  g.push(R(-9.3, -8.9, -5.7, -5.3)); // lampadaire
  g.push(R(-16.5, -15.9, -9.3, -8.7), R(-16.6, -16.0, 0.4, 1.0), R(-8.5, -7.9, 0.6, 1.2), R(-3.9, -3.3, -0.7, -0.1), R(6.1, 6.7, 0.6, 1.2)); // plantes
  g.push(R(-10.55, -4.75, -9.8, -9.05)); // cuisine : plan de travail
  g.push(R(-11.75, -10.5, -9.8, -9.05)); // frigo
  g.push(R(-9.75, -5.75, -7.2, -5.6)); // îlot
  for (const sx of [-9.0, -8.05, -7.1, -6.15]) g.push(R(sx - 0.22, sx + 0.22, -5.37, -4.93)); // tabourets
  g.push(R(-3.45, 0.45, -4.62, -2.4)); // table + chaises
  g.push(R(4.35, 5.45, -9.7, -9.2)); // console
  g.push(R(6.05, 6.85, -6.85, -5.45)); // banc du hall
  g.push(R(STAIR_HOLE[0] - 0.05, STAIR.xBottom - 0.05, -8.6, -8.45)); // garde-corps de l'escalier
  // terrasse couverte
  g.push(R(-13.0, -10.1, 2.7, 5.1), R(-2.75, 0.55, 3.95, 4.85), R(-3.5, -2.5, 2.6, 3.6), R(0.4, 1.4, 2.6, 3.6), R(-1.8, -0.4, 2.75, 3.65));
  g.push(R(-16.5, -15.9, 2.3, 2.9), R(6.2, 6.8, 4.3, 4.9), R(-5.0, -4.4, 2.25, 2.85));
  // garage
  g.push(R(9.1, 13.9, -7.75, -5.65)); // voiture 1
  g.push(R(8.7, 13.9, -2.35, -0.25)); // voiture 2
  g.push(R(7.15, 7.7, -9.75, -4.95)); // étagères
  g.push(R(7.15, 7.9, -4.85, -3.55)); // établi
  g.push(R(8.05, 8.75, -9.55, -8.85)); // pneus
  g.push(R(12.35, 13.45, -9.75, -9.25)); // coffre
  g.push(R(15.6, 16.05, 0.75, 1.4)); // borne de recharge

  /* ------------------------ étage : enveloppe ------------------------ */
  u.push(R(-14.1, 7.1, -11.1, -10.75)); // mur nord
  u.push(R(-14.1, -13.75, -11.1, 2.06)); // mur ouest
  u.push(R(-14.1, -13.8, 2.0, 5.25)); // écran bois de la loggia
  u.push(R(6.72, 7.05, -11.1, -9.3), R(6.72, 7.05, -6.6, 2.06)); // mur est (baie ouverte entre z = -9,3 et -6,6)
  u.push(R(-14.1, -6.9167, 1.72, 2.06), R(-3.5, 7.05, 1.72, 2.06)); // façade vitrée (baie ouverte entre x = -6,92 et -3,5)
  u.push(R(-14.2, 7.2, 4.95, 5.25), R(7.0, 7.2, 2.0, 5.25)); // garde-corps de la loggia
  u.push(R(16.3, 16.5, -10.4, 2.3), R(7.1, 16.5, -10.3, -9.95), R(7.1, 16.5, 1.95, 2.3)); // garde-corps de la terrasse du garage
  // cloisons
  for (const x of [-6.5, 1.0]) u.push(R(x - 0.09, x + 0.09, -10.8, -5.4), R(x - 0.09, x + 0.09, -4.0, -1.95));
  u.push(R(-10.7, -10.5, -10.8, -7.15)); // salle de bain : cloison est
  u.push(R(-13.8, -12.3, -7.3, -7.12), R(-11.0, -10.5, -7.3, -7.12)); // salle de bain : cloison sud (porte entre x = -12,3 et -11)
  // trémie de l'escalier (garde-corps sur trois côtés, accès libre par l'ouest)
  u.push(R(STAIR_HOLE[0], STAIR_HOLE[1], -9.86, -9.72), R(STAIR_HOLE[0], STAIR_HOLE[1], -8.56, -8.44), R(-0.66, -0.54, -9.86, -8.44));

  /* ------------------------ étage : mobilier ------------------------ */
  u.push(R(-11.75, -7.85, -10.65, -8.15)); // lit parental
  u.push(R(-11.15, -8.45, -7.05, -6.45)); // banquette
  u.push(R(-13.2, -12.2, -4.95, -3.95), R(-12.5, -11.9, -3.7, -3.1), R(-13.4, -13.0, -2.8, -2.4)); // fauteuil, table, lampadaire
  u.push(R(-6.75, -6.25, -10.55, -6.45)); // dressing
  u.push(R(-7.6, -7.0, -1.3, -0.7), R(0.0, 0.5, -1.3, -0.7), R(1.5, 2.1, 0.6, 1.2)); // plantes
  // salle de bain
  u.push(R(-13.6, -11.9, -10.72, -9.85), R(-13.78, -13.2, -9.3, -7.8), R(-11.5, -10.7, -8.95, -8.35), R(-11.78, -10.7, -10.75, -9.62));
  // salon haut
  u.push(R(-5.05, -1.75, -3.1, -2.1), R(-6.4, -5.4, -6.25, -4.15), R(-4.1, -2.7, -5.05, -4.15), R(-5.25, -1.95, -10.75, -10.4));
  // chambre 2
  u.push(R(2.05, 5.75, -10.6, -8.2), R(1.1, 1.6, -9.85, -5.95), R(5.5, 6.3, -4.1, -2.5), R(4.85, 5.55, -3.7, -2.9));
  // loggia
  u.push(R(-12.15, -8.85, 2.5, 3.45), R(-11.1, -9.9, 3.65, 4.25), R(-8.5, -7.5, 3.2, 4.2), R(-13.65, -13.05, 4.1, 4.7), R(6.1, 6.7, 4.1, 4.7));
  // terrasse du garage
  for (const px of [8.3, 14.2]) for (const pz of [-9.4, -4.2]) u.push(R(px - 0.12, px + 0.12, pz - 0.12, pz + 0.12));
  u.push(R(8.85, 12.35, -9.7, -8.7), R(8.4, 9.4, -8.45, -5.95), R(12.2, 13.2, -7.5, -6.5), R(10.25, 11.35, -7.65, -6.55));
  u.push(R(11.7, 12.3, -5.9, -5.3), R(9.3, 9.9, -5.8, -5.2));
  for (let x = 8; x < 16; x += 1.5) u.push(R(x, x + 0.8, 0.95, 1.55));
  u.push(R(9.25, 9.95, -2.45, -0.35), R(10.35, 11.05, -2.45, -0.35));

  /* ------------------------ zones nommées ------------------------ */
  const zones = [
    { level: 0, name: 'Terrasse couverte · vue sur la piscine', ...R(-18, 8, 2.06, 6) },
    { level: 0, name: 'Escalier', ...R(-4.6, 1.3, -9.8, -8.4) },
    { level: 0, name: 'Garage', ...R(7.17, 16.3, -10, 2) },
    { level: 0, name: 'Hall d’entrée', ...R(1.5, 7.17, -10, 2) },
    { level: 0, name: 'Cuisine', ...R(-11.8, -4.7, -10, -4.6) },
    { level: 0, name: 'Salle à manger', ...R(-4.7, 1.5, -10, 2) },
    { level: 0, name: 'Séjour · baies sur la piscine', ...R(-17, -4.7, -10, 2) },
    { level: 1, name: 'Loggia · vue sur la piscine', ...R(-14.2, 7.2, 2.0, 5.3) },
    { level: 1, name: 'Terrasse sur le garage', ...R(7.1, 16.5, -10.4, 2.3) },
    { level: 1, name: 'Salle de bain', ...R(BATH.x0, BATH.x1, BATH.z0, BATH.z1) },
    { level: 1, name: 'Chambre parentale', ...R(-14, -6.5, -11, 2) },
    { level: 1, name: 'Chambre 2', ...R(1.0, 7.1, -11, 2) },
    { level: 1, name: 'Salon de l’étage', ...R(-6.5, 1.0, -11, 2) },
  ];
  const zoneAt = (x, z, level) => {
    for (const zn of zones) if (zn.level === level && x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn.name;
    return '';
  };

  return {
    colliders: [g, u],
    floorAt,
    zoneAt,
    spawn: { x: -7.4, z: -1.0, level: 0 },
    // point de passage extérieur pour l'animation d'entrée (porte-fenêtre ouverte côté piscine)
    approach: [
      { x: -7.4, y: 2.5, z: 11 },
      { x: -7.4, y: 2.0, z: 3.6 },
    ],
    garage: GARAGE,
  };
}
