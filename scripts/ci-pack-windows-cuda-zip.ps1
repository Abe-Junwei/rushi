# Package Windows CUDA sidecar zip for CDN.
# Prefer ASCII intermediate then rename — keeps zip tooling off Unicode -f paths
# (defensive; Compress-Archive is .NET but upload scripts share the same final name).

param(
  [Parameter(Mandatory = $true)][string]$CudaOnedir,
  [Parameter(Mandatory = $true)][string]$FinalZipPath,
  [string]$AsciiZipPath = "",
  [switch]$WriteSha256
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptRoot "rushi-resolve-git-sha.ps1")

function Resolve-FullPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
}

$CudaOnedir = Resolve-FullPath $CudaOnedir
$FinalZipPath = Resolve-FullPath $FinalZipPath
$exe = Join-Path $CudaOnedir "rushi-asr-sidecar-cuda.exe"
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Missing CUDA sidecar: $exe"
}

if ([string]::IsNullOrWhiteSpace($AsciiZipPath)) {
  $AsciiZipPath = Join-Path (Split-Path -Parent $FinalZipPath) "windows-cuda-sidecar-build.zip"
}
$AsciiZipPath = Resolve-FullPath $AsciiZipPath

foreach ($p in @($AsciiZipPath)) {
  foreach ($ch in $p.ToCharArray()) {
    if ([int]$ch -gt 0x7F) {
      throw "Non-ASCII path not allowed for CUDA ascii zip ($p)."
    }
  }
}

$finalParent = Split-Path -Parent $FinalZipPath
if (-not (Test-Path -LiteralPath $finalParent)) {
  New-Item -ItemType Directory -Force -Path $finalParent | Out-Null
}
if (Test-Path -LiteralPath $AsciiZipPath) { Remove-Item -LiteralPath $AsciiZipPath -Force }
if (Test-Path -LiteralPath $FinalZipPath) { Remove-Item -LiteralPath $FinalZipPath -Force }

# Zip root must be rushi-asr-sidecar-cuda/ for exe_relpath in manifest.
# Compress-Archive OOMs on ~4GB CUDA onedir; tar streams like portable packer.
$cudaParent = Split-Path -Parent $CudaOnedir
$cudaLeaf = Split-Path -Leaf $CudaOnedir
if ($cudaLeaf -ne "rushi-asr-sidecar-cuda") {
  throw "CUDA onedir leaf must be rushi-asr-sidecar-cuda (got: $cudaLeaf)"
}
Push-Location -LiteralPath $cudaParent
try {
  $tarCreate = Invoke-RushiNativeSoft -Command {
    & tar -a -c -f $AsciiZipPath $cudaLeaf
  }
  if ($tarCreate.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $AsciiZipPath)) {
    if (Test-Path -LiteralPath $AsciiZipPath) { Remove-Item -LiteralPath $AsciiZipPath -Force }
    Write-Warning "tar -a zip failed; retrying with tar --format zip"
    $tarCreate = Invoke-RushiNativeSoft -Command {
      & tar --format zip -c -f $AsciiZipPath $cudaLeaf
    }
  }
  if ($tarCreate.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $AsciiZipPath)) {
    throw "tar zip failed (ascii=$AsciiZipPath, exit=$($tarCreate.ExitCode))"
  }
} finally {
  Pop-Location
}
if (-not (Test-Path -LiteralPath $AsciiZipPath)) {
  throw "ASCII zip missing after tar: $AsciiZipPath"
}
Move-Item -LiteralPath $AsciiZipPath -Destination $FinalZipPath

if ($WriteSha256) {
  $name = Split-Path -Leaf $FinalZipPath
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $FinalZipPath).Hash.ToLowerInvariant()
  Set-Content -Encoding utf8 -Path "$FinalZipPath.sha256" -Value "$hash  $name"
}

Get-Item -LiteralPath $FinalZipPath | Format-List Name, Length, FullName
Write-Host "OK: CUDA zip $FinalZipPath"
