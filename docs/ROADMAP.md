# Roadmap / idées

Priorités indicatives. Cocher au fil de l'eau.

## Court terme

- [ ] Boucles parfaites pour les flipbooks (temps exprimé en phase 0..1 ; bruit « flow »
      avec rotation de 2π par boucle, défilement d'une période entière).
- [ ] Bibliothèque de presets utilisateur dans `localStorage` (liste, renommer, supprimer),
      import/export groupé.
- [ ] Graine RD depuis une **image** importée (et carte f/k depuis une image, comme Karl Sims).
- [ ] Vignettes pour les simulations (pré-calcul quelques centaines d'itérations en 64²).
- [ ] Bouton « copier l'image » dans le presse-papiers (HTTPS seulement).

## Moyen terme

- [ ] **Graphe de nœuds / calques** : combiner plusieurs générateurs (blend modes, masques,
      warp d'un générateur par un autre). L'architecture actuelle (générateur → source target
      → post) est le premier maillon : un calque = (générateur, params, blend).
- [ ] Autres simulations sur le même contrat `Simulation` : Physarum (slime mold),
      automates cellulaires, croissance DLA, fluides 2D (stable fluids) pour fumées.
- [ ] Rapports non carrés (résolution W×H) — `u_resolution` existe déjà, l'UI et les
      générateurs centrés devront corriger l'aspect.
- [ ] Export EXR/PNG 16 bits pour les height maps (précision), export ZIP (couleur + normal + height).
- [ ] i18n de l'interface (FR/EN) — chaînes actuellement en anglais dans `ui/`.
- [ ] PWA (manifest + service worker) pour usage hors-ligne.

## Long terme

- [ ] Éditeur GLSL intégré (générateur « Custom shader » avec la bibliothèque disponible).
- [ ] Galerie partagée sur le serveur (nécessiterait un petit backend : stockage de documents
      JSON, aucune image à stocker puisque tout est régénérable).
- [ ] WebGPU (compute shaders) si les simulations deviennent limitantes.
