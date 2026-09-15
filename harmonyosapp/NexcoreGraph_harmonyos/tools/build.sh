#!/usr/bin/env bash
# 启核图策 · 鸿蒙端命令行构建（macOS / Linux / Git Bash；Windows 推荐 tools\build.bat）
# 用法：bash tools/build.sh [assembleHap|clean]
set -euo pipefail

TASK="${1:-assembleHap}"
PROJ="$(cd "$(dirname "$0")/.." && pwd)"

CANDIDATES=(
  "${DEVECOSTUDIO_HOME:-}"
  "/Applications/DevEco-Studio.app/Contents"
  "$HOME/Applications/DevEco-Studio.app/Contents"
  "/opt/DevEco-Studio"
)

HOME_DIR=""
for c in "${CANDIDATES[@]}"; do
  [ -z "$c" ] && continue
  if [ -d "$c/sdk" ] && [ -x "$c/tools/hvigor/bin/hvigorw" ]; then
    HOME_DIR="$c"
    break
  fi
done

if [ -z "$HOME_DIR" ]; then
  echo "[build] 未找到 DevEco Studio，请设置 DEVECOSTUDIO_HOME 指向安装目录（需含 sdk/ 与 tools/hvigor/bin/hvigorw）"
  exit 2
fi

export DEVECO_SDK_HOME="$HOME_DIR/sdk"
[ -d "$HOME_DIR/tools/node" ] && export NODE_HOME="$HOME_DIR/tools/node"

echo "[build] DevEco : $HOME_DIR"
echo "[build] SDK     : $DEVECO_SDK_HOME"
echo "[build] task    : $TASK"

cd "$PROJ"
if [ "$TASK" = "assembleHap" ]; then
  exec "$HOME_DIR/tools/hvigor/bin/hvigorw" assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
fi
exec "$HOME_DIR/tools/hvigor/bin/hvigorw" "$TASK" --no-daemon
