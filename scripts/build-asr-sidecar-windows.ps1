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
  $Site = python -c "import funasr, pathlib; print(pathlib.Path(funasr.__file__).resolve().parent)"
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

if (Test-Path $TmpVenv) { Remove-Item -Recurse -Force $TmpVenv }
python -m venv $TmpVenv
& (Join-Path $TmpVenv "Scripts\Activate.ps1")
python -m pip install -U pip setuptools wheel
python -m pip install pyinstaller
python -m pip install -r $Lock
python -m pip install -e $Asr --no-deps

Set-Location $Asr
if (Test-Path build) { Remove-Item -Recurse -Force build }
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
$SpecCpu = Join-Path $Asr "rushi-asr-sidecar.spec"
$SpecCuda = Join-Path $Asr "rushi-asr-sidecar-cuda.spec"
if (Test-Path $SpecCpu) { Remove-Item -Force $SpecCpu }
if (Test-Path $SpecCuda) { Remove-Item -Force $SpecCuda }

$FfExe = Join-Path $FfDir "ffmpeg.exe"
$FfProbe = Join-Path $FfDir "ffprobe.exe"

pyinstaller --noconfirm --clean --onedir --name $PyInstallerName `
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

Ensure-FunasrOnedirData -InternalDir (Join-Path $Asr "dist\$PyInstallerName\_internal")

$DistOnedir = Join-Path $Asr "dist\$PyInstallerName"
$SmokeExe = Join-Path $DistOnedir $PyInstallerName
if (Get-Command bash -ErrorAction SilentlyContinue) {
  bash "$Root/scripts/smoke-asr-sidecar-health.sh" $SmokeExe
} else {
  Write-Warning "bash not found; skipping post-build /health smoke (install Git Bash for release builds)"
}

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force (Split-Path $Dest) | Out-Null
Copy-Item -Recurse $DistOnedir $Dest
Write-Host "OK ($Variant): FunASR sidecar onedir -> $Dest"
