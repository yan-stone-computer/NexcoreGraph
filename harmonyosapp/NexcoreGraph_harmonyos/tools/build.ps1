# NexcoreGraph HarmonyOS build helper (remediation M-13 / defect D11).
# ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 as the ANSI code page.
#
# Usage:
#   powershell -File tools\build.ps1
#   powershell -File tools\build.ps1 -Task clean
#   powershell -File tools\build.ps1 -Release
#   powershell -File tools\build.ps1 -DevEcoHome 'D:\CodeEditor\DevEcoStudio\DevEco Studio'
#
# DevEco Studio 6.x does not ship project-level hvigorw wrapper scripts (the template
# entry is a 0-byte placeholder). Command line builds therefore use the hvigor bundled
# with the IDE; this script locates that install and exports DEVECO_SDK_HOME / NODE_HOME.

param(
  [string]$Task = 'assembleHap',
  [string]$DevEcoHome = '',
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$projRoot = Split-Path -Parent $PSScriptRoot

function Test-DevEcoHome([string]$p) {
  if ([string]::IsNullOrWhiteSpace($p)) { return $false }
  return (Test-Path (Join-Path $p 'sdk')) -and (Test-Path (Join-Path $p 'tools\hvigor\bin\hvigorw.bat'))
}

$candidates = @()
if ($DevEcoHome -ne '') { $candidates += $DevEcoHome }
if ($env:DEVECOSTUDIO_HOME) { $candidates += $env:DEVECOSTUDIO_HOME }
$candidates += @(
  'C:\Program Files\Huawei\DevEco Studio',
  'D:\CodeEditor\DevEcoStudio\DevEco Studio',
  (Join-Path $env:LOCALAPPDATA 'Huawei\DevEco Studio')
)

$ideHome = $candidates | Where-Object { Test-DevEcoHome $_ } | Select-Object -First 1
if (-not $ideHome) {
  Write-Host '[build] DevEco Studio not found.' -ForegroundColor Red
  Write-Host '[build] Pass -DevEcoHome <dir> (must contain sdk\ and tools\hvigor\bin\hvigorw.bat),'
  Write-Host '[build] or open the project in DevEco Studio and press Run.'
  exit 2
}

$env:DEVECO_SDK_HOME = Join-Path $ideHome 'sdk'
$nodeHome = Join-Path $ideHome 'tools\node'
if (Test-Path $nodeHome) { $env:NODE_HOME = $nodeHome }

$hvigorw = Join-Path $ideHome 'tools\hvigor\bin\hvigorw.bat'
Write-Host "[build] DevEco : $ideHome"
Write-Host "[build] SDK     : $env:DEVECO_SDK_HOME"
if ($env:NODE_HOME) { Write-Host "[build] Node    : $env:NODE_HOME" }
Write-Host "[build] task    : $Task"

Push-Location $projRoot
$code = 1
try {
  if ($Task -eq 'assembleHap') {
    $mode = if ($Release) { 'release' } else { 'debug' }
    & $hvigorw assembleHap --mode module -p product=default -p "buildMode=$mode" --no-daemon
  } else {
    & $hvigorw $Task --no-daemon
  }
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

if ($code -eq 0) {
  $hap = Get-ChildItem -Path (Join-Path $projRoot 'entry\build') -Recurse -Filter '*.hap' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($hap) { Write-Host "[build] artifact: $($hap.FullName)" -ForegroundColor Green }
}
exit $code
