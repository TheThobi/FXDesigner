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
- [x] **Système nodal** dans le viewport (nodes avec texture en direct, entrées Base / Mask /
      Warp + entrées propres, liens courbes, post et rampe par node, œil pour masquer le post) ;
      documents v4 (migration automatique des anciens).
- [x] Presets qui repartent de zéro + confirmation ; plus de surcharge de rampe (rampe du post
      ou `Preset.ramp`).
- [x] Caustiques d'eau simulées (équation d'onde + projection réfractée de la lumière,
      dispersion) ; Fumée & Feu façon FluidNinja (vorticité, flottabilité, émetteurs, entrées
      Emitter / Flow, motion vectors).
- [x] Motifs tirés de références : motifs géométriques, masques doux, hachures, taches / camo.
- [x] Timeline : contrôles centrés, allers-retours non destructifs dans les images-clés des
      simulations ; flipbook avec début décalé / temps de chauffe.
- [x] Freeze frame par node, modules d'ajustement (transformation, maths, code GLSL),
      format d'espace de travail non carré, Paint Mask, usure de surface, émetteur en orbite,
      rampe avec opacité visible, nodes retravaillées (contour, sélection, pulse discret).
- [x] Bibliothèque de presets utilisateur (enregistrer, appliquer, renommer, supprimer) ;
      node **Image** (import / glisser-déposer, utilisable en Base / Mask / Warp / Emitter) ;
      export **ZIP** couleur + normal + height en un clic ; verre brisé refait en segments.
- [x] **Opérateurs** façon Substance (Blend, Mask, Levels, Transform, Warp, Blur, Slope Blur,
      Distance, Edge Detect, Channels, Pack RGBA, Custom Code) dans un onglet dédié ; entrées
      génériques et modules d'ajustement migrés vers ces opérateurs (documents v5) ; fenêtre
      d'export des maps avec aperçus.
- [x] Renommage en **FX Designer**. Onglets Generators / Operators dans l'en-tête du panneau,
      entrées centrées sur les nodes, **Unpack RGBA** à 4 sorties (liens par canal, documents
      v6), **Distance** exacte (jump flooding : extérieur, biseau, signé, couleurs propagées),
      Blur gaussien séparable avec nombre de samples, passes multiples pour les opérateurs.
- [x] Sélection multiple dans le viewport (rectangle, `Shift`+clic, déplacement groupé,
      suppression), liens tirés depuis les entrées, Blur à échantillonnage automatique
      (gaussien multi-niveaux).
- [x] Liens à angles droits arrondis, pins en barres arrondies, marges égales autour de l'image ;
      menu d'ajout rapide quand un lien est lâché dans le vide ; générateurs Weave, Creased,
      Crystal, Anisotropic Noise ; Surface Wear séparé en Brushed Metal / Scratches / Cracked
      Glass (documents v7) ; **opérateurs d'animation** (Hue Shift, Color Cycle, Flicker,
      Scroll, Dissolve).
- [x] Bibliothèque de **systèmes** (plusieurs graphes sauvegardés, vignettes) ; fenêtre
      d'**export** unique (image, maps, flipbook, toutes les nodes en ZIP, document, lien) ;
      types de valeur (gris / couleur détectés) sur les pins et liens en dégradé ; liens
      cliquables (Suppr) ; nodes repliables, alignées sur la grille, la sélection passe devant ;
      fond du viewport lié à la caméra ; catégories revues (Feu & fumée, Lumière & magie,
      Impacts & mouvement, Eau, Matières…) ; presets de générateur séparés du post-traitement ;
      barre Stats ; nouveau logo.
- [x] Galeries de presets et de looks avec vignettes et aperçu au survol ; éditeur de rampe
      refait (sélecteur de couleur complet, stops déplaçables) ; **conversion de n'importe
      quelle node shader en code GLSL** (node custom) et générateur Custom Shader ; panneaux
      déplaçables ; menu File, export / import de la bibliothèque ; valeurs tapées au-delà
      des curseurs ; Crystal et Creased refaits ; documentation générée (`docs/development/nodes.md`) et
      guide d'écriture de nodes (`docs/development/authoring.md`, utilisable par une IA).
- [x] **Comptes** (pseudo / email / mot de passe, Discord) et bibliothèque synchronisée sur le
      compte (PostgreSQL) ; dossiers dans la bibliothèque ; déploiement auto-update avec
      rollback ; presets de générateurs sans effets de post-process (looks toon / comic /
      topographique déplacés dans les looks).
- [x] Dock libre façon UE5 (onglets empilables et scindables partout) ; paramètres custom des
      nodes en code ; compilation du code custom en arrière-plan (une erreur ne bloque plus
      le viewport) ; galerie de couleurs ; dégradé d'accent unifié ; Crystal refait d'après
      Crystal 2.

## Court terme

- [ ] Boucles « natives » sans fondu pour les bruits (phase 0..1, rotation de 2π du bruit
      « flow » par boucle) quand le fondu générique abîme l'effet.
- [x] Bibliothèque de presets utilisateur dans `localStorage` (liste, renommer, supprimer).
- [x] Graine depuis une **image** (ou n'importe quelle node) pour la réaction-diffusion et la
      marbrure (entrée Seed).
- [x] « Nourriture » Physarum depuis n'importe quelle node (entrée Food).
- [x] Carte f/k de la réaction-diffusion depuis une image, comme Karl Sims (entrée f/k map).
- [x] Physarum multi-espèces (jusqu'à 3 populations qui s'évitent → rendu RGB).
- [ ] Contours toon plus riches : épaisseur variable, contour intérieur/extérieur séparés.

## Pistes (direction Silksong / Dead Cells)

- [x] Chaîne de nœuds simple : blend de deux générateurs, masques, warp (graphe de nœuds).
- [x] Flowmap : export avec flip X/Y (fenêtre d'export : flip R / G). (Import d'une texture :
      node Image ; flowmap peinte appliquée à un autre générateur : opérateur Warp ou entrée Flow.)
- [ ] Particules : fumée « wispy », gouttes/éclaboussures d'eau, feuilles, lueurs magiques.
- [x] Export multi-maps en un clic (couleur, height, normal) en ZIP.

## Simulations candidates

- [ ] **Croissance différentielle** (lignes qui se plissent, motifs de cerveau) — CPU + rendu de lignes.
- [ ] Fluide : couleurs d'encre multiples (RGB), obstacles peints. (Vorticité : Smoke & Fire.)
- [ ] Érosion hydraulique pour heightmaps (plus réaliste, utile avec l'export normal map).

## Effets stylisés candidats

- [ ] Impact frames en négatif, traînées de vitesse « anime ».
- [ ] Runes intégrées au cercle magique (anneau de glyphes en option).
- [ ] Underworld FX : sol de dalles gravées, chaînes spectrales, portail d'âme.

## Moyen terme

- [x] **Graphe de nœuds / calques** : combiner plusieurs générateurs (blend modes, masques, warp
      d'un générateur par un autre).
- [x] Rapports non carrés (format de l'espace de travail).
- [x] Export PNG 16 bits pour les height maps (fenêtre d'export). EXR : à faire si besoin.
- [ ] i18n de l'interface (FR/EN).
- [ ] PWA (manifest + service worker) pour usage hors-ligne.

## Long terme

- [ ] Bibliothèque communautaire (presets et shaders custom, comptes) : voir
      [community.md](community.md) pour le découpage. Étapes 1-2 sans serveur : presets
      utilisateur locaux (fait), puis générateur « Custom shader » (GLSL ; le module Custom code
      des ajustements en est la première brique).
- [ ] WebGPU (compute shaders) si les simulations deviennent limitantes.
