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
  Copy-Item -Recurse (Join-Path $Site "*") $FunasrDir
  if (-not (Test-Path $Marker)) {
    throw "FATAL: funasr package data still missing at $Marker"
  }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "python not on PATH (install Python 3.12+)"
}

New-Item -ItemType Directory -Force $FfDir | Out-Null
Invoke-WebRequest -Uri "$Base/ffmpeg-win32-x64" -OutFile (Join-Path $FfDir "ffmpeg.exe")
Invoke-WebRequest -Uri "$Base/ffprobe-win32-x64" -OutFile (Join-Path $FfDir "ffprobe.exe")
Invoke-WebRequest -Uri "$Base/win32-x64.LICENSE" -OutFile (Join-Path $FfDir "LICENSE.ffmpeg-static")

if (Test-Path $TmpVenv) {
  try {
    Remove-Item -Recurse -Force $TmpVenv -ErrorAction Stop
  } catch {
    $stale = "${TmpVenv}.stale-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Warning "Could not delete $TmpVenv ($($_.Exception.Message)); renaming to $stale"
    Rename-Item -LiteralPath $TmpVenv -NewName (Split-Path -Leaf $stale) -Force
  }
}
Invoke-RushiNativeChecked -FailMessage "python -m venv failed" -Command {
  & python -m venv $TmpVenv
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
$SmokeExe = Join-Path $DistOnedir $PyInstallerName
if (Get-Command bash -ErrorAction SilentlyContinue) {
  Invoke-RushiNativeChecked -FailMessage "post-build sidecar health smoke failed" -Command {
    & bash "$Root/scripts/smoke-asr-sidecar-health.sh" $SmokeExe
  }
} else {
  Write-Warning "bash not found; skipping post-build /health smoke (install Git Bash for release builds)"
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
