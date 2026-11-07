# Villa Horizon — notes de conception

Badge : **Fable 5.1 · effort high**. Point d'entrée : `index.html` (Three.js 0.160.0 via importmap, aucun build).

## Style choisi et pourquoi

**Villa contemporaine méditerranéenne à toits plats** (volumes blancs enduits, bardage bois sombre sur le volume d'entrée, garage en bardage anthracite, grandes baies toute hauteur à meneaux aluminium, étage en porte-à-faux côté piscine, terrasse sur le toit du rez-de-chaussée avec garde-corps vitré).

Raisons :
- Les volumes orthogonaux, les toits plats et les baies vitrées sont exactement ce que la géométrie procédurale (boîtes, dalles extrudées) rend le mieux : on obtient une architecture crédible sans modèle externe.
- Le contraste blanc / bois / anthracite et la paroi vitrée continue donnent immédiatement le « code » villa de luxe, et le verre transparent laisse lire l'intérieur (exigence du cahier des charges).
- Le porte-à-faux crée une terrasse couverte vers la piscine et une ombre portée forte qui met en valeur les ombres temps réel.
- Palmiers, cyprès, oliviers, travertin et haies complètent l'ambiance méditerranéenne cohérente avec une piscine extérieure.

## Structure du code

```
index.html          importmap, panneau UI, badge, loader
css/style.css       panneau en surimpression (verre dépoli), responsive ≤ 480 px
js/main.js          renderer, caméra/OrbitControls, assemblage, UI, boucle
js/registry.js      registre partagé : lumières/émissifs de nuit, matériaux env, updaters
js/utils.js         RNG déterministe, UV en unités monde, Merger (fusion de géométries)
js/textures.js      textures canvas 100 % procédurales (pelouse, travertin, bois, pavés…)
js/materials.js     matériaux partagés (textures en unités monde : repeat = 1 / tuile)
js/sky.js           dôme ciel (shader dégradé + soleil + lune), étoiles, PMREM jour/nuit
js/lighting.js      soleil/lune directionnel avec ombres, hémisphère, brouillard, cycle k∈[0,1]
js/terrain.js       pelouse (trou sous le bassin), rue, allée pavée, cheminement, clôture, portail, bornes
js/vegetation.js    palmiers (palmes à alphaTest), cyprès (lathe), oliviers, haies, buissons
js/villa.js         villa 2 niveaux (murs avec ouvertures, vitrages, dalles, escalier, mobilier), garage, porte sectionnelle
js/pool.js          plage travertin, bassin carrelé, margelle, eau (ShaderMaterial), transats, parasol, lumières
js/cars.js          2 voitures (profil extrudé + bevel, roues à jantes, phares, feux, projecteur)
js/cameraViews.js   4 vues prédéfinies, tween caméra/cible, bornes (pas sous le sol)
js/walk.js          visite intérieure 1re personne (regard, clavier, collisions, escalier, transitions)
js/touch.js         joystick virtuel + bouton « Courir » (tactile)
```

Principes :
- **Merger** : toutes les pièces statiques d'un même matériau sont fusionnées en un seul Mesh (clôture, meubles, palmes…). ~200 draw calls pour ~50 k triangles.
- **UV en unités monde** : chaque boîte reçoit des UV à l'échelle réelle, une texture = une taille de tuile ; aucune texture n'est étirée.
- **Registre jour/nuit** : les modules s'inscrivent (`nightLight`, `nightEmissive`, `R.updaters`) ; `lighting.js` applique un seul paramètre `k` lissé (smoothstep) à tout : soleil → lune, ciel, brouillard, exposition, lumières intérieures, piscine, allée, phares, émissifs, intensité de l'environnement (PMREM jour/nuit).
- **Porte de garage** : 5 panneaux suivent un chemin vertical → quart de cercle → horizontal (vraie cinématique de porte sectionnelle), animée avec easing.
- **Eau** : vagues (3 sinusoïdes avec normales analytiques), pattern de caustiques, fresnel vers la couleur du ciel, spéculaire solaire, teinte lumineuse de nuit ; brouillard et tone mapping intégrés au shader.

## Priorités

1. Conformité stricte : terrain 64 × 48 m, villa ~370 m² sur 2 niveaux (RDC 18 × 12, étage 17 × 9, garage 10 × 8), piscine 10 × 4,5 m avec eau animée, 3 transats + parasol, 2 voitures distinctes, 4 vues, rotation auto, jour/nuit animé, badge.
2. Lisibilité visuelle de jour (ombres douces PCF 2048, ACES, ciel procédural) et de nuit (intérieurs allumés, piscine éclairée de l'intérieur, allée, phares avec faisceaux réels).
3. Performance : ~12 lumières au total, 1 seule ombre portée (soleil/lune), géométries fusionnées, pixelRatio plafonné à 1,75. Mesuré 60–120 fps en 1280 × 800 @2x sur Mac portable.
4. UX : transitions caméra en ease-in-out avec léger arc, panneau repliable, raccourcis clavier (N, G, R, 1–4), états `aria-pressed`, utilisable à 375 px.

## Visite intérieure (avenant n°1)

- **Entrée / sortie** : bouton « Visiter l'intérieur » (raccourci V) → transition fluide (1,6 s, ease-in-out) de la caméra orbitale vers l'œil du visiteur dans le séjour (1,65 m), regard vers la baie et la piscine. Sortie par le même bouton devenu « Vue extérieure », par Échap, par un bouton tactile dédié, ou en choisissant une vue / la rotation : la caméra revole vers la dernière vue prédéfinie, la cible d'orbite étant initialisée sur le point regardé pour éviter tout à-coup.
- **Commandes desktop** : codes physiques `KeyW/A/S/D` + flèches — ZQSD sur AZERTY et WASD sur QWERTY fonctionnent sans détection de clavier ; Maj = course (4,6 m/s au lieu de 2,3). Regard par **Pointer Lock** (demandé à la fin de la transition et au clic) avec repli automatique « glisser pour regarder » si le verrouillage est refusé (iframe, navigateur embarqué). Sortir du verrouillage avec Échap termine la visite.
- **Tactile** : joystick virtuel (bas gauche, Pointer Events avec capture), bouton « Courir », glisser sur la scène pour regarder, bouton « Vue extérieure » en haut à droite ; le panneau se replie automatiquement sous 480 px pour dégager la vue.
- **Collisions** : le `Merger` enregistre chaque boîte non tournée qu'il fusionne (murs, vitres, meneaux, meubles) comme AABB dans `VILLA_COLLIDERS` (~300 boîtes) ; les voitures ajoutent les leurs. Le visiteur est un cylindre de rayon 0,28 m testé entre pieds + 0,2 m et pieds + 1,7 m, résolu axe par axe (glissement le long des murs). Les objets bas (tapis) sont enjambés, les tables basses bloquent. Des AABB manuelles ferment la trémie, le flanc ouvert de l'escalier et la porte du garage (on ne sort pas de la maison).
- **Escalier** : les marches ne sont pas des colliders ; `floorHeight(x, z, feet)` renvoie une rampe linéaire 0,15 → 3,95 m sur l'emprise de l'escalier, puis le plancher de l'étage (3,96) ou du RDC (0,16) / du garage (0,06). La hauteur des pieds est lissée (10/s) et un léger balancement de tête accompagne la marche. Une porte de service relie le séjour au garage pour voir les voitures de près.
- **Pièces** : séjour (canapé en L, table basse, bibliothèque, meuble TV, lampadaire), salle à manger, cuisine (linéaire, îlot, tabourets, hotte, réfrigérateur), hall, chambre (lit, chevets et lampes, dressing, banc), salle de bain (baignoire, vasque, miroir, WC, douche vitrée), bureau/salon TV à l'étage, tableaux. De nuit, les 5 points lumineux intérieurs et les luminaires émissifs sont actifs ; la piscine éclairée est visible à travers la baie est.
- **Aide** : bandeau en bas de l'écran rappelant les commandes (variante clavier/souris ou tactile selon `pointer: coarse`).

## Limites connues

- Le verre est un verre « simple » (transparence + réflexions d'environnement), sans transmission/réfraction physique, pour rester > 50 fps.
- Les réflexions d'environnement basculent entre deux PMREM (jour / nuit) à mi-transition plutôt que d'être interpolées ; le changement est masqué par la baisse d'intensité.
- Les voitures sont stylisées (profils extrudés) : pas d'intérieur détaillé ni de portières ouvrantes.
- Les lumières ponctuelles ne projettent pas d'ombres (coût), seule la source directionnelle le fait ; les faisceaux de phares traversent donc les volumes.
- L'eau n'a pas de vraie réflexion planaire de la villa (couleur du ciel par fresnel uniquement).
- Les ombres de la source directionnelle couvrent ±40 m autour de l'origine ; au-delà (route lointaine) il n'y a pas d'ombre.
- Visite : collisions en AABB alignées (pas de capsule contre des parois obliques) ; l'escalier est une rampe lissée plutôt qu'une marche discrète par marche ; la terrasse du toit et l'extérieur ne sont pas accessibles à pied (vitres infranchissables, porte d'entrée fermée) ; pas de porte animée ni d'ouverture des meubles.
