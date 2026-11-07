# Villa Solène — Sonnet 5.5 · effort xhigh

Scène 3D interactive d'une villa de luxe (piscine, garage, deux voitures), 100 % procédurale :
Three.js 0.160.0 via `importmap` (jsDelivr), aucun modèle ni image externe, textures générées au canvas.
Point d'entrée : `index.html` (servi sur `http://localhost:8080/sonnet-5-5/`).

## Style architectural choisi — « Riviera contemporaine »

Villa moderniste méditerranéenne : volumes blancs superposés, étage en **porte-à-faux de 3 m** au sud qui couvre une
terrasse, toits plats à débord mince, **murs-rideaux** pleine hauteur, bardage bois, parements de pierre, garde-corps en
verre, pergola bois sur le toit du garage. Jardin : palmiers, oliviers, cyprès, haies taillées, massifs d'agaves.

Pourquoi ce style :
- les grandes baies vitrées rendent l'intérieur lisible depuis l'extérieur (meubles, escalier, plafonniers) ;
- il se prête à une géométrie procédurale propre (volumes orthogonaux, détails répétables) tout en restant « luxueux » ;
- il met en valeur la lumière : soleil du sud-est le jour, intérieur et piscine rétro-éclairés la nuit ;
- palmiers + pierre claire + bois chaud donnent un contraste lisible sur la pelouse, quelle que soit l'heure.

Implantation (repère : x est, z sud, y haut ; rue à l'est) : terrain **60 × 44 m** (2 640 m²), villa ≈ **690 m² bâtis**
(rez-de-chaussée 400 m² dont garage, étage 340 m², loggia et terrasses en plus), piscine 15 × 5,6 m avec plage immergée.

## Structure du code (`js/`)

| Fichier | Rôle |
|---|---|
| `main.js` | Renderer, post-traitement (MSAA + bloom nocturne), construction étape par étape, boucle, adaptation des performances |
| `config.js` | Cotes d'implantation (niveaux, emprises, piscine, garage) |
| `utils.js` | Maths, PRNG déterministe, **Batcher** (fusion des primitives par matériau), dalles extrudées |
| `textures.js` | Textures canvas : gazon, bois, pierre, marbre, pavés, mosaïque, palme (alpha), bois d'écorce, champs… |
| `materials.js` | Matériaux PBR partagés, verre à mélange prémultiplié, émissifs de nuit, halos |
| `ambience.js` | Registre des sources « nocturnes » (lumières, émissifs, halos) allumées progressivement selon `tod` |
| `sky.js` | Ciel procédural (dégradés, soleil, lune, étoiles, nuages), cycle jour/nuit, ombres, brouillard, IBL (PMREM) |
| `terrain.js`, `vegetation.js` | Sol, rue, allée en entonnoir, clôtures, portail, collines, champs, plantations instanciées |
| `villa.js` | Gros œuvre : dalles, murs percés, baies vitrées, toiture, terrasses, garde-corps, éclairage d'architecture |
| `interior.js`, `rooms.js` | Mobilier (séjour, cuisine, salle à manger, chambres, terrasses), escalier, salle de bain, évier |
| `pool.js` | Bassin carrelé (caustiques), **eau en shader** (vagues, Fresnel, reflet du ciel, éclats du soleil), transats, parasols |
| `cars.js` | Deux voitures originales : coque lofée par sections, passages de roues, habitacle vitré, jantes, phares/feux |
| `garage.js` | Porte sectionnelle animée (5 panneaux suivant un rail courbe), placement des voitures |
| `camera.js` | OrbitControls bornés (jamais sous l'horizon), 4 vues avec transition en arc, adaptation portrait |
| `ui.js` | Panneau (jour/nuit, garage, vues, rotation), raccourcis clavier, toasts |
| `walkmap.js`, `walk.js`, `walkui.js` | **Visite intérieure** (voir plus bas) |

Principes : une primitive = un appel `Batcher.box/cyl/sphere/plane` en coordonnées monde ; le Batcher fusionne par
matériau → **≈ 350 draw calls, ≈ 385 k triangles**, chargement ≈ 1,2 s. Les éléments animés (porte, voitures, eau, palmes)
restent des objets séparés.

## Éclairage et ambiance

- **Jour** : soleil directionnel (ombres 4096², PCF doux), ciel avec nuages, IBL générée depuis le ciel courant.
- **Nuit** : ciel étoilé + lune, lumière lunaire (la même lumière à ombres change de source), intérieurs allumés,
  piscine éclairée de l'intérieur (spots immergés + carrelage émissif + halos), balises d'allée, spots de terrasse,
  phares des voitures, bloom.
- **Transition animée de 5,5 s** : élévation/azimut du soleil, couleurs du ciel (coucher orange puis heure bleue),
  intensités. Les sources s'allument avec des seuils décalés (jardin → intérieur → piscine → phares).
- Nombre de lumières constant (pas de recompilation de shaders), ombres recalculées uniquement quand la scène change.

## Ce qui a été priorisé

1. Conformité stricte au cahier des charges (terrain, 2 niveaux, baies, piscine animée, garage animé, 2 voitures, jour/nuit,
   UI complète, badge, OrbitControls bornés, responsive 375 px).
2. Qualité visuelle : éclairage physique, ombres, verre réaliste (reflets additifs), eau en shader, bloom de nuit.
3. Détail crédible : intérieur visible à travers les vitres, voitures avec jantes/étriers/intérieur, vie du jardin.
4. Performance : fusion de géométries, instanciation, ombres à la demande, **résolution adaptative** (le ratio de pixels
   baisse tout seul sous 40 fps et remonte au-dessus de 58), `prefers-reduced-motion` respecté.

## Visite intérieure (avenant n°1)

Bouton **« Visiter l'intérieur »** (touche `V`) dans le panneau ; il devient **« Vue extérieure »** (ou `Échap`).

- **Entrée** : vol fluide de la caméra (trajectoire en spline, ~4 s) qui passe par la baie coulissante ouverte côté piscine
  jusqu'au séjour, puis un demi-tour de 1,5 s pour découvrir la piscine à travers les vitres. Sortie : la caméra
  orbitale reprend à l'endroit où l'on se trouve et rejoint la vue Façade.
- **Première personne** : yeux à **1,65 m**, champ de 68°, léger balancement de marche. Le panneau reste actif :
  **jour/nuit et garage fonctionnent pendant la visite** (les vues orbitales / la rotation terminent la visite).
- **Clavier** : `Z Q S D`, `W A S D` (lecture par `event.code`, valable AZERTY et QWERTY) et `↑ ↓` pour avancer/reculer/
  glisser, `← →` pour tourner, `Maj` pour courir, `C` pour capturer la souris (Pointer Lock), `H` pour l'aide.
- **Souris** : clic-glisser pour regarder (fonctionne partout, sans capture) ; capture du pointeur optionnelle.
- **Tactile** : joystick virtuel à gauche (à fond = course), glisser n'importe où ailleurs pour regarder, bouton
  « Vue extérieure » en haut ; le panneau se replie automatiquement sur mobile pendant la visite.
- **Collisions** (`walkmap.js` / `walk.js`) : le visiteur est un cercle de 0,26 m ; murs, cloisons, **vitres**
  (sauf les baies ouvertes), garde-corps, trémie d'escalier et **gros meubles** sont des rectangles 2D par niveau ;
  déplacement par sous-pas de ≤ 8 cm (pas de traversée même à bas FPS), résolution cercle/rectangle itérative.
- **Escalier** : la hauteur du sol est calculée marche par marche (20 marches de 17,5 cm) et lissée : la caméra monte
  réellement l'escalier ; le niveau (rez-de-chaussée/étage) bascule avec la hauteur, la trémie est protégée sur trois côtés.
- **Pièces visitables** : séjour (canapés, cheminée, bibliothèque), cuisine (îlot, tabourets, évier), salle à manger,
  hall, **garage avec les deux voitures**, terrasse couverte sur la piscine, escalier, étage : chambre parentale,
  **salle de bain** (baignoire îlot, double vasque + miroir rétro-éclairé, douche vitrée, WC), salon, chambre 2,
  **loggia** et **terrasse du garage** (pergola, salon d'extérieur) — toutes avec vue sur la piscine ou le jardin.
- **Aide à l'écran** : carte des commandes à l'entrée (14 s) puis bouton « ? », étiquette de pièce à chaque changement.

## Limites connues

- La visite reste dans la maison et ses deux terrasses ; les jardins, la piscine et le garage-extérieur ne sont pas
  accessibles à pied (limite invisible au bord des marches de la terrasse, porte de garage toujours condamnée).
- Collisions 2D (rectangles alignés sur les axes) : les meubles tournés sont approximés par leur boîte englobante.
- Les voitures sont des maquettes lofées : pas de joints de portes complexes, optiques simplifiées, pas de rétroviseurs articulés.
- Le verre est réaliste en reflets mais sans réfraction ; les ombres de l'intérieur dépendent de la résolution de la
  shadow map (4096², réduite à 2048² si la machine peine).
- L'eau n'est pas réfractive (le fond est visible par transparence) ; pas de mousse ni d'éclaboussures.
- Mesures faites sur un portable Apple M1 Pro dans un navigateur **partagé avec d'autres scènes 3D en parallèle** : 30 à 48 fps
  constatés (la résolution adaptative a ramené le ratio de pixels à 1,25–1,75) ; l'objectif de 50 fps n'a donc pas pu être
  confirmé de façon fiable, il devrait être atteint sur une machine dédiée (le coût de rendu est borné par la résolution adaptative).
- `window.villa` expose une poignée de débogage (renderer, scène, caméra, visite) utilisée pour les tests.

## Commandes (rappel)

Souris : orbite / molette (zoom) / clic droit (déplacer) · `J` jour · `N` nuit · `G` garage · `R` rotation ·
`1`–`4` vues · `V` visite · en visite : `ZQSD/WASD/flèches`, `Maj`, `C`, `H`, `Échap`.
