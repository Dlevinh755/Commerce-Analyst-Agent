COMPOSE_APP := docker compose --env-file .env -f compose/infra.yml -f compose/app.yml
COMPOSE_ALL := docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml

.PHONY: help up up-tools down ps logs restart config build

help:
	@echo "Available commands:"
	@echo "  make up                         Start infra + app"
	@echo "  make up-tools                   Start infra + app + tools"
	@echo "  make down                       Stop infra + app + tools"
	@echo "  make ps                         Show container status"
	@echo "  make logs SERVICE=order_service Follow logs for a service"
	@echo "  make restart SERVICE=gateway    Restart a service"
	@echo "  make config                     Validate compose config"
	@echo "  make build                      Build infra + app images"

up:
	$(COMPOSE_APP) up -d

up-tools:
	$(COMPOSE_ALL) up -d

down:
	$(COMPOSE_ALL) down

ps:
	$(COMPOSE_ALL) ps

logs:
	@if [ -z "$(SERVICE)" ]; then echo "Usage: make logs SERVICE=order_service"; exit 1; fi
	$(COMPOSE_ALL) logs -f $(SERVICE)

restart:
	@if [ -z "$(SERVICE)" ]; then echo "Usage: make restart SERVICE=gateway"; exit 1; fi
	$(COMPOSE_APP) restart $(SERVICE)

config:
	$(COMPOSE_ALL) config --quiet

build:
	$(COMPOSE_APP) build
