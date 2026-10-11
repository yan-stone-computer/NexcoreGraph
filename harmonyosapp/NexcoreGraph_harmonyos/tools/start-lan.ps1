# 启核图策 · 局域网自建服务器一键启动
#
# 作用：在你自己的电脑上启动后端（3000）与流转中转（3100），打印手机/平板该填的局域网地址，
#      并提示防火墙放行命令。数据只在局域网内流转，不经过公网，不需要域名与备案。
#
# 用法（普通权限即可）：powershell -ExecutionPolicy Bypass -File tools\start-lan.ps1
# 放行防火墙需要管理员权限，脚本会把命令打印出来，你自己开一个管理员 PowerShell 执行。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'

Write-Host '=== 启核图策 · 局域网自建服务器 ===' -ForegroundColor Green
Write-Host '部署形态：局域网自建（非云端、无域名、无需备案）'
Write-Host ''

# 找局域网 IPv4（排除 127.0.0.1 与虚拟网卡）
$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' })
if ($ips.Count -eq 0) {
  Write-Host '! 没找到局域网地址：确认电脑已连 WiFi/网线。' -ForegroundColor Yellow
} else {
  Write-Host '手机 / 平板要填的服务器地址（同一 WiFi 下）：' -ForegroundColor Cyan
  foreach ($a in $ips) {
    Write-Host ('   http://' + $a.IPAddress + ':3000    [' + $a.InterfaceAlias + ']')
  }
  Write-Host ''
}

Write-Host '如果手机连不上，先放行防火墙（管理员 PowerShell 执行一次）：' -ForegroundColor Cyan
Write-Host '   New-NetFirewallRule -DisplayName "NexcoreGraph LAN 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow'
Write-Host '   New-NetFirewallRule -DisplayName "NexcoreGraph LAN 3100" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow'
Write-Host ''

# 1) 后端（带 AI Key，从多模态技能 .env 读）
Write-Host '[1/2] 启动后端 :3000 …' -ForegroundColor Green
Start-Process -FilePath 'powershell' -WindowStyle Hidden `
  -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $backend 'start-with-key.ps1') `
  -WorkingDirectory $backend
Start-Sleep -Seconds 4

# 2) 流转中转（跨设备活同步用）
Write-Host '[2/2] 启动流转中转 :3100 …' -ForegroundColor Green
Start-Process -FilePath 'node' -WindowStyle Hidden -ArgumentList 'flow-bridge.js' -WorkingDirectory $backend
Start-Sleep -Seconds 2

$ok3000 = Test-NetConnection -ComputerName 127.0.0.1 -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
$ok3100 = Test-NetConnection -ComputerName 127.0.0.1 -Port 3100 -InformationLevel Quiet -WarningAction SilentlyContinue
Write-Host ''
Write-Host ('后端 3000: ' + $(if ($ok3000) { '已就绪' } else { '未就绪（看 backend 窗口日志）' }) +
  '   流转中转 3100: ' + $(if ($ok3100) { '已就绪' } else { '未就绪' }))
Write-Host 'App 端：登录页会显示"已连接 http://192.168.x.x:3000（局域网自建服务器）"；' +
  '地址填错可在「我的 → 服务器连接」里改，不用重新打包。'
Write-Host '停服：Get-Process node | Where-Object { $_.Path -like "*node*" } 里结束对应进程，或直接关掉对应窗口。'
