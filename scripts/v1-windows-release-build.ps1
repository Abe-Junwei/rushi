# Local Windows release build — portable zip (+ optional NSIS). CI uploads on tag push.
# Run from repo root on Windows x64:
#   npm run release:win
# Optional env:
#   RUSHI_SKIP_BUNDLED_MODELS_STAGE=1
#   RUSHI_SKIP_SIDECAR_SIGN=1
# Signing (optional): SIGNTOOL, SIGN_PFX, SIGN_PASS — see sign-windows-sidecar.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-Npm {
  param([Parameter(Mandatory)][string[]] $Args)
  & npm @Args
  if ($LASTEXITCODE -ne 0) { throw "npm $($Args -join ' ') failed with exit $LASTEXITCODE" }
}

Write-Host "== Windows release preflight =="
Invoke-Npm @("run", "typecheck")
Invoke-Npm @("run", "test", "-w", "@rushi/desktop")
& node scripts/check-architecture-guard.mjs
if ($LASTEXITCODE -ne 0) { throw "architecture guard failed" }

Write-Host "== build ASR sidecars =="
Invoke-Npm @("run", "asr:build-sidecar-windows-cpu")
Invoke-Npm @("run", "asr:build-sidecar-windows-cuda")

$cpuExe = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar\rushi-asr-sidecar.exe"
$cudaExe = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda\rushi-asr-sidecar-cuda.exe"
foreach ($path in @($cpuExe, $cudaExe)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing sidecar: $path" }
}

if ($env:RUSHI_SKIP_SIDECAR_SIGN -ne "1") {
  Write-Host "== sign sidecars (optional) =="
  & pwsh (Join-Path $Root "scripts\sign-windows-sidecar.ps1")
} else {
  Write-Host "SKIP: RUSHI_SKIP_SIDECAR_SIGN=1"
}

Write-Host "== sidecar health smoke =="
& pwsh (Join-Path $Root "scripts\smoke-asr-sidecar-health.ps1")
if ($LASTEXITCODE -ne 0) { throw "sidecar health smoke failed" }

if ($env:RUSHI_SKIP_BUNDLED_MODELS_STAGE -ne "1") {
  Write-Host "== stage bundled ASR models (Plan B) =="
  Invoke-Npm @("run", "asr:stage-bundled-models")
  & bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh")
  if ($LASTEXITCODE -ne 0) { throw "bundled-asr-models preflight failed" }
} else {
  Write-Host "SKIP: RUSHI_SKIP_BUNDLED_MODELS_STAGE=1"
}

Write-Host "== Tauri build (Windows exe) =="
Push-Location (Join-Path $Root "apps\desktop")
try {
  Invoke-Npm @("run", "tauri", "--", "build", "--no-bundle")
} finally {
  Pop-Location
}

Write-Host "== Tauri NSIS (optional) =="
Push-Location (Join-Path $Root "apps\desktop")
try {
  Invoke-Npm @("run", "tauri", "--", "build", "--bundles", "nsis")
} catch {
  Write-Warning "NSIS bundle failed or skipped: $_"
} finally {
  Pop-Location
}

Write-Host "== portable zip =="
$TauriRoot = Join-Path $Root "apps\desktop\src-tauri"
$Exe = Join-Path $TauriRoot "target\release\rushi-desktop.exe"
if (-not (Test-Path -LiteralPath $Exe)) { throw "Missing $Exe" }

$Stage = Join-Path $Root "dist\windows-portable"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
Copy-Item $Exe (Join-Path $Stage "rushi-desktop.exe")
Copy-Item (Join-Path $TauriRoot "resources") (Join-Path $Stage "resources") -Recurse

$Zip = Join-Path $Root "windows-portable-x64.zip"
if (Test-Path $Zip) { Remove-Item -Force $Zip }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip

$HashPath = "$Zip.sha256"
(Get-FileHash -Algorithm SHA256 -Path $Zip).Hash.ToLower() | Set-Content -Path $HashPath -NoNewline
Add-Content -Path $HashPath -Value "  windows-portable-x64.zip"

$NsisGlob = Join-Path $TauriRoot "target\release\bundle\nsis\*-setup.exe"
$NsisFiles = Get-ChildItem -Path $NsisGlob -ErrorAction SilentlyContinue
foreach ($nsis in $NsisFiles) {
  $nsisSha = "$($nsis.FullName).sha256"
  (Get-FileHash -Algorithm SHA256 -Path $nsis.FullName).Hash.ToLower() | Set-Content -Path $nsisSha -NoNewline
  Add-Content -Path $nsisSha -Value "  $($nsis.Name)"
}

Write-Host ""
Write-Host "OK: Windows release build finished."
Get-Item $Zip
if ($NsisFiles) { $NsisFiles | ForEach-Object { Get-Item $_.FullName } }
Write-Host "Portable: $Zip"
Write-Host "SHA256:   $HashPath"
