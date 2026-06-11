# Post-build smoke: bundled sidecar starts and /health reports bundled FunASR + ffmpeg.
param(
  [string]$Exe = "$PSScriptRoot/../apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar.exe"
)

$ErrorActionPreference = "Stop"
$Exe = (Resolve-Path $Exe).Path
$Port = if ($env:RUSHI_SMOKE_ASR_PORT) { [int]$env:RUSHI_SMOKE_ASR_PORT } else { 18741 }
$WorkDir = Split-Path -Parent $Exe
$Internal = Join-Path $WorkDir "_internal"

if (-not (Test-Path $Exe)) {
  throw "smoke: executable not found: $Exe"
}
if (-not (Test-Path (Join-Path $Internal "funasr/version.txt"))) {
  throw "smoke: missing PyInstaller data file: funasr/version.txt"
}
if (-not (Test-Path (Join-Path $Internal "ffmpeg.exe"))) {
  throw "smoke: missing bundled ffmpeg.exe under $Internal"
}
if (-not (Test-Path (Join-Path $Internal "ffprobe.exe"))) {
  throw "smoke: missing bundled ffprobe.exe under $Internal"
}

$inUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($inUse) {
  throw "smoke: port $Port already in use"
}

$log = Join-Path $env:TEMP "rushi-sidecar-smoke.log"
$logErr = Join-Path $env:TEMP "rushi-sidecar-smoke.err"
$healthJson = Join-Path $env:TEMP "rushi-sidecar-smoke-health.json"
$rootJson = Join-Path $env:TEMP "rushi-sidecar-smoke-root.json"

Push-Location $WorkDir
$proc = $null
try {
  $env:ASR_HOST = "127.0.0.1"
  $env:ASR_PORT = "$Port"
  # Start-Process rejects identical RedirectStandardOutput/Error paths (unlike bash 2>&1).
  $proc = Start-Process -FilePath $Exe -PassThru -NoNewWindow -RedirectStandardOutput $log -RedirectStandardError $logErr

  $ready = $false
  for ($i = 0; $i -lt 120; $i++) {
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -OutFile $healthJson -TimeoutSec 2 | Out-Null
      if ((Get-Item $healthJson).Length -gt 0) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    Get-Content $log, $logErr -Tail 30 -ErrorAction SilentlyContinue
    throw "smoke: /health did not become ready (see $log and $logErr)"
  }

  python - @"
import json
import sys
with open(r"$healthJson", encoding="utf-8") as f:
    body = json.load(f)
if body.get("service") != "rushi-asr":
    sys.exit(f"unexpected service field: {body!r}")
if body.get("funasr_import_ok") is not True:
    sys.exit(f"funasr_import_ok is not true: {body!r}")
if body.get("ffmpeg_ok") is not True:
    sys.exit(f"ffmpeg_ok is not true: {body!r}")
if body.get("funasr_ready") is not True:
    sys.exit(f"funasr_ready is not true: {body!r}")
if "funasr_loaded_model_id" not in body:
    sys.exit(f"missing funasr_loaded_model_id: {body!r}")
print("smoke OK:", body.get("transcription_mode"), "ffmpeg_ok=", body.get("ffmpeg_ok"))
"@

  Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -OutFile $rootJson -TimeoutSec 5 | Out-Null
  python - @"
import json
import sys
with open(r"$rootJson", encoding="utf-8") as f:
    body = json.load(f)
if body.get("service") != "rushi-asr":
    sys.exit(f"unexpected root service: {body!r}")
if not body.get("prepare_model_async"):
    sys.exit(f"missing prepare_model_async on root: {body!r}")
print("smoke root OK: catalog endpoints present")
"@
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
