# Pack + verify Windows offline installer zip (thin NSIS + sibling Plan B models).
#
# Layout inside zip:
#   <中文安装包.exe>
#   resources/bundled-asr-models/...
#
# HARD RULE (Windows bsdtar / tar.exe): NEVER pass Unicode paths to `tar -f`.
# ASCII intermediate zip → verify extract → Move-Item to Chinese final name.
#
# Usage (repo root):
#   pwsh scripts/ci-pack-windows-offline-installer-zip.ps1 `
#     -NsisSetupPath apps/desktop/src-tauri/target/release/bundle/nsis/<中文安装包>.exe `
#     -ModelsDir apps/desktop/src-tauri/resources/bundled-asr-models `
#     -FinalZipPath (Join-Path (Get-Location) $env:WIN_OFFLINE_ZIP)

param(
  [Parameter(Mandatory = $true)][string]$NsisSetupPath,
  [Parameter(Mandatory = $true)][string]$ModelsDir,
  [Parameter(Mandatory = $true)][string]$FinalZipPath,
  [string]$StageDir = "",
  [string]$AsciiZipPath = "",
  [string]$ProbeDir = "",
  [switch]$SkipVerifyExtract,
  [switch]$WriteSha256
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptRoot "rushi-resolve-git-sha.ps1")

function Resolve-FullPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
}

$NsisSetupPath = Resolve-FullPath $NsisSetupPath
$ModelsDir = Resolve-FullPath $ModelsDir
$FinalZipPath = Resolve-FullPath $FinalZipPath

if (-not (Test-Path -LiteralPath $NsisSetupPath)) {
  throw "Missing NSIS setup: $NsisSetupPath"
}
$manifestSrc = Join-Path $ModelsDir "manifest.json"
if (-not (Test-Path -LiteralPath $manifestSrc)) {
  throw "Missing Plan B manifest: $manifestSrc"
}
$modelscopeSrc = Join-Path $ModelsDir "modelscope"
if (-not (Test-Path -LiteralPath $modelscopeSrc)) {
  throw "Missing Plan B modelscope/: $modelscopeSrc"
}

$onCi = ($env:GITHUB_ACTIONS -eq "true")
if ([string]::IsNullOrWhiteSpace($StageDir)) {
  $StageDir = if ($onCi) {
    if (Test-Path "E:\") { "E:\rp-offline" } else { "C:\rp-offline" }
  } else {
    Join-Path (Split-Path -Parent $FinalZipPath) "dist\windows-offline"
  }
}
if ([string]::IsNullOrWhiteSpace($AsciiZipPath)) {
  $AsciiZipPath = if ($onCi) {
    if (Test-Path "E:\") { "E:\rp-offline-build.zip" } else { "C:\rp-offline-build.zip" }
  } else {
    Join-Path (Split-Path -Parent $FinalZipPath) "dist\windows-offline-build.zip"
  }
}
if ([string]::IsNullOrWhiteSpace($ProbeDir)) {
  $ProbeDir = if ($onCi) {
    if (Test-Path "E:\") { "E:\rp-offline-probe" } else { "C:\rp-offline-probe" }
  } else {
    Join-Path (Split-Path -Parent $FinalZipPath) "dist\windows-offline-probe"
  }
}

$StageDir = Resolve-FullPath $StageDir
$AsciiZipPath = Resolve-FullPath $AsciiZipPath
$ProbeDir = Resolve-FullPath $ProbeDir

foreach ($p in @($AsciiZipPath, $StageDir, $ProbeDir)) {
  foreach ($ch in $p.ToCharArray()) {
    if ([int]$ch -gt 0x7F) {
      throw "Non-ASCII path not allowed for tar staging ($p). Use ASCII intermediate only."
    }
  }
}

Write-Host "offline pack: stage=$StageDir asciiZip=$AsciiZipPath final=$FinalZipPath"

if (Test-Path -LiteralPath $StageDir) { Remove-Item -LiteralPath $StageDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
$asciiParent = Split-Path -Parent $AsciiZipPath
if (-not [string]::IsNullOrWhiteSpace($asciiParent) -and -not (Test-Path -LiteralPath $asciiParent)) {
  New-Item -ItemType Directory -Force -Path $asciiParent | Out-Null
}

$setupLeaf = Split-Path -Leaf $NsisSetupPath
Copy-Item -LiteralPath $NsisSetupPath -Destination (Join-Path $StageDir $setupLeaf)
$stageModels = Join-Path $StageDir "resources\bundled-asr-models"
New-Item -ItemType Directory -Force -Path $stageModels | Out-Null
# Never use -LiteralPath with "*" — PowerShell treats the asterisk as a literal filename.
if (-not (Test-Path -LiteralPath $ModelsDir)) {
  throw "Missing Plan B models dir: $ModelsDir"
}
Get-ChildItem -LiteralPath $ModelsDir -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stageModels $_.Name) -Recurse -Force
}

if (Test-Path -LiteralPath $AsciiZipPath) { Remove-Item -LiteralPath $AsciiZipPath -Force }

Push-Location -LiteralPath $StageDir
try {
  $tarCreate = Invoke-RushiNativeSoft -Command {
    & tar -a -c -f $AsciiZipPath .
  }
  if ($tarCreate.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $AsciiZipPath)) {
    if (Test-Path -LiteralPath $AsciiZipPath) { Remove-Item -LiteralPath $AsciiZipPath -Force }
    Write-Warning "tar -a zip failed; retrying with tar --format zip"
    $tarCreate = Invoke-RushiNativeSoft -Command {
      & tar --format zip -c -f $AsciiZipPath .
    }
  }
  if ($tarCreate.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $AsciiZipPath)) {
    throw "tar zip failed (ascii=$AsciiZipPath, exit=$($tarCreate.ExitCode))"
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
  Invoke-RushiNativeChecked -FailMessage "tar extract failed ascii=$AsciiZipPath" -Command {
    & tar -xf $AsciiZipPath -C $ProbeDir
  }
  $probeSetup = Join-Path $ProbeDir $setupLeaf
  $probeManifest = Join-Path $ProbeDir "resources\bundled-asr-models\manifest.json"
  $probeModelscope = Join-Path $ProbeDir "resources\bundled-asr-models\modelscope"
  if (-not (Test-Path -LiteralPath $probeSetup)) {
    throw "offline zip missing NSIS setup: $probeSetup"
  }
  if (-not (Test-Path -LiteralPath $probeManifest)) {
    throw "offline zip missing Plan B models manifest: $probeManifest"
  }
  if (-not (Test-Path -LiteralPath $probeModelscope)) {
    throw "offline zip missing Plan B modelscope/: $probeModelscope"
  }
  Write-Host "OK: ascii zip contains NSIS setup + sibling Plan B models."
  Remove-Item -LiteralPath $ProbeDir -Recurse -Force
}

$finalParent = Split-Path -Parent $FinalZipPath
if (-not [string]::IsNullOrWhiteSpace($finalParent) -and -not (Test-Path -LiteralPath $finalParent)) {
  New-Item -ItemType Directory -Force -Path $finalParent | Out-Null
}
if (Test-Path -LiteralPath $FinalZipPath) { Remove-Item -LiteralPath $FinalZipPath -Force }
Move-Item -LiteralPath $AsciiZipPath -Destination $FinalZipPath
Write-Host "OK: wrote offline zip $FinalZipPath ($((Get-Item -LiteralPath $FinalZipPath).Length) bytes)"

if (Test-Path -LiteralPath $StageDir) {
  Remove-Item -LiteralPath $StageDir -Recurse -Force
  Write-Host "Cleaned stage dir $StageDir"
}

if ($WriteSha256) {
  $name = Split-Path -Leaf $FinalZipPath
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $FinalZipPath).Hash.ToLowerInvariant()
  Set-Content -Encoding utf8 -Path "$FinalZipPath.sha256" -Value "$hash  $name"
  Write-Host "Wrote $FinalZipPath.sha256"
}
