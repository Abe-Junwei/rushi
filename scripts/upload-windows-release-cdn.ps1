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
  [switch]$SkipPortableNsis
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
. (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")

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
$PortableZipName = Get-RushiWinPortableZipName $AppVersion
$NsisSetupName = Get-RushiWinNsisSetupName $AppVersion
$CudaZipName = Get-RushiWinCudaZipName $AppVersion
$BundleRoot = "apps/desktop/src-tauri/target/release/bundle"
$NsisPath = Join-Path $Root "apps\desktop\src-tauri\target\release\bundle\nsis\$NsisSetupName"
$PortablePath = Join-Path $Root $PortableZipName
$CudaZip = Join-Path $Root "dist\cuda-cdn\$CudaZipName"
$CdnBase = if ($env:RUSHI_UPDATER_CDN_BASE) { $env:RUSHI_UPDATER_CDN_BASE } else { "https://updates.rushi.app" }

Write-Host "== Manual Windows CDN upload =="
Write-Host "Tag: $Tag"
Write-Host "Portable: $PortableZipName"
Write-Host "NSIS:     $NsisSetupName"

function Invoke-BashUpload {
  param([Parameter(Mandatory)][string[]]$BashArgs)
  & bash @BashArgs
  if ($LASTEXITCODE -ne 0) { throw "bash $($BashArgs -join ' ') failed ($LASTEXITCODE)" }
}

# Prefer Git Bash aws; bootstrap via project helper if needed.
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  Write-Host "aws CLI not on PATH — trying scripts/ci-pip-venv-install.sh awscli"
  & bash -lc "source scripts/ci-pip-venv-install.sh awscli"
}

if (-not $SkipPortableNsis) {
  if (-not (Test-Path -LiteralPath $PortablePath)) {
    throw "Missing portable zip: $PortablePath — run npm run release:win first."
  }
  if (-not (Test-Path -LiteralPath $NsisPath)) {
    Write-Warning "NSIS missing at $NsisPath — uploading portable only if present."
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

if (-not $SkipCuda -and (Test-Path -LiteralPath $CudaZip)) {
  Write-Host "== Upload CUDA zip =="
  $runtimeManifest = Join-Path $Root "dist\cuda-cdn\rushi-runtime-manifest.json"
  $cudaArgs = @(
    "scripts/ci-upload-updater-cdn.sh",
    "--tag", $Tag,
    "--mode", "windows-cuda",
    "--cuda-zip", "dist/cuda-cdn/$CudaZipName",
    "--cdn-base", $CdnBase
  )
  if (Test-Path -LiteralPath $runtimeManifest) {
    $cudaArgs += @("--runtime-manifest", "dist/cuda-cdn/rushi-runtime-manifest.json")
  }
  Invoke-BashUpload $cudaArgs
} elseif (-not $SkipCuda) {
  Write-Warning "Skip CUDA — missing $CudaZip"
}

Write-Host ""
Write-Host "OK: uploaded to $CdnBase/$Tag/"
Write-Host "  $CdnBase/$Tag/$PortableZipName"
if (Test-Path -LiteralPath $NsisPath) {
  Write-Host "  $CdnBase/$Tag/$NsisSetupName"
}
