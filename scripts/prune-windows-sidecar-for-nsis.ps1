# Prune PyInstaller onedir trees that break makensis (Windows MAX_PATH ~260).
# Torch ships nested third_party LICENSE trees under *.dist-info/licenses/ that
# exceed MAX_PATH when rooted at apps/desktop/src-tauri/resources/bundled-asr/...
# Those files are not required at sidecar runtime.
#
# Usage (repo root):
#   pwsh scripts/prune-windows-sidecar-for-nsis.ps1
#   pwsh scripts/prune-windows-sidecar-for-nsis.ps1 -Onedir apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar
#   pwsh scripts/prune-windows-sidecar-for-nsis.ps1 -MaxPathLen 240

param(
  [string[]]$Onedir = @(
    "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar",
    "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda"
  ),
  [int]$MaxPathLen = 240
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Get-LongestPath {
  param([string]$Dir)
  $maxLen = 0
  $worst = $null
  if (-not (Test-Path -LiteralPath $Dir)) { return @{ Len = 0; Path = $null } }
  Get-ChildItem -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $p = $_.FullName
    if ($p.Length -gt $maxLen) {
      $maxLen = $p.Length
      $worst = $p
    }
  }
  return @{ Len = $maxLen; Path = $worst }
}

$pruned = 0
foreach ($rel in $Onedir) {
  $dir = Join-Path $Root $rel
  if (-not (Test-Path -LiteralPath $dir)) {
    Write-Host "SKIP (missing): $rel"
    continue
  }

  Write-Host "== prune for NSIS: $rel =="
  $before = Get-LongestPath $dir
  Write-Host ("  longest before: {0} chars" -f $before.Len)
  if ($before.Path) { Write-Host ("  {0}" -f $before.Path) }

  # 1) *.dist-info/licenses (torch kineto/prometheus/duktape trees)
  Get-ChildItem -LiteralPath $dir -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "licenses" -and $_.Parent.Name -like "*.dist-info" } |
    ForEach-Object {
      Write-Host ("  remove {0}" -f $_.FullName)
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
      $script:pruned++
    }

  # 2) Orphan deep third_party license-only nests still over budget (best-effort)
  $again = Get-LongestPath $dir
  if ($again.Len -ge $MaxPathLen) {
    Get-ChildItem -LiteralPath $dir -Recurse -File -Force -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName.Length -ge $MaxPathLen -and (
          $_.Name -match '^(LICENSE|COPYING|NOTICE)' -or
          $_.FullName -match '[\\/]third_party[\\/].*[\\/]third_party[\\/]'
        )
      } |
      ForEach-Object {
        Write-Host ("  remove long file {0} ({1})" -f $_.FullName, $_.FullName.Length)
        Remove-Item -LiteralPath $_.FullName -Force
        $script:pruned++
      }
  }

  $after = Get-LongestPath $dir
  Write-Host ("  longest after:  {0} chars" -f $after.Len)
  if ($after.Path) { Write-Host ("  {0}" -f $after.Path) }

  if ($after.Len -ge $MaxPathLen) {
    throw @"
NSIS path budget still exceeded under $rel (max $($after.Len) >= $MaxPathLen).
Worst: $($after.Path)
Extend prune rules or shorten the resources root.
"@
  }
}

Write-Host "OK: pruned $pruned path(s); remaining trees under NSIS MAX_PATH budget ($MaxPathLen)."
