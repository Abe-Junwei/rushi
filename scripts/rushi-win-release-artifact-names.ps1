# Shared Windows release artifact basenames (Chinese product + version + role).
# Dot-source from other scripts:
#   . (Join-Path $Root "scripts\rushi-win-release-artifact-names.ps1")

function Get-RushiWinProductName {
  return "如是我闻"
}

function Get-RushiWinAppVersion {
  param([string]$RepoRoot = (Split-Path -Parent $PSScriptRoot))
  $pkg = Join-Path $RepoRoot "apps\desktop\package.json"
  $json = Get-Content -LiteralPath $pkg -Raw | ConvertFrom-Json
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
  return "$(Get-RushiWinProductName)_${v}_Windows_x64_便携版.zip"
}

function Get-RushiWinNsisSetupName {
  param([string]$Version = "")
  $v = Get-RushiWinNormalizedVersion $Version
  return "$(Get-RushiWinProductName)_${v}_Windows_x64_安装包.exe"
}

function Get-RushiWinCudaZipName {
  param([string]$Version = "")
  $v = Get-RushiWinNormalizedVersion $Version
  return "$(Get-RushiWinProductName)_${v}_Windows_x64_CUDA侧车.zip"
}
