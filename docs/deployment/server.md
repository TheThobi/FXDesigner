# Déploiement avec comptes (serveur + PostgreSQL)

L'image Docker du dépôt est le serveur Node de FX Designer. Sans base de données, il sert
seulement l'application ([static.md](static.md)). Avec PostgreSQL, il sert aussi l'API des
comptes : inscription pseudo / email / mot de passe, connexion Discord, bibliothèque
sauvegardée sur le compte et communauté.

## 1. PostgreSQL sur le même serveur (réseau Docker local)

La base reste dans son propre conteneur. Les deux conteneurs se parlent par un **réseau Docker
partagé**, sans exposer PostgreSQL sur le réseau de la machine.

Dans le `docker-compose.yml` de PostgreSQL :

```yaml
services:
  postgres:
    image: postgres:17 # 13 minimum
    container_name: postgres # = PGHOST dans le .env de FX Designer
    # ...
    networks:
      - default
      - shared-db
    # Plus besoin de publier 5432 : supprimer `ports: - "5432:5432"`,
    # ou le limiter à la machine : "127.0.0.1:5432:5432".

networks:
  shared-db:
    name: shared-db
```

Puis `docker compose up -d` dans ce dossier (le réseau `shared-db` est créé).

Créer la base et l'utilisateur, une fois (choisir un vrai mot de passe) :

```sh
docker exec -i postgres psql -U postgres <<'SQL'
CREATE ROLE fxdesigner LOGIN PASSWORD 'change-me';
CREATE DATABASE fxdesigner OWNER fxdesigner;
SQL
```

Les tables sont créées et migrées par le serveur à son démarrage.

## 2. Application Discord (connexion « Continue with Discord »)

1. <https://discord.com/developers/applications> → _New Application_.
2. _OAuth2_ → _Redirects_ : `https://VOTRE-DOMAINE/api/auth/discord/callback`.
3. Copier _Client ID_ et _Client Secret_ dans le `.env`.

Sans ces deux valeurs, le bouton Discord n'apparaît pas (inscription email / mot de passe
seulement).

## 3. Le conteneur FX Designer

Sur le serveur :

```sh
git clone https://github.com/OWNER/REPO.git /home/docker/fx-designer
cd /home/docker/fx-designer
cp .env.example .env      # puis remplir .env (PUBLIC_URL, PG*, Discord…)
```

Brancher le conteneur sur le réseau de la base avec un `docker-compose.override.yml` à côté
du `docker-compose.yml` (lu automatiquement par `docker compose`, à ne pas committer) :

```yaml
services:
  texture-maker:
    networks: [default, shared-db]

networks:
  shared-db:
    external: true
```

Puis :

```sh
docker compose up -d --build
docker logs -f fx-designer
```

Le serveur écoute sur le port **8080** du conteneur (publié tel quel par le compose). Mettre le
reverse proxy HTTPS habituel devant, avec `PUBLIC_URL=https://VOTRE-DOMAINE` et
`TRUST_PROXY=1` dans le `.env`.

Mise à jour : `git pull && docker compose up -d --build`. L'ancien conteneur tourne jusqu'à
ce que la nouvelle image soit construite : un build cassé ne coupe pas le site.

## 4. Secrets et fichiers `.env`

- `.env.example` (versionné) : le modèle, avec toutes les variables commentées.
- `.env` (**jamais versionné**, ignoré par git et par le build Docker) : les vraies valeurs,
  uniquement sur le serveur, à côté du `docker-compose.yml`.

Le dépôt est public : un `.env` committé publierait le mot de passe de la base, le secret
Discord… et resterait dans l'historique git même après suppression. Pour garder une copie des
vraies valeurs, utiliser un gestionnaire de mots de passe ou un fichier hors du dépôt.

## 5. Sauvegardes

```sh
docker exec postgres pg_dump -U fxdesigner fxdesigner | gzip > fxdesigner-$(date +%F).sql.gz
```

Chaque utilisateur peut aussi exporter sa bibliothèque (File → Save library).

## 6. Communauté

La fenêtre Community utilise la même base : la migration 2 crée `community_systems` et
`community_subscriptions` au démarrage, rien à configurer. Sans base de données, la fenêtre
affiche « The community is unavailable ». Les catégories se modifient dans
`server/src/community.ts` (`COMMUNITY_CATEGORIES`) ; leurs identifiants sont stockés, ne pas les
renommer sans migration.

**Modération.** Les utilisateurs connectés peuvent signaler un système (« Report… » sur sa
carte ou sa page). À partir de 3 signalements de personnes différentes, il est masqué en
attendant une décision : seuls son auteur et les modérateurs le voient encore. Les modérateurs
sont les pseudos listés dans `MODERATORS` (`.env`, séparés par des virgules) : un bouton
« Moderation » apparaît alors dans la fenêtre Community, avec la file des systèmes signalés et
leurs motifs. Pour chacun : masquer, rétablir (efface les signalements), ignorer les
signalements ou supprimer.
