# Local Windows release build — NSIS installer (OTA) + portable zip.
# Prefer remote `release.yml` on tag push. Use this script ONLY when CI Windows
# fails due to model-pack OOM; then: npm run release:win:upload -- --tag vX.Y.Z
# Run from repo root on Windows x64:
#   npm run release:win
# Optional env:
#   RUSHI_FORCE_MODELS_IN_NSIS=1  # dangerous: stage Plan B into NSIS (makensis may OOM)
#   RUSHI_SKIP_SIDECAR_SIGN=1
#   RUSHI_SKIP_CUDA_CDN=1          # skip post-NSIS CUDA zip (default: build CUDA for local CDN staging)
# Signing (optional): SIGNTOOL, SIGN_PFX, SIGN_PASS — see sign-windows-sidecar.ps1
# Manifest URL (injected into release shell):
#   $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL = "https://updates.rushi.app/runtime/rushi-runtime-manifest.json"
#
# Product rule: portable zip MUST include CPU sidecar + Plan B ASR models.
# NSIS keeps CPU-only (makensis second knife); models are staged AFTER NSIS for portable.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
. (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")
$AppVersion = Get-RushiWinAppVersion
$PortableZipName = Get-RushiWinPortableZipName $AppVersion
$NsisSetupName = Get-RushiWinNsisSetupName $AppVersion
$CudaZipName = Get-RushiWinCudaZipName $AppVersion
Write-Host "Artifact names: portable=$PortableZipName nsis=$NsisSetupName"

function Invoke-Npm {
  # Do not name the param $Args — that shadows PowerShell's automatic $Args and
  # leaves the splat empty (npm prints help and exits non-zero).
  param([Parameter(Mandatory)][string[]] $NpmArgs)
  & npm @NpmArgs
  if ($LASTEXITCODE -ne 0) { throw "npm $($NpmArgs -join ' ') failed with exit $LASTEXITCODE" }
}

if ($env:RUSHI_SKIP_RELEASE_PREFLIGHT -eq "1") {
  Write-Host "SKIP: Windows release preflight (RUSHI_SKIP_RELEASE_PREFLIGHT=1)"
} else {
  Write-Host "== Windows release preflight =="
  Invoke-Npm @("run", "typecheck")
  Invoke-Npm @("run", "test", "-w", "@rushi/desktop")
  & node scripts/check-architecture-guard.mjs
  if ($LASTEXITCODE -ne 0) { throw "architecture guard failed" }
}

Write-Host "== build ASR sidecar (CPU only for NSIS) =="
Invoke-Npm @("run", "asr:build-sidecar-windows-cpu")

$cpuExe = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar\rushi-asr-sidecar.exe"
if (-not (Test-Path -LiteralPath $cpuExe)) { throw "Missing sidecar: $cpuExe" }

$cudaDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda"
if (Test-Path -LiteralPath $cudaDir) {
  Write-Host "Removing staged CUDA onedir before NSIS - CDN opt-in"
  Remove-Item -Recurse -Force $cudaDir
}

$modelsDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr-models"
if ($env:RUSHI_FORCE_MODELS_IN_NSIS -eq "1") {
  Write-Host "== stage Plan B models BEFORE NSIS (RUSHI_FORCE_MODELS_IN_NSIS=1) =="
  Invoke-Npm @("run", "asr:stage-bundled-models")
  & bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh") $modelsDir
  if ($LASTEXITCODE -ne 0) { throw "bundled-asr-models preflight failed" }
} else {
  foreach ($sub in @("modelscope", "models")) {
    $p = Join-Path $modelsDir $sub
    if (Test-Path -LiteralPath $p) {
      Write-Host "Removing $p before NSIS (models go into portable after NSIS)"
      Remove-Item -Recurse -Force $p
    }
  }
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

Write-Host "== measure bundle size spike (pre-NSIS) =="
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
Write-Host "== normalize NSIS installer name (Chinese product+version) =="
& bash (Join-Path $Root "scripts/ci-normalize-windows-nsis-name.sh") --bundle-root (Join-Path $Root "apps/desktop/src-tauri/target/release/bundle") --version $AppVersion

$NsisSetup = Join-Path $BundleRoot "nsis\$NsisSetupName"
if (Test-Path -LiteralPath $NsisSetup) {
  & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -NsisPath $NsisSetup
}

Write-Host "== stage Plan B models for portable (required) =="
Invoke-Npm @("run", "asr:stage-bundled-models")
& bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh") $modelsDir
if ($LASTEXITCODE -ne 0) { throw "bundled-asr-models preflight failed (portable requires models)" }
& pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -AllowModelsForPortable

Write-Host "== portable zip (CPU sidecar + Plan B models) =="
$Exe = Join-Path $TauriRoot "target\release\rushi-desktop.exe"
if (-not (Test-Path -LiteralPath $Exe)) { throw "Missing $Exe" }

$Stage = Join-Path $Root "dist\windows-portable"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
Copy-Item $Exe (Join-Path $Stage "rushi-desktop.exe")
Copy-Item (Join-Path $TauriRoot "resources") (Join-Path $Stage "resources") -Recurse

$Zip = Join-Path $Root $PortableZipName
if (Test-Path $Zip) { Remove-Item -Force $Zip }
# Compress-Archive OOMs on sidecar+models; tar streams and is reliable on Win10+.
Push-Location $Stage
try {
  & tar -a -c -f $Zip *
  if ($LASTEXITCODE -ne 0) { throw "tar zip failed with exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

$sidecarInZip = Join-Path $Stage "resources\bundled-asr\rushi-asr-sidecar"
$manifestInZip = Join-Path $Stage "resources\bundled-asr-models\manifest.json"
if (-not (Test-Path -LiteralPath $sidecarInZip)) { throw "portable stage missing CPU sidecar: $sidecarInZip" }
if (-not (Test-Path -LiteralPath $manifestInZip)) { throw "portable stage missing Plan B models: $manifestInZip" }

$HashPath = "$Zip.sha256"
(Get-FileHash -Algorithm SHA256 -Path $Zip).Hash.ToLower() | Set-Content -Path $HashPath -NoNewline
Add-Content -Path $HashPath -Value "  $PortableZipName"

if (Test-Path -LiteralPath $NsisSetup) {
  $nsisSha = "$NsisSetup.sha256"
  (Get-FileHash -Algorithm SHA256 -Path $NsisSetup).Hash.ToLower() | Set-Content -Path $nsisSha -NoNewline
  Add-Content -Path $nsisSha -Value "  $NsisSetupName"
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
  $cudaZip = Join-Path $cudaCdn $CudaZipName
  if (Test-Path $cudaZip) { Remove-Item -Force $cudaZip }
  Compress-Archive -Path $cudaDir -DestinationPath $cudaZip
  $cudaSha = "$cudaZip.sha256"
  (Get-FileHash -Algorithm SHA256 -Path $cudaZip).Hash.ToLower() | Set-Content -Path $cudaSha -NoNewline
  Add-Content -Path $cudaSha -Value "  $CudaZipName"
  Write-Host "CUDA CDN zip: $cudaZip"
} else {
  Write-Host "SKIP: RUSHI_SKIP_CUDA_CDN=1"
}

Write-Host ""
Write-Host "OK: Windows release build finished (NSIS CPU-only; portable = sidecar + Plan B models)."
Write-Host "Next (CI failed / manual CDN): npm run release:win:upload -- --tag v$AppVersion"
Get-Item $Zip
if (Test-Path -LiteralPath $NsisSetup) { Get-Item $NsisSetup }
Write-Host "Portable: $Zip"
Write-Host "SHA256:   $HashPath"
if (Test-Path -LiteralPath $NsisSetup) { Write-Host "NSIS OTA: $NsisSetup" }
