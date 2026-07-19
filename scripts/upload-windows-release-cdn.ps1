# Manual CDN upload after local `npm run release:win` (CI Windows job fallback).
# Requires R2_*: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT [, R2_BUCKET]
# Optional: Git Bash + aws CLI (or pip awscli via scripts/ci-pip-venv-install.sh).
#
# Usage (repo root):
#   npm run release:win:upload -- --tag v1.0.1
#   pwsh scripts/upload-windows-release-cdn.ps1 -Tag v1.0.1
#   pwsh scripts/upload-windows-release-cdn.ps1 -Tag v1.0.1 -SkipOta -SkipCuda

param(
  [string]$Tag = "",
  [switch]$SkipOta,
  [switch]$SkipCuda,
  [switch]$SkipPortableNsis,
  [switch]$SkipOfflineNsis
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
. (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")

# npm run release:win:upload -- --tag v1.0.1  → unbound args
if ([string]::IsNullOrWhiteSpace($Tag)) {
  for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -in @("--tag", "-Tag", "-tag") -and ($i + 1) -lt $args.Count) {
      $Tag = [string]$args[$i + 1]
      break
    }
  }
}
if ($Tag -notmatch '^v\d') {
  throw "Tag must look like vX.Y.Z (got: '$Tag'). Example: npm run release:win:upload -- --tag v1.0.1"
}

foreach ($req in @("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT")) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($req))) {
    throw "Missing env $req — set Cloudflare R2 credentials before upload."
  }
}

$AppVersion = Get-RushiWinAppVersion
Invoke-RushiNativeChecked -FailMessage "release tag/version consistency check failed" -Command {
  & node scripts/check-release-version-consistency.mjs "--tag=$Tag"
}
$OfflineZipName = Get-RushiWinOfflineInstallerZipName $AppVersion
$NsisSetupName = Get-RushiWinNsisSetupName $AppVersion
$CudaZipName = Get-RushiWinCudaZipName $AppVersion
$BundleRoot = "apps/desktop/src-tauri/target/release/bundle"
$NsisPath = Join-Path $Root "apps\desktop\src-tauri\target\release\bundle\nsis\$NsisSetupName"
$WinReleaseDir = Get-RushiWinReleaseArtifactDir
$CudaArtifactDir = Get-RushiWinCudaArtifactDir
# Prefer E:\rushi-artifacts (or RUSHI_WIN_ARTIFACT_DIR); fall back to legacy repo-root paths.
$OfflinePath = Join-Path $WinReleaseDir $OfflineZipName
if (-not (Test-Path -LiteralPath $OfflinePath)) {
  $legacyOffline = Join-Path $Root $OfflineZipName
  if (Test-Path -LiteralPath $legacyOffline) { $OfflinePath = $legacyOffline }
}
$CudaZip = Join-Path $CudaArtifactDir $CudaZipName
if (-not (Test-Path -LiteralPath $CudaZip)) {
  $legacyCuda = Join-Path $Root "dist\cuda-cdn\$CudaZipName"
  if (Test-Path -LiteralPath $legacyCuda) { $CudaZip = $legacyCuda }
}
$CdnBase = if ($env:RUSHI_UPDATER_CDN_BASE) { $env:RUSHI_UPDATER_CDN_BASE } else { "https://updates.rushi.app" }

Write-Host "== Manual Windows CDN upload =="
Write-Host "Tag: $Tag"
Write-Host "Offline: $OfflinePath"
Write-Host "NSIS:    $NsisSetupName"
Write-Host "CUDA:    $CudaZip"

function Invoke-BashUpload {
  param([Parameter(Mandatory)][string[]]$BashArgs)
  # bash/aws often write progress to stderr; only non-zero exit is failure.
  Invoke-RushiNativeChecked -FailMessage "bash $($BashArgs -join ' ') failed" -Command {
    & bash @BashArgs
  }
}

# Prefer Git Bash aws; bootstrap via project helper if needed.
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  Write-Host "aws CLI not on PATH — trying scripts/ci-pip-venv-install.sh awscli"
  Invoke-RushiNativeChecked -FailMessage "ci-pip-venv-install awscli failed" -Command {
    & bash -lc "source scripts/ci-pip-venv-install.sh awscli"
  }
}

$cudaReady = $false
$cudaUploadRelative = "dist/cuda-cdn/$CudaZipName"
$cudaUploadPath = Join-Path $Root ("dist\cuda-cdn\" + $CudaZipName)
$runtimeManifestRelative = "dist/runtime-manifest/rushi-runtime-manifest.json"
$runtimeManifest = Join-Path $Root "dist\runtime-manifest\rushi-runtime-manifest.json"
if (-not $SkipCuda -and (Test-Path -LiteralPath $CudaZip)) {
  if ([string]::IsNullOrWhiteSpace($env:RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX)) {
    Write-Warning "Skip CUDA upload — RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX is required so the stable runtime manifest cannot remain stale."
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $cudaUploadPath) | Out-Null
    foreach ($stale in @($cudaUploadPath, "$cudaUploadPath.sha256", $runtimeManifest)) {
      if (Test-Path -LiteralPath $stale) { Remove-Item -LiteralPath $stale -Force }
    }
    try {
      New-Item -ItemType HardLink -Path $cudaUploadPath -Target $CudaZip | Out-Null
    } catch {
      Copy-Item -LiteralPath $CudaZip -Destination $cudaUploadPath -Force
    }
    if (Test-Path -LiteralPath "$CudaZip.sha256") {
      Copy-Item -LiteralPath "$CudaZip.sha256" -Destination "$cudaUploadPath.sha256" -Force
    }
    $manifestCommand = "source scripts/ci-pip-venv-install.sh cryptography && bash scripts/ci-publish-cuda-runtime-manifest.sh --tag '$Tag' --zip '$cudaUploadRelative' --cdn-base '$CdnBase'"
    Invoke-RushiNativeChecked -FailMessage "CUDA runtime manifest generation failed" -Command {
      & bash -lc $manifestCommand
    }
    if (-not (Test-Path -LiteralPath $runtimeManifest)) {
      throw "CUDA runtime manifest missing after generation: $runtimeManifest"
    }
    $cudaReady = $true
  }
}

$skipCore = $SkipOfflineNsis -or $SkipPortableNsis
if (-not $skipCore) {
  if (-not (Test-Path -LiteralPath $OfflinePath)) {
    throw "Missing offline zip: $OfflinePath — run npm run release:win first."
  }
  if (-not (Test-Path -LiteralPath $NsisPath)) {
    throw "Missing NSIS setup: $NsisPath — refusing a partial core upload."
  }
  if (-not (Test-Path -LiteralPath "$OfflinePath.sha256")) {
    throw "Missing offline checksum: $OfflinePath.sha256 — refusing a partial core upload."
  }
  if (-not (Test-Path -LiteralPath "$NsisPath.sha256")) {
    throw "Missing NSIS checksum: $NsisPath.sha256 — refusing a partial core upload."
  }
  # ASCII alias for ci-upload-updater-cdn.sh (hardlink when same volume; else copy).
  $asciiZip = Join-Path $Root "windows-offline-x64.zip"
  if (Test-Path -LiteralPath $asciiZip) { Remove-Item -LiteralPath $asciiZip -Force }
  try {
    New-Item -ItemType HardLink -Path $asciiZip -Target $OfflinePath | Out-Null
  } catch {
    Copy-Item -LiteralPath $OfflinePath -Destination $asciiZip -Force
  }
  if (Test-Path -LiteralPath "$OfflinePath.sha256") {
    Copy-Item -LiteralPath "$OfflinePath.sha256" -Destination (Join-Path $Root "windows-offline-x64.zip.sha256") -Force
  }
  Invoke-BashUpload @(
    "scripts/ci-upload-updater-cdn.sh",
    "--tag", $Tag,
    "--mode", "windows",
    "--bundle-root", $BundleRoot,
    "--cdn-base", $CdnBase
  )
}

if (-not $SkipOta -and (Test-Path -LiteralPath "$NsisPath.sig")) {
  Write-Host "== Upload Windows OTA (.exe + .sig) =="
  Invoke-BashUpload @(
    "scripts/ci-upload-updater-cdn.sh",
    "--tag", $Tag,
    "--mode", "windows-ota",
    "--bundle-root", $BundleRoot,
    "--cdn-base", $CdnBase
  )
  $fragmentOut = Join-Path $Root "apps\desktop\src-tauri\target\release\bundle\nsis\updater-fragment.json"
  Invoke-BashUpload @(
    "scripts/ci-generate-updater-latest-json.sh",
    "--tag", $Tag,
    "--cdn-base", $CdnBase,
    "--bundle-root", $BundleRoot,
    "--platform", "windows-x86_64",
    "--out", "apps/desktop/src-tauri/target/release/bundle/nsis/updater-fragment.json"
  )
  Write-Host "Wrote Windows updater fragment: $fragmentOut"
  Write-Host "Merge into latest.json on a machine with mac fragment, or re-run verify-cdn-release after mac CI."
} elseif (-not $SkipOta) {
  Write-Warning "Skip OTA upload — missing $NsisPath.sig (need TAURI_SIGNING_PRIVATE_KEY at build time)."
}

if (-not $SkipCuda -and $cudaReady) {
  Write-Host "== Upload CUDA zip =="
  $cudaArgs = @(
    "scripts/ci-upload-updater-cdn.sh",
    "--tag", $Tag,
    "--mode", "windows-cuda",
    "--cuda-zip", $cudaUploadRelative,
    "--runtime-manifest", $runtimeManifestRelative,
    "--cdn-base", $CdnBase
  )
  Invoke-BashUpload $cudaArgs
} elseif (-not $SkipCuda) {
  Write-Warning "Skip CUDA — missing a publishable signed CUDA zip/manifest pair (zip source: $CudaZip)"
}

Write-Host ""
Write-Host "OK: uploaded to $CdnBase/$Tag/"
Write-Host "  $CdnBase/$Tag/$OfflineZipName"
if (Test-Path -LiteralPath $NsisPath) {
  Write-Host "  $CdnBase/$Tag/$NsisSetupName"
}
