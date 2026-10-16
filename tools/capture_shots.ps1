# Stable screenshot capture: tap one step at a time, verify the page with a signature
# string from dumpLayout, snapshot only when matched, retry up to 3 times.
#
# ASCII-only on purpose: Windows PowerShell 5.1 parses BOM-less .ps1 as ANSI, so Chinese
# literals here would break parsing (same root cause as commit 7e53dbb). All Chinese
# signatures live in capture_targets.json and are read back as UTF-8.
#
# Usage: powershell -ExecutionPolicy Bypass -File tools/capture_shots.ps1 -Dev 127.0.0.1:5555 -Kind phone
#
# Gotcha (verified 2026-10-16): `uitest uiInput click` only reaches the app's own window.
# The system photo picker runs in its own window (hostWindowId != app window), so taps on it
# are swallowed -- use `hdc shell uinput -T -c <x> <y>` for those, and `uitest dumpLayout -i`
# (nodes carry hostWindowId) to find the real coordinates.
param(
  [Parameter(Mandatory = $true)][string]$Dev,
  [Parameter(Mandatory = $true)][ValidateSet('phone', 'tablet')][string]$Kind
)
$ErrorActionPreference = 'Continue'
$hdc = 'D:\CodeEditor\DevEcoStudio\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$img = Join-Path $root 'docs\images'
$tmp = Join-Path $env:TEMP 'nxg-shots'
New-Item -ItemType Directory -Force -Path $img, $tmp | Out-Null

function Dump([string]$name) {
  & $hdc -t $Dev shell "uitest dumpLayout -p /data/local/tmp/$name.json" | Out-Null
  & $hdc -t $Dev file recv "/data/local/tmp/$name.json" "$tmp\$name.json" 2>&1 | Out-Null
}
function Has([string]$name, [string]$sig) {
  if (-not (Test-Path "$tmp\$name.json")) { return $false }
  return ((Select-String -Path "$tmp\$name.json" -Pattern $sig -Encoding UTF8 | Measure-Object).Count -gt 0)
}
function Tap([int]$x, [int]$y, [int]$wait = 6) {
  & $hdc -t $Dev shell "uitest uiInput click $x $y" | Out-Null
  Start-Sleep -Seconds $wait
}
function Snap([string]$name) {
  & $hdc -t $Dev shell "snapshot_display -f /data/local/tmp/$name.jpeg" | Out-Null
  & $hdc -t $Dev file recv "/data/local/tmp/$name.jpeg" "$img\$name.jpeg" 2>&1 | Out-Null
}

$cfg = (Get-Content -Path (Join-Path $PSScriptRoot 'capture_targets.json') -Encoding UTF8 -Raw) | ConvertFrom-Json
$targets = $cfg.$Kind

foreach ($t in $targets) {
  $ok = $false
  for ($i = 1; $i -le 3 -and -not $ok; $i++) {
    Tap $t.x $t.y
    Dump "chk"
    if (Has 'chk' $t.sig) {
      $ok = $true
      Snap $t.name
      Write-Host ("PASS  {0}  (tap #{1} matched)" -f $t.name, $i)
    } else {
      Write-Host ("retry {0}  (tap #{1} no match)" -f $t.name, $i)
    }
  }
  if (-not $ok) { Write-Host ("FAIL  {0}" -f $t.name) }
}
Dump "final-$Kind"
Write-Host ("done -> " + $img)
