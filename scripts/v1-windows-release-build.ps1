# Local Windows release build — thin NSIS (OTA) + offline installer zip (main).
# Prefer remote `release.yml` on tag push. Fallback: npm run release:win:upload -- --tag vX.Y.Z
# Run from repo root on Windows x64:
#   npm run release:win
# Optional env:
#   RUSHI_SKIP_SIDECAR_BUILD=1
#   RUSHI_SKIP_SIDECAR_SIGN=1
#   RUSHI_SKIP_CUDA_CDN=1
#   RUSHI_WIN_ARTIFACT_DIR         # default E:\rushi-artifacts
#   RUSHI_FORCE_MODELS_IN_NSIS=1 # dangerous: may hit makensis ICE #12345
#
# Product (2026-07-19+ Route 3): offline zip = thin NSIS + sibling Plan B models.
# NSIS payload = shell + CPU sidecar only; models copied at install via installerHooks.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
. (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")
$AppVersion = Get-RushiWinAppVersion
$OfflineZipName = Get-RushiWinOfflineInstallerZipName $AppVersion
$NsisSetupName = Get-RushiWinNsisSetupName $AppVersion
$CudaZipName = Get-RushiWinCudaZipName $AppVersion
$WinReleaseDir = Get-RushiWinReleaseArtifactDir
$CudaArtifactDir = Get-RushiWinCudaArtifactDir
New-Item -ItemType Directory -Force -Path $WinReleaseDir, $CudaArtifactDir | Out-Null
Invoke-RushiNativeChecked -FailMessage "release version consistency check failed" -Command {
  & node scripts/check-release-version-consistency.mjs
}
Write-Host "Artifact names: offline=$OfflineZipName nsis=$NsisSetupName"
Write-Host "Artifact dir: $WinReleaseDir (override RUSHI_WIN_ARTIFACT_DIR)"

function Invoke-Npm {
  param([Parameter(Mandatory)][string[]] $NpmArgs)
  Invoke-RushiNativeChecked -FailMessage "npm $($NpmArgs -join ' ') failed" -Command {
    & npm @NpmArgs
  }
}

if ($env:RUSHI_SKIP_RELEASE_PREFLIGHT -eq "1") {
  Write-Host "SKIP: Windows release preflight (RUSHI_SKIP_RELEASE_PREFLIGHT=1)"
} else {
  Write-Host "== Windows release preflight =="
  Invoke-RushiNativeChecked -FailMessage "Windows release runner readiness failed" -Command {
    & pwsh scripts/check-windows-release-runner.ps1
  }
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
if ($env:RUSHI_FORCE_MODELS_IN_NSIS -eq "1") {
  Write-Host "== stage Plan B models BEFORE NSIS (RUSHI_FORCE_MODELS_IN_NSIS=1; may OOM) =="
  Invoke-Npm @("run", "asr:stage-bundled-models")
  Invoke-RushiNativeChecked -FailMessage "bundled-asr-models preflight failed" -Command {
    & bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh") $modelsDir
  }
} else {
  foreach ($sub in @("modelscope", "models")) {
    $p = Join-Path $modelsDir $sub
    if (Test-Path -LiteralPath $p) {
      Write-Host "Removing $p before NSIS (models go into offline zip sibling after NSIS)"
      Remove-Item -Recurse -Force -LiteralPath $p
    }
  }
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

Write-Host "== measure bundle size spike (CPU only before NSIS) =="
Invoke-RushiNativeChecked -FailMessage "ci-measure-windows-bundle-size failed" -Command {
  & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1")
}

if (-not $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL) {
  $env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL = "https://updates.rushi.app/runtime/rushi-runtime-manifest.json"
}
Write-Host "== Tauri build NSIS (CPU sidecar only) - manifest URL=$($env:RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL) =="
$staleNormalizedNsis = Join-Path $Root "apps\desktop\src-tauri\target\release\bundle\nsis\$NsisSetupName"
foreach ($stale in @($staleNormalizedNsis, "$staleNormalizedNsis.sig", "$staleNormalizedNsis.sha256")) {
  if (Test-Path -LiteralPath $stale) {
    Remove-Item -LiteralPath $stale -Force
    Write-Host "Removed stale same-version NSIS output: $stale"
  }
}
Push-Location (Join-Path $Root "apps\desktop")
try {
  $tauriArgs = @("run", "tauri", "--", "build", "--bundles", "nsis")
  if (-not [string]::IsNullOrWhiteSpace($env:SIGNTOOL) -or -not [string]::IsNullOrWhiteSpace($env:SIGN_PFX)) {
    foreach ($name in @("SIGNTOOL", "SIGN_PFX", "SIGN_PASS")) {
      if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Local Tauri Authenticode signing is partially configured; missing $name."
      }
    }
    $signScript = (Resolve-Path (Join-Path $Root "scripts\sign-windows-tauri-artifact.ps1")).Path.Replace("\", "/")
    $signCommand = "pwsh -NoProfile -ExecutionPolicy Bypass -File `"$signScript`" `"%1`""
    $signConfig = Join-Path $env:TEMP "rushi-tauri-windows-signing-$PID.json"
    @{ bundle = @{ windows = @{ signCommand = $signCommand } } } |
      ConvertTo-Json -Depth 5 |
      Set-Content -LiteralPath $signConfig -Encoding utf8
    $tauriArgs += @("--config", $signConfig)
    Write-Host "Tauri Authenticode signCommand enabled."
  }
  Invoke-Npm $tauriArgs
} finally {
  Pop-Location
  if ($signConfig -and (Test-Path -LiteralPath $signConfig)) {
    Remove-Item -LiteralPath $signConfig -Force
  }
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
    & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -NsisPath $NsisSetup
  }
}

Write-Host "== stage Plan B models for offline zip sibling (required) =="
Invoke-Npm @("run", "asr:stage-bundled-models")
Invoke-RushiNativeChecked -FailMessage "bundled-asr-models preflight failed (offline zip requires models)" -Command {
  & bash (Join-Path $Root "scripts\preflight-bundled-asr-models.sh") $modelsDir
}
Invoke-RushiNativeChecked -FailMessage "ci-measure-windows-bundle-size (offline layout) failed" -Command {
  & pwsh (Join-Path $Root "scripts\ci-measure-windows-bundle-size.ps1") -RequirePlanBForOfflineLayout
}

if (-not (Test-Path -LiteralPath $NsisSetup)) {
  throw "Missing NSIS setup: $NsisSetup"
}

Write-Host "== offline installer zip (thin NSIS + sibling Plan B; ASCII tar → Chinese rename) =="
$Zip = Join-Path $WinReleaseDir $OfflineZipName
Invoke-RushiNativeChecked -FailMessage "ci-pack-windows-offline-installer-zip failed" -Command {
  & pwsh (Join-Path $Root "scripts\ci-pack-windows-offline-installer-zip.ps1") `
    -NsisSetupPath $NsisSetup `
    -ModelsDir $modelsDir `
    -FinalZipPath $Zip `
    -WriteSha256
}

$nsisSha = "$NsisSetup.sha256"
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $NsisSetup).Hash.ToLowerInvariant()
Set-Content -Encoding utf8 -Path $nsisSha -Value "$hash  $NsisSetupName"

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
  $cudaZip = Join-Path $CudaArtifactDir $CudaZipName
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
Write-Host "OK: Windows release build finished (thin NSIS + offline zip = setup + sibling Plan B)."
Write-Host "Next (CI failed / manual CDN): npm run release:win:upload -- --tag v$AppVersion"
Get-Item $Zip
Get-Item $NsisSetup
Write-Host "Offline: $Zip"
Write-Host "NSIS OTA: $NsisSetup"
