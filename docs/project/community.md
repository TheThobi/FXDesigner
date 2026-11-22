# Bibliothèque communautaire : proposition de conception

But : parcourir, publier et réutiliser des **effets** créés par d'autres (presets d'effets
existants ou nouveaux générateurs en shader), depuis l'application.

C'est un gros chantier : il fait passer le projet de « site statique » à « service avec
comptes ». Ce document découpe le travail en étapes livrables séparément. Les premières étapes
ne demandent aucun serveur.

## Ce qui se publie

| Type              | Contenu                                                                | Risque                                                         |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Preset**        | Un document `.ptm.json` existant (générateur + params + post + rampe). | Nul : ce ne sont que des données validées par `parseDocument`. |
| **Shader custom** | Code GLSL `vec4 generate(vec2 uv)` + schéma de paramètres + presets.   | Moyen : du code exécuté sur le GPU du visiteur.                |

Un shader custom serait un « paquet » JSON versionné :

```json
{
  "format": "ptm-effect",
  "version": 1,
  "id": "user/aurore-boreale",
  "name": "Aurore boréale",
  "category": "light",
  "animated": true,
  "params": [
    { "type": "float", "key": "speed", "label": "Speed", "default": 1, "min": 0, "max": 4 }
  ],
  "glsl": "vec4 generate(vec2 uv) { … }",
  "presets": [],
  "defaultPost": {}
}
```

Le moteur sait déjà tout faire à partir de cette description : les paramètres déclarent les
uniforms `u_<key>`, l'interface et la validation (`ParamDef`). Seul le code GLSL est nouveau.

### GLSL et HLSL

Le navigateur n'exécute que du **GLSL ES 3.0** (WebGL2), ou du WGSL avec WebGPU. Le HLSL n'y
tourne pas directement. Deux options :

1. **GLSL uniquement** (recommandé au départ). L'éditeur documente les différences courantes
   (`float2` → `vec2`, `lerp` → `mix`, `frac` → `fract`, `saturate` existe déjà dans notre
   chunk `common`).
2. Plus tard, une conversion HLSL → GLSL dans le navigateur, via une version WebAssembly d'un
   outil comme `naga` ou `SPIRV-Cross`. C'est lourd (plusieurs Mo) et ce n'est pas fiable à
   100 %. À réserver à un import ponctuel, pas au format de stockage.

## Étapes

### 1. Bibliothèque locale (sans serveur)

- « Enregistrer comme preset » dans le panneau Generator : le preset va dans `localStorage` et
  apparaît dans la liste des presets sous « Mes presets ».
- Import et export de presets en fichiers (le format document existe déjà).
- Ce format est exactement celui qui sera publié plus tard.

### 2. Générateur « Custom shader » (sans serveur)

Point de départ : un shader vide, un générateur existant dupliqué, ou un shader Shadertoy
importé (voir plus bas).

- Un éditeur de code (textarea avec coloration légère, ou CodeMirror 6 si besoin). La
  compilation se fait à la volée avec les erreurs annotées : `ShaderCompileError.annotated()`
  existe déjà.
- Des paramètres déclarés dans un formulaire, ou par des annotations dans le code
  (`// @param float speed 1 0 4`).
- Garde-fous : longueur du code limitée, rendu de l'aperçu à résolution réduite tant que le
  temps de frame est trop élevé (l'aperçu adaptatif existe déjà). La « perte de contexte »
  WebGL est déjà gérée.

### 3. Serveur de partage (sur l'OMV)

- Un petit service **Node (Fastify) + SQLite**, dans un conteneur à côté du conteneur nginx.
  nginx sert le site et fait proxy de `/api/`.
- Endpoints : `GET /api/effects?query=&type=&sort=`, `GET /api/effects/:id`,
  `POST /api/effects`, `POST /api/effects/:id/like`, `POST /api/reports`.
- Vignettes générées **côté client** à la publication (PNG 256 px envoyé avec le paquet). Le
  serveur n'a pas besoin de GPU.
- Toute entrée est validée côté serveur avec le même code que le client (`parseDocument` et le
  validateur de paquets, partagés via un dossier `shared/`).

### 4. Comptes

- Comptes simples : pseudo + **passkey** (WebAuthn), ou lien magique par e-mail. Pas de mot de
  passe à stocker.
- Cookie de session `HttpOnly; Secure; SameSite=Lax`.
- Une publication est liée à son auteur ; seul l'auteur peut la modifier ou la retirer. Il y a
  un rôle de modérateur.

### 5. Navigateur d'effets dans l'app

- Un onglet ou une fenêtre « Browse » : grille de vignettes, recherche, filtres (type,
  catégorie, récent ou populaire), page de détail, bouton « Ouvrir » (preset) ou « Installer »
  (shader custom ajouté à une catégorie « Community »).
- Les shaders installés sont mis en cache localement et reconnus par leur `id` dans les
  documents et liens de partage.

## Partir d'un shader existant

### Dupliquer un générateur de l'application

Chaque générateur est déjà une description complète : `fragment` GLSL, `params`, `presets`,
`defaultPost`. Un bouton « Dupliquer en shader custom » dans l'onglet Generator peut donc
produire un paquet `ptm-effect` éditable à partir de n'importe quel générateur. Les `#include`
sont conservés tels quels, puisque la bibliothèque GLSL partagée est disponible pour les
shaders custom. C'est le meilleur point de départ pour apprendre : on modifie une flamme qui
marche déjà.

Pour les simulations (passes `seed`, `step` et `render`), on pourra dupliquer plus tard via
un format « grid-simulation ». Ce format décrirait plusieurs passes, comme le fait
`GridSimulationSpec`.

### Importer depuis Shadertoy

Les shaders Shadertoy ont une forme fixe : `void mainImage(out vec4 fragColor, in vec2
fragCoord)` avec `iResolution`, `iTime`, `iMouse`, `iFrame` et `iChannel0..3`. Un adaptateur
peut les envelopper automatiquement :

```glsl
// Généré à l'import
#define iResolution vec3(u_resolution, 1.0)
#define iTime u_time
#define iFrame int(u_time * 60.0)
#define iMouse vec4(0.0)
// … code Shadertoy collé tel quel …
vec4 generate(vec2 uv) {
  vec4 c;
  mainImage(c, uv * u_resolution);
  return c;
}
```

- **Ce qui marche directement** : les shaders à un seul passage (« Image ») sans texture, ce
  qui couvre la majorité des effets procéduraux.
- **Ce qu'il faut adapter** :
  - `iChannel` pointant vers des textures : on peut fournir à la place des textures de bruit
    générées, équivalentes aux « noise » de Shadertoy ;
  - les buffers multi-passes (Buffer A…D) : ils correspondent à une simulation en grille ;
  - le son, le clavier et `iMouse` : non pertinents ici.
- **Contraintes en plus** :
  - le résultat n'est pas forcément tuilable ;
  - les shaders ne sont pas pensés pour une rampe de couleurs (ils sortent souvent de la
    couleur). L'import proposera « Source colors » par défaut.
- **Licence** : sauf mention contraire de l'auteur, les shaders Shadertoy sont sous **CC
  BY-NC-SA 3.0**. Cela impose de **conserver l'attribution** (auteur et lien), de ne pas en
  faire d'usage commercial et de partager sous la même licence. L'import doit enregistrer
  l'auteur, l'URL et la licence dans le paquet, puis les afficher. La publication d'un
  shader importé dans la bibliothèque doit reprendre la licence d'origine.

## Documentation à écrire

Publier ne suffit pas : pour que les contributions soient cohérentes, il faut une
documentation d'auteur, accessible depuis l'éditeur. À prévoir :

- **Paramètres** : les types (`float`, `int`, `select`, `bool`, `color`, `vec2`, `gradient`,
  `text`), le nom des uniforms (`u_<clé>`), les noms réservés (`RESERVED_UNIFORMS`), les
  groupes et modules (`toggle`), les unités, `resetOnChange`, les descriptions. Il faut aussi
  des conseils sur les plages : des bornes qui donnent toujours un résultat lisible, une
  valeur par défaut qui montre l'effet.
- **Catégories et familles** : quand utiliser Sprites & Impacts, Fire & Smoke, Light &
  Energy, Stylized FX, Underworld FX, Noise ou Shapes & Patterns. Et comment proposer une
  nouvelle catégorie.
- **Conventions GLSL** :
  - `uv` dans [0, 1] avec y vers le haut, `centered()` ;
  - sortir des niveaux de gris (la rampe colorise), ou une couleur assumée et alors
    `colorMode: 0` ;
  - l'alpha et `alphaMode` ;
  - le tuilage (bruits périodiques, `period`) ;
  - le temps (`u_time`, boucle forcée) et l'anti-aliasing (`fwidth`, `u_resolution`) ;
  - la performance : boucles bornées, pas de branche coûteuse par pixel.
- **Bibliothèque GLSL** : la référence des fonctions disponibles (`noise`, `sdf`, `common`),
  générée automatiquement à partir des commentaires des fichiers `.glsl`.
- **Presets** : nommer par l'aspect obtenu et jamais d'après un autre générateur, choisir un
  `featuredPreset` représentatif, et utiliser les raccourcis de post (`posterize: 4`…).
- **Publication** : les critères de modération, la licence choisie par l'auteur (la proposer
  explicitement : CC0, CC BY, CC BY-NC-SA…) et l'attribution des sources.

Les fichiers `docs/development/authoring.md` et `agents.md` couvrent déjà une partie de ce
contenu pour les développeurs. La documentation d'auteur en serait la version publique et
illustrée.

## Sécurité

- **Les presets ne posent pas de problème** : ce sont des données, validées et bornées.
- **Les shaders custom ne sont pas du JavaScript**. Le GLSL ne peut ni lire la page, ni faire de
  requêtes réseau, ni accéder aux fichiers. Le risque réel est le **déni de service GPU**
  (boucle infinie, onglet figé, perte du contexte WebGL). Mesures :
  - les shaders publiés ne sont jamais exécutés automatiquement : il faut cliquer pour les
    compiler ;
  - la vignette est un PNG statique ;
  - les tailles de boucle sont plafonnées (refus des boucles sans borne constante à la
    validation) et le code ne peut pas dépasser une certaine taille ;
  - un système de signalement et de modération est en place.
- Les noms et descriptions sont affichés en texte, jamais en HTML (le helper `h()` utilise déjà
  `textContent`).
- Le serveur limite le débit des publications et des likes, et limite la taille des paquets
  (environ 64 Ko plus la vignette).

## Ordre conseillé

Les étapes 1 et 2 apportent de la valeur immédiatement et figent le format. Les étapes 3 à 5
n'ont de sens qu'une fois le site hébergé publiquement et avec quelques utilisateurs ; elles
ajoutent une base de données, des sauvegardes et de la modération à maintenir.
