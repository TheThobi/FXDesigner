# Runs the Node toolchain in Docker so no local Node install is required.
# With Node >= 20 installed locally you can use `npm run <script>` directly instead.
NODE_IMAGE ?= node:22-alpine
# node_modules lives in a named Docker volume, not in the working tree: native binaries
# (rolldown, esbuild) are OS-specific, so a Linux install must never overwrite (or reuse) the
# host's Windows/macOS one. `make install` fills the volume; host `npm ci` stays independent.
NODE_MODULES_VOLUME ?= ptm_node_modules
DOCKER_RUN = docker run --rm -it -e npm_config_cache=/tmp/.npm -v "$(CURDIR)":/app \
	-v $(NODE_MODULES_VOLUME):/app/node_modules -w /app
NPM = $(DOCKER_RUN) $(NODE_IMAGE) npm

.PHONY: install dev build test check lint format image up down e2e

install:          ## Install dependencies
	$(NPM) ci

dev:              ## Dev server with hot reload on http://localhost:5173
	$(DOCKER_RUN) -p 5173:5173 $(NODE_IMAGE) sh -c "[ -x node_modules/.bin/vite ] || npm ci; npm run dev"

build:            ## Production build into dist/
	$(NPM) run build

test:             ## Unit tests
	$(NPM) test

check:            ## Typecheck + lint + unit tests (run before committing)
	$(NPM) run check

lint:
	$(NPM) run lint

format:
	$(NPM) run format

image:            ## Build the production Docker image
	docker build -t fx-designer .

up:               ## Run the production image locally on http://localhost:8080
	docker compose up -d --build

down:
	docker compose down

PLAYWRIGHT_IMAGE ?= mcr.microsoft.com/playwright:v1.65.1-noble

e2e:              ## End-to-end smoke tests in the Playwright image (screenshots in test-results/)
	docker run --rm --ipc=host -e npm_config_cache=/tmp/.npm -v "$(CURDIR)":/app \
		-v $(NODE_MODULES_VOLUME):/app/node_modules -w /app $(PLAYWRIGHT_IMAGE) \
		sh -c "[ -x node_modules/.bin/vite ] || npm ci; npx playwright test"
