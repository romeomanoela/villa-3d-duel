# Cahier des charges : Villa de luxe en 3D

Spécification commune et identique pour les trois modèles comparés :

| Modèle | Effort | Dossier |
|---|---|---|
| Sonnet 5.5 | xhigh (Extra) | `sonnet-5-5/` |
| Opus 5.5 | xhigh (Extra) | `opus-5-5/` |
| Fable 5.1 | high (Élevé) | `fable-5-1/` |

## Objectif
Une scène 3D interactive d'une villa de luxe avec piscine et voitures dans le garage, navigable dans le navigateur.

## Technique
- Three.js `0.160.0` via `<script type="importmap">` sur `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`, et `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/` pour OrbitControls et les addons. Pas de build, pas de npm.
- Géométrie 100 % procédurale : aucun modèle 3D ni image externe (les textures générées par canvas sont autorisées).
- Tous les fichiers dans le dossier du modèle ; point d'entrée `index.html`.
- 0 erreur console, au moins 50 fps sur un portable récent, ombres activées, responsive (le panneau UI reste utilisable à 375 px de large).

## Contenu de la scène (obligatoire)
1. **Terrain** d'au moins 40 × 30 m : pelouse, allée carrossable menant au garage, végétation (arbres, haies ou palmiers selon le style), clôture ou murets.
2. **Villa** : au moins 2 niveaux, de l'ordre de 300 m² ou plus, grandes baies vitrées (verre transparent), terrasse(s). L'intérieur doit se deviner à travers les vitres : sols, quelques meubles simplifiés, escalier.
3. **Piscine** : bassin avec eau animée (vagues ou reflets procéduraux), margelle, plage, au moins 2 transats et un parasol.
4. **Garage** : au moins 2 places, porte qui s'ouvre et se ferme avec une animation, **au moins 2 voitures de luxe différentes** (carrosserie, 4 roues avec jantes, vitres, phares et feux). Designs originaux, **aucun logo ni nom de marque réelle**.
5. **Style architectural libre** : le modèle choisit et justifie son choix dans `NOTES.md`.

## Éclairage et ambiance
- Mode **Jour** : soleil directionnel avec ombres, ciel.
- Mode **Nuit** : ciel sombre, lumières intérieures allumées, piscine éclairée de l'intérieur, éclairage extérieur (allée, jardin), phares des voitures allumés.
- Transition animée entre les deux modes (pas de coupure brutale).

## Interface (panneau en surimpression)
- Boutons : Jour / Nuit · Ouvrir / Fermer le garage · Vues prédéfinies (Façade, Piscine, Garage, Aérienne) avec transition de caméra fluide · Rotation automatique on/off.
- Caméra orbitale (OrbitControls) bornée : pas de passage sous le sol.
- Badge discret avec le nom du modèle et l'effort (ex. « Opus 5.5 · effort xhigh »).

## Avenant n°1 : visite intérieure (ajouté en cours de projet, le même pour les 3 modèles)
- Bouton **« Visiter l'intérieur »** dans le panneau ; on revient en vue orbitale avec un bouton **« Vue extérieure »** (ou Échap).
- Visite à la **1re personne**, caméra à hauteur d'yeux (≈ 1,65 m), avec une transition fluide pour entrer.
- **Desktop** : ZQSD **et** WASD (+ flèches) pour se déplacer, souris pour regarder (PointerLockControls ou équivalent), Maj pour courir.
- **Mobile / tactile** : joystick virtuel ou boutons à l'écran pour avancer et tourner, et glisser pour regarder.
- **Collisions** avec les murs, les vitres et les gros meubles : on ne traverse rien.
- **Accès à l'étage par l'escalier** : la caméra suit la hauteur des marches. À défaut, on accepte des points de téléportation clairement indiqués.
- Les pièces doivent valoir le détour : meubles crédibles (salon, cuisine, chambre, salle de bain au minimum), lumières intérieures actives de nuit, et une vue sur la piscine depuis l'intérieur.
- Une aide à l'écran rappelle les commandes. Toutes les fonctions précédentes (jour/nuit, garage, vues, rotation) continuent de fonctionner.

## `NOTES.md` à fournir
Style choisi et pourquoi, structure du code, ce qui a été priorisé, limites connues.

## Interdits
Lire ou modifier un autre dossier que le sien ; toucher à `index.html` à la racine ou à ce cahier des charges.

## Grille d'évaluation (sur 100)
| Critère | Points |
|---|---|
| Conformité au cahier des charges | 30 |
| Qualité visuelle et esthétique d'ensemble | 25 |
| Réalisme et niveau de détail (villa, voitures, piscine) | 15 |
| Interactivité et UX (toggles, transitions, vues) | 15 |
| Qualité et lisibilité du code | 10 |
| Performance, 0 erreur console | 5 |

Mesures relevées en plus : durée de génération, tokens consommés, lignes de code, poids des fichiers.
