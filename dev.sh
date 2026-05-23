#!/usr/bin/env sh
set -eu

COMMAND="${1:-help}"
SERVICE="${2:-}"

APP_COMPOSE="docker compose --env-file .env -f compose/infra.yml -f compose/app.yml"
ALL_COMPOSE="docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml"

show_help() {
  cat <<'EOF'
Available commands:
  ./dev.sh up                         Start infra + app
  ./dev.sh up-tools                   Start infra + app + tools
  ./dev.sh down                       Stop infra + app + tools
  ./dev.sh ps                         Show container status
  ./dev.sh logs order_service         Follow logs for a service
  ./dev.sh restart gateway            Restart a service
  ./dev.sh config                     Validate compose config
  ./dev.sh build                      Build infra + app images
EOF
}

case "$COMMAND" in
  up)
    $APP_COMPOSE up -d
    ;;
  up-tools)
    $ALL_COMPOSE up -d
    ;;
  down)
    $ALL_COMPOSE down
    ;;
  ps)
    $ALL_COMPOSE ps
    ;;
  logs)
    if [ -z "$SERVICE" ]; then
      echo "Usage: ./dev.sh logs order_service" >&2
      exit 1
    fi
    $ALL_COMPOSE logs -f "$SERVICE"
    ;;
  restart)
    if [ -z "$SERVICE" ]; then
      echo "Usage: ./dev.sh restart gateway" >&2
      exit 1
    fi
    $APP_COMPOSE restart "$SERVICE"
    ;;
  config)
    $ALL_COMPOSE config --quiet
    ;;
  build)
    $APP_COMPOSE build
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    show_help
    exit 1
    ;;
esac
