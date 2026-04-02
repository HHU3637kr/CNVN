# CNVN Backend

面向越南市场的中文学习双边撮合平台 — 后端服务

## 技术栈

- **框架**: FastAPI
- **数据库**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0 (async)
- **迁移**: Alembic
- **认证**: JWT (python-jose)
- **部署**: Docker + Docker Compose

## 快速开始

### 使用 Docker（推荐）

```bash
# 启动所有服务（FastAPI + PostgreSQL）
docker compose up --build

# 后台运行
docker compose up --build -d

# 查看日志
docker compose logs -f api

# 停止
docker compose down
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 本地开发（不使用 Docker）

```bash
# 安装依赖
uv sync

# 启动（需要本地 PostgreSQL）
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── dependencies.py      # 通用依赖
│   ├── models/              # SQLAlchemy ORM 模型
│   ├── schemas/             # Pydantic 请求/响应模型
│   ├── api/v1/              # API 路由
│   └── services/            # 业务逻辑（后续实现）
├── alembic/                 # 数据库迁移
├── tests/                   # 测试
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

## 数据库迁移

```bash
# 生成迁移
docker compose exec api alembic revision --autogenerate -m "描述"

# 执行迁移
docker compose exec api alembic upgrade head

# 回滚
docker compose exec api alembic downgrade -1
```
