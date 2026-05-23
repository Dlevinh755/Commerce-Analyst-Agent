param(
    [Parameter(Position = 0)]
    [string]$Command = "help",

    [Parameter(Position = 1)]
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

$AppComposeFiles = @(
    "--env-file", ".env",
    "-f", "compose/infra.yml",
    "-f", "compose/app.yml"
)

$AllComposeFiles = @(
    "--env-file", ".env",
    "-f", "compose/infra.yml",
    "-f", "compose/app.yml",
    "-f", "compose/tools.yml"
)

function Invoke-DockerCompose {
    param(
        [string[]]$ComposeFiles,
        [string[]]$ComposeCommand
    )

    & docker compose @ComposeFiles @ComposeCommand
    exit $LASTEXITCODE
}

function Show-Help {
    Write-Host "Available commands:"
    Write-Host "  .\dev.ps1 up                         Start infra + app"
    Write-Host "  .\dev.ps1 up-tools                   Start infra + app + tools"
    Write-Host "  .\dev.ps1 down                       Stop infra + app + tools"
    Write-Host "  .\dev.ps1 ps                         Show container status"
    Write-Host "  .\dev.ps1 logs order_service         Follow logs for a service"
    Write-Host "  .\dev.ps1 restart gateway            Restart a service"
    Write-Host "  .\dev.ps1 config                     Validate compose config"
    Write-Host "  .\dev.ps1 build                      Build infra + app images"
}

switch ($Command.ToLowerInvariant()) {
    "up" {
        Invoke-DockerCompose $AppComposeFiles @("up", "-d")
    }
    "up-tools" {
        Invoke-DockerCompose $AllComposeFiles @("up", "-d")
    }
    "down" {
        Invoke-DockerCompose $AllComposeFiles @("down")
    }
    "ps" {
        Invoke-DockerCompose $AllComposeFiles @("ps")
    }
    "logs" {
        if ([string]::IsNullOrWhiteSpace($Service)) {
            Write-Error "Usage: .\dev.ps1 logs order_service"
        }
        Invoke-DockerCompose $AllComposeFiles @("logs", "-f", $Service)
    }
    "restart" {
        if ([string]::IsNullOrWhiteSpace($Service)) {
            Write-Error "Usage: .\dev.ps1 restart gateway"
        }
        Invoke-DockerCompose $AppComposeFiles @("restart", $Service)
    }
    "config" {
        Invoke-DockerCompose $AllComposeFiles @("config", "--quiet")
    }
    "build" {
        Invoke-DockerCompose $AppComposeFiles @("build")
    }
    default {
        Show-Help
    }
}
