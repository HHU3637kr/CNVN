#!/bin/sh
# Render 部署启动脚本：运行数据库迁移 → 启动 API 服务
# Render 提供的 DATABASE_URL 格式为 postgresql://...
# asyncpg 需要 postgresql+asyncpg://... 格式，在 Python 配置中处理

set -e

echo "Running Alembic migrations..."
uv run alembic upgrade head

echo "Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
