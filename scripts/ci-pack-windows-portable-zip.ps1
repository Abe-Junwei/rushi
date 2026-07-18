# Pack + verify Windows portable zip (CPU sidecar + Plan B models).
#
# HARD RULE (Windows bsdtar / tar.exe): NEVER pass Unicode paths to `tar -f`.
# Create and extract only via an ASCII intermediate zip, then rename to the
# Chinese product filename for CDN / artifacts. .NET APIs (Move-Item,
# Get-FileHash, Test-Path -LiteralPath) handle Unicode; tar.exe does not.
#
# Staging: on GitHub Actions use a short root (C:\rp) to avoid MAX_PATH when
# packing modelscope trees under D:\a\rushi\rushi\...
#
# Usage (repo root or any cwd; paths may be absolute or relative):
#   pwsh scripts/ci-pack-windows-portable-zip.ps1 `
#     -ExePath apps/desktop/src-tauri/target/release/rushi-desktop.exe `
#     -ResourcesDir apps/desktop/src-tauri/resources `
#     -FinalZipPath (Join-Path (Get-Location) $env:WIN_PORTABLE_ZIP)

param(
  [Parameter(Mandatory = $true)][string]$ExePath,
  [Parameter(Mandatory = $true)][string]$ResourcesDir,
  [Parameter(Mandatory = $true)][string]$FinalZipPath,
  [string]$StageDir = "",
  [string]$AsciiZipPath = "",
  [string]$ProbeDir = "",
  [switch]$SkipVerifyExtract,
  [switch]$WriteSha256
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
}

$ExePath = Resolve-FullPath $ExePath
$ResourcesDir = Resolve-FullPath $ResourcesDir
$FinalZipPath = Resolve-FullPath $FinalZipPath

if (-not (Test-Path -LiteralPath $ExePath)) {
  throw "Missing exe: $ExePath"
}
if (-not (Test-Path -LiteralPath $ResourcesDir)) {
  throw "Missing resources: $ResourcesDir"
}

$onCi = ($env:GITHUB_ACTIONS -eq "true")
if ([string]::IsNullOrWhiteSpace($StageDir)) {
  $StageDir = if ($onCi) { "C:\rp" } else { Join-Path (Split-Path -Parent $FinalZipPath) "dist\windows-portable" }
}
if ([string]::IsNullOrWhiteSpace($AsciiZipPath)) {
  $AsciiZipPath = if ($onCi) { "C:\rp-build.zip" } else { Join-Path (Split-Path -Parent $FinalZipPath) "dist\windows-portable-build.zip" }
}
if ([string]::IsNullOrWhiteSpace($ProbeDir)) {
  $ProbeDir = if ($onCi) { "C:\rp-probe" } else { Join-Path (Split-Path -Parent $FinalZipPath) "dist\windows-portable-probe" }
}

$StageDir = Resolve-FullPath $StageDir
$AsciiZipPath = Resolve-FullPath $AsciiZipPath
$ProbeDir = Resolve-FullPath $ProbeDir

# Guard: tar -f targets must be ASCII-only (no chars above 0x7F).
foreach ($p in @($AsciiZipPath, $StageDir, $ProbeDir)) {
  foreach ($ch in $p.ToCharArray()) {
    if ([int]$ch -gt 0x7F) {
      throw "Non-ASCII path not allowed for tar staging ($p). Use ASCII intermediate only."
    }
  }
}

Write-Host "portable pack: stage=$StageDir asciiZip=$AsciiZipPath final=$FinalZipPath"

if (Test-Path -LiteralPath $StageDir) { Remove-Item -LiteralPath $StageDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
$asciiParent = Split-Path -Parent $AsciiZipPath
if (-not [string]::IsNullOrWhiteSpace($asciiParent) -and -not (Test-Path -LiteralPath $asciiParent)) {
  New-Item -ItemType Directory -Force -Path $asciiParent | Out-Null
}

Copy-Item -LiteralPath $ExePath -Destination (Join-Path $StageDir "rushi-desktop.exe")
Copy-Item -LiteralPath $ResourcesDir -Destination (Join-Path $StageDir "resources") -Recurse

if (Test-Path -LiteralPath $AsciiZipPath) { Remove-Item -LiteralPath $AsciiZipPath -Force }

# Compress-Archive OOMs on sidecar+models; tar streams on Win10+.
Push-Location -LiteralPath $StageDir
try {
  & tar -a -c -f $AsciiZipPath .
  if ($LASTEXITCODE -ne 0) {
    throw "tar zip failed with exit $LASTEXITCODE (ascii=$AsciiZipPath)"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $AsciiZipPath)) {
  throw "ASCII zip missing after tar: $AsciiZipPath"
}
Write-Host "OK: ascii zip $AsciiZipPath ($((Get-Item -LiteralPath $AsciiZipPath).Length) bytes)"

if (-not $SkipVerifyExtract) {
  if (Test-Path -LiteralPath $ProbeDir) { Remove-Item -LiteralPath $ProbeDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $ProbeDir | Out-Null
  & tar -xf $AsciiZipPath -C $ProbeDir
  if ($LASTEXITCODE -ne 0) {
    throw "tar extract failed ($LASTEXITCODE) ascii=$AsciiZipPath"
  }
  $sidecar = Join-Path $ProbeDir "resources\bundled-asr\rushi-asr-sidecar"
  $manifest = Join-Path $ProbeDir "resources\bundled-asr-models\manifest.json"
  $modelscope = Join-Path $ProbeDir "resources\bundled-asr-models\modelscope"
  if (-not (Test-Path -LiteralPath $sidecar)) {
    throw "portable zip missing CPU sidecar onedir: $sidecar"
  }
  if (-not (Test-Path -LiteralPath $manifest)) {
    throw "portable zip missing Plan B models manifest: $manifest"
  }
  if (-not (Test-Path -LiteralPath $modelscope)) {
    throw "portable zip missing Plan B modelscope/: $modelscope"
  }
  Write-Host "OK: ascii zip contains CPU sidecar + Plan B models."
  Remove-Item -LiteralPath $ProbeDir -Recurse -Force
}

$finalParent = Split-Path -Parent $FinalZipPath
if (-not [string]::IsNullOrWhiteSpace($finalParent) -and -not (Test-Path -LiteralPath $finalParent)) {
  New-Item -ItemType Directory -Force -Path $finalParent | Out-Null
}
if (Test-Path -LiteralPath $FinalZipPath) { Remove-Item -LiteralPath $FinalZipPath -Force }
# Cross-volume Move-Item copies then deletes — fine for C:\ → D:\ on GHA.
Move-Item -LiteralPath $AsciiZipPath -Destination $FinalZipPath
Write-Host "OK: wrote portable zip $FinalZipPath ($((Get-Item -LiteralPath $FinalZipPath).Length) bytes)"

if ($WriteSha256) {
  $name = Split-Path -Leaf $FinalZipPath
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $FinalZipPath).Hash.ToLowerInvariant()
  Set-Content -Encoding utf8 -Path "$FinalZipPath.sha256" -Value "$hash  $name"
  Write-Host "Wrote $FinalZipPath.sha256"
}
