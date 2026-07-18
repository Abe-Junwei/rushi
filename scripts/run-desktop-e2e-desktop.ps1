# Run desktop-ui Playwright e2e on Windows (avoids Unix-style VAR=val in npm scripts).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:PW_DESKTOP_WEBSERVER = "1"
npm run test:e2e -w @rushi/desktop -- --project=desktop-ui @($args)
