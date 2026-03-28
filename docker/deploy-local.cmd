@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "ENV_FILE=%SCRIPT_DIR%graph-lab.env"
set "COMPOSE_FILE=%SCRIPT_DIR%compose.yaml"

docker version >nul 2>&1
if errorlevel 1 (
  echo docker is required but was not found.
  exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
  echo docker compose is required but was not found.
  exit /b 1
)

docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d --build
if errorlevel 1 exit /b 1

echo Graph Lab is starting on http://localhost:4173
