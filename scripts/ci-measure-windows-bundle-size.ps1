# Measure Windows bundle contribution sizes for NSIS / portable budget decisions.
# Run after sidecar (+ Plan B models) are staged under resources/.
# Usage (repo root, Windows):
#   pwsh scripts/ci-measure-windows-bundle-size.ps1 -RequirePlanBModels
#   pwsh scripts/ci-measure-windows-bundle-size.ps1 -NsisPath apps/desktop/src-tauri/target/release/bundle/nsis/<中文安装包>.exe
#
# Decision note (Windows 2026-07-19+):
#   - NSIS + portable: BOTH must include CPU sidecar + Plan B models.
#   - CUDA onedir is CDN opt-in only — must not be present before NSIS.
#   - NSIS artifact hard limit remains < 2GB (upload / makensis practical ceiling).

param(
  [string]$NsisPath = "",
  # Canonical switch (NSIS + portable share the same Plan B requirement).
  [switch]$RequirePlanBModels,
  # Backward-compatible alias for older workflow/local call sites.
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

$requireModels = $RequirePlanBModels -or $AllowModelsForPortable

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

if ($null -ne $cudaBytes -and $cudaBytes -ge 1MB) {
  Write-Error "DECISION: CUDA onedir present before NSIS — remove rushi-asr-sidecar-cuda (CDN opt-in only)."
}

if ($requireModels) {
  if ($null -eq $modelsBytes -or $modelsBytes -lt 1MB) {
    Write-Error "DECISION: NSIS/portable require Plan B models (>=1MB staged); got $(Format-GiB $modelsBytes)."
  }
  $cpuPlusModels = $cpuBytes + $modelsBytes
  Write-Host ("CPU + models:  {0}" -f (Format-GiB $cpuPlusModels))
  Write-Host "DECISION: staging OK (CPU sidecar + Plan B models for NSIS and portable)."
  if ($cpuPlusModels -ge [int64](2GB)) {
    Write-Warning "DECISION: CPU+models staging >= 2GB — NSIS may hit makensis mmap/OOM; watch CI."
  }
} else {
  Write-Host "DECISION: -RequirePlanBModels not set; size report only (no Plan B gate)."
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
  nsisBytes = if ($NsisPath -and (Test-Path -LiteralPath $NsisPath)) { (Get-Item -LiteralPath $NsisPath).Length } else { $null }
  keepModelsInNsis = $true
  keepModelsInPortable = $true
  requirePlanBModels = [bool]$requireModels
}
$payload | ConvertTo-Json | Set-Content -Encoding utf8 $report
Write-Host "Wrote $report"
