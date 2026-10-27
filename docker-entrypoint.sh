#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

# 外挂目录常由宿主机 root 创建，先修正属主再降权运行
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$DATA_DIR" 2>/dev/null || \
    echo "[entrypoint] 警告：无法修改 $DATA_DIR 属主，请确认挂载目录可写" >&2
  exec su-exec nextjs:nodejs "$@"
fi

exec "$@"
