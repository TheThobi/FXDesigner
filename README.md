# Procedural Texture Maker

Générateur de textures d'effets procédurales dans le navigateur (WebGL2), inspiré de
[EffectTextureMaker](https://mebiusbox.github.io/contents/EffectTextureMaker/), avec en plus une
simulation de **réaction-diffusion** (modèle Gray-Scott, d'après
[Karl Sims](https://www.karlsims.com/rd.html)).

100 % statique côté serveur : tout le calcul est fait par le GPU du client.

## Fonctionnalités

- **19 générateurs** : bruit fractal (fBm / turbulence / ridged), cellulaire (Voronoi), domain
  warp, caustiques, glow, étoile/flare, anneau, rayons, faisceau laser, éclairs, flamme, boule de
  feu, fumée, dégradés, motifs (damier, rayures, points, grille), polygone/étoile, cercle magique,
  briques.
- **Réaction-diffusion** temps réel : presets (Mitosis, Coral, Maze, Worms…), cartes de variation
  f/k (gradient ou radiale), diffusion anisotrope (angle fixe, tourbillon, radiale), graines
  (carré, taches, bruit, anneau, **texte**, vide), **peinture à la souris**, rendu en relief.
- **Post-traitement commun** : niveaux, inversion, **gradient map** avec éditeur de dégradé et
  presets, modes d'alpha, **export en normal map** (OpenGL ou DirectX).
- **Textures seamless** (option sur les bruits, RD toujours tuilable) et prévisualisation 2×2 / 3×3.
- **Export PNG** jusqu'à 4096², **flipbook / sprite sheet** pour les effets animés.
- **Documents** : sauvegarde/ouverture `.json`, **lien de partage** (état encodé dans l'URL),
  autosauvegarde locale, **annuler/rétablir** (Ctrl+Z / Ctrl+Shift+Z).

Raccourcis : `Espace` lecture/pause · `Ctrl+Z` / `Ctrl+Shift+Z` · double-clic sur un libellé =
valeur par défaut.

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

## Licence

À définir.
