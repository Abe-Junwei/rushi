# Run rushi-asr pytest on Windows using services/asr/.venv (mirrors scripts/run-asr-pytest.sh).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root "scripts\rushi-resolve-git-sha.ps1")
$Asr = Join-Path $Root "services/asr"
Set-Location $Asr

$VenvPy = Join-Path $Asr ".venv/Scripts/python.exe"
if (-not (Test-Path $VenvPy)) {
  Write-Host "Creating services/asr/.venv ..."
  $Py = if ($env:RUSHI_ASR_TEST_PYTHON) { $env:RUSHI_ASR_TEST_PYTHON } else { "python" }
  Invoke-RushiNativeChecked -FailMessage "python -m venv failed" -Command { & $Py -m venv .venv }
  Invoke-RushiNativeChecked -FailMessage "pip upgrade failed" -Command { & $VenvPy -m pip install -U pip }
  Invoke-RushiNativeChecked -FailMessage "pip install asr[dev] failed" -Command { & $VenvPy -m pip install -e ".[dev]" }
}

$PytestArgs = @($args)
Invoke-RushiNativeChecked -FailMessage "pytest failed" -Command { & $VenvPy -m pytest @PytestArgs }
