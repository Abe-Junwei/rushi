# Run rushi-asr pytest on Windows using services/asr/.venv (mirrors scripts/run-asr-pytest.sh).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Asr = Join-Path $Root "services/asr"
Set-Location $Asr

$VenvPy = Join-Path $Asr ".venv/Scripts/python.exe"
if (-not (Test-Path $VenvPy)) {
  Write-Host "Creating services/asr/.venv ..."
  $Py = if ($env:RUSHI_ASR_TEST_PYTHON) { $env:RUSHI_ASR_TEST_PYTHON } else { "python" }
  & $Py -m venv .venv
  & $VenvPy -m pip install -U pip
  & $VenvPy -m pip install -e ".[dev]"
}

& $VenvPy -m pytest @($args)
