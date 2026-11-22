# Déploiement avec comptes (serveur + PostgreSQL, mise à jour automatique)

Ce mode sert l'application **et** l'API des comptes (inscription pseudo / email / mot de passe,
connexion Discord, bibliothèque sauvegardée sur le compte). Il reprend le principe du setup du
portfolio (un conteneur qui clone le dépôt, build et redéploie à chaque commit) avec deux
améliorations :

- chaque version est construite **à côté** de celle en ligne et n'est basculée que si le build
  réussit **et** que le nouveau serveur répond : un commit cassé ne coupe jamais le site ;
- si la nouvelle version ne démarre pas, l'ancienne revient automatiquement (rollback), et un
  serveur qui plante est relancé.

Le déploiement statique (nginx, sans comptes) de [static.md](static.md) reste possible.

## 1. PostgreSQL sur le même serveur (réseau Docker local)

La base reste dans son propre conteneur. Les deux conteneurs se parlent par un **réseau Docker
partagé**, sans exposer PostgreSQL sur le réseau de la machine.

Dans le `docker-compose.yml` de PostgreSQL :

```yaml
services:
  postgres:
    image: postgres:17          # 13 minimum
    container_name: postgres    # = PGHOST dans le .env de FX Designer
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

Puis `docker compose up -d` dans ce dossier (le réseau `shared-db` est créé). Le compose de FX
Designer s'y branche (`DB_NETWORK=shared-db`).

Créer la base et l'utilisateur, une fois (changer le mot de passe dans le fichier avant) :

```sh
docker exec -i postgres psql -U postgres < deploy/postgres/init.sql
```

Les tables sont créées et migrées par le serveur à son démarrage.

## 2. Application Discord (connexion « Continue with Discord »)

1. <https://discord.com/developers/applications> → *New Application*.
2. *OAuth2* → *Redirects* : `https://VOTRE-DOMAINE/api/auth/discord/callback`.
3. Copier *Client ID* et *Client Secret* dans le `.env`.

Sans ces deux valeurs, le bouton Discord n'apparaît pas (inscription email / mot de passe
seulement).

## 3. Le conteneur FX Designer

Sur le serveur :

```sh
mkdir -p /home/docker/fx-designer && cd /home/docker/fx-designer
# copier ici le contenu de deploy/autoupdate/ (Dockerfile, docker-compose.yml, start.sh)
# et .env.example sous le nom .env, puis remplir .env
docker compose up -d --build
docker logs -f fx-designer
```

Le premier démarrage clone, installe et build (quelques minutes) ; ensuite chaque push sur
`BRANCH` est déployé en ~1 minute (`POLL_SECONDS`). Le dépôt étant public, `REPO_URL` n'a pas
besoin de jeton.

Mettre le reverse proxy HTTPS habituel devant le port `3010` (modifiable dans le compose), avec
`PUBLIC_URL=https://VOTRE-DOMAINE` et `TRUST_PROXY=1`.

## 4. Secrets et fichiers `.env`

- `.env.example` (versionné) : le modèle, avec toutes les variables commentées.
- `.env` (**jamais versionné**, ignoré par git) : les vraies valeurs, uniquement sur le
  serveur, à côté du `docker-compose.yml`.

Le dépôt est public : un `.env` committé publierait le mot de passe de la base, le secret
Discord… et resterait dans l'historique git même après suppression. Pour garder une copie des
vraies valeurs, utiliser un gestionnaire de mots de passe ou un fichier hors du dépôt.

## 5. Différences avec le setup du portfolio

| Portfolio | FX Designer |
| --- | --- |
| build dans le dossier du dépôt, l'app tourne depuis ce dossier | build dans le dépôt, copie dans `next/`, bascule vers `live/` si OK |
| build cassé : l'ancienne version continue, mais les fichiers sont déjà écrasés | build cassé : rien n'est touché |
| pas de vérification après redémarrage | contrôle `/healthz`, rollback automatique |
| clé GitHub dans `REPO_URL` | inutile (dépôt public) |
| variables listées une à une dans le compose | `env_file: .env` |

## 6. Sauvegardes

```sh
docker exec postgres pg_dump -U fxdesigner fxdesigner | gzip > fxdesigner-$(date +%F).sql.gz
```

Chaque utilisateur peut aussi exporter sa bibliothèque (File → Save library).
