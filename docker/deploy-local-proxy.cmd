@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "ENV_FILE=%SCRIPT_DIR%graph-lab.env"
set "COMPOSE_FILE=%SCRIPT_DIR%compose.yaml"
set "PROXY_URL=http://127.0.0.1:10808"
set "BUILD_PROXY_URL=http://host.docker.internal:10808"

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

set "HTTP_PROXY=%PROXY_URL%"
set "HTTPS_PROXY=%PROXY_URL%"
set "ALL_PROXY=%PROXY_URL%"
set "NO_PROXY=localhost,127.0.0.1,host.docker.internal,api,web"
set "http_proxy=%PROXY_URL%"
set "https_proxy=%PROXY_URL%"
set "all_proxy=%PROXY_URL%"
set "no_proxy=%NO_PROXY%"

set "BUILD_HTTP_PROXY=%BUILD_PROXY_URL%"
set "BUILD_HTTPS_PROXY=%BUILD_PROXY_URL%"
set "BUILD_ALL_PROXY=%BUILD_PROXY_URL%"
set "BUILD_NO_PROXY=%NO_PROXY%"

docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d --build
if errorlevel 1 exit /b 1

echo Graph Lab is starting on http://localhost:4173 via proxy %PROXY_URL%
