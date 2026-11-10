#!/usr/bin/env bash
# ============================================
#  启核图策 · Web 端 一键启动（macOS / Linux / WSL）
#  用法：./start.sh [端口]   默认端口 8090
# ============================================
set -euo pipefail
cd "$(dirname "$0")"

# 本脚本就放在 Web 工程目录内，直接用自身所在目录（旧版硬编码成 webapp/ 会找不到 index.html）
APP="$(pwd)"
PORT="${1:-8090}"

open_browser() {
  case "$(uname -s)" in
    Darwin*) open "$1" ;;
    *) command -v xdg-open >/dev/null 2>&1 && xdg-open "$1" >/dev/null 2>&1 || true ;;
  esac
}

if [ ! -f "$APP/index.html" ]; then
  echo "[错误] 未找到 $APP/index.html，请把 start.sh 与 index.html 放在同一目录。" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[错误] 未找到 Python 3，请先安装：https://www.python.org/downloads/" >&2
  exit 1
fi

# 端口已被占用 → 说明服务已在运行，直接打开浏览器
if command -v lsof >/dev/null 2>&1 && lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "[提示] 端口 $PORT 已在运行，直接打开浏览器。"
  open_browser "http://127.0.0.1:$PORT/"
  exit 0
fi

echo "[启动] 静态服务 http://127.0.0.1:$PORT/  （Ctrl+C 停止）"
(cd "$APP" && exec "$PY" -m http.server "$PORT" --bind 127.0.0.1) &
SERVER_PID=$!

# 等待端口就绪（最多 8 秒）
for _ in $(seq 1 8); do
  if command -v curl >/dev/null 2>&1 && curl -sf "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

open_browser "http://127.0.0.1:$PORT/"
echo "服务已启动（PID $SERVER_PID），浏览器已打开 http://127.0.0.1:$PORT/"
wait "$SERVER_PID"
