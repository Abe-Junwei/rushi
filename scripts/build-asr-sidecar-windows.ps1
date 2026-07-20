# Build PyInstaller onedir for rushi-asr sidecar (Windows x64) and copy into Tauri resources.
# Run from repo root:
#   powershell -File scripts/build-asr-sidecar-windows.ps1
#   powershell -File scripts/build-asr-sidecar-windows.ps1 -Variant Cuda
# Requires: Python 3.12 on PATH, network.
param(
  [Parameter(Mandatory = $false)]
  [ValidateSet('Cpu', 'Cuda')]
  [string]$Variant = 'Cpu'
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")
$Asr = Join-Path $Root "services\asr"
$Tag = "b6.1.1"
$Base = "https://github.com/eugeneware/ffmpeg-static/releases/download/$Tag"
$FfDir = Join-Path $Asr "third_party\ffmpeg\win32-x64"

switch ($Variant) {
  'Cpu' {
    $LockName = "requirements-sidecar-cpu-win_amd64.lock"
    $DestRel = "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar"
    $PyInstallerName = "rushi-asr-sidecar"
    $TmpVenv = Join-Path $Asr ".venv-sidecar-build"
  }
  'Cuda' {
    $LockName = "requirements-sidecar-cuda-win_amd64.lock"
    $DestRel = "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda"
    $PyInstallerName = "rushi-asr-sidecar-cuda"
    $TmpVenv = Join-Path $Asr ".venv-sidecar-build-cuda"
  }
}

$Dest = Join-Path $Root $DestRel
$Lock = Join-Path $Asr $LockName

function Get-RushiWinArtifactRoot {
  if (-not [string]::IsNullOrWhiteSpace($env:RUSHI_WIN_ARTIFACT_DIR)) {
    return $env:RUSHI_WIN_ARTIFACT_DIR.TrimEnd("\", "/")
  }
  if (Test-Path -LiteralPath "E:\") {
    return "E:\rushi-artifacts"
  }
  return (Join-Path $Root "dist\rushi-artifacts")
}

# NETWORK SERVICE cannot use interactive user %LOCALAPPDATA%\pip\Cache — pin a shared disk cache.
$artifactRoot = Get-RushiWinArtifactRoot
if ([string]::IsNullOrWhiteSpace($env:PIP_CACHE_DIR)) {
  $env:PIP_CACHE_DIR = Join-Path $artifactRoot "pip-cache"
}
New-Item -ItemType Directory -Force -Path $env:PIP_CACHE_DIR | Out-Null
Write-Host "PIP_CACHE_DIR=$($env:PIP_CACHE_DIR)"

# Durable venv keyed by lock hash — avoid re-downloading torch/funasr every release run.
$lockHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Lock).Hash.Substring(0, 16).ToLowerInvariant()
$TmpVenv = Join-Path $artifactRoot "sidecar-venv\$Variant\$lockHash"
Write-Host "sidecar venv: $TmpVenv (lock=$LockName hash=$lockHash)"

function Ensure-FunasrOnedirData {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InternalDir
  )

  $Marker = Join-Path $InternalDir "funasr\version.txt"
  if (Test-Path $Marker) {
    return
  }

  Write-Warning "$Marker missing after PyInstaller; copying funasr from build venv"
  $Site = Invoke-RushiNativeChecked -PassThru -FailMessage "FATAL: funasr is not importable in the sidecar build venv" -Command {
    & python -c "import funasr, pathlib; print(pathlib.Path(funasr.__file__).resolve().parent)"
  }
  $Site = ("$Site").Trim()
  if ([string]::IsNullOrWhiteSpace($Site)) {
    throw "FATAL: funasr is not importable in the sidecar build venv"
  }
  $FunasrDir = Join-Path $InternalDir "funasr"
  if (Test-Path $FunasrDir) { Remove-Item -Recurse -Force $FunasrDir }
  New-Item -ItemType Directory -Force $FunasrDir | Out-Null
  # Prefer Get-ChildItem + -LiteralPath per item (never -LiteralPath with "*").
  Get-ChildItem -LiteralPath $Site -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $FunasrDir $_.Name) -Recurse -Force
  }
  if (-not (Test-Path $Marker)) {
    throw "FATAL: funasr package data still missing at $Marker"
  }
}

function Get-FfmpegDurableCacheDir {
  $root = "E:\rushi-artifacts"
  if (-not [string]::IsNullOrWhiteSpace($env:RUSHI_WIN_ARTIFACT_DIR)) {
    $root = $env:RUSHI_WIN_ARTIFACT_DIR.TrimEnd("\", "/")
  }
  return (Join-Path $root "ffmpeg-static\$Tag\win32-x64")
}

function Test-FfmpegCachedFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][long]$MinBytes
  )
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $item = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
  return ($null -ne $item -and $item.Length -ge $MinBytes)
}

function Invoke-DownloadWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][string]$OutFile,
    [long]$MinBytes = 1,
    [int]$Attempts = 5,
    # ~80MB ffmpeg/ffprobe over flaky GitHub: align with fetch-ffmpeg-sidecar.sh
    [int]$TimeoutSec = 600
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      Write-Host "Downloading $(Split-Path -Leaf $OutFile) ($attempt/$Attempts)"
      $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
      if ($curl) {
        # Keep partials and resume; do not delete OutFile between attempts.
        Invoke-RushiNativeChecked -FailMessage "curl download failed: $Uri" -Command {
          & $curl.Source --fail --location --show-error --http1.1 `
            --connect-timeout 30 --max-time $TimeoutSec `
            --retry 3 --retry-delay 5 --retry-all-errors `
            -C - --output $OutFile $Uri
        }
      } else {
        if (Test-Path -LiteralPath $OutFile) {
          Remove-Item -LiteralPath $OutFile -Force
        }
        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -TimeoutSec $TimeoutSec
      }
      if (-not (Test-FfmpegCachedFile -Path $OutFile -MinBytes $MinBytes)) {
        throw "download produced a file smaller than $MinBytes bytes"
      }
      return
    } catch {
      Write-Warning "Download failed: $Uri ($($_.Exception.Message))"
      if ($attempt -eq $Attempts) {
        throw "Failed to download $Uri after $Attempts attempts"
      }
      Start-Sleep -Seconds ([Math]::Min(30, 5 * $attempt))
    }
  }
}

function Ensure-FfmpegAsset {
  param(
    [Parameter(Mandatory = $true)][string]$RemoteName,
    [Parameter(Mandatory = $true)][string]$OutFile,
    [Parameter(Mandatory = $true)][long]$MinBytes
  )

  $force = ($env:FORCE_FFMPEG_FETCH -eq "1")
  if (-not $force -and (Test-FfmpegCachedFile -Path $OutFile -MinBytes $MinBytes)) {
    Write-Host "OK: reuse cached $(Split-Path -Leaf $OutFile) ($((Get-Item -LiteralPath $OutFile).Length) bytes)"
    return
  }

  $cacheDir = Get-FfmpegDurableCacheDir
  $cacheFile = Join-Path $cacheDir (Split-Path -Leaf $OutFile)
  if (-not $force -and (Test-FfmpegCachedFile -Path $cacheFile -MinBytes $MinBytes)) {
    Write-Host "OK: copy durable ffmpeg cache -> $OutFile"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutFile) | Out-Null
    Copy-Item -LiteralPath $cacheFile -Destination $OutFile -Force
    return
  }

  Invoke-DownloadWithRetry -Uri "$Base/$RemoteName" -OutFile $OutFile -MinBytes $MinBytes

  try {
    New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    Copy-Item -LiteralPath $OutFile -Destination $cacheFile -Force
    Write-Host "OK: seeded durable ffmpeg cache $cacheFile"
  } catch {
    Write-Warning "Could not seed durable ffmpeg cache ($($_.Exception.Message))"
  }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "python not on PATH (install Python 3.12+)"
}

New-Item -ItemType Directory -Force $FfDir | Out-Null
# Binaries ~80MB; LICENSE is small. Reuse workspace/durable cache to survive GitHub timeouts (curl 28).
Ensure-FfmpegAsset -RemoteName "ffmpeg-win32-x64" -OutFile (Join-Path $FfDir "ffmpeg.exe") -MinBytes 1048576
Ensure-FfmpegAsset -RemoteName "ffprobe-win32-x64" -OutFile (Join-Path $FfDir "ffprobe.exe") -MinBytes 1048576
Ensure-FfmpegAsset -RemoteName "win32-x64.LICENSE" -OutFile (Join-Path $FfDir "LICENSE.ffmpeg-static") -MinBytes 100

$venvPython = Join-Path $TmpVenv "Scripts\python.exe"
$forceVenv = ($env:RUSHI_FORCE_SIDECAR_VENV -eq "1")
if ($forceVenv -and (Test-Path -LiteralPath $TmpVenv)) {
  Write-Host "RUSHI_FORCE_SIDECAR_VENV=1 — recreating durable venv"
  try {
    Remove-Item -LiteralPath $TmpVenv -Recurse -Force -ErrorAction Stop
  } catch {
    $staleRoot = Join-Path $artifactRoot "sidecar-venv-stale"
    New-Item -ItemType Directory -Force -Path $staleRoot | Out-Null
    $staleName = "$Variant-$lockHash.stale-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $stale = Join-Path $staleRoot $staleName
    Write-Warning "Could not delete $TmpVenv ($($_.Exception.Message)); moving to $stale"
    Move-Item -LiteralPath $TmpVenv -Destination $stale -Force
  }
}
if (-not (Test-Path -LiteralPath $venvPython)) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TmpVenv) | Out-Null
  Invoke-RushiNativeChecked -FailMessage "python -m venv failed" -Command {
    & python -m venv $TmpVenv
  }
} else {
  Write-Host "OK: reuse durable sidecar venv $TmpVenv"
}
& (Join-Path $TmpVenv "Scripts\Activate.ps1")

# CUDA torch wheels pin setuptools<82; keep upgrade within that bound.
if ($Variant -eq "Cuda") {
  Invoke-RushiNativeChecked -FailMessage "pip bootstrap (cuda) failed" -Command {
    & python -m pip install -U pip "setuptools<82" wheel
  }
} else {
  Invoke-RushiNativeChecked -FailMessage "pip bootstrap failed" -Command {
    & python -m pip install -U pip setuptools wheel
  }
}
Invoke-RushiNativeChecked -FailMessage "pip install pyinstaller failed" -Command {
  & python -m pip install pyinstaller
}
Invoke-RushiNativeChecked -FailMessage "pip install lockfile failed" -Command {
  & python -m pip install -r $Lock
}
Invoke-RushiNativeChecked -FailMessage "pip install -e asr failed" -Command {
  & python -m pip install -e $Asr --no-deps
}

Set-Location $Asr
if (Test-Path build) { Remove-Item -Recurse -Force build }
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
$SpecCpu = Join-Path $Asr "rushi-asr-sidecar.spec"
$SpecCuda = Join-Path $Asr "rushi-asr-sidecar-cuda.spec"
if (Test-Path $SpecCpu) { Remove-Item -Force $SpecCpu }
if (Test-Path $SpecCuda) { Remove-Item -Force $SpecCuda }

$FfExe = Join-Path $FfDir "ffmpeg.exe"
$FfProbe = Join-Path $FfDir "ffprobe.exe"

Invoke-RushiNativeChecked -FailMessage "pyinstaller failed" -Command {
  & pyinstaller --noconfirm --clean --onedir --name $PyInstallerName `
    --add-binary "$FfExe;." `
    --add-binary "$FfProbe;." `
    --hidden-import=uvicorn.logging `
    --hidden-import=uvicorn.loops `
    --hidden-import=uvicorn.loops.auto `
    --hidden-import=uvicorn.protocols `
    --hidden-import=uvicorn.protocols.http `
    --hidden-import=uvicorn.protocols.http.auto `
    --hidden-import=uvicorn.lifespan `
    --hidden-import=uvicorn.lifespan.on `
    --hidden-import=funasr `
    --collect-all funasr `
    --collect-all jieba `
    --collect-data modelscope `
    --collect-submodules modelscope `
    --collect-submodules hydra `
    --collect-submodules omegaconf `
    --collect-submodules torchaudio `
    rushi_sidecar_entry.py
}

Ensure-FunasrOnedirData -InternalDir (Join-Path $Asr "dist\$PyInstallerName\_internal")

$DistOnedir = Join-Path $Asr "dist\$PyInstallerName"
# Prefer .exe + PowerShell smoke on Windows. Passing a Win32 path into Git Bash
# smoke-asr-sidecar-health.sh prepends $PWD (path is not `/*`) and fails "not found".
$SmokeExe = Join-Path $DistOnedir "$PyInstallerName.exe"
if (-not (Test-Path -LiteralPath $SmokeExe)) {
  $SmokeExe = Join-Path $DistOnedir $PyInstallerName
}
Invoke-RushiNativeChecked -FailMessage "post-build sidecar health smoke failed" -Command {
  & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\smoke-asr-sidecar-health.ps1") -Exe $SmokeExe
}

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force (Split-Path $Dest) | Out-Null
Copy-Item -Recurse $DistOnedir $Dest

# Drop torch *.dist-info/licenses trees so makensis does not hit MAX_PATH.
Invoke-RushiNativeChecked -FailMessage "prune-windows-sidecar-for-nsis failed" -Command {
  & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\prune-windows-sidecar-for-nsis.ps1") -Onedir @($DestRel)
}

# Stamp metadata only — never fail the build on git ownership / missing git (CI runners).
$gitSha = Get-RushiGitShaShort -RepoRoot $Root

$builtAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$stampPath = Join-Path $Dest "sidecar-build-stamp.txt"
@"
git_sha=$gitSha
built_at=$builtAt
platform=Windows-$Variant
"@ | Set-Content -Encoding utf8 $stampPath

Write-Host "OK ($Variant): FunASR sidecar onedir -> $Dest"
