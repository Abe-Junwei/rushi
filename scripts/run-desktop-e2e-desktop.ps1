# Run desktop-ui Playwright e2e on Windows (avoids Unix-style VAR=val in npm scripts).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")
Set-Location $Root
$env:PW_DESKTOP_WEBSERVER = "1"
$E2eArgs = @($args)
Invoke-RushiNativeChecked -FailMessage "playwright e2e desktop-ui failed" -Command {
  & npm run test:e2e -w @rushi/desktop -- --project=desktop-ui @E2eArgs
}
