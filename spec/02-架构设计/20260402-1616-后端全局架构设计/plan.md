---
title: CNVN 后端全局架构设计
type: plan
category: 02-架构设计
status: 草稿
priority: 高
created: 2026-04-02
execution_mode: single-agent
tags:
  - spec
  - plan
  - backend
  - architecture
  - FastAPI
  - PostgreSQL
related:
  - "[[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]]"
  - "[[exploration-report|探索报告]]"
---

# CNVN 后端全局架构设计

## 1. 目标与范围

### 1.1 目标

基于已验证的前端原型（Mock 数据），设计并搭建 CNVN 后端服务的**全局架构**，包括：

1. **数据库 Schema**：覆盖 MVP 所有核心实体
2. **API 契约文档**：所有端点的请求/响应规范
3. **项目脚手架**：可运行的 FastAPI 项目骨架

### 1.2 范围

**包含**：
- 数据库表结构设计（PostgreSQL）
- RESTful API 端点清单与契约定义
- FastAPI 项目目录结构与基础配置
- 数据库迁移工具配置（Alembic）
- 认证方案设计（JWT）
- CORS 配置（前后端分离）

**不包含**（后续单独 Spec）：
- 具体业务逻辑实现代码
- 视频通话集成（Agora SDK）
- 支付网关集成（MoMo/ZaloPay）
- 生产环境 CI/CD 配置
- 前端对接改造

### 1.3 前置依赖

- 前端原型已跑通（✅ 已完成）
- 技术栈已确认：FastAPI + PostgreSQL（✅ 已确认）

---

## 2. 技术架构

### 2.1 整体架构

```
┌──────────────────┐         ┌──────────────────────────────┐
│   Frontend       │  HTTP   │        Backend (FastAPI)      │
│   Vite + React   │◄───────►│                              │
│   :5173          │  JSON   │  ┌──────────────────────┐    │
└──────────────────┘         │  │   API Router Layer    │    │
                             │  │  /api/v1/*            │    │
                             │  └──────────┬───────────┘    │
                             │             │                 │
                             │  ┌──────────▼───────────┐    │
                             │  │   Service Layer       │    │
                             │  │  (Business Logic)     │    │
                             │  └──────────┬───────────┘    │
                             │             │                 │
                             │  ┌──────────▼───────────┐    │
                             │  │   Repository Layer    │    │
                             │  │  (SQLAlchemy ORM)     │    │
                             │  └──────────┬───────────┘    │
                             │             │                 │
                             │  ┌──────────▼───────────┐    │
                             │  │   PostgreSQL          │    │
                             │  │   :5432               │    │
                             │  └──────────────────────┘    │
                             │        :8000                  │
                             └──────────────────────────────┘
```

### 2.2 技术栈明细

| 层 | 技术 | 版本 | 用途 |
|---|------|------|------|
| Web 框架 | FastAPI | ≥0.115 | API 服务 |
| ORM | SQLAlchemy | ≥2.0 | 数据库访问（async） |
| 数据库迁移 | Alembic | ≥1.13 | Schema 版本管理 |
| 数据库 | PostgreSQL | ≥16 | 主数据库 |
| 数据库驱动 | asyncpg | ≥0.29 | 异步 PG 驱动 |
| 数据验证 | Pydantic | v2 | 请求/响应模型 |
| 认证 | python-jose + passlib | - | JWT + 密码哈希 |
| 包管理 | uv | ≥0.6 | Python 依赖管理 |
| 测试 | pytest + httpx | - | API 测试 |
| 异步 | uvicorn | ≥0.34 | ASGI 服务器 |
| 容器化 | Docker + Docker Compose | - | 部署与本地开发环境 |

### 2.3 项目目录结构

```
backend/
├── alembic/                    # 数据库迁移
│   ├── versions/               # 迁移脚本
│   ├── env.py
│   └── script.py.mako
├── alembic.ini
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置管理（环境变量）
│   ├── database.py             # 数据库连接与会话管理
│   ├── dependencies.py         # 通用依赖（get_db, get_current_user）
│   ├── models/                 # SQLAlchemy ORM 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── teacher_profile.py
│   │   ├── lesson.py
│   │   ├── review.py
│   │   ├── availability.py
│   │   ├── payment.py
│   │   └── message.py
│   ├── schemas/                # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── teacher.py
│   │   ├── lesson.py
│   │   ├── review.py
│   │   ├── availability.py
│   │   └── payment.py
│   ├── api/                    # API 路由
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py       # 聚合所有 v1 路由
│   │   │   ├── auth.py         # 注册/登录
│   │   │   ├── teachers.py     # 老师搜索/详情
│   │   │   ├── lessons.py      # 预约/课程管理
│   │   │   ├── reviews.py      # 评价
│   │   │   ├── availability.py # 可用时间
│   │   │   ├── payments.py     # 支付/钱包
│   │   │   └── users.py        # 用户信息
│   │   └── deps.py             # API 层依赖
│   └── services/               # 业务逻辑层（后续实现时创建）
│       └── __init__.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── api/
│       └── v1/
├── .env.example                # 环境变量模板
├── pyproject.toml              # 项目配置 + 依赖
├── Dockerfile                  # 后端服务镜像
├── docker-compose.yml          # 编排：FastAPI + PostgreSQL
├── .dockerignore               # Docker 构建忽略文件
└── README.md
```

---

## 3. 数据库 Schema 设计

### 3.1 ER 关系概览

```
User (1) ──── (0..1) TeacherProfile
User (1) ──── (N) Lesson (as student)
TeacherProfile (1) ──── (N) Lesson (as teacher)
TeacherProfile (1) ──── (N) Availability
Lesson (1) ──── (0..1) Review
User (1) ──── (1) Wallet
Wallet (1) ──── (N) Transaction
Lesson (1) ──── (N) Message
```

### 3.2 表结构定义

#### users 表

| 列名              | 类型            | 约束                            | 说明                             |
| --------------- | ------------- | ----------------------------- | ------------------------------ |
| id              | UUID          | PK, default gen               | 用户唯一 ID                        |
| email           | VARCHAR(255)  | UNIQUE, NOT NULL              | 邮箱（登录凭证）                       |
| phone           | VARCHAR(20)   | UNIQUE, NULLABLE              | 手机号（越南/中国）                     |
| hashed_password | VARCHAR(255)  | NOT NULL                      | 密码哈希                           |
| full_name       | VARCHAR(100)  | NOT NULL                      | 显示名                            |
| avatar_url      | TEXT          | NULLABLE                      | 头像 URL                         |
| roles           | VARCHAR(20)[] | NOT NULL, default '{student}' | 角色数组，可包含 'student' / 'teacher' |
| active_role     | VARCHAR(20)   | NOT NULL, default 'student'   | 当前活跃角色（用于前端界面切换）               |
| is_active       | BOOLEAN       | default true                  | 是否激活                           |
| created_at      | TIMESTAMPTZ   | default now()                 | 创建时间                           |
| updated_at      | TIMESTAMPTZ   | auto update                   | 更新时间                           |

#### teacher_profiles 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK→users, UNIQUE | 关联用户 |
| title | VARCHAR(200) | NOT NULL | 一句话标题 |
| about | TEXT | NULLABLE | 详细自我介绍 |
| video_url | TEXT | NULLABLE | 自我介绍视频 URL |
| hourly_rate | INTEGER | NOT NULL | 小时单价 (VND) |
| currency | VARCHAR(3) | default 'VND' | VND / CNY |
| teacher_type | VARCHAR(50) | NOT NULL | 'overseas_student' / 'tour_guide' / 'native_speaker' / 'professional' |
| specialties | TEXT[] | ARRAY | 擅长方向标签 |
| is_verified | BOOLEAN | default false | 是否认证 |
| total_lessons | INTEGER | default 0 | 总完课数（冗余，定期同步） |
| avg_rating | DECIMAL(2,1) | default 0.0 | 平均评分（冗余，定期同步） |
| total_reviews | INTEGER | default 0 | 评价总数（冗余） |
| response_rate | DECIMAL(3,2) | default 0.0 | 响应率 (0-1) |
| is_active | BOOLEAN | default true | 是否接单 |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | auto update | |

**索引**：
- `idx_teacher_profiles_hourly_rate` (hourly_rate)
- `idx_teacher_profiles_avg_rating` (avg_rating DESC)
- `idx_teacher_profiles_teacher_type` (teacher_type)
- GIN index on `specialties` 用于标签搜索

#### availabilities 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| teacher_id | UUID | FK→teacher_profiles | |
| day_of_week | SMALLINT | 0-6, NULLABLE | 周期性：周几 (0=Mon) |
| specific_date | DATE | NULLABLE | 特定日期 |
| start_time | TIME | NOT NULL | 开始时间 |
| end_time | TIME | NOT NULL | 结束时间 |
| is_recurring | BOOLEAN | default true | 周期性 or 一次性 |
| created_at | TIMESTAMPTZ | default now() | |

**约束**：`CHECK (day_of_week IS NOT NULL OR specific_date IS NOT NULL)`

#### lessons 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| student_id | UUID | FK→users | 学生 |
| teacher_id | UUID | FK→teacher_profiles | 老师 |
| scheduled_at | TIMESTAMPTZ | NOT NULL | 课程开始时间 |
| duration_minutes | INTEGER | default 60 | 时长 |
| topic | VARCHAR(200) | NULLABLE | 课程主题 |
| status | VARCHAR(20) | NOT NULL | 见下方状态机 |
| price | INTEGER | NOT NULL | 课程费用 (VND) |
| platform_fee_rate | DECIMAL(3,2) | NOT NULL | 平台抽成比例 |
| cancel_reason | TEXT | NULLABLE | 取消原因 |
| actual_start_at | TIMESTAMPTZ | NULLABLE | 实际开始时间 |
| actual_end_at | TIMESTAMPTZ | NULLABLE | 实际结束时间 |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | auto update | |

**课程状态机**：
```
pending_confirmation → confirmed → in_progress → completed → reviewed
                    → cancelled (from pending/confirmed, 24h rule)
                    → expired (teacher no response within 24h)
```

**索引**：
- `idx_lessons_student_id` (student_id)
- `idx_lessons_teacher_id` (teacher_id)
- `idx_lessons_status` (status)
- `idx_lessons_scheduled_at` (scheduled_at)

#### reviews 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| lesson_id | UUID | FK→lessons, UNIQUE | 一节课一条评价 |
| reviewer_id | UUID | FK→users | 评价者（学生） |
| teacher_id | UUID | FK→teacher_profiles | 被评价的老师 |
| rating_overall | SMALLINT | 1-5, NOT NULL | 总体评分 |
| rating_teaching | SMALLINT | 1-5 | 教学质量 |
| rating_punctuality | SMALLINT | 1-5 | 准时度 |
| rating_communication | SMALLINT | 1-5 | 沟通友好度 |
| content | TEXT | NULLABLE | 评价内容 |
| created_at | TIMESTAMPTZ | default now() | |

**索引**：
- `idx_reviews_teacher_id` (teacher_id)

#### wallets 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK→users, UNIQUE | |
| balance | BIGINT | default 0 | 余额 (VND, 整数避免浮点) |
| updated_at | TIMESTAMPTZ | auto update | |

#### transactions 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| wallet_id | UUID | FK→wallets | |
| lesson_id | UUID | FK→lessons, NULLABLE | 关联课程 |
| type | VARCHAR(20) | NOT NULL | 'topup' / 'payment' / 'earning' / 'refund' / 'platform_fee' |
| amount | BIGINT | NOT NULL | 金额 (正=入, 负=出) |
| description | VARCHAR(255) | NULLABLE | |
| created_at | TIMESTAMPTZ | default now() | |

#### messages 表（课堂聊天）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| lesson_id | UUID | FK→lessons | |
| sender_id | UUID | FK→users | |
| content | TEXT | NOT NULL | |
| message_type | VARCHAR(20) | default 'text' | 'text' / 'system' / 'file' |
| created_at | TIMESTAMPTZ | default now() | |

---

## 4. API 契约设计

### 4.1 通用约定

- **Base URL**: `/api/v1`
- **认证**: Bearer Token (JWT) in `Authorization` header
- **分页**: `?page=1&page_size=20`，响应体包含 `total`, `page`, `page_size`, `items`
- **错误格式**: `{ "detail": "错误描述" }`
- **时间格式**: ISO 8601 (`2026-04-02T20:00:00+07:00`)
- **金额**: 整数 (VND)，前端自行格式化显示

### 4.2 端点清单

#### Auth（认证）

统一登录入口，登录后可在学生/老师角色间切换。注册时默认为学生角色，想成为老师需额外“开通教师身份”。

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 用户注册（默认学生角色） | 无 |
| POST | `/auth/login` | 统一登录，返回 JWT（含 roles + active_role） | 无 |
| POST | `/auth/refresh` | 刷新 Token | Bearer |
| GET | `/auth/me` | 获取当前用户信息（根据 active_role 返回不同数据） | Bearer |
| POST | `/auth/switch-role` | 切换当前活跃角色（student↔teacher） | Bearer |
| POST | `/auth/become-teacher` | 开通教师身份（提交教学档案初始信息） | Bearer |

#### Teachers（老师）

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| GET | `/teachers` | 搜索/筛选老师列表 | 无 |
| GET | `/teachers/{id}` | 老师详情 | 无 |
| POST | `/teachers/profile` | 创建教师档案 | Bearer |
| PUT | `/teachers/profile` | 更新教师档案 | Bearer |
| GET | `/teachers/{id}/reviews` | 老师的评价列表 | 无 |
| GET | `/teachers/{id}/availability` | 老师的可用时间 | 无 |

**`GET /teachers` 查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| q | string | 关键词搜索（名字、标签、描述） |
| teacher_type | string | 老师类型筛选 |
| specialties | string[] | 擅长方向（多选） |
| min_price | int | 最低价格 |
| max_price | int | 最高价格 |
| min_rating | float | 最低评分 |
| sort_by | string | 'recommended' / 'rating' / 'price_asc' / 'price_desc' |
| page | int | 页码 |
| page_size | int | 每页数量 |

#### Availability（可用时间）

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| GET | `/availability` | 获取自己的可用时间 | Bearer(teacher) |
| POST | `/availability` | 添加可用时间段 | Bearer(teacher) |
| PUT | `/availability/{id}` | 修改可用时间段 | Bearer(teacher) |
| DELETE | `/availability/{id}` | 删除可用时间段 | Bearer(teacher) |

#### Lessons（课程/预约）

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/lessons` | 学生预约课程 | Bearer(student) |
| GET | `/lessons` | 获取我的课程列表 | Bearer |
| GET | `/lessons/{id}` | 课程详情 | Bearer |
| PATCH | `/lessons/{id}/confirm` | 老师确认课程 | Bearer(teacher) |
| PATCH | `/lessons/{id}/cancel` | 取消课程 | Bearer |
| PATCH | `/lessons/{id}/start` | 开始上课 | Bearer |
| PATCH | `/lessons/{id}/end` | 结束课程 | Bearer |

**`GET /lessons` 查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态筛选 |
| role | string | 'student' / 'teacher'（以哪个身份查看） |
| upcoming | bool | 只看即将开始的 |

#### Reviews（评价）

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/reviews` | 提交评价 | Bearer(student) |
| GET | `/reviews/{id}` | 评价详情 | 无 |

#### Payments（支付/钱包）

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| GET | `/wallet` | 获取钱包余额 | Bearer |
| GET | `/wallet/transactions` | 交易流水 | Bearer |
| POST | `/wallet/topup` | 充值（MVP: 模拟） | Bearer |

#### Users（用户）

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| GET | `/users/me` | 获取个人资料 | Bearer |
| PUT | `/users/me` | 更新个人资料 | Bearer |

---

## 5. 认证方案

### 5.1 JWT 方案

```
注册/登录 → 返回 { access_token, refresh_token, token_type }
    ↓
access_token: 有效期 30 分钟，携带 user_id + role
refresh_token: 有效期 7 天，用于换新 access_token
    ↓
前端请求时: Authorization: Bearer {access_token}
```

### 5.2 密码存储

- 使用 `passlib[bcrypt]` 进行密码哈希
- 最小密码长度: 8 字符

### 5.3 角色权限

采用**单账号多角色**模式，用户可在学生和老师身份之间自由切换（类似抖音的“创作者/浏览者”切换）。

**角色获取流程**：
1. 新用户注册 → 默认获得 `student` 角色
2. 学生用户想成为老师 → 调用 `/auth/become-teacher` 提交教学档案 → 获得 `teacher` 角色
3. 拥有双角色的用户 → 通过 `/auth/switch-role` 切换当前活跃角色

| 角色 | 说明 |
|------|------|
| student | 可预约课程、评价、管理钱包 |
| teacher | 可管理档案、可用时间、确认课程、查看收入 |

> **设计原则**：
> - 前端学生端和老师端是独立的界面，但共用同一登录入口
> - 登录后根据 `active_role` 跳转到对应的 Dashboard
> - 后端通过 JWT 中的 `active_role` claim 做接口权限隔离
> - 钱包是账号级别的，不区分角色（学生身份消费、老师身份收入，共用同一钱包）

---

## 6. 实现步骤

> 以下步骤为本次 Spec 的实现范围（脚手架 + Schema，不含业务逻辑）。

### Step 1: 项目初始化

1. 在项目根目录创建 `backend/` 目录
2. 使用 `uv` 初始化 Python 项目，创建 `pyproject.toml`
3. 安装核心依赖：fastapi, uvicorn, sqlalchemy, asyncpg, alembic, pydantic, python-jose, passlib, httpx, pytest
4. 创建 `.env.example` 文件

### Step 2: FastAPI 应用骨架

1. 创建 `app/main.py`：FastAPI 实例 + CORS 配置 + 路由挂载
2. 创建 `app/config.py`：Pydantic Settings 读取环境变量
3. 创建 `app/database.py`：AsyncSession + engine 配置
4. 创建 `app/dependencies.py`：`get_db`, `get_current_user` 依赖

### Step 3: ORM 模型

按 Section 3.2 的表结构，创建所有 SQLAlchemy ORM 模型文件：
- `models/user.py`
- `models/teacher_profile.py`
- `models/availability.py`
- `models/lesson.py`
- `models/review.py`
- `models/payment.py` (wallet + transaction)
- `models/message.py`

### Step 4: Pydantic Schema

按 Section 4.2 的 API 契约，创建所有请求/响应模型：
- `schemas/user.py`
- `schemas/teacher.py`
- `schemas/lesson.py`
- `schemas/review.py`
- `schemas/availability.py`
- `schemas/payment.py`

### Step 5: API 路由骨架

创建所有 API 路由文件，每个端点暂时返回 mock 响应或 `501 Not Implemented`：
- `api/v1/auth.py`
- `api/v1/teachers.py`
- `api/v1/lessons.py`
- `api/v1/reviews.py`
- `api/v1/availability.py`
- `api/v1/payments.py`
- `api/v1/users.py`
- `api/v1/router.py`（聚合路由）

### Step 6: Alembic 迁移

1. 初始化 Alembic
2. 配置 `alembic/env.py` 使用 async engine
3. 生成初始迁移脚本（所有表）
4. **不执行迁移**（需要实际 PostgreSQL 实例时再执行）

### Step 7: Docker 配置

1. 创建 `Dockerfile`（多阶段构建，基于 python:3.12-slim）
2. 创建 `docker-compose.yml`（编排 FastAPI + PostgreSQL）
3. 创建 `.dockerignore`
4. PostgreSQL 数据卷挂载到 D 盘（不占 C 盘空间）

**docker-compose.yml 服务编排**：

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| api | 自建 (Dockerfile) | 8000:8000 | FastAPI 后端 |
| db | postgres:16-alpine | 5432:5432 | PostgreSQL 数据库 |

**卷挂载**：
- `pgdata` volume → PostgreSQL 数据持久化
- `./app` → `/app/app`（开发模式热重载）

### Step 8: 验证

1. 确保 `docker compose up` 能正常启动所有服务
2. 确认 `http://localhost:8000/docs`（Swagger UI）展示所有端点
3. 确认 PostgreSQL 可连接
4. 确认项目结构符合 Section 2.3

---

## 7. 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| AC-1 | `backend/` 目录结构符合 Section 2.3 | 目测检查 |
| AC-2 | 所有 ORM 模型覆盖 Section 3.2 的表结构 | 代码审查 |
| AC-3 | 所有 Pydantic Schema 覆盖 Section 4.2 的 API 契约 | 代码审查 |
| AC-4 | 所有 API 端点在 Swagger UI 可见 | 启动服务后访问 /docs |
| AC-5 | `pyproject.toml` 包含所有必要依赖 | `uv sync` 成功 |
| AC-6 | Alembic 迁移脚本存在且可生成 | `alembic check` |
| AC-7 | 服务可通过 `docker compose up` 正常启动 | 运行验证 |
| AC-8 | CORS 配置允许前端 :5173 访问 | 配置审查 |
| AC-9 | Dockerfile 和 docker-compose.yml 存在且可构建 | `docker compose build` |
| AC-10 | PostgreSQL 容器可连接，数据持久化 | 连接测试 |

---

## 8. 风险与注意事项

| 风险 | 影响 | 缓解 |
|------|------|------|
| PostgreSQL 未安装 | 无法执行迁移 | 通过 Docker Compose 自动拉起 PG 容器，无需本地安装 |
| Python 版本不兼容 | 依赖安装失败 | 要求 Python ≥ 3.11 |
| C 盘空间限制 | 用户规则禁止占用 C 盘 | uv 缓存和虚拟环境均放在 `backend/` 目录下（D盘） |

---

## 文档关联

- PRD: [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|产品需求文档]]
- 探索报告: [[exploration-report|探索报告]]
- 实现总结: [[summary|实现总结]] (待创建)
- 测试计划: [[test-plan|测试计划]] (待创建)
