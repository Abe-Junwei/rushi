# Fast readiness check for the self-hosted Windows release runner.
# Run before expensive sidecar/NSIS work so machine drift fails early.

param(
  [switch]$ExportGithubPath
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$rows = New-Object System.Collections.Generic.List[object]

function Add-Row {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Status,
    [Parameter(Mandatory)][string]$Detail
  )
  $rows.Add([pscustomobject]@{
    Check  = $Name
    Status = $Status
    Detail = $Detail
  }) | Out-Null
}

function Add-Error {
  param([Parameter(Mandatory)][string]$Message)
  $errors.Add($Message) | Out-Null
}

function Add-Warning {
  param([Parameter(Mandatory)][string]$Message)
  $warnings.Add($Message) | Out-Null
}

function Get-NativeText {
  param([Parameter(Mandatory)][scriptblock]$Command)
  $result = Invoke-RushiNativeSoft -Command $Command
  $text = if ($null -eq $result.Output) { "" } else { (($result.Output | Out-String).Trim()) }
  return [pscustomobject]@{
    ExitCode = $result.ExitCode
    Text     = $text
  }
}

function Test-CommandVersion {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][scriptblock]$VersionCommand,
    [scriptblock]$Validate,
    [switch]$Required
  )
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    $msg = "$Name not on PATH"
    if ($Required) { Add-Error $msg } else { Add-Warning $msg }
    Add-Row $Name "missing" $msg
    return $null
  }
  $version = Get-NativeText -Command $VersionCommand
  if ($version.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($version.Text)) {
    $msg = "$Name version probe failed"
    if ($Required) { Add-Error $msg } else { Add-Warning $msg }
    Add-Row $Name "bad" "$msg at $($cmd.Source)"
    return $null
  }
  if ($Validate -and -not (& $Validate $version.Text)) {
    $msg = "$Name version is not acceptable: $($version.Text)"
    if ($Required) { Add-Error $msg } else { Add-Warning $msg }
    Add-Row $Name "bad" "$($version.Text) at $($cmd.Source)"
    return $null
  }
  Add-Row $Name "ok" "$($version.Text) at $($cmd.Source)"
  return $cmd
}

function Test-UsablePython312 {
  param([string]$Exe)
  if ([string]::IsNullOrWhiteSpace($Exe) -or -not (Test-Path -LiteralPath $Exe)) {
    return $false
  }
  if ($Exe -match '[\\/]_work[\\/]_tool[\\/]') { return $false }
  if ($Exe -match 'WindowsApps') { return $false }
  $version = Get-NativeText -Command {
    & $Exe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
  }
  if ($version.ExitCode -ne 0 -or $version.Text -notmatch '^3\.12') {
    return $false
  }
  $ok = Get-NativeText -Command {
    & $Exe -c "import pip, venv"
  }
  return ($ok.ExitCode -eq 0)
}

Write-Host "== Windows release runner readiness =="
Write-Host "Repo: $Root"
Write-Host "User: $env:USERNAME"
Write-Host "Computer: $env:COMPUTERNAME"
Write-Host "Workspace: $env:GITHUB_WORKSPACE"

$isWindowsPlatform = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if (-not $isWindowsPlatform) {
  Add-Error "This release runner check must run on Windows."
} else {
  Add-Row "os" "ok" ([System.Environment]::OSVersion.VersionString)
}

if ([string]::IsNullOrWhiteSpace($env:GITHUB_WORKSPACE)) {
  Add-Warning "GITHUB_WORKSPACE is empty (normal for local dry runs, bad for GitHub Actions)."
} elseif (-not (Test-Path -LiteralPath $env:GITHUB_WORKSPACE)) {
  Add-Error "GITHUB_WORKSPACE does not exist: $env:GITHUB_WORKSPACE"
} else {
  Add-Row "workspace" "ok" $env:GITHUB_WORKSPACE
}

Test-CommandVersion `
  -Name "node" `
  -VersionCommand { & node -v } `
  -Validate { param($v) ([int](($v -replace '^v','').Split('.')[0]) -ge 22) } `
  -Required | Out-Null

Test-CommandVersion `
  -Name "npm" `
  -VersionCommand { & npm -v } `
  -Validate { param($v) ([int](($v.Trim()).Split('.')[0]) -ge 10) } `
  -Required | Out-Null

$pythonCandidates = @(
  "E:\Python312\python.exe",
  "E:\PythonVersions\cpython-3.12.10-windows-x86_64-none\python.exe",
  "E:\PythonVersions\cpython-3.12-windows-x86_64-none\python.exe",
  "C:\Program Files\Python312\python.exe",
  (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"),
  (Join-Path $env:USERPROFILE "AppData\Local\Programs\Python\Python312\python.exe")
)
foreach ($pySpec in @("-3.12", "-V:Astral/CPython3.12.10")) {
  $pyOut = Get-NativeText -Command {
    & py $pySpec -c "import sys; print(sys.executable)" 2>$null
  }
  if ($pyOut.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($pyOut.Text)) {
    $pythonCandidates += $pyOut.Text.Trim()
  }
}
$python312 = $null
foreach ($candidate in $pythonCandidates | Select-Object -Unique) {
  if (Test-UsablePython312 $candidate) {
    $python312 = $candidate
    break
  }
}
if ($python312) {
  $pyVer = Get-NativeText -Command { & $python312 --version }
  Add-Row "python3.12" "ok" "$($pyVer.Text) at $python312"
  if ($ExportGithubPath -and -not [string]::IsNullOrWhiteSpace($env:GITHUB_PATH)) {
    $pyDir = Split-Path -Parent $python312
    Add-Content -LiteralPath $env:GITHUB_PATH -Value $pyDir
    $pyScripts = Join-Path $pyDir "Scripts"
    if (Test-Path -LiteralPath $pyScripts) {
      Add-Content -LiteralPath $env:GITHUB_PATH -Value $pyScripts
    }
    Add-Row "python3.12:path" "ok" "exported $pyDir to GITHUB_PATH"
  }
} else {
  Add-Error "Usable Python 3.12 not found (need real CPython with pip+venv; not WindowsApps or runner _tool cache)."
  Add-Row "python3.12" "missing" "Install CPython 3.12 to E:\Python312 or Program Files."
}

Test-CommandVersion -Name "git" -VersionCommand { & git --version } -Required | Out-Null
Test-CommandVersion -Name "bash" -VersionCommand { & bash --version } -Required | Out-Null
Test-CommandVersion -Name "tar" -VersionCommand { & tar --version } -Required | Out-Null
Test-CommandVersion -Name "curl" -VersionCommand { & curl --version } -Required | Out-Null
Test-CommandVersion -Name "sha256sum" -VersionCommand { & sha256sum --version } -Required | Out-Null

$bashPython = Get-NativeText -Command {
  & bash scripts/resolve-host-python312.sh
}
if ($bashPython.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($bashPython.Text)) {
  Add-Error "Git Bash cannot resolve the required Python 3.12 (scripts/resolve-host-python312.sh failed)."
  Add-Row "bash-python3.12" "bad" "Git Bash host Python resolution failed"
} else {
  Add-Row "bash-python3.12" "ok" $bashPython.Text.Trim()
}

$tarProbeRoot = Join-Path $env:TEMP "rushi-release-tar-probe-$PID"
try {
  $tarProbeInput = Join-Path $tarProbeRoot "input"
  $tarProbeZip = Join-Path $tarProbeRoot "probe.zip"
  New-Item -ItemType Directory -Force -Path $tarProbeInput | Out-Null
  Set-Content -LiteralPath (Join-Path $tarProbeInput "probe.txt") -Encoding ascii -Value "rushi-release-tar-probe"
  $tarCreate = Get-NativeText -Command { & tar -a -c -f $tarProbeZip -C $tarProbeInput probe.txt }
  $tarList = if ($tarCreate.ExitCode -eq 0 -and (Test-Path -LiteralPath $tarProbeZip)) {
    Get-NativeText -Command { & tar -tf $tarProbeZip }
  } else {
    [pscustomobject]@{ ExitCode = 1; Text = "" }
  }
  $magic = if (Test-Path -LiteralPath $tarProbeZip) {
    [System.IO.File]::ReadAllBytes($tarProbeZip)[0..1]
  } else {
    @()
  }
  if ($tarCreate.ExitCode -ne 0 -or $tarList.ExitCode -ne 0 -or $tarList.Text -notmatch 'probe\.txt' -or $magic.Count -ne 2 -or $magic[0] -ne 0x50 -or $magic[1] -ne 0x4B) {
    Add-Error "tar cannot create and read a real ZIP via -a; Windows release packaging requires ZIP-capable bsdtar."
    Add-Row "tar:zip" "bad" "tar -a ZIP round-trip failed"
  } else {
    Add-Row "tar:zip" "ok" "ZIP create/list round-trip passed"
  }
} catch {
  Add-Error "tar ZIP capability probe failed: $($_.Exception.Message)"
  Add-Row "tar:zip" "bad" $_.Exception.Message
} finally {
  if (Test-Path -LiteralPath $tarProbeRoot) {
    Remove-Item -LiteralPath $tarProbeRoot -Recurse -Force
  }
}

$signToolPath = if ($env:WINDOWS_SIGNTOOL_PATH) { $env:WINDOWS_SIGNTOOL_PATH } else { $env:SIGNTOOL }
$signPfxPath = if ($env:WINDOWS_SIGN_PFX_PATH) { $env:WINDOWS_SIGN_PFX_PATH } else { $env:SIGN_PFX }
$signPassword = if ($env:WINDOWS_SIGN_PFX_PASSWORD) { $env:WINDOWS_SIGN_PFX_PASSWORD } else { $env:SIGN_PASS }
$signingValues = @($signToolPath, $signPfxPath, $signPassword)
if ($signingValues | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) {
  if ([string]::IsNullOrWhiteSpace($signToolPath) -or
      [string]::IsNullOrWhiteSpace($signPfxPath) -or
      [string]::IsNullOrWhiteSpace($signPassword)) {
    Add-Error "Windows signing configuration is partial; signtool path, PFX path, and password must be set together."
    Add-Row "windows-signing" "bad" "partial signing configuration"
  } elseif (-not (Test-Path -LiteralPath $signToolPath)) {
    Add-Error "WINDOWS_SIGNTOOL_PATH does not exist."
    Add-Row "windows-signing" "bad" "signtool path missing"
  } elseif (-not (Test-Path -LiteralPath $signPfxPath)) {
    Add-Error "WINDOWS_SIGN_PFX_PATH does not exist."
    Add-Row "windows-signing" "bad" "PFX path missing"
  } else {
    Add-Row "windows-signing" "ok" "configured paths exist"
  }
} else {
  Add-Warning "Windows Authenticode signing is not configured."
  Add-Row "windows-signing" "warn" "unsigned release policy"
}

Test-CommandVersion -Name "rustc" -VersionCommand { & rustc --version } | Out-Null
Test-CommandVersion -Name "cargo" -VersionCommand { & cargo --version } | Out-Null
Test-CommandVersion -Name "aws" -VersionCommand { & aws --version } | Out-Null

$diskRoots = @($Root, $env:TEMP, "E:\")
$seenDrives = New-Object System.Collections.Generic.HashSet[string]
foreach ($diskRoot in $diskRoots | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) {
  try {
    $full = [System.IO.Path]::GetFullPath($diskRoot)
    $driveName = [System.IO.Path]::GetPathRoot($full)
    if ([string]::IsNullOrWhiteSpace($driveName)) { continue }
    if (-not $seenDrives.Add($driveName.ToUpperInvariant())) { continue }
    $drive = New-Object System.IO.DriveInfo($driveName)
    $freeGiB = [math]::Round($drive.AvailableFreeSpace / 1GB, 2)
    $detail = "$driveName free ${freeGiB} GiB"
    if ($drive.AvailableFreeSpace -lt 15GB) {
      Add-Error "Low disk space on ${driveName}: ${freeGiB} GiB free; Windows release needs at least 15 GiB."
      Add-Row "disk:$driveName" "bad" $detail
    } elseif ($drive.AvailableFreeSpace -lt 30GB) {
      Add-Warning "Disk space on $driveName is below 30 GiB: ${freeGiB} GiB free."
      Add-Row "disk:$driveName" "warn" $detail
    } else {
      Add-Row "disk:$driveName" "ok" $detail
    }
  } catch {
    Add-Warning "Could not inspect disk for $diskRoot ($($_.Exception.Message))"
  }
}

Write-Host ""
$rows | Format-Table -AutoSize | Out-String | Write-Host

if ($warnings.Count -gt 0) {
  Write-Host "Warnings:"
  foreach ($warning in $warnings) {
    Write-Warning $warning
  }
}

if ($errors.Count -gt 0) {
  Write-Host "Errors:"
  foreach ($err in $errors) {
    Write-Host "::error::$err"
  }
  throw "Windows release runner readiness failed ($($errors.Count) error(s))."
}

Write-Host "OK: Windows release runner readiness"
