param(
  [Parameter(Mandatory = $true, Position = 0)][string]$FilePath
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")

foreach ($name in @("SIGNTOOL", "SIGN_PFX", "SIGN_PASS")) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Tauri Authenticode sign command requires $name."
  }
}
if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Tauri sign target does not exist: $FilePath"
}

Invoke-RushiNativeChecked -FailMessage "signtool sign failed for $FilePath" -Command {
  & $env:SIGNTOOL sign /fd SHA256 /f $env:SIGN_PFX /p $env:SIGN_PASS /tr http://timestamp.digicert.com /td SHA256 $FilePath
}
Invoke-RushiNativeChecked -FailMessage "signtool verification failed for $FilePath" -Command {
  & $env:SIGNTOOL verify /pa $FilePath
}
Write-Host "Authenticode signed and verified: $FilePath"
