#!/bin/bash
# 启动待办事项服务

cd "$(dirname "$0")"

# 检查是否已运行
if lsof -Pi :8890 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️ 服务已在运行 (端口 8890)"
    exit 0
fi

# 启动服务
node server.js &
echo "✅ 待办事项服务已启动: http://localhost:8890"
