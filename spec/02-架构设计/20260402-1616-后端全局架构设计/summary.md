---
title: 后端全局架构设计 - 实现总结
type: summary
category: 02-架构设计
status: 已完成
created: 2026-04-02
tags:
  - backend
  - architecture
  - FastAPI
  - PostgreSQL
  - Docker
related:
  - "[[plan|架构设计 Spec]]"
  - "[[test-plan|测试计划]]"
  - "[[exploration-report|探索报告]]"
---

# 实现总结：后端全局架构设计

## 完成状态：✅ 全部完成

## 产出清单

### Spec 文档
| 文档 | 状态 |
|------|------|
| exploration-report.md | ✅ 已完成 |
| plan.md | ✅ 已完成 |
| test-plan.md | ✅ 已完成 |
| summary.md | ✅ 本文档 |

### 代码产出（`backend/` 目录）

| 类别 | 文件数 | 说明 |
|------|--------|------|
| 项目配置 | 5 | pyproject.toml, .env.example, README.md, alembic.ini, .dockerignore |
| FastAPI 骨架 | 4 | main.py, config.py, database.py, dependencies.py |
| ORM 模型 | 8 | user, teacher_profile, availability, lesson, review, payment(wallet+transaction), message + __init__ |
| Pydantic Schema | 8 | user, teacher, lesson, review, availability, payment, common + __init__ |
| API 路由 | 10 | auth, teachers, lessons, reviews, availability, payments, users, router + 2 __init__ |
| Alembic | 3 | env.py, script.py.mako, initial_schema migration |
| Docker | 2 | Dockerfile, docker-compose.yml |
| Tests | 4 | conftest.py + 3 __init__ |
| **合计** | **44** | |

### API 端点统计

| 分组 | 端点数 | 方法 |
|------|--------|------|
| Auth | 6 | register, login, refresh, me, switch-role, become-teacher |
| Teachers | 6 | search, detail, create/update profile, reviews, availability |
| Lessons | 7 | create, list, detail, confirm, cancel, start, end |
| Reviews | 2 | create, detail |
| Availability | 4 | list, create, update, delete |
| Wallet | 3 | balance, transactions, topup |
| Users | 2 | get/update profile |
| Health | 1 | health check |
| **合计** | **31** | |

### 数据库 Schema

8 张表已通过 Alembic 迁移创建到 PostgreSQL：
users, teacher_profiles, availabilities, lessons, reviews, wallets, transactions, messages

## 验收结果

| AC | 标准 | 结果 |
|----|------|------|
| AC-1 | 目录结构符合 plan.md Section 2.3 | ✅ 43 文件全部就位 |
| AC-2 | ORM 模型覆盖 Section 3.2 | ✅ 8 表 77 列 |
| AC-3 | Pydantic Schema 覆盖 Section 4.2 | ✅ |
| AC-4 | Swagger UI 可见所有端点 | ✅ 31 端点 |
| AC-5 | pyproject.toml 依赖完整 | ✅ 40 packages installed |
| AC-6 | Alembic 迁移脚本可用 | ✅ initial_schema 已生成并执行 |
| AC-7 | docker compose up 正常启动 | ✅ |
| AC-8 | CORS 配置允许 :5173 | ✅ |
| AC-9 | Dockerfile 可构建 | ✅ |
| AC-10 | PostgreSQL 容器可连接 | ✅ PG 16.13 |

## 实现过程中的修正

| 问题 | 原因 | 修复 |
|------|------|------|
| Docker build 失败：README.md not found | .dockerignore 排除了 *.md | 添加 `!README.md` 例外 |
| uv run 失败：Unable to determine wheel files | hatchling 找不到 cnvn_backend 包目录 | pyproject.toml 添加 `[tool.hatch.build.targets.wheel] packages = ["app"]` |

## 设计决策记录

1. **单账号多角色**：用户注册后默认为学生，可通过 `/auth/become-teacher` 开通教师身份，通过 `/auth/switch-role` 切换活跃角色
2. **UUID 主键**：避免自增 ID 暴露业务量
3. **金额用 BIGINT**：VND 整数存储，避免浮点精度问题
4. **冗余统计字段**：teacher_profiles 中的 avg_rating、total_lessons 等定期同步
5. **Docker 部署**：开发环境 docker-compose 编排 FastAPI + PostgreSQL

## 后续工作

按 PRD 路线图，建议按以下顺序开 Spec 实现业务逻辑：

1. **用户认证模块**：注册/登录/JWT 实际逻辑
2. **教师模块**：教师搜索/筛选/档案管理
3. **预约模块**：课程预约/状态流转/取消规则
4. **支付模块**：钱包/充值/课程结算/抽成计算
5. **评价模块**：评分/排名算法
6. **实时通信**：Agora SDK 集成 + 课堂聊天
7. **前端对接**：替换 Mock 数据为真实 API 调用
