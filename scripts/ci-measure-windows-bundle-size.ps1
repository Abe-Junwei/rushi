# Measure Windows bundle contribution sizes for NSIS budget decisions.
# Run after sidecar (+ optional models) are staged under resources/.
# Usage (repo root, Windows):
#   pwsh scripts/ci-measure-windows-bundle-size.ps1
#   pwsh scripts/ci-measure-windows-bundle-size.ps1 -NsisPath apps/desktop/src-tauri/target/release/bundle/nsis/rushi-desktop-setup.exe
#
# Decision note (Plan B models stay in installer unless CPU+models still >= 2GB):
#   - CUDA onedir alone is typically ~1.5–2GB — removing it is the primary NSIS fix.
#   - CPU onedir + Plan B models (~1.1GB) should land under ~2GB; CI prints evidence.

param(
  [string]$NsisPath = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Get-DirBytes([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $sum = (Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  if ($null -eq $sum) { return [int64]0 }
  return [int64]$sum
}

function Format-GiB([Nullable[int64]]$Bytes) {
  if ($null -eq $Bytes) { return "missing" }
  return ("{0:N2} GiB ({1:N0} bytes)" -f ($Bytes / 1GB), $Bytes)
}

$cpuDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar"
$cudaDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda"
$modelsDir = Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr-models"

$cpuBytes = Get-DirBytes $cpuDir
$cudaBytes = Get-DirBytes $cudaDir
$modelsBytes = Get-DirBytes $modelsDir

Write-Host "== Windows bundle size spike =="
Write-Host ("CPU onedir:    {0}" -f (Format-GiB $cpuBytes))
Write-Host ("CUDA onedir:   {0}" -f (Format-GiB $cudaBytes))
Write-Host ("Plan B models: {0}" -f (Format-GiB $modelsBytes))

if ($null -ne $cpuBytes -and $null -ne $modelsBytes) {
  $cpuPlusModels = $cpuBytes + $modelsBytes
  Write-Host ("CPU + models:  {0}" -f (Format-GiB $cpuPlusModels))
  $limit = [int64](2GB)
  if ($cpuPlusModels -ge $limit) {
    Write-Host "DECISION: CPU+models still >= 2GB — second cut (externalize models) REQUIRED."
  } else {
    Write-Host "DECISION: CPU+models < 2GB — keep Plan B models in installer; CUDA stays CDN-only."
  }
} else {
  Write-Host "DECISION: incomplete staging (missing CPU and/or models) — re-run after build."
}

if ($NsisPath -and (Test-Path -LiteralPath $NsisPath)) {
  $nsisBytes = (Get-Item -LiteralPath $NsisPath).Length
  Write-Host ("NSIS setup:    {0}" -f (Format-GiB $nsisBytes))
  if ($nsisBytes -ge 2GB) {
    Write-Error "NSIS artifact is still >= 2GB — makensis/upload risk."
  } elseif ($nsisBytes -ge 1.5GB) {
    Write-Warning "NSIS artifact is >= 1.5GB (under 2GB hard limit, but watch growth)."
  } else {
    Write-Host "NSIS artifact is under 1.5GB target."
  }
}

$reportDir = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$report = Join-Path $reportDir "windows-bundle-size-spike.json"
$payload = [ordered]@{
  measuredAt = (Get-Date).ToUniversalTime().ToString("o")
  cpuBytes = $cpuBytes
  cudaBytes = $cudaBytes
  modelsBytes = $modelsBytes
  cpuPlusModelsBytes = if ($null -ne $cpuBytes -and $null -ne $modelsBytes) { $cpuBytes + $modelsBytes } else { $null }
  nsisBytes = if ($NsisPath -and (Test-Path -LiteralPath $NsisPath)) { (Get-Item $NsisPath).Length } else { $null }
  keepModelsInInstaller = if ($null -ne $cpuBytes -and $null -ne $modelsBytes) { ($cpuBytes + $modelsBytes) -lt 2GB } else { $null }
}
$payload | ConvertTo-Json | Set-Content -Encoding utf8 $report
Write-Host "Wrote $report"
