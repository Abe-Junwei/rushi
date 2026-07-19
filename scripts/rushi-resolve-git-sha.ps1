# Resolve a short git SHA for build stamps / metadata.
# Never throws: CI self-hosted runners often hit "dubious ownership"; stamp must not fail the build.
#
# Also hosts native-command helpers for PowerShell `$ErrorActionPreference=Stop` + PS 7.3+
# `PSNativeCommandUseErrorActionPreference` (stderr / non-zero must not become terminating
# unless we choose to fail on exit code).
#
# Dot-source:
#   . (Join-Path $PSScriptRoot "rushi-resolve-git-sha.ps1")
#   $sha = Get-RushiGitShaShort -RepoRoot $Root
#   Invoke-RushiNativeChecked -FailMessage "npm ci failed" -Command { & npm ci }

function Get-RushiGitShaShort {
  param(
    [string]$RepoRoot = "",
    [int]$Length = 7
  )

  if ($Length -lt 4) { $Length = 4 }
  if ($Length -gt 40) { $Length = 40 }

  foreach ($envName in @("GITHUB_SHA", "RUSHI_GIT_SHA")) {
    $raw = [Environment]::GetEnvironmentVariable($envName)
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
      $trim = $raw.Trim()
      return $trim.Substring(0, [Math]::Min($Length, $trim.Length))
    }
  }

  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
  }

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    return "unknown"
  }

  $soft = Invoke-RushiNativeSoft -Command {
    & git -C $RepoRoot rev-parse --short=$Length HEAD 2>$null
  }
  if ($soft.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace("$($soft.Output)")) {
    return ("$($soft.Output)").Trim()
  }

  return "unknown"
}

function Enter-RushiNativeSafePref {
  $state = [ordered]@{
    Eap       = $ErrorActionPreference
    HasNative = $false
    Native    = $null
  }
  $ErrorActionPreference = "Continue"
  if ($null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)) {
    $state.HasNative = $true
    $state.Native = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }
  return [pscustomobject]$state
}

function Exit-RushiNativeSafePref {
  param([Parameter(Mandatory)]$State)
  $ErrorActionPreference = $State.Eap
  if ($State.HasNative) {
    $PSNativeCommandUseErrorActionPreference = $State.Native
  }
}

# Soft probe: never throws. Returns ExitCode + Output (stdout objects).
function Invoke-RushiNativeSoft {
  param([Parameter(Mandatory)][scriptblock]$Command)
  $state = Enter-RushiNativeSafePref
  try {
    $global:LASTEXITCODE = 0
    $output = & $Command
    $code = 0
    if ($null -ne $LASTEXITCODE) { $code = [int]$LASTEXITCODE }
    return [pscustomobject]@{
      ExitCode = $code
      Output   = $output
    }
  } catch {
    return [pscustomobject]@{
      ExitCode = 1
      Output   = $null
    }
  } finally {
    Exit-RushiNativeSafePref -State $state
  }
}

# Shared pattern: run a native command; only fail on non-zero exit (ignore stderr noise under Stop).
# Default streams to the host (pip/pyinstaller progress). Use -PassThru to capture stdout objects.
function Invoke-RushiNativeChecked {
  param(
    [Parameter(Mandatory)][scriptblock]$Command,
    [string]$FailMessage = "native command failed",
    [switch]$PassThru
  )
  $state = Enter-RushiNativeSafePref
  try {
    # Reset so a leftover non-zero / $null from a prior native call cannot false-fail.
    $global:LASTEXITCODE = 0
    if ($PassThru) {
      $output = & $Command
    } else {
      # Do not capture — keep live pip/pyinstaller/npm progress on the console.
      & $Command
      $output = $null
    }
    # Only integer non-zero fails; $null (some cmdlets) must not throw ($null -ne 0 is $true).
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
      throw "$FailMessage (exit $LASTEXITCODE)"
    }
    if ($PassThru) { return $output }
  } finally {
    Exit-RushiNativeSafePref -State $state
  }
}
