---
title: 后端全局架构设计 - 测试计划
type: test-plan
category: 02-架构设计
created: 2026-04-02
tags:
  - test
  - backend
  - architecture
related:
  - "[[plan|架构设计 Spec]]"
---

# 测试计划：后端全局架构设计

## 测试范围

本次测试针对**架构脚手架**，不涉及业务逻辑验证。

## 测试项

### T-1: 项目结构验证

| # | 检查项 | 验证方法 |
|---|--------|---------|
| T-1.1 | `backend/` 目录存在且结构符合 plan.md Section 2.3 | `find` 命令列出目录树 |
| T-1.2 | 所有 `__init__.py` 文件存在 | 文件检查 |
| T-1.3 | `pyproject.toml` 存在且包含所有依赖 | 读取文件 |
| T-1.4 | `.env.example` 存在且包含必要变量 | 读取文件 |

### T-2: 依赖安装验证

| # | 检查项 | 验证方法 |
|---|--------|---------|
| T-2.1 | `uv sync` 成功完成 | 运行命令 |
| T-2.2 | 虚拟环境创建在 D 盘（不占用 C 盘） | 检查 `.venv` 路径 |

### T-3: Docker 与应用启动验证

| # | 检查项 | 验证方法 |
|---|--------|--------|
| T-3.1 | `Dockerfile` 存在且可构建 | `docker compose build` |
| T-3.2 | `docker-compose.yml` 包含 api + db 服务 | 文件检查 |
| T-3.3 | `.dockerignore` 存在 | 文件检查 |
| T-3.4 | `docker compose up` 能正常启动所有服务 | 运行命令 |
| T-3.5 | `http://localhost:8000/docs` (Swagger UI) 可访问 | HTTP GET |
| T-3.6 | `/api/v1` 前缀下所有端点可见 | 检查 Swagger UI |
| T-3.7 | PostgreSQL 容器可连接 | `docker compose exec db psql` |

### T-4: ORM 模型验证

| # | 检查项 | 验证方法 |
|---|--------|---------|
| T-4.1 | 所有 7 个模型文件存在 (user, teacher_profile, availability, lesson, review, payment, message) | 文件检查 |
| T-4.2 | 模型字段覆盖 plan.md Section 3.2 所有列 | 代码审查 |
| T-4.3 | 外键关系正确定义 | 代码审查 |
| T-4.4 | 索引按 plan.md 定义 | 代码审查 |

### T-5: Pydantic Schema 验证

| # | 检查项 | 验证方法 |
|---|--------|---------|
| T-5.1 | 所有 6 个 schema 文件存在 | 文件检查 |
| T-5.2 | 请求/响应模型覆盖 plan.md Section 4.2 所有端点 | 代码审查 |
| T-5.3 | 分页响应模型存在 (total, page, page_size, items) | 代码审查 |

### T-6: API 路由验证

| # | 检查项 | 验证方法 |
|---|--------|---------|
| T-6.1 | 所有 7 个路由文件存在 | 文件检查 |
| T-6.2 | 端点数量与 plan.md Section 4.2 一致 | Swagger UI 计数 |
| T-6.3 | CORS 配置允许 localhost:5173 | 检查 main.py |

### T-7: Alembic 配置验证

| # | 检查项 | 验证方法 |
|---|--------|---------|
| T-7.1 | `alembic.ini` 存在 | 文件检查 |
| T-7.2 | `alembic/env.py` 配置了 async engine | 代码审查 |
| T-7.3 | 初始迁移脚本已生成 | 检查 `alembic/versions/` 目录 |

## 不测试项

- 业务逻辑正确性（后续模块 Spec 覆盖）
- 前端对接（后续 Spec 覆盖）
- 生产环境部署流程
