# Local Windows release build — NSIS installer (OTA) + portable zip.
# Prefer remote `release.yml` on tag push. Use this script ONLY when CI Windows
# fails due to model-pack OOM; then: npm run release:win:upload -- --tag vX.Y.Z
# Run from repo root on Windows x64:
#   npm run release:win
# Optional env:
#   RUSHI_SKIP_SIDECAR_BUILD=1   # reuse existing CPU onedir (still prune + smoke)
#   RUSHI_SKIP_SIDECAR_SIGN=1
#   RUSHI_SKIP_CUDA_CDN=1          # skip post-NSIS CUDA zip (default: build CUDA for local CDN staging)
# Signing (optional): SIGNTOOL, SIGN_PFX, SIGN_PASS — see sign-windows-sidecar.ps1
# Manifest URL (injected into release shell):
#   $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL = "https://updates.rushi.app/runtime/rushi-runtime-manifest.json"
#
# Product rule (2026-07-19+): NSIS + portable BOTH include CPU sidecar + Plan B models.
# Stage Plan B before NSIS; CUDA onedir stays CDN-only.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
. (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")
$AppVersion = Get-RushiWinAppVersion
$PortableZipName = Get-RushiWinPortableZipName $AppVersion
$NsisSetupName = Get-RushiWinNsisSetupName $AppVersion
$CudaZipName = Get-RushiWinCudaZipName $AppVersion
Write-Host "Artifact names: portable=$PortableZipName nsis=$NsisSetupName"

function Invoke-Npm {
  # Do not name the param $Args — that shadows PowerShell's automatic $Args and
  # leaves the splat empty (npm prints help and exits non-zero).
  param([Parameter(Mandatory)][string[]] $NpmArgs)
  Invoke-RushiNativeChecked -FailMessage "npm $($NpmArgs -join ' ') failed" -Command {
    & npm @NpmArgs
  }
}

if ($env:RUSHI_SKIP_RELEASE_PREFLIGHT -eq "1") {
  Write-Host "SKIP: Windows release preflight (RUSHI_SKIP_RELEASE_PREFLIGHT=1)"
} else {
  Write-Host "== Windows release preflight =="
  Invoke-Npm @("run", "typecheck")
  Invoke-Npm @("run", "test", "-w", "@rushi/desktop")
  Invoke-RushiNativeChecked -FailMessage "architecture guard failed" -Command {
    & node scripts/check-architecture-guard.mjs
  }
}

$cpuExe = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar\rushi-asr-sidecar.exe"
if ($env:RUSHI_SKIP_SIDECAR_BUILD -eq "1") {
  Write-Host "SKIP: ASR sidecar rebuild (RUSHI_SKIP_SIDECAR_BUILD=1)"
  if (-not (Test-Path -LiteralPath $cpuExe)) { throw "Missing sidecar: $cpuExe" }
} else {
  Write-Host "== build ASR sidecar (CPU only for NSIS) =="
  Invoke-Npm @("run", "asr:build-sidecar-windows-cpu")
  if (-not (Test-Path -LiteralPath $cpuExe)) { throw "Missing sidecar: $cpuExe" }
}

$cudaDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda"
if (Test-Path -LiteralPath $cudaDir) {
  Write-Host "Removing staged CUDA onedir before NSIS - CDN opt-in"
  Remove-Item -Recurse -Force $cudaDir
}

$modelsDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr-models"
Write-Host "== stage Plan B models BEFORE NSIS (required for installer + portable) =="
Invoke-Npm @("run", "asr:stage-bundled-models")
Invoke-RushiNativeChecked -FailMessage "bundled-asr-models preflight failed" -Command {
  & bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh") $modelsDir
}

if ($env:RUSHI_SKIP_SIDECAR_SIGN -ne "1") {
  Write-Host "== sign CPU sidecar (optional) =="
  Invoke-RushiNativeChecked -FailMessage "sign-windows-sidecar failed" -Command {
    & pwsh (Join-Path $Root "scripts\sign-windows-sidecar.ps1")
  }
} else {
  Write-Host "SKIP: RUSHI_SKIP_SIDECAR_SIGN=1"
}

Write-Host "== sidecar health smoke =="
Invoke-RushiNativeChecked -FailMessage "sidecar health smoke failed" -Command {
  & pwsh (Join-Path $Root "scripts\smoke-asr-sidecar-health.ps1")
}

Write-Host "== prune sidecar for makensis MAX_PATH =="
Invoke-RushiNativeChecked -FailMessage "prune-windows-sidecar-for-nsis failed" -Command {
  & pwsh (Join-Path $Root "scripts\prune-windows-sidecar-for-nsis.ps1") -Onedir @(
    "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar"
  )
}

Write-Host "== measure bundle size spike (CPU + models before NSIS) =="
Invoke-RushiNativeChecked -FailMessage "ci-measure-windows-bundle-size failed" -Command {
  & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -RequirePlanBModels
}

if (-not $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL) {
  $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL = "https://updates.rushi.app/runtime/rushi-runtime-manifest.json"
}
Write-Host "== Tauri build NSIS (CPU sidecar + Plan B models) - manifest URL=$($env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL) =="
Push-Location (Join-Path $Root "apps\desktop")
try {
  Invoke-Npm @("run", "tauri", "--", "build", "--bundles", "nsis")
} finally {
  Pop-Location
}

$TauriRoot = Join-Path $Root "apps\desktop\src-tauri"
$BundleRoot = Join-Path $TauriRoot "target\release\bundle"
Write-Host "== normalize NSIS installer name (Chinese product+version) =="
Invoke-RushiNativeChecked -FailMessage "ci-normalize-windows-nsis-name failed" -Command {
  & bash (Join-Path $Root "scripts/ci-normalize-windows-nsis-name.sh") --bundle-root (Join-Path $Root "apps/desktop/src-tauri/target/release/bundle") --version $AppVersion
}

$NsisSetup = Join-Path $BundleRoot "nsis\$NsisSetupName"
if (Test-Path -LiteralPath $NsisSetup) {
  Invoke-RushiNativeChecked -FailMessage "ci-measure-windows-bundle-size (nsis) failed" -Command {
    & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -RequirePlanBModels -NsisPath $NsisSetup
  }
}

Write-Host "== portable zip (CPU sidecar + Plan B models; ASCII tar → Chinese rename) =="
$Exe = Join-Path $TauriRoot "target\release\rushi-desktop.exe"
$Zip = Join-Path $Root $PortableZipName
Invoke-RushiNativeChecked -FailMessage "ci-pack-windows-portable-zip failed" -Command {
  & pwsh (Join-Path $Root "scripts\ci-pack-windows-portable-zip.ps1") `
    -ExePath $Exe `
    -ResourcesDir (Join-Path $TauriRoot "resources") `
    -FinalZipPath $Zip `
    -WriteSha256
}

if (Test-Path -LiteralPath $NsisSetup) {
  $nsisSha = "$NsisSetup.sha256"
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $NsisSetup).Hash.ToLowerInvariant()
  Set-Content -Encoding utf8 -Path $nsisSha -Value "$hash  $NsisSetupName"
}

if ($env:RUSHI_SKIP_CUDA_CDN -ne "1") {
  Write-Host "== build CUDA sidecar for CDN zip (after NSIS) =="
  Invoke-Npm @("run", "asr:build-sidecar-windows-cuda")
  $cudaExe = Join-Path $cudaDir "rushi-asr-sidecar-cuda.exe"
  if (-not (Test-Path -LiteralPath $cudaExe)) { throw "Missing CUDA sidecar: $cudaExe" }
  if ($env:RUSHI_SKIP_SIDECAR_SIGN -ne "1") {
    Invoke-RushiNativeChecked -FailMessage "sign-windows-sidecar (cuda) failed" -Command {
      & pwsh (Join-Path $Root "scripts\sign-windows-sidecar.ps1")
    }
  }
  $cudaZip = Join-Path $Root "dist\cuda-cdn\$CudaZipName"
  Invoke-RushiNativeChecked -FailMessage "ci-pack-windows-cuda-zip failed" -Command {
    & pwsh (Join-Path $Root "scripts\ci-pack-windows-cuda-zip.ps1") `
      -CudaOnedir $cudaDir `
      -FinalZipPath $cudaZip `
      -WriteSha256
  }
  Write-Host "CUDA CDN zip: $cudaZip"
} else {
  Write-Host "SKIP: RUSHI_SKIP_CUDA_CDN=1"
}

Write-Host ""
Write-Host "OK: Windows release build finished (NSIS + portable = CPU sidecar + Plan B models)."
Write-Host "Next (CI failed / manual CDN): npm run release:win:upload -- --tag v$AppVersion"
Get-Item $Zip
if (Test-Path -LiteralPath $NsisSetup) { Get-Item $NsisSetup }
Write-Host "Portable: $Zip"
Write-Host "SHA256:   $HashPath"
if (Test-Path -LiteralPath $NsisSetup) { Write-Host "NSIS OTA: $NsisSetup" }
