#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "docker compose is required but was not found" >&2
  exit 1
fi

cd "$SCRIPT_DIR/.."

$COMPOSE_CMD --env-file "$SCRIPT_DIR/graph-lab.env" -f "$SCRIPT_DIR/compose.yaml" up -d --build
