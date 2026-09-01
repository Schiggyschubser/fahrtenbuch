SHELL := /bin/sh

.PHONY: init build up down restart logs ps dev dev-down dev-logs test lint backup clean-dev reset-admin git-init version version-check

init:
	@test -f .env || cp .env.example .env
	@mkdir -p data data-dev
	@echo "Konfiguration angelegt. Prüfe bei Bedarf die Datei .env."

build: init
	docker compose build --pull

up: init
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart fahrtenbuch

logs:
	docker compose logs -f fahrtenbuch

ps:
	docker compose ps

dev: init
	docker compose -f docker-compose.dev.yaml up --build

dev-down:
	docker compose -f docker-compose.dev.yaml down

dev-logs:
	docker compose -f docker-compose.dev.yaml logs -f fahrtenbuch-dev

test:
	docker compose -f docker-compose.dev.yaml run --rm fahrtenbuch-dev npm test

lint:
	docker compose -f docker-compose.dev.yaml run --rm fahrtenbuch-dev npm run lint

backup:
	./scripts/backup-host.sh

clean-dev:
	docker compose -f docker-compose.dev.yaml down -v

reset-admin:
	docker compose exec fahrtenbuch node scripts/reset-admin.mjs


git-init:
	./scripts/init-git.sh

version:
	@cat VERSION

version-check:
	node scripts/version-check.mjs
