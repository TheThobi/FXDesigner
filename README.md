# Procedural Texture Maker

Générateur de textures d'effets procédurales dans le navigateur (WebGL2), inspiré de
[EffectTextureMaker](https://mebiusbox.github.io/contents/EffectTextureMaker/), avec en plus une
simulation de **réaction-diffusion** (modèle Gray-Scott, d'après
[Karl Sims](https://www.karlsims.com/rd.html)).

100 % statique côté serveur : tout le calcul est fait par le GPU du client.

## Fonctionnalités

- **10 simulations GPU** interactives : réaction-diffusion (Karl Sims), Physarum, marbrure
  d'encre, automate cyclique, spirales BZ, **Lenia**, **fluide d'encre** (stable fluids),
  **croissance cristalline** (DLA / dielectric breakdown), **automates Life** (Conway, Brian's
  Brain, Star Wars, Larger than Life…) et un **peintre de flowmap** (on peint des directions à
  la souris ; aperçu d'une surface d'eau qui boucle, comparable via une barre déplaçable ;
  export RG).
- **Bruits variés** : fractal (bases Perlin / Value / Simplex / Worley / Perlin-Worley ; fBm,
  turbulence, ridged), cellulaire (bordures d'épaisseur uniforme), domain warp, caustiques,
  Gabor, flow strokes, veines (marbre, bois, agate), ripples, facettes, éclaboussures.
- **Particles & VFX** : sprites (ripple, flamme, étincelle(s), éclats d'impact, traînée,
  volute de fumée, éclaboussure, feuille, orbe magique), **Underworld FX** façon jeux d'action
  mythologiques (flamme d'âme, fissures de lave, aura divine, impact au sol, braises),
  smear frames, flammes à crochets, bulles, onde de choc, lumières (glow, flare, anneau, rayons, laser, éclairs), feu/fumée, slash, lignes
  de vitesse, bouclier hexagonal, vortex, eau stylisée, scintillements…
- **Motifs** : dégradés, damiers, polygones, cercle magique, briques, **runes**, **Truchet**,
  **kaléidoscope**.
- **Post-traitement en modules** activables, dans l'ordre du pipeline : niveaux, **slope blur**
  (lissage pictural comme dans Substance Designer), **Kuwahara** (aplats façon peinture à
  l'huile), **étalonnage** (saturation, teinte, température, ombres colorées), éclairage de
  relief, **aquarelle** (bords mouillés, granulation), postérisation/tramage, halftone,
  pixelisation (« pixel art » ou image finale, export à la résolution des blocs), **grain de
  papier / toile**, contours, **anti-aliasing SSAA**. Icônes et résumé d'état par module,
  **presets de look** (huile, aquarelle, gouache, pixel art…), look **global** (partagé par
  tous les générateurs) ou **local** (par générateur).
- **Presets** nombreux pour chaque générateur ; les vignettes montrent le preset le plus
  représentatif et font défiler les presets au survol.
- **Rampe de couleurs partagée** par tous les générateurs (0 → 1 par défaut), surchargeable par
  générateur ; presets de rampes avec aperçu.
- **Timeline** : lecture, défilement, image par image, vitesse, durée de boucle, pellicule
  d'aperçus ; **boucle forcée** (fondu fin → début) pour obtenir des flipbooks qui bouclent ;
  images-clés de retour en arrière pour les simulations.
- **Viewport** : zoom (molette, 1:1, ajuster) et déplacement, layout personnalisable (panneaux
  et timeline masquables).
- **Sorties** : couleur, normal map (OpenGL/DirectX), height map ; alpha configurable ; PNG
  jusqu'à 4096², flipbook pour les effets animés.
- **Interface** inspirée d'Unreal Engine 5 : navigateur en tuiles, panneaux redimensionnables,
  Details en 3 onglets (Generator / Post Process / Output) avec recherche et flèches de reset,
  champs à glisser (Shift = fin), aperçu adaptatif pendant les réglages.
- **Documents** versionnés : `.json`, lien de partage, autosauvegarde, annuler/rétablir.

Raccourcis : `Espace` lecture/pause · `,` / `.` image précédente/suivante · `T` timeline ·
`F` ajuster le zoom · `1` zoom 1:1 · `+` / `-` zoom · molette = zoom, clic molette ou
`Alt`+glisser = déplacer · `Ctrl+Z` / `Ctrl+Shift+Z` · double-clic sur un libellé = valeur par
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

Documentation technique :

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — organisation du code et pipeline de rendu
- [docs/ADDING_A_GENERATOR.md](docs/ADDING_A_GENERATOR.md) — ajouter un générateur en 3 fichiers
- [docs/DEPLOY_OMV.md](docs/DEPLOY_OMV.md) — hébergement sur OpenMediaVault
- [docs/ROADMAP.md](docs/ROADMAP.md) — idées et évolutions prévues
- [docs/COMMUNITY.md](docs/COMMUNITY.md) — conception de la bibliothèque communautaire

## Licence

À définir.
