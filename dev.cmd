@echo off
setlocal

set "COMMAND=%~1"
set "SERVICE=%~2"

if "%COMMAND%"=="" set "COMMAND=help"

set "APP_COMPOSE=docker compose --env-file .env -f compose/infra.yml -f compose/app.yml"
set "ALL_COMPOSE=docker compose --env-file .env -f compose/infra.yml -f compose/app.yml -f compose/tools.yml"

if /I "%COMMAND%"=="up" (
    %APP_COMPOSE% up -d
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="up-tools" (
    %ALL_COMPOSE% up -d
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="down" (
    %ALL_COMPOSE% down
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="ps" (
    %ALL_COMPOSE% ps
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="logs" (
    if "%SERVICE%"=="" (
        echo Usage: dev logs order_service
        exit /b 1
    )
    %ALL_COMPOSE% logs -f %SERVICE%
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="restart" (
    if "%SERVICE%"=="" (
        echo Usage: dev restart gateway
        exit /b 1
    )
    %APP_COMPOSE% restart %SERVICE%
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="config" (
    %ALL_COMPOSE% config --quiet
    exit /b %ERRORLEVEL%
)

if /I "%COMMAND%"=="build" (
    %APP_COMPOSE% build
    exit /b %ERRORLEVEL%
)

echo Available commands:
echo   dev up                         Start infra + app
echo   dev up-tools                   Start infra + app + tools
echo   dev down                       Stop infra + app + tools
echo   dev ps                         Show container status
echo   dev logs order_service         Follow logs for a service
echo   dev restart gateway            Restart a service
echo   dev config                     Validate compose config
echo   dev build                      Build infra + app images

exit /b 0
