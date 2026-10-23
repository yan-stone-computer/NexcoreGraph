# 启核图策 · 桌面安装包构建（Windows PowerShell 5.1）
# 用法：powershell -ExecutionPolicy Bypass -File desktop\build.ps1
# ASCII-only: Windows PowerShell 5.1 按 ANSI 解析 .ps1，中文注释会炸。

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
$webSrc = Join-Path $repo 'web\NexcoreGraph_web'
$webDst = Join-Path $here 'web'

Write-Host '[build] copying web -> desktop\web'
if (-not (Test-Path $webSrc)) { throw "web source not found: $webSrc" }
if (Test-Path $webDst) {
  # 只允许删 desktop\web 这个构建副本，防止路径变量出错删到别处
  $full = (Resolve-Path -LiteralPath $webDst).Path
  if (-not $full.StartsWith((Resolve-Path -LiteralPath $here).Path)) {
    throw "refuse to delete outside desktop: $full"
  }
  Remove-Item -LiteralPath $full -Recurse -Force
}
Copy-Item -LiteralPath $webSrc -Destination $webDst -Recurse

Push-Location $here
try {
  if (-not (Test-Path (Join-Path $here 'node_modules\electron'))) {
    Write-Host '[build] npm install'
    npm install --no-audit --no-fund
  }
  if (-not (Test-Path (Join-Path $here 'node_modules\electron\dist\electron.exe'))) {
    Write-Host '[build] electron binary missing, running install.js'
    node (Join-Path $here 'node_modules\electron\install.js')
  }
  # corporate proxy / MITM CA: let Node use the Windows cert store
  $env:NODE_OPTIONS = '--use-system-ca'
  Write-Host '[build] electron-builder (nsis)'
  npm run dist
} finally {
  Pop-Location
}

$out = Join-Path $here 'dist'
Get-ChildItem $out -Filter '*.exe' | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
