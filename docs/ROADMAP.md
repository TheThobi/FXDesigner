# Roadmap / idées

Priorités indicatives. Cocher au fil de l'eau.

## Fait

- [x] Simulations : réaction-diffusion, Physarum, marbrure d'encre, automate cyclique, spirales BZ.
- [x] Effets stylisés : slash, speed lines, comic burst, toon cloud, hex shield, vortex, toon
      water, sparkles ; post « Stylize » (postérisation, dither, pixel, halftone, contours) ;
      presets toon pour les générateurs existants.
- [x] Interface façon UE5, Details en onglets (Generator / Post Process / Output).
- [x] Post en modules activables avec résumés ; rampe de couleurs partagée ; slope blur.
- [x] Peintre de flowmap ; particules (ripple, flamme, étincelles, éclats, traînée).
- [x] Voronoi : bordures exactes (épaisseur uniforme), points espacés.
- [x] Panneaux redimensionnables, vignettes paresseuses, aperçu adaptatif.
- [x] Bruits : bases multiples, Gabor, flow strokes, veines, ripples, facettes, éclaboussures.
- [x] Pixel art (contours sur la grille), anti-aliasing SSAA, contours extérieur/intérieur.
- [x] Navigation : zoom (molette, 1:1, ajuster) et déplacement dans le viewport ; timeline
      (lecture, défilement, image par image, vitesse, durée de boucle, pellicule d'aperçus ;
      images-clés de retour en arrière pour les simulations).
- [x] Boucle forcée générique (fondu enchaîné fin → début), activable par générateur ;
      flipbooks qui bouclent.
- [x] Layout personnalisable (masquer navigateur, détails, timeline, stats), mémorisé.
- [x] Flowmap : vrai shader deux phases qui boucle, motif eau (éclairé ou normal map), flèches
      de direction, barre de comparaison déplaçable, aperçu activable.
- [x] Rampe par défaut 0 → 1, aperçu des presets de rampe, noms neutres ; icônes des modules.
- [x] Catégories : « Particles & VFX » regroupe sprites, feu, lumière et FX stylisés.
- [x] Simulations : Lenia, fluide d'encre, croissance cristalline (DBM), automates Life.
- [x] Générateurs : volute, éclaboussure, feuille, orbe, smear, flammes à crochets, bulles,
      onde de choc, runes, Truchet, kaléidoscope ; Underworld FX (flamme d'âme, lave, aura,
      impact, braises).
- [x] Post : Kuwahara, étalonnage, aquarelle, grain papier ; presets de look ; scope
      global/local ; export à la résolution du pixel art.
- [x] Presets étoffés partout, vignette = preset mis en avant, défilement au survol.

## Court terme

- [ ] Boucles « natives » sans fondu pour les bruits (phase 0..1, rotation de 2π du bruit
      « flow » par boucle) quand le fondu générique abîme l'effet.
- [ ] Bibliothèque de presets utilisateur dans `localStorage` (liste, renommer, supprimer).
- [ ] Graine depuis une **image** importée (RD, marbrure, « nourriture » Physarum) et carte f/k
      depuis une image, comme Karl Sims.
- [ ] Physarum multi-espèces (3 populations qui s'évitent → rendu RGB très graphique).
- [ ] Contours toon plus riches : épaisseur variable, contour intérieur/extérieur séparés.

## Pistes (direction Silksong / Dead Cells)

- [ ] Chaîne de nœuds simple : générateur → slope blur avec un **autre générateur** comme slope
      map, blend de deux générateurs, masques (la base d'un graphe de nœuds).
- [ ] Flowmap : importer une flowmap/texture à prévisualiser, appliquer une flowmap peinte
      comme distorsion d'un autre générateur, export avec flip X/Y.
- [ ] Particules : fumée « wispy », gouttes/éclaboussures d'eau, feuilles, lueurs magiques.
- [ ] Export multi-maps en un clic (couleur, height, normal) en ZIP.

## Simulations candidates

- [ ] **Croissance différentielle** (lignes qui se plissent, motifs de cerveau) — CPU + rendu de lignes.
- [ ] Fluide : confinement de vorticité, couleurs d'encre multiples (RGB), obstacles peints.
- [ ] Érosion hydraulique pour heightmaps (plus réaliste, utile avec l'export normal map).

## Effets stylisés candidats

- [ ] Impact frames en négatif, traînées de vitesse « anime ».
- [ ] Runes intégrées au cercle magique (anneau de glyphes en option).
- [ ] Underworld FX : sol de dalles gravées, chaînes spectrales, portail d'âme.

## Moyen terme

- [ ] **Graphe de nœuds / calques** : combiner plusieurs générateurs (blend modes, masques, warp
      d'un générateur par un autre). La chaîne générateur → source → post en est la base.
- [ ] Rapports non carrés (résolution W×H).
- [ ] Export EXR/PNG 16 bits pour les height maps, export ZIP (couleur + normal + height).
- [ ] i18n de l'interface (FR/EN).
- [ ] PWA (manifest + service worker) pour usage hors-ligne.

## Long terme

- [ ] Bibliothèque communautaire (presets et shaders custom, comptes) : voir
      [COMMUNITY.md](COMMUNITY.md) pour le découpage. Étapes 1-2 sans serveur : presets
      utilisateur locaux, puis générateur « Custom shader » (GLSL).
- [ ] WebGPU (compute shaders) si les simulations deviennent limitantes.
