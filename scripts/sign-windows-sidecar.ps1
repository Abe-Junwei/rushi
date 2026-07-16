# Authenticode-sign bundled ASR sidecar: top-level exes + full onedir (*.dll, *.pyd, *.exe).
# Aligns with docs/architecture/asr-sidecar-funasr-policy.md §4 (exe + onedir DLLs).
#
# Requires: Windows, signtool.exe (Windows SDK), PFX + password in env (never commit secrets).
#
# Example (adjust paths):
#   $env:SIGNTOOL = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
#   $env:SIGN_PFX   = "D:\certs\publisher.pfx"
#   $env:SIGN_PASS  = "********"
#   powershell -File scripts/sign-windows-sidecar.ps1
#
# Without SIGNTOOL + SIGN_PFX: prints guidance and exits 0 (local dev) or 1 (release tag build).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleaseBuild = $env:RELEASE_BUILD -eq "1"

if (-not $env:SIGNTOOL -or -not $env:SIGN_PFX) {
  if ($ReleaseBuild) {
    Write-Error "Release build requires SIGNTOOL and SIGN_PFX for Authenticode signing."
    exit 1
  }
  Write-Host "Skip signing: set SIGNTOOL (path to signtool.exe) and SIGN_PFX (path to .pfx)."
  Write-Host "See docs/execution/windows-release-checklist.md"
  exit 0
}

if ($ReleaseBuild -and [string]::IsNullOrWhiteSpace($env:SIGN_PASS)) {
  Write-Error "Release build requires SIGN_PASS (WINDOWS_SIGN_PFX_PASSWORD) when signing is enabled."
  exit 1
}

function Invoke-SignFile {
  param([Parameter(Mandatory)][string] $FilePath)
  Write-Host "Signing $FilePath"
  & $env:SIGNTOOL sign /fd SHA256 /f $env:SIGN_PFX /p $env:SIGN_PASS /tr http://timestamp.digicert.com /td SHA256 $FilePath
}

$SidecarDirs = @(
  (Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar"),
  (Join-Path $Root "apps\desktop\src-tauri\resources\bundled-asr\rushi-asr-sidecar-cuda")
)

foreach ($dir in $SidecarDirs) {
  if (-not (Test-Path -LiteralPath $dir)) {
    Write-Host "Skip (missing): $dir"
    continue
  }
  # Native deps first, then all exes (incl. ffmpeg/ffprobe and PyInstaller bootloader).
  # Avoid -Include on -Recurse (PS 5.x requires a wildcarded -Path for -Include to apply).
  $natives = Get-ChildItem -LiteralPath $dir -Recurse -File |
    Where-Object { $_.Extension.ToLowerInvariant() -in ".dll", ".pyd" } |
    Sort-Object FullName
  foreach ($f in $natives) {
    Invoke-SignFile $f.FullName
  }
  $exes = Get-ChildItem -LiteralPath $dir -Recurse -File -Filter *.exe | Sort-Object FullName
  foreach ($f in $exes) {
    Invoke-SignFile $f.FullName
  }
}

Write-Host "Done (recursive under both sidecar roots)."
