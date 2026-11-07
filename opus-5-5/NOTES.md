# Villa Azur — notes de conception

Scène Three.js 0.160.0 (import map + CDN jsDelivr, sans build), 100 % procédurale : aucune
image ni aucun modèle externe. Toutes les textures sont dessinées dans des `<canvas>`.

## Style choisi : villa contemporaine méditerranéenne (Côte d'Azur)

Deux volumes blancs superposés et décalés : un rez-de-chaussée sur socle de travertin, et un
étage en porte-à-faux habillé de bardage cèdre à claire-voie, sous une toiture plate débordante.

Pourquoi ce style :
- **Il va avec le programme.** Piscine, plage minérale, palmiers, oliviers et cyprès forment un
  ensemble cohérent. Le contraste enduit blanc / travertin / bois chaud est typique du luxe
  azuréen actuel.
- **Il sert la lisibilité 3D.** Les baies toute hauteur laissent voir l'intérieur, comme le
  demande le cahier des charges. Le porte-à-faux abrite la terrasse et crée de belles ombres
  portées. Les grands aplats blancs mettent en valeur le cycle jour / nuit (couchant orangé,
  lumière chaude des intérieurs la nuit).
- **Il se construit bien en procédural** : des boîtes, des dalles et des vitrages bien
  proportionnés suffisent à rendre crédible une architecture moderniste, là où un style
  néo-provençal demanderait tuiles, génoises et moulures.

Surfaces : rez-de-chaussée 200 m², étage 220 m² (hors toit-terrasse de 40 m² et garage de
80 m²), soit environ 420 m² habitables. Parcelle de 60 × 46 m.

## Structure du code

```
index.html               import map, panneau UI, HUD de visite, badge
css/style.css            interface en verre dépoli, responsive (panneau en bas < 640 px)
js/main.js               rendu, post-traitement, boucle, résolution adaptative, câblage UI
js/config.js             plan de masse : toutes les cotes en un seul endroit
js/utils.js              Batcher (fusion des géométries par matériau), bruit, easing
js/texture-kit.js        outils canvas (motifs raccordables)
js/textures.js           pavés, travertin, enduit, bois, mosaïque, caustiques, marbre…
js/textures-nature.js    pelouse, palmes, feuillages, écorce
js/materials.js          bibliothèque de matériaux ; registre des émissifs « nuit »
js/sky.js                shader de ciel (dégradé, soleil, couchant, étoiles, lune)
js/atmosphere.js         cycle jour/nuit animé : soleil, lune, brouillard, exposition,
                         bloom, carte d'environnement PMREM régénérée pendant la transition
js/site.js               terrain, rue, allée pavée, murets, portails, bornes lumineuses
js/vegetation.js         palmiers, oliviers, cyprès, haies, lavandes, buis (instanciés)
js/villa.js              façades paramétriques (segments plein / vitrage / porte), dalles,
                         toiture, toit-terrasse, garde-corps, appliques
js/furniture.js          mobilier réutilisable (canapé, lit, chaise longue, parasol, tableaux…)
js/interior.js           rez-de-chaussée meublé + escalier suspendu + lumières intérieures
js/upstairs.js           étage : suite parentale, salle de bain, salon, chambre d'amis
js/pool.js               bassin, shader d'eau, caustiques animées, plage, transats, parasols
js/garage.js             garage double, porte sectionnelle animée sur rails
js/cars.js               coupé GT et SUV (profils extrudés, jantes, feux, intérieur)
js/colliders.js          registre des volumes infranchissables pour la visite
js/tour.js               visite à la 1re personne (déplacements, collisions, escalier)
js/camera.js             vues prédéfinies et transitions orbitales fluides
js/ui.js                 boutons, raccourcis clavier, HUD
```

Choix techniques notables :
- **Batcher** : chaque module empile ses boîtes, cylindres et extrusions, puis les fusionne par
  matériau, ce qui donne environ 190 appels de rendu pour toute la scène. Les UV sont exprimées
  en mètres, donc les textures ont la même échelle partout.
- **Façades paramétriques** : une façade est décrite par une liste de segments
  (`w` plein, `g` vitrage avec allège, imposte et montants, `d` porte). Le même code produit les
  menuiseries, le doublage intérieur et la boîte de collision.
- **Cycle jour/nuit** : une palette d'images clés (zénith, horizon, soleil, exposition)
  interpolée sur 4,2 s. Le soleil se couche réellement vers l'ouest et teinte le ciel. Les
  lumières intérieures s'allument progressivement au crépuscule.
- **Eau** : `ShaderMaterial` avec houle procédurale (somme de sinus et texture de caustiques),
  normale par différences finies, effet Fresnel sur la couleur du ciel, reflet spéculaire du
  soleil, lueur turquoise la nuit. Un second shader projette des caustiques animées sur le
  fond du bassin.
- **Ombres** : la carte d'ombre (2048², PCF doux) n'est recalculée que si le soleil bouge ou si
  la porte du garage s'anime (`shadow.autoUpdate = false`).
- **Performance** : bloom en demi-résolution, MSAA ×4 sur la cible HDR, aucune ombre pour les
  lumières ponctuelles, végétation instanciée. La résolution baisse automatiquement sous
  50 fps et remonte quand la marge revient (avec hystérésis anti-oscillation).
  Mesure sur la machine de test, viewport 1280 × 800 : environ 10 ms par image à ×1,5 et
  12 ms à ×1,75.

## Ce qui a été priorisé

1. Conformité stricte au cahier des charges : chaque élément obligatoire est présent et
   fonctionnel. Cela couvre les 2 niveaux, les baies transparentes, l'intérieur meublé et
   l'escalier, la piscine animée avec margelle, plage, 5 transats et 2 parasols, le garage
   2 places avec porte animée et les 2 voitures différentes. Le mode nuit inclut les intérieurs
   éclairés, la piscine éclairée, l'allée, le jardin et les phares. On trouve aussi les 4 vues,
   la rotation, le badge et l'orbite bornée.
2. L'ambiance lumineuse : le ciel, le couchant pendant la transition, le bloom des sources la
   nuit, les flaques de lumière au sol et les lavages muraux des appliques.
3. Une architecture crédible : socle, porte-à-faux, débords de toiture, doublages intérieurs,
   jardinière filante et toit-terrasse.
4. L'UX : les transitions de caméra contournent la villa au lieu de la traverser. Le panneau
   donne un retour d'état, propose des raccourcis clavier et se replie sur mobile.

## Visite intérieure (avenant n° 1)

- Le bouton **« Visiter l'intérieur »** (ou la touche `V`) déclenche une entrée animée. La
  caméra part de la vue courante, passe par l'allée devant la porte d'entrée et finit dans
  l'entrée, à 1,65 m de hauteur, regard vers la piscine. Le champ de vision s'élargit à 68°.
- On sort avec **« Vue extérieure »** (panneau ou HUD) ou **Échap** : animation inverse vers la
  vue orbitale précédente. Cliquer une vue prédéfinie pendant la visite sort directement vers
  cette vue.
- **Desktop** : `ZQSD`, `WASD` et les flèches pour marcher (codes physiques et caractères sont
  tous deux reconnus, donc AZERTY et QWERTY fonctionnent), `Maj` pour courir. On regarde en
  glissant la souris. Un double-clic verrouille le pointeur (Pointer Lock) ; le premier Échap
  le libère, le suivant quitte la visite.
- **Mobile / tactile** : un joystick virtuel en bas à gauche sert à se déplacer, glisser
  ailleurs sur l'écran sert à regarder. Le panneau se replie automatiquement.
- **Collisions** : le joueur est un cercle de 28 cm, testé contre des boîtes XZ avec plage de
  hauteur (`colliders.js`). Elles sont générées automatiquement par les façades (murs, vitres,
  porte), les cloisons et les garde-corps, et déclarées pour le gros mobilier (canapés, lits,
  tables, îlot, colonnes, baignoire, vasques, paroi de douche, dressing…). La résolution se fait
  en sous-pas de 10 cm, ce qui empêche de traverser quoi que ce soit, même en courant.
- **Escalier** : la hauteur des pieds suit une rampe calée sur les 18 marches, avec un lissage
  et un léger balancement de la marche. Au RDC, on ne peut aborder l'escalier que par sa
  première marche (des butées invisibles empêchent de passer dessous). À l'étage, la trémie est
  protégée par des garde-corps vitrés. En complément, le HUD propose deux points de
  téléportation clairement nommés (« Rez-de-chaussée », « Étage ») avec un fondu.
- **Pièces** : séjour (cheminée linéaire, tableau, canapé, fauteuils), salle à manger
  (suspensions laiton), cuisine (îlot marbre avec plaque et hotte, colonnes, évier sous fenêtre),
  suite parentale (lit, chevets, dressing, banc), salle de bain (douche à l'italienne, baignoire
  îlot, double vasque, miroir rétroéclairé, WC suspendu), salon d'étage avec bibliothèque et
  chambre d'amis avec bureau. Le séjour et le salon d'étage ont une vue directe sur la piscine.
  Le nom de la pièce courante s'affiche dans le HUD.
- Le mode nuit, le garage, les vues et la rotation restent pilotables pendant la visite
  (panneau ou touches `N`, `G`, `1`–`4`, `R`).

## Limites connues

- Le verre est simulé par transparence et reflet de l'environnement, sans réfraction ni miroir
  plan. L'eau reflète le ciel mais pas la villa.
- Les lumières ponctuelles ne projettent pas d'ombres, pour la performance : la lumière
  intérieure peut « traverser » une cloison.
- Les voitures sont stylisées (profils extrudés) : pas de portes ouvrantes ni de ligne de
  carrosserie fine.
- La visite est limitée à l'intérieur de la maison : la terrasse, le toit-terrasse et le garage
  ne sont pas accessibles à pied. Les portes intérieures sont de simples baies.
- Les collisions sont 2D (cercle contre boîtes alignées) : pas de saut, et on ne peut pas
  s'accroupir sous une table.
- Avec le pointeur verrouillé, le premier Échap est consommé par le navigateur pour libérer la
  souris. Il faut un second Échap pour sortir (sans verrouillage, un seul Échap suffit).
- Three.js et ses modules complémentaires sont chargés depuis le CDN jsDelivr : la scène
  demande une connexion au premier chargement.
