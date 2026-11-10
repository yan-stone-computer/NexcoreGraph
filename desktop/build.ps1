# 启核图策 · 桌面安装包构建（Windows PowerShell 5.1）
# 用法：powershell -ExecutionPolicy Bypass -File desktop\build.ps1
# ASCII-only: Windows PowerShell 5.1 按 ANSI 解析 .ps1，中文注释会炸。

$ErrorActionPreference = 'Stop'
$desktopRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$repo = Split-Path -Parent $desktopRoot
$webSrc = Join-Path $repo 'web\NexcoreGraph_web'
$webDst = Join-Path $desktopRoot 'web'
$webFull = [System.IO.Path]::GetFullPath($webDst)

Write-Host '[build] copying web -> desktop\web'
Write-Host "[build] target: $webFull"
if (-not (Test-Path $webSrc)) { throw "web source not found: $webSrc" }
if (Test-Path $webDst) {
  # 只允许删 desktop\web 这个构建副本，防止路径变量出错删到别处
  $desktopPrefix = $desktopRoot.TrimEnd('\') + '\'
  if (-not $webFull.StartsWith($desktopPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "refuse to delete outside desktop: $webFull"
  }
  Remove-Item -LiteralPath $webFull -Recurse -Force
}
robocopy $webSrc $webDst /E /XD node_modules /XF .env /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw "web copy failed: $LASTEXITCODE" }
if (Test-Path (Join-Path $webDst '.env')) { throw 'refuse to package .env' }

Push-Location $desktopRoot
try {
  if (-not (Test-Path (Join-Path $desktopRoot 'node_modules\electron'))) {
    Write-Host '[build] npm install'
    npm install --no-audit --no-fund
  }
  if (-not (Test-Path (Join-Path $desktopRoot 'node_modules\electron\dist\electron.exe'))) {
    Write-Host '[build] electron binary missing, running install.js'
    node (Join-Path $desktopRoot 'node_modules\electron\install.js')
  }
  # corporate proxy / MITM CA: let Node use the Windows cert store
  $env:NODE_OPTIONS = '--use-system-ca'
  Write-Host '[build] electron-builder (nsis)'
  npm run dist
} finally {
  Pop-Location
}

$out = Join-Path $desktopRoot 'dist'
Get-ChildItem $out -Filter '*.exe' | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
