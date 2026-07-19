# Post-build smoke: bundled sidecar starts and /health reports bundled FunASR + ffmpeg.
param(
  [string]$Exe = "$PSScriptRoot/../apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar.exe"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "rushi-resolve-git-sha.ps1")
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

try {
  $inUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if ($inUse) {
    throw "smoke: port $Port already in use"
  }
} catch {
  # Service accounts may lack Get-NetTCPConnection; bind failure still fails via /health timeout.
  if ("$($_.Exception.Message)" -match 'already in use') { throw }
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

  $py = @(
    $env:RUSHI_HOST_PYTHON,
    "E:\Python312\python.exe",
    (Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $py) { throw "smoke: Python 3.12 not found (set RUSHI_HOST_PYTHON or install E:\Python312)" }

  Invoke-RushiNativeChecked -FailMessage "smoke: health json assertions failed" -Command {
    & $py - @"
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
  }

  Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -OutFile $rootJson -TimeoutSec 5 | Out-Null
  Invoke-RushiNativeChecked -FailMessage "smoke: root json assertions failed" -Command {
    & $py - @"
import json
import sys
with open(r"$rootJson", encoding="utf-8") as f:
    body = json.load(f)
if body.get("service") != "rushi-asr":
    sys.exit(f"unexpected root service: {body!r}")
if not body.get("prepare_model_async"):
    sys.exit(f"missing prepare_model_async on root: {body!r}")
warmup_model = str(body.get("warmup_model", ""))
if "warmup" not in warmup_model:
    sys.exit(f"missing warmup_model on root: {body!r}")
print("smoke root OK: catalog + warmup endpoints present")
"@
  }

  $warmupJson = Join-Path $env:TEMP "rushi-sidecar-smoke-warmup.json"
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$Port/v1/models/warmup" -Method POST -UseBasicParsing -OutFile $warmupJson -TimeoutSec 30 | Out-Null
    $warmupCode = 200
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 503) {
      $warmupCode = 503
    } elseif ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
      Get-Content $log, $logErr -Tail 30 -ErrorAction SilentlyContinue
      if (Test-Path $warmupJson) { Get-Content $warmupJson -ErrorAction SilentlyContinue }
      throw "smoke: POST /v1/models/warmup returned 404 — rebuild sidecar from current services/asr (stale PyInstaller bundle)"
    } else {
      throw $_
    }
  }
  if ($warmupCode -ne 200 -and $warmupCode -ne 503) {
    throw "smoke: unexpected warmup HTTP $warmupCode"
  }
  Write-Host "smoke warmup OK: HTTP $warmupCode"
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
