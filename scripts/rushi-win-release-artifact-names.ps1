# Shared Windows release artifact basenames (Chinese product + version + role).
# Chinese literals are built from code points so Windows PowerShell 5.1 (non-UTF8
# script parse) still produces correct UTF-16 strings / UTF-8 filenames.
# Dot-source: . (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")

function Get-RushiWinProductName {
  # 如是我闻
  return -join @(
    [char]0x5982
    [char]0x662F
    [char]0x6211
    [char]0x95FB
  )
}

function Get-RushiWinAppVersion {
  param([string]$RepoRoot = (Split-Path -Parent $PSScriptRoot))
  $pkg = Join-Path $RepoRoot "apps\desktop\package.json"
  $json = Get-Content -LiteralPath $pkg -Raw -Encoding utf8 | ConvertFrom-Json
  return [string]$json.version
}

function Get-RushiWinNormalizedVersion {
  param([string]$Version = "")
  if ([string]::IsNullOrWhiteSpace($Version)) {
    return Get-RushiWinAppVersion
  }
  return $Version.TrimStart("v", "V")
}

function Get-RushiWinPortableZipName {
  param([string]$Version = "")
  $v = Get-RushiWinNormalizedVersion $Version
  # _Windows_x64_便携版.zip
  $role = -join @([char]0x4FBF, [char]0x643A, [char]0x7248)
  return "$(Get-RushiWinProductName)_${v}_Windows_x64_${role}.zip"
}

function Get-RushiWinNsisSetupName {
  param([string]$Version = "")
  $v = Get-RushiWinNormalizedVersion $Version
  # _Windows_x64_安装包.exe
  $role = -join @([char]0x5B89, [char]0x88C5, [char]0x5305)
  return "$(Get-RushiWinProductName)_${v}_Windows_x64_${role}.exe"
}

function Get-RushiWinCudaZipName {
  param([string]$Version = "")
  $v = Get-RushiWinNormalizedVersion $Version
  # _Windows_x64_CUDA侧车.zip
  $role = -join @("CUDA", [char]0x4FA7, [char]0x8F66)
  return "$(Get-RushiWinProductName)_${v}_Windows_x64_${role}.zip"
}

# Local Windows release staging — outside the git repo (never write portable/CUDA zips into $RepoRoot).
# Override: $env:RUSHI_WIN_ARTIFACT_DIR
function Get-RushiWinArtifactDir {
  if (-not [string]::IsNullOrWhiteSpace($env:RUSHI_WIN_ARTIFACT_DIR)) {
    return $env:RUSHI_WIN_ARTIFACT_DIR.TrimEnd("\", "/")
  }
  return "E:\rushi-artifacts"
}

function Get-RushiWinReleaseArtifactDir {
  $root = Get-RushiWinArtifactDir
  return (Join-Path $root "win-release")
}

function Get-RushiWinCudaArtifactDir {
  $root = Get-RushiWinArtifactDir
  return (Join-Path $root "cuda-cdn")
}
