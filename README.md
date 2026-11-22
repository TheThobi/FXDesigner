# FX Designer

Générateur de textures d'effets procédurales dans le navigateur (WebGL2), inspiré de
[EffectTextureMaker](https://mebiusbox.github.io/contents/EffectTextureMaker/), avec en plus une
simulation de **réaction-diffusion** (modèle Gray-Scott, d'après
[Karl Sims](https://www.karlsims.com/rd.html)).

100 % statique côté serveur : tout le calcul est fait par le GPU du client.

## Fonctionnalités

- **Système nodal dans le viewport** : chaque générateur est une node qui affiche sa texture en
  direct ; on relie la sortie d'une node (à droite) aux entrées d'une autre (à gauche).
- **Opérateurs** (onglet dédié du navigateur, à la Substance Designer) : Blend (modes, opacité,
  masque), Mask, Levels & Math, Transform 2D, Warp, Blur (gaussien multi-niveaux, échantillonnage
  adapté au rayon : lisse à toute taille), Slope Blur, **Distance** (champ de distance exact par jump flooding :
  extérieur, biseau, signé, propagation des couleurs d'une source), Edge Detect, **Unpack
  RGBA** (une sortie par canal), Pack RGBA et **Custom Code** (GLSL). **Opérateurs
  d'animation** (ce que Substance ne fait pas) : Hue Shift, **Color Cycle** (cycle de palette
  dans la rampe de la node), Flicker (bougie, respiration, stroboscope), Scroll (défilement,
  ondulation) et **Dissolve** (disparition à travers un motif avec bord brûlant). Les anciens documents
  sont convertis automatiquement. Chaque
  node a son propre post-traitement (masquable avec l'œil) et sa propre rampe. Double-clic ou
  glisser-déposer depuis le navigateur pour créer une node ; clic pour changer le générateur
  de la node sélectionnée ; `Suppr` supprime, `Ctrl+D` duplique. **Sélection multiple** :
  rectangle de sélection en glissant sur le fond, `Shift`+clic pour ajouter / retirer ; les
  nodes sélectionnées se déplacent ensemble. Les liens (tracés à angles droits arrondis) se
  tirent depuis une sortie ou depuis une entrée ; relâchés dans le vide, ils ouvrent un petit
  menu (nodes les plus utilisées + recherche) qui crée la node déjà branchée. Un clic sur un
  lien le sélectionne, `Suppr` le supprime. Les pins et les liens sont colorés selon le type
  de valeur (niveaux de gris ou couleur, détecté automatiquement sur chaque node) : un lien qui
  envoie de la couleur dans une entrée à un seul canal (masque, motif…) est tracé en dégradé.
  Les nodes s'alignent sur la grille du fond (`Ctrl` pendant le déplacement : libre), la node
  sélectionnée passe devant les autres, et la flèche de l'en-tête replie une node (en-tête et
  entrées seulement). Le flocon fige une node (freeze frame) pendant que les autres
  continuent ; la baguette active / contourne son post-traitement.
- **Bibliothèque de systèmes** (bouton Library) : plusieurs graphes séparés plutôt qu'un seul
  graphe géant ; chacun est sauvegardé automatiquement dans le navigateur (vignette, date),
  et peut être renommé (clic sur son nom dans la barre), dupliqué ou supprimé. Ouvrir un
  fichier `.json` l'ajoute à la bibliothèque ; **File → Save / Open library** enregistre ou
  importe toute la bibliothèque en un fichier. Le menu **File** regroupe aussi nouveau,
  ouvrir, enregistrer, annuler et rétablir. Les systèmes se rangent dans des **dossiers**
  (glisser une carte sur un dossier).
- **Comptes** (déploiement avec serveur) : inscription avec pseudo, email et mot de passe, ou
  connexion **Discord** ; la bibliothèque (systèmes et dossiers) est sauvegardée sur le compte
  et synchronisée entre les appareils.
- **Code GLSL de chaque node** : le bouton Code de la page Generator affiche le shader de la
  node (paramètres = uniforms, liste des fonctions disponibles). Le modifier transforme la
  node en node custom (« · custom » dans son titre) ; Revert revient au générateur. Le
  générateur **Custom Shader** part d'un modèle avec quatre curseurs et une couleur.
- **Format de l'espace de travail** : carré, large (2:1, 3:1) ou haut (1:2, 1:3) — utile pour
  une fumée qui monte ; les motifs se répètent sur le côté long, les effets centrés gardent
  leurs proportions.
- **12 simulations GPU** interactives : réaction-diffusion (Karl Sims), Physarum (entrée **Food** : le réseau pousse vers une image ; jusqu'à 3 espèces rivales en
  RGB), réaction-diffusion avec **carte f/k** depuis n'importe quelle node, marbrure
  d'encre, automate cyclique, spirales BZ, **Lenia**, **fluide d'encre** (stable fluids),
  **caustiques d'eau simulées** (vagues, pluie, réfraction réelle de la lumière, dispersion),
  **fumée & feu** façon FluidNinja (émetteurs, flottabilité, vorticité, entrées Emitter / Flow,
  émetteur en orbite pour des traînées, sortie densité + alpha ou motion vectors), **Paint
  Mask** (on peint un masque qui reste, à brancher par exemple dans l'émetteur de la fumée),
  **croissance cristalline** (DLA / dielectric breakdown), **automates Life** (Conway, Brian's
  Brain, Star Wars, Larger than Life…) et un **peintre de flowmap** (on peint des directions à
  la souris ; aperçu d'une surface d'eau qui boucle, comparable via une barre déplaçable ;
  export RG).
- **Bruits & matières** — bruits : fractal (bases Perlin / Value / Simplex / Worley / Perlin-Worley ; fBm,
  turbulence, ridged), cellulaire (bordures d'épaisseur uniforme), domain warp, caustiques,
  Gabor, flow strokes, veines (marbre, bois, agate), éclaboussures, **Anisotropic Noise**
  (stries, bois, pluie) ; matières : **Creased** (feuille froissée), **Crystal** (éclats de
  cristal superposés), facettes, fissures de lave, briques, **Weave**, métal brossé, rayures,
  verre brisé.
- **Effets**, rangés par usage : **Feu & fumée** (flamme, boule de feu, fumée, flamme d'âme,
  flammes à crochets, nuage stylisé, braises), **Lumière & magie** (glow, flare, anneau,
  rayons, laser, éclairs, bouclier hexagonal, aura, scintillements, cercle magique, runes,
  vortex, orbe), **Impacts & mouvement** (slash, lignes de vitesse, comic burst, smear frames,
  onde de choc, impact au sol, éclats), **Eau** (caustiques, ripples, eau stylisée, bulles) et
  **sprites de particules** (ripple, flamme, étincelle(s), traînée, volute, éclaboussure,
  feuille).
- **Formes & motifs** : dégradés, damiers, polygones, **Truchet**, **kaléidoscope**,
  **motifs géométriques** (chevrons, seigaiha, triangles, grilles de formes, points en dégradé,
  labyrinthe, tressage, carrés concentriques), **masques doux**, **hachures** (traits de
  crayon), **taches** (léopard, guépard, camouflage, spores), Image et Paint Mask.
- **Post-traitement en modules** activables, dans l'ordre du pipeline : niveaux, **slope blur**
  (lissage pictural comme dans Substance Designer), **Kuwahara** (aplats façon peinture à
  l'huile), **étalonnage** (saturation, teinte, température, ombres colorées), éclairage de
  relief, **aquarelle** (bords mouillés, granulation), postérisation/tramage, halftone,
  pixelisation (« pixel art » ou image finale, export à la résolution des blocs), **grain de
  papier / toile**, contours, **anti-aliasing SSAA**. Icônes et résumé d'état par module,
  **presets de look** (huile, aquarelle, gouache, pixel art…), propres à chaque node.
- **Mes presets** : enregistrer les réglages d'une node comme preset personnel, puis
  l'appliquer, le renommer ou le supprimer (stockés dans le navigateur).
- **Node Image** : importer (ou glisser-déposer) une image et l'utiliser comme les autres nodes
  (graine de la réaction-diffusion ou de la marbrure, émetteur de la fumée, opérateurs…), avec
  cadrage, répétition et canal.
- **Presets en galerie** : les presets du générateur et les looks du post-traitement
  s'affichent en vignettes rendues sur la node elle-même (avec ses entrées et sa rampe) ;
  survoler une vignette prévisualise le résultat en direct sur la node, cliquer l'applique.
  Un preset de générateur ne change que les réglages du générateur, un look que le
  post-traitement. Les vignettes du navigateur montrent le preset le plus représentatif.
- **Valeurs au-delà des curseurs** : en tapant une valeur on peut dépasser la plage du
  curseur (jusqu'à 4× pour les décimaux, 2× pour les entiers) ; le champ le signale par un
  liseré orange.
- **Rampe de couleurs** par node (0 → 1 par défaut) avec aperçu séparé couleur / opacité ;
  stops déplaçables, `Suppr` sur un stop le retire, position réglable en glissant ;
  sélecteur de couleur complet (carré teinte / saturation, hex, RGB, HSV, opacité) ;
  presets de rampes avec aperçu.
- **Timeline** : lecture, défilement, image par image, vitesse, durée de boucle, pellicule
  d'aperçus ; **boucle forcée** (fondu fin → début) pour obtenir des flipbooks qui bouclent ;
  images-clés de retour en arrière pour les simulations (on peut faire des allers-retours sans
  rien perdre).
- **Viewport** : zoom (molette, 1:1, ajuster) et déplacement, layout personnalisable (panneaux
  et timeline masquables).
- **Export** : un seul bouton qui présente toutes les possibilités — image PNG de la node
  sélectionnée, maps, flipbook, **toutes les nodes en ZIP**, document `.json`, lien de
  partage. Couleur, normal map (OpenGL/DirectX), height map ; alpha configurable ; PNG
  jusqu'à 4096², **fenêtre d'export des maps** (couleur, normal, height : choix, réglages, aperçus, ZIP ou PNG ;
  flip R/G pour les conventions de flowmap, height en **PNG 16 bits**), flipbook pour les effets animés (début décalé, ou temps de chauffe pour les
  simulations).
- **Interface** inspirée d'Unreal Engine 5 : navigateur en tuiles (Generators / Operators en
  sélecteur pleine largeur), panneaux redimensionnables, Details en 3 pages (Generator / Post
  Process / Output, même sélecteur) avec recherche et flèches de reset, champs à glisser
  (Shift = fin), aperçu adaptatif pendant les réglages. **Panneaux déplaçables** : glisser
  l'onglet Browser ou Details vers l'autre côté les empile en onglets (interface compacte).
  L'onglet Output n'affiche que les réglages de la map choisie. Barre **Stats** en bas de la page (FPS,
  taille d'aperçu, nodes, GPU), masquée par défaut (menu Layout). Thème sombre déclaré au
  navigateur (Dark Reader ne le retouche pas).
- **Documents** versionnés : `.json`, lien de partage, autosauvegarde, annuler/rétablir.

Raccourcis : `Espace` lecture/pause · `,` / `.` image précédente/suivante · `T` timeline ·
`F` tout afficher · `Shift+F` cadrer la node sélectionnée · `1` zoom 1:1 · `+` / `-` zoom · molette = zoom, clic molette ou
`Alt`+glisser = déplacer la vue · glisser sur le fond = rectangle de sélection · `Ctrl+Z` / `Ctrl+Shift+Z` · double-clic sur un libellé = valeur par
défaut.

## Développement

Node ≥ 20 requis (voir `.nvmrc`). Sans Node local, toutes les commandes passent par Docker :

| Avec Docker (`make`) | Avec Node local    | Description                                      |
| -------------------- | ------------------ | ------------------------------------------------ |
| `make install`       | `npm ci`           | Installer les dépendances                        |
| `make dev`           | `npm run dev`      | Serveur de dev → http://localhost:5173           |
| `make check`         | `npm run check`    | Typecheck + lint + tests unitaires               |
| `make e2e`           | `npm run test:e2e` | Tests navigateur (captures dans `test-results/`) |
| `make build`         | `npm run build`    | Build de production dans `dist/`                 |
| `make up`            | —                  | Image de prod locale → http://localhost:8080     |

Comptes en local : copier `.env.example` en `.env`, le remplir avec une base PostgreSQL de
test, puis `npm run dev:server` (API sur :3000) à côté de `npm run dev` (qui lui transmet
`/api`).

Documentation technique :

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — organisation du code et pipeline de rendu
- [docs/AUTHORING.md](docs/AUTHORING.md) — écrire des générateurs, opérateurs et simulations (guide pas à pas, utilisable tel quel par une IA)
- [docs/NODES.md](docs/NODES.md) — référence de toutes les nodes (paramètres, uniforms, entrées, presets), générée depuis le code par `npm run docs`
- [llms.txt](llms.txt) — point d'entrée pour les assistants IA
- [docs/DEPLOY_SERVER.md](docs/DEPLOY_SERVER.md) — déploiement avec comptes (PostgreSQL,
  Discord, mise à jour automatique depuis GitHub)
- [docs/DEPLOY_OMV.md](docs/DEPLOY_OMV.md) — hébergement statique sur OpenMediaVault
- [docs/ROADMAP.md](docs/ROADMAP.md) — idées et évolutions prévues
- [docs/COMMUNITY.md](docs/COMMUNITY.md) — conception de la bibliothèque communautaire

## Licence

À définir.
