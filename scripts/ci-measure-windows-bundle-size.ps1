# Measure Windows bundle contribution sizes for NSIS / portable budget decisions.
# Run after sidecar (+ optional models) are staged under resources/.
# Usage (repo root, Windows):
#   pwsh scripts/ci-measure-windows-bundle-size.ps1
#   pwsh scripts/ci-measure-windows-bundle-size.ps1 -NsisPath apps/desktop/src-tauri/target/release/bundle/nsis/rushi-desktop-setup.exe
#   pwsh scripts/ci-measure-windows-bundle-size.ps1 -AllowModelsForPortable
#
# Decision note (Windows 2026-07+):
#   - NSIS: omit Plan B models (makensis OOM — second knife).
#   - portable (主分发): MUST include CPU sidecar + Plan B models (stage after NSIS).
#   - CUDA onedir is CDN opt-in only — must not be present before NSIS.

param(
  [string]$NsisPath = "",
  [switch]$AllowModelsForPortable
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

if ($null -eq $cpuBytes) {
  Write-Error "DECISION: CPU sidecar onedir missing — Windows release must ship the sidecar."
}

if ($AllowModelsForPortable) {
  if ($null -eq $modelsBytes -or $modelsBytes -lt 1MB) {
    Write-Error "DECISION: portable requires Plan B models (>=1MB staged); got $(Format-GiB $modelsBytes)."
  }
  $cpuPlusModels = $cpuBytes + $modelsBytes
  Write-Host ("CPU + models:  {0}" -f (Format-GiB $cpuPlusModels))
  Write-Host "DECISION: portable staging OK (CPU sidecar + Plan B models)."
} elseif ($null -ne $modelsBytes) {
  $cpuPlusModels = $cpuBytes + $modelsBytes
  Write-Host ("CPU + models:  {0}" -f (Format-GiB $cpuPlusModels))
  $limit = [int64](2GB)
  if ($modelsBytes -ge 1MB -and $cpuPlusModels -ge $limit) {
    Write-Error "DECISION: CPU+models still >= 2GB — Windows NSIS must omit Plan B models (second knife)."
  } elseif ($modelsBytes -lt 1MB) {
    Write-Host "DECISION: Plan B models omitted before NSIS (second knife); stage after NSIS for portable."
  } else {
    Write-Warning "DECISION: Plan B models present before NSIS — expected omit; confirm staging order."
  }
} else {
  Write-Host "DECISION: models dir missing (OK before NSIS); portable path must stage Plan B after NSIS."
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
  keepModelsInNsis = $false
  keepModelsInPortable = $true
  allowModelsForPortable = [bool]$AllowModelsForPortable
}
$payload | ConvertTo-Json | Set-Content -Encoding utf8 $report
Write-Host "Wrote $report"
