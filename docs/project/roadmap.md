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
- [x] Démarrage et fluidité : shaders compilés en arrière-plan et en parallèle (cache de
      programmes partagé), miniatures du navigateur conservées (IndexedDB), canvas redessiné
      seulement quand il change, assets compressés (brotli / gzip) par le serveur Node.
- [x] Graines et entrées de simulation : Seed (réaction-diffusion, marbrure), Food (Physarum),
      carte f/k façon Karl Sims, Physarum multi-espèces ; presets utilisateur.
- [x] Chaîne de nœuds, flowmap avec flip X/Y à l'export, ZIP multi-maps, export PNG 16 bits,
      rapports non carrés ; particules (volutes de fumée, éclaboussures, feuilles, orbes).
- [x] Communauté (étape 1) : partage de **systèmes** (découverte, catégories, tags,
      abonnements, versions) ; voir [community.md](community.md).
- [x] **Érosion hydraulique** (simulation : pluie, transport de sédiments, entrée Terrain,
      vues hauteur / relief / eau / érosion) ; anneau de **runes** dans le Magic Circle ;
      **PWA** (installable, hors-ligne, rechargement instantané).
- [x] **Boucles natives** des bruits (Fractal Noise sauf Value, Domain Warp, Cellular) : avec
      « Force seamless loop », la rotation du bruit finit sur des tours entiers, sans fondu ;
      contours à **épaisseur variable** (« Ink variation ») ; érosion **thermique** (angle de
      talus) et entrée **Hardness** ; **Spectral Chains** ;
      `make glsl` (compilation de tous les shaders sans navigateur).
- [x] **Atlas de variations** (export : une graine par case) ; export **vidéo WebM** des
      boucles et des simulations ; boucles natives étendues (Gabor, Flow Strokes, Veins,
      Ripples) ; érosion à **strates** (canyons en terrasses).
- [x] Panneau **3D Preview** (plan, sphère, cube, cylindre ; matériau éclairé avec le relief de
      la height map, ou sprite additif ; répétitions, orbite) ; export **GIF** (encodeur maison,
      palette commune, boucle infinie) ; simulation **Differential Growth** ; entrée
      **Obstacles** pour Ink Fluid et Smoke & Fire.
- [x] Node **Material Output** (Color / Normal / Height / Roughness) affichée en priorité par
      le panneau 3D ; **encres RGB** dans Ink Fluid (second état par cellule : render targets
      multiples dans `GridSimulation`) ; communauté : **signalements et modération** (motifs,
      masquage automatique, file des modérateurs).
- [x] **Motion vectors** pour tout flipbook (flux optique) ; **cadres de commentaires** dans le
      graphe (touche `C`) ; node **Trim Sheet** (nodes branchées empilées en bandes raccordables).
- [x] Opérateurs **Tile Sampler**, **Flood Fill**, **Make It Tile**, **Radial Blur**, **Polar
      Coordinates**, **Curvature & Occlusion**, **Height Blend**, **Glow** ;
      simulations **Burning Paper** et **Crack Growth** ; opérateurs classés par fréquence
      d'usage ; pas de presets sur les nodes de plomberie (Output, Pack, Uniform…).
- [x] Nodes **Flood Fill to Gradient / Size / Color** et **Flood Fill Mapper** (sortie Data du
      Flood Fill : boîte de chaque îlot) ; **Tile Sampler animé** (dérive, rotation, oscillation,
      pulsation, scintillement, apparition / disparition, en boucle) ; **Flowmap Painter** avec
      entrée Image (sortie flowmap ou image qui coule) et sorties RG / R / G.
- [x] Communauté (étape 2) : partage de **nodes de shaders custom** (onglet Shader nodes :
      publication de la node sélectionnée, code GLSL visible avant installation, installation
      dans une section **Community** du navigateur de nodes, mises à jour, liens node ↔
      publication) ; tout ce qui est publié est réutilisable librement ; voir
      [community.md](community.md).
- [x] Node **Dilate (Padding)** (couleurs des pixels opaques étendues sous l'alpha, mipmaps
      sans bavure) ; **nom personnalisé** des nodes (F2, double-clic sur l'en-tête) ;
      **aligner / distribuer** ; cadres de commentaire **sélectionnables** (clic, Shift,
      rectangle de sélection), déplacés et supprimés avec les nodes, taille du titre ;
      3D Preview ouverte sous Details ; lien **GitHub** et fenêtre **About** (section IA,
      contributions) ; `prefers-reduced-motion` ne coupe plus que le mouvement (le retour
      visuel reste).
- [x] Opérateurs **Mirror / Symmetry**, **Histogram Scan**, **Non-uniform Blur** ; post
      **Sharpen**, **Chromatic aberration**, **Vignette** ; option **Dilate** à l'export des
      flipbooks ; Details : « Community node … · **Update to vN** » sur une node ajoutée depuis
      la communauté, « Based on » sur la page d'une node dérivée ; pins lisibles sans la
      couleur (1, 2, 3 points = float, vec2, RGB) ; message quand une sauvegarde échoue
      (stockage plein) ; fenêtre Community chargée à la demande ; opérateurs rangés par
      usage dans le navigateur (Blend & mask, Adjust, Transform & tiling, Blur & glow, Edges &
      distance, Flood fill, Channels & graph, Animation).
- [x] Nodes installées et liens « cette node est ma publication » **synchronisés avec le
      compte** (fusion par entrée, comme la bibliothèque) : un autre appareil met à jour la
      même publication au lieu d'en créer une en double ; Caustics des effets renommées
      **Stylized Caustics**.

## Propositions

Taille indicative : **S** (une soirée), **M** (quelques jours), **L** (chantier).

### Graphe et workspace

- [ ] **M** Aligner / distribuer : bon début, mais l'ergonomie est à améliorer (barre
      d'alignement quand plusieurs nodes sont sélectionnées, raccourcis, guides et aimantation
      pendant le déplacement).
- [ ] **M** Mini-carte du graphe et recherche de node (Ctrl+F : saute à la node, la sélectionne).
- [ ] **M** Paramètres **exposés** d'un système (quelques curseurs « macro » reliés à des
      paramètres de nodes) : un système publié se règle sans ouvrir le graphe.
- [ ] **S** Options de workspace : pas de la grille et magnétisme, fond de l'aperçu (damier,
      noir, couleur), courbure des liens, thème clair.

### Nodes

- [ ] **M** Générateurs : muzzle flash, bokeh / champ d'étoiles.
- [ ] **L** Simulations : équation d'onde (ondulations interactives), sable tombant
      (automate), liquide SPH 2D.

### Post Process

- [ ] **M** Étalonnage par **LUT** (`.cube` importé) et courbes RVB.
- [ ] **M** Distorsion de chaleur (déplacement par bruit animé, en boucle).

### Communauté

- [ ] **S** « Basé sur » pour les **systèmes** (les nodes l'ont : une node publiée depuis une
      node communautaire affiche l'original).
- [ ] **M** Import Shadertoy (adaptateur `mainImage`) pour un usage local : la licence par
      défaut de Shadertoy (CC BY-NC-SA) est incompatible avec la réutilisation libre de la
      communauté, un shader importé ne se publie donc que si son auteur l'autorise.
- [ ] **M** Collections (listes publiques de systèmes / nodes) et commentaires.

### Accessibilité

- [ ] **S** Focus clavier visibles partout, libellés ARIA des curseurs et des pins.
- [ ] **S** Échelle de l'interface (90 à 150 %) et thème à fort contraste.
- [ ] **M** Graphe au clavier : Tab entre les nodes, flèches pour déplacer, Entrée pour
      ouvrir la recherche d'ajout ; aide des raccourcis (`?`).

### Stabilité

- [ ] **M** Bibliothèque locale en **IndexedDB** : la copie de travail de la bibliothèque (et
      la seule copie sans compte) est en localStorage, limité à ≈ 5 Mo par site ; au-delà, les
      sauvegardes échouaient sans bruit (un message prévient désormais quand une sauvegarde
      échoue).
- [ ] **M** Garde-fou GPU : une node dont le temps de rendu explose est mise en pause avec un
      message, au lieu de figer l'onglet (important pour les nodes communautaires).
- [ ] **M** Tests de régression visuelle (captures de la CI comparées à des références) et
      parcours e2e « publier / installer une node ».

### Fluidité

- [ ] **M** Nodes hors écran ou dézoomées rendues moins souvent / en plus petit (LOD des cartes).
- [ ] **L** Rendu dans un Worker (`OffscreenCanvas`) : l'interface reste fluide pendant les
      simulations lourdes.

## Long terme

- [ ] **Stockage Google Drive** (optionnel, pour qui veut plus d'espace) : relier un dossier
      Drive de l'utilisateur pour y stocker la bibliothèque et ses contenus, et y piocher des
      images (les images du dossier reconnues directement par la node Image). Réponse plus
      large à la saturation du stockage local que l'IndexedDB seule.
- [ ] **Système comme node** (sous-graphe / material function : entrées, sorties et
      paramètres exposés) ; prolongerait « Collapse into new system ». Gardé de côté.

- [ ] WebGPU (compute shaders) si les simulations deviennent limitantes.
