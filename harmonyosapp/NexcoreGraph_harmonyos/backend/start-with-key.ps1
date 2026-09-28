# 启核图策 · 带 AI Key 启动本地后端
# 从「多模态助手」技能的本机 .env 读取 Agnes Key 注入环境变量后启动 server.js。
# 说明：Key 只进进程环境，不写入仓库（仓库里任何文件都不含明文 Key，check_release.py 会校验）。
#
# 用法：powershell -ExecutionPolicy Bypass -File backend\start-with-key.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $env:AGNES_API_KEY) {
  $candidates = @(Get-ChildItem "$env:USERPROFILE\.codex\plugins\cache\personal\text-model-multimodal-skill\*\skills\多模态助手\scripts\.env" -ErrorAction SilentlyContinue)
  if ($candidates.Count -eq 0) {
    $candidates = @(Get-ChildItem "$env:USERPROFILE\.agents\skills\*\scripts\.env" -ErrorAction SilentlyContinue)
  }
  if ($candidates.Count -gt 0) {
    $envFile = ($candidates | Sort-Object LastWriteTime -Descending)[0].FullName
    $line = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match '^\s*AGNES_API_KEY\s*=' } | Select-Object -First 1
    if ($line) {
      $env:AGNES_API_KEY = ($line -replace '^\s*AGNES_API_KEY\s*=\s*', '').Trim()
      Write-Host ("[start] 已从 " + $envFile + " 读取 AGNES_API_KEY（" + $env:AGNES_API_KEY.Substring(0, 6) + "****）")
    }
  }
}

if (-not $env:AGNES_API_KEY) {
  Write-Warning '未找到 Agnes Key：AI 网关会返回 503，端侧将回退演示数据。请先在多模态技能里配置 Key，或设置 $env:AGNES_API_KEY。'
}

$node = 'D:\CodeEditor\DevEcoStudio\DevEco Studio\tools\node\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }
& $node server.js
