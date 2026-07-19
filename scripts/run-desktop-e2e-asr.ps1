# Run ASR Playwright e2e on Windows (avoids Unix-style VAR=val in npm scripts).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")
Set-Location $Root
$env:PW_ASR_MOCK_WEBSERVER = "1"
$env:PW_ASR_BASE_URL = "http://127.0.0.1:18741"
$env:PW_ASR_MOCK_PORT = "18741"
$E2eArgs = @($args)
Invoke-RushiNativeChecked -FailMessage "playwright e2e asr-api failed" -Command {
  & npm run test:e2e -w @rushi/desktop -- --project=asr-api @E2eArgs
}
