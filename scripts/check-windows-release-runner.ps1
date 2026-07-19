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

function Test-Sha256sumAvailable {
  $cmd = Get-Command "sha256sum" -ErrorAction SilentlyContinue
  if ($cmd) {
    $version = Get-NativeText -Command { & sha256sum --version }
    if ($version.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($version.Text)) {
      Add-Row "sha256sum" "ok" "$($version.Text) at $($cmd.Source)"
      return $true
    }
  }

  $bashProbe = Get-NativeText -Command {
    & bash -lc "command -v sha256sum >/dev/null 2>&1 && sha256sum --version | head -n 1"
  }
  if ($bashProbe.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($bashProbe.Text)) {
    Add-Row "sha256sum" "ok" "available in Git Bash: $($bashProbe.Text)"
    return $true
  }

  Add-Error "sha256sum not available in PowerShell PATH or Git Bash PATH"
  Add-Row "sha256sum" "missing" "sha256sum not available in PowerShell or Git Bash"
  return $false
}

function Test-ZipTarCandidate {
  param([Parameter(Mandatory)][string]$TarExe)
  if (-not (Test-Path -LiteralPath $TarExe)) {
    return $false
  }
  $probeRoot = Join-Path $env:TEMP "rushi-release-tar-probe-$PID-$([Guid]::NewGuid().ToString('N'))"
  try {
    $probeInput = Join-Path $probeRoot "input"
    $probeZip = Join-Path $probeRoot "probe.zip"
    New-Item -ItemType Directory -Force -Path $probeInput | Out-Null
    Set-Content -LiteralPath (Join-Path $probeInput "probe.txt") -Encoding ascii -Value "rushi-release-tar-probe"
    $create = Get-NativeText -Command { & $TarExe -a -c -f $probeZip -C $probeInput probe.txt 2>$null }
    if ($create.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $probeZip)) {
      if (Test-Path -LiteralPath $probeZip) { Remove-Item -LiteralPath $probeZip -Force }
      $create = Get-NativeText -Command { & $TarExe --format zip -c -f $probeZip -C $probeInput probe.txt 2>$null }
    }
    if ($create.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $probeZip)) {
      return $false
    }
    $list = Get-NativeText -Command { & $TarExe -tf $probeZip 2>$null }
    $magic = [System.IO.File]::ReadAllBytes($probeZip)[0..1]
    return ($list.ExitCode -eq 0 -and $list.Text -match 'probe\.txt' -and $magic[0] -eq 0x50 -and $magic[1] -eq 0x4B)
  } catch {
    return $false
  } finally {
    if (Test-Path -LiteralPath $probeRoot) {
      Remove-Item -LiteralPath $probeRoot -Recurse -Force
    }
  }
}

function Resolve-ZipCapableTar {
  param([object[]]$SeedCommands)
  $candidates = New-Object System.Collections.Generic.List[string]
  if (-not [string]::IsNullOrWhiteSpace($env:RUSHI_ZIP_TAR)) {
    $candidates.Add($env:RUSHI_ZIP_TAR) | Out-Null
  }
  foreach ($cmd in $SeedCommands) {
    if ($cmd -and $cmd.Source) {
      $toolDir = Split-Path -Parent $cmd.Source
      $gitRoot = Split-Path -Parent $toolDir
      $candidates.Add((Join-Path $gitRoot "usr\bin\tar.exe")) | Out-Null
      $candidates.Add((Join-Path $toolDir "tar.exe")) | Out-Null
    }
  }
  foreach ($path in @("E:\Git\usr\bin\tar.exe", "C:\Program Files\Git\usr\bin\tar.exe", "C:\Program Files (x86)\Git\usr\bin\tar.exe")) {
    $candidates.Add($path) | Out-Null
  }
  $pathTar = Get-Command "tar" -ErrorAction SilentlyContinue
  if ($pathTar -and $pathTar.Source) {
    $candidates.Add($pathTar.Source) | Out-Null
  }
  foreach ($candidate in $candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) {
    if (Test-ZipTarCandidate $candidate) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }
  return $null
}

function Test-DotnetZipAvailable {
  $probeRoot = Join-Path $env:TEMP "rushi-release-dotnet-zip-probe-$PID-$([Guid]::NewGuid().ToString('N'))"
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $probeInput = Join-Path $probeRoot "input"
    $probeExtract = Join-Path $probeRoot "extract"
    $probeZip = Join-Path $probeRoot "probe.zip"
    New-Item -ItemType Directory -Force -Path $probeInput | Out-Null
    Set-Content -LiteralPath (Join-Path $probeInput "probe.txt") -Encoding ascii -Value "rushi-release-dotnet-zip-probe"
    [System.IO.Compression.ZipFile]::CreateFromDirectory($probeInput, $probeZip)
    [System.IO.Compression.ZipFile]::ExtractToDirectory($probeZip, $probeExtract)
    return (Test-Path -LiteralPath (Join-Path $probeExtract "probe.txt"))
  } catch {
    return $false
  } finally {
    if (Test-Path -LiteralPath $probeRoot) {
      Remove-Item -LiteralPath $probeRoot -Recurse -Force
    }
  }
}

function Add-PathForCurrentStep {
  param([Parameter(Mandatory)][string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
    return $false
  }
  $parts = @($env:PATH -split [IO.Path]::PathSeparator | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $alreadyPresent = $parts | Where-Object { $_.TrimEnd('\') -ieq $Path.TrimEnd('\') } | Select-Object -First 1
  if (-not $alreadyPresent) {
    $env:PATH = "$Path$([IO.Path]::PathSeparator)$env:PATH"
  }
  if ($ExportGithubPath -and -not [string]::IsNullOrWhiteSpace($env:GITHUB_PATH)) {
    Add-Content -LiteralPath $env:GITHUB_PATH -Value $Path
  }
  return $true
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

$gitCmd = Test-CommandVersion -Name "git" -VersionCommand { & git --version } -Required
$bashCmd = Test-CommandVersion -Name "bash" -VersionCommand { & bash --version } -Required
Test-CommandVersion -Name "tar" -VersionCommand { & tar --version } -Required | Out-Null
Test-CommandVersion -Name "curl" -VersionCommand { & curl --version } -Required | Out-Null

$gitUsrBinCandidates = @()
foreach ($cmd in @($gitCmd, $bashCmd)) {
  if ($cmd -and $cmd.Source) {
    $toolDir = Split-Path -Parent $cmd.Source
    $gitRoot = Split-Path -Parent $toolDir
    $gitUsrBinCandidates += (Join-Path $gitRoot "usr\bin")
  }
}
foreach ($candidate in $gitUsrBinCandidates | Select-Object -Unique) {
  if ((Test-Path -LiteralPath (Join-Path $candidate "sha256sum.exe")) -and (Add-PathForCurrentStep $candidate)) {
    Add-Row "git-usr-bin:path" "ok" "exported $candidate to PATH"
    break
  }
}
Test-Sha256sumAvailable | Out-Null

$zipTar = Resolve-ZipCapableTar -SeedCommands @($gitCmd, $bashCmd)
if ($zipTar) {
  $env:RUSHI_ZIP_TAR = $zipTar
  $zipTarDir = Split-Path -Parent $zipTar
  Add-PathForCurrentStep $zipTarDir | Out-Null
  if ($ExportGithubPath -and -not [string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
    Add-Content -LiteralPath $env:GITHUB_ENV -Value "RUSHI_ZIP_TAR=$zipTar"
  }
  Add-Row "tar:zip" "ok" "ZIP create/list round-trip passed via $zipTar"
} else {
  Add-Warning "No ZIP-capable tar.exe found; Windows packaging will use .NET ZipArchive."
  Add-Row "tar:zip" "warn" "No ZIP-capable tar.exe found"
}

if (Test-DotnetZipAvailable) {
  Add-Row "dotnet:zip" "ok" "ZipArchive create/extract round-trip passed"
} else {
  Add-Error ".NET ZipArchive cannot create/extract ZIP files; Windows release packaging requires ZipArchive."
  Add-Row "dotnet:zip" "bad" "ZipArchive round-trip failed"
}

$bashPython = Get-NativeText -Command {
  & bash scripts/resolve-host-python312.sh
}
if ($bashPython.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($bashPython.Text)) {
  Add-Error "Git Bash cannot resolve the required Python 3.12 (scripts/resolve-host-python312.sh failed)."
  Add-Row "bash-python3.12" "bad" "Git Bash host Python resolution failed"
} else {
  Add-Row "bash-python3.12" "ok" $bashPython.Text.Trim()
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
