# Déploiement sur OpenMediaVault

L'application est un site statique servi par nginx dans un conteneur (image ~75 Mo,
utilisateur non-root, système de fichiers en lecture seule, port **8080**, `GET /healthz`).

## Prérequis

- OMV 6/7 avec **omv-extras** et le plugin **openmediavault-compose** (Docker).
- Un dossier partagé pour les fichiers compose (configuré dans _Services › Compose › Settings_).

## Option A — construire sur le NAS (le plus simple)

1. Copier le dépôt sur le NAS (ex. `git clone` dans un dossier partagé `apps/fx-designer`).
2. Dans le dossier : `docker compose up -d --build`
   (ou via l'UI : _Services › Compose › Files › Add_, coller le contenu de `docker-compose.yml`,
   puis _Up_. Avec l'UI, le `build: .` exige que le chemin du fichier pointe vers le dépôt —
   sinon utiliser l'option B.)
3. Ouvrir `http://<ip-du-nas>:8080`.

Mise à jour : `git pull && docker compose up -d --build`.

> Ancien nom : jusqu'à la v0.1 l'outil s'appelait « Procedural Texture Maker » (image et
> conteneur `procedural-texture-maker`). Le service compose garde le même nom, donc
> `docker compose up -d --build` remplace l'ancien conteneur ; supprimer ensuite l'ancienne image
> avec `docker image rm procedural-texture-maker:latest`. Les documents et la sauvegarde
> automatique du navigateur restent compatibles.

## Option B — construire ailleurs, déployer l'image

```sh
# Sur la machine de dev (adapter l'architecture si le NAS est ARM : --platform linux/arm64)
docker build -t fx-designer:latest .
docker save fx-designer:latest | gzip > fx-designer.tar.gz
scp fx-designer.tar.gz nas:/tmp/
ssh nas 'gunzip -c /tmp/fx-designer.tar.gz | docker load'
```

Puis sur OMV, un compose sans `build:` :

```yaml
services:
  texture-maker:
    image: fx-designer:latest
    restart: unless-stopped
    ports: ['8080:8080']
    read_only: true
    tmpfs: [/tmp]
    security_opt: [no-new-privileges:true]
```

## Option C — sans Docker

`npm run build` puis copier `dist/` dans n'importe quel serveur web statique (nginx d'OMV,
Caddy…). Le build utilise des chemins **relatifs** : il fonctionne aussi dans un sous-dossier
(`https://nas.local/textures/`).

## HTTPS (recommandé)

Sans HTTPS l'application fonctionne, mais le navigateur n'autorise pas l'API presse-papiers :
« Share link » affiche alors le lien dans une boîte de dialogue au lieu de le copier.
Pour HTTPS : reverse proxy (Nginx Proxy Manager, Traefik, Caddy, SWAG…) devant le port 8080.

Exemple Caddy :

```
textures.mondomaine.fr {
    reverse_proxy fx-designer:8080
}
```

## Notes

- Aucune donnée n'est stockée côté serveur (autosave = `localStorage` du navigateur).
- Les fichiers `assets/*` sont fingerprintés et mis en cache 1 an ; `index.html` est toujours
  revalidé, donc une mise à jour est visible immédiatement.
