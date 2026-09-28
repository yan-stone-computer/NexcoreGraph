# NexcoreGraph backend launcher WITH AI key.
# Reads AGNES_API_KEY from the local multimodal skill .env and injects it into the
# process environment, then starts server.js. The key is never written into the repo
# (tools/check_release.py verifies no plaintext key is committed).
#
# Usage:  powershell -ExecutionPolicy Bypass -File backend\start-with-key.ps1
# Note: ASCII-only on purpose -- Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $env:AGNES_API_KEY) {
  $patterns = @(
    "$env:USERPROFILE\.codex\plugins\cache\personal\text-model-multimodal-skill\*\skills\*\scripts\.env",
    "$env:USERPROFILE\.codex\skills\*\scripts\.env"
  )
  $candidates = @()
  foreach ($p in $patterns) {
    $candidates += @(Get-ChildItem $p -ErrorAction SilentlyContinue)
  }
  if ($candidates.Count -gt 0) {
    $envFile = ($candidates | Sort-Object LastWriteTime -Descending)[0].FullName
    $line = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match '^\s*AGNES_API_KEY\s*=' } | Select-Object -First 1
    if ($line) {
      $env:AGNES_API_KEY = ($line -replace '^\s*AGNES_API_KEY\s*=\s*', '').Trim()
      Write-Host ("[start] AGNES_API_KEY loaded from " + $envFile + " (" + $env:AGNES_API_KEY.Substring(0, 6) + "****)")
    }
  }
}

if (-not $env:AGNES_API_KEY) {
  Write-Warning 'No Agnes key found: the AI gateway will answer 503 and the app falls back to demo data. Configure the key in the multimodal skill, or set $env:AGNES_API_KEY.'
}

$node = 'D:\CodeEditor\DevEcoStudio\DevEco Studio\tools\node\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }
& $node server.js
