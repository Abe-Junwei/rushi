# Local Windows release build — NSIS installer (OTA) + portable zip. CI uploads on tag push.
# Run from repo root on Windows x64:
#   npm run release:win
# Optional env:
#   RUSHI_SKIP_BUNDLED_MODELS_STAGE=0  # opt-in: stage Plan B into NSIS (default skip — makensis limit)
#   RUSHI_SKIP_SIDECAR_SIGN=1
#   RUSHI_SKIP_CUDA_CDN=1          # skip post-NSIS CUDA zip (default: build CUDA for local CDN staging)
# Signing (optional): SIGNTOOL, SIGN_PFX, SIGN_PASS — see sign-windows-sidecar.ps1
# Manifest URL (injected into release shell):
#   $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL = "https://updates.rushi.app/runtime/rushi-runtime-manifest.json"

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

Write-Host "== build ASR sidecar (CPU only for NSIS) =="
Invoke-Npm @("run", "asr:build-sidecar-windows-cpu")

$cpuExe = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar\rushi-asr-sidecar.exe"
if (-not (Test-Path -LiteralPath $cpuExe)) { throw "Missing sidecar: $cpuExe" }

$cudaDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda"
if (Test-Path -LiteralPath $cudaDir) {
  Write-Host "Removing staged CUDA onedir before NSIS - CDN opt-in"
  Remove-Item -Recurse -Force $cudaDir
}

if ($env:RUSHI_SKIP_SIDECAR_SIGN -ne "1") {
  Write-Host "== sign CPU sidecar (optional) =="
  & pwsh (Join-Path $Root "scripts\sign-windows-sidecar.ps1")
} else {
  Write-Host "SKIP: RUSHI_SKIP_SIDECAR_SIGN=1"
}

Write-Host "== sidecar health smoke =="
& pwsh (Join-Path $Root "scripts\smoke-asr-sidecar-health.ps1")
if ($LASTEXITCODE -ne 0) { throw "sidecar health smoke failed" }

if ($env:RUSHI_SKIP_BUNDLED_MODELS_STAGE -eq "0") {
  Write-Host "== stage bundled ASR models - Plan B explicit opt-in =="
  Invoke-Npm @("run", "asr:stage-bundled-models")
  & bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh")
  if ($LASTEXITCODE -ne 0) { throw "bundled-asr-models preflight failed" }
} else {
  Write-Host "SKIP: Plan B models omitted from Windows NSIS. Set RUSHI_SKIP_BUNDLED_MODELS_STAGE=0 to force stage."
}

Write-Host "== measure bundle size spike =="
& pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1")

if (-not $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL) {
  $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL = "https://updates.rushi.app/runtime/rushi-runtime-manifest.json"
}
Write-Host "== Tauri build NSIS - manifest URL=$($env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL) =="
Push-Location (Join-Path $Root "apps\desktop")
try {
  Invoke-Npm @("run", "tauri", "--", "build", "--bundles", "nsis")
} finally {
  Pop-Location
}

$TauriRoot = Join-Path $Root "apps\desktop\src-tauri"
$BundleRoot = Join-Path $TauriRoot "target\release\bundle"
Write-Host "== normalize NSIS installer name =="
& bash (Join-Path $Root "scripts/ci-normalize-windows-nsis-name.sh") --bundle-root (Join-Path $Root "apps/desktop/src-tauri/target/release/bundle")

$NsisSetup = Join-Path $BundleRoot "nsis\rushi-desktop-setup.exe"
if (Test-Path -LiteralPath $NsisSetup) {
  & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -NsisPath $NsisSetup
}

Write-Host "== portable zip (CPU-only resources) =="
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

if (Test-Path -LiteralPath $NsisSetup) {
  $nsisSha = "$NsisSetup.sha256"
  (Get-FileHash -Algorithm SHA256 -Path $NsisSetup).Hash.ToLower() | Set-Content -Path $nsisSha -NoNewline
  Add-Content -Path $nsisSha -Value "  rushi-desktop-setup.exe"
}

if ($env:RUSHI_SKIP_CUDA_CDN -ne "1") {
  Write-Host "== build CUDA sidecar for CDN zip (after NSIS) =="
  Invoke-Npm @("run", "asr:build-sidecar-windows-cuda")
  $cudaExe = Join-Path $cudaDir "rushi-asr-sidecar-cuda.exe"
  if (-not (Test-Path -LiteralPath $cudaExe)) { throw "Missing CUDA sidecar: $cudaExe" }
  if ($env:RUSHI_SKIP_SIDECAR_SIGN -ne "1") {
    & pwsh (Join-Path $Root "scripts\sign-windows-sidecar.ps1")
  }
  $cudaCdn = Join-Path $Root "dist\cuda-cdn"
  New-Item -ItemType Directory -Force -Path $cudaCdn | Out-Null
  $cudaZip = Join-Path $cudaCdn "rushi-asr-sidecar-cuda-windows-x64.zip"
  if (Test-Path $cudaZip) { Remove-Item -Force $cudaZip }
  Compress-Archive -Path $cudaDir -DestinationPath $cudaZip
  $cudaSha = "$cudaZip.sha256"
  (Get-FileHash -Algorithm SHA256 -Path $cudaZip).Hash.ToLower() | Set-Content -Path $cudaSha -NoNewline
  Add-Content -Path $cudaSha -Value "  rushi-asr-sidecar-cuda-windows-x64.zip"
  Write-Host "CUDA CDN zip: $cudaZip"
} else {
  Write-Host "SKIP: RUSHI_SKIP_CUDA_CDN=1"
}

Write-Host ""
Write-Host "OK: Windows release build finished (CPU-only NSIS)."
Get-Item $Zip
if (Test-Path -LiteralPath $NsisSetup) { Get-Item $NsisSetup }
Write-Host "Portable: $Zip"
Write-Host "SHA256:   $HashPath"
if (Test-Path -LiteralPath $NsisSetup) { Write-Host "NSIS OTA: $NsisSetup" }
