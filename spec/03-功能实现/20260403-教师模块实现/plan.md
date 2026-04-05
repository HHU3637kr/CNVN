---
title: 教师模块实现
type: plan
category: 03-功能实现
status: 已完成
priority: 高
created: 2026-04-03
execution_mode: single-agent
tags:
  - spec
  - plan
  - backend
  - teacher
  - service-layer
related:
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
  - "[[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]]"
---

# 教师模块实现

## 1. 概述

### 1.1 背景

后端全局架构已完成脚手架搭建（ORM 模型、Pydantic Schema、路由骨架、数据库迁移），所有教师模块端点返回 `501 Not Implemented`。本 Spec 负责实现教师模块的完整业务逻辑。

### 1.2 目标

实现教师模块 6 个端点的真实业务逻辑，连接 PostgreSQL 数据库，遵循现有分层架构（Router → Service → ORM）。

### 1.3 范围

**包含**：
- `services/teacher_service.py` — 教师业务逻辑层
- `services/availability_service.py` — 可用时间业务逻辑层
- 路由层替换：将 `501 Not Implemented` 替换为真实 Service 调用
- 搜索/筛选的多条件动态查询
- 分页响应封装

**不包含**：
- 认证逻辑（已在 auth_service 中实现）
- 评价创建逻辑（属于评价模块）
- 预约/课程逻辑（属于预约模块）

---

## 2. 需求分析

### 2.1 端点清单

| # | 方法 | 端点 | 说明 | 认证 |
|---|------|------|------|------|
| 1 | GET | `/teachers` | 搜索/筛选老师列表 | 无 |
| 2 | GET | `/teachers/{id}` | 老师详情 | 无 |
| 3 | POST | `/teachers/profile` | 创建教师档案 | Bearer |
| 4 | PUT | `/teachers/profile` | 更新教师档案 | Bearer(teacher) |
| 5 | GET | `/teachers/{id}/reviews` | 老师的评价列表 | 无 |
| 6 | GET | `/teachers/{id}/availability` | 老师的可用时间 | 无 |

### 2.2 搜索筛选需求（端点 1）

`GET /teachers` 查询参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| q | string | 关键词搜索（title、about、specialties） |
| teacher_type | string | 老师类型筛选 |
| specialties | string[] | 擅长方向（多选） |
| min_price | int | 最低价格 |
| max_price | int | 最高价格 |
| min_rating | float | 最低评分 |
| sort_by | string | 'recommended' / 'rating' / 'price_asc' / 'price_desc' |
| page | int | 页码 |
| page_size | int | 每页数量 |

**排序规则**：
- `recommended`（默认）：综合排名 = avg_rating × 0.5 + (total_lessons / max_lessons) × 0.3 + response_rate × 0.2
- `rating`：avg_rating DESC
- `price_asc`：hourly_rate ASC
- `price_desc`：hourly_rate DESC

**筛选条件**：
- 仅返回 `is_active = true` 的教师
- 各筛选条件之间为 AND 关系
- specialties 使用 PostgreSQL ARRAY 的 `@>` 包含操作符

### 2.3 数据关联需求

- `TeacherListItem` 需要关联 `User.full_name` 和 `User.avatar_url`
- `GET /teachers/{id}/reviews` 需要返回评价者姓名（`reviewer_name`）
- `GET /teachers/{id}/availability` 直接返回 Availability 列表

---

## 3. 设计方案

### 3.1 分层架构

```
Router Layer (api/v1/teachers.py)
    ↓ 调用
Service Layer (services/teacher_service.py, services/availability_service.py)
    ↓ 使用
ORM Layer (models/teacher_profile.py, models/availability.py, models/user.py, models/review.py)
    ↓
PostgreSQL
```

**遵循现有模式**：参考 `auth_service.py` 的设计，Service 层函数接收 `AsyncSession` 和参数，返回 Pydantic Schema 对象或抛出 `ValueError`。

### 3.2 Service 层设计

#### `services/teacher_service.py`

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `search_teachers` | db, 各筛选参数 | `(list[TeacherListItem], int)` | 动态构建查询，返回 (items, total) |
| `get_teacher_profile` | db, teacher_id | `TeacherProfileOut` | 根据 ID 获取教师档案 |
| `create_teacher_profile` | db, user_id, data | `TeacherProfileOut` | 创建档案 + 追加 teacher 角色 |
| `update_teacher_profile` | db, user_id, data | `TeacherProfileOut` | 更新档案（仅本人） |

#### `services/availability_service.py`

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_teacher_availability` | db, teacher_id | `list[AvailabilityOut]` | 获取指定教师的可用时间 |

### 3.3 搜索查询实现策略

使用 SQLAlchemy 2.0 的 `select()` 动态构建查询：

```python
# 基础查询：关联 User 表获取 name 和 avatar
stmt = select(TeacherProfile, User.full_name, User.avatar_url)\
    .join(User, TeacherProfile.user_id == User.id)\
    .where(TeacherProfile.is_active == True)

# 动态添加 WHERE 条件
if q:
    stmt = stmt.where(
        or_(
            TeacherProfile.title.ilike(f"%{q}%"),
            TeacherProfile.about.ilike(f"%{q}%"),
        )
    )
if teacher_type:
    stmt = stmt.where(TeacherProfile.teacher_type == teacher_type)
if specialties:
    stmt = stmt.where(TeacherProfile.specialties.op("@>")(specialties))
if min_price is not None:
    stmt = stmt.where(TeacherProfile.hourly_rate >= min_price)
if max_price is not None:
    stmt = stmt.where(TeacherProfile.hourly_rate <= max_price)
if min_rating is not None:
    stmt = stmt.where(TeacherProfile.avg_rating >= min_rating)

# 排序
if sort_by == "recommended":
    stmt = stmt.order_by(
        (TeacherProfile.avg_rating * 0.5 +
         TeacherProfile.response_rate * 0.2).desc()
    )
elif sort_by == "rating":
    stmt = stmt.order_by(TeacherProfile.avg_rating.desc())
# ...

# 分页
count_stmt = select(func.count()).select_from(stmt.subquery())
total = (await db.execute(count_stmt)).scalar()
stmt = stmt.offset((page - 1) * page_size).limit(page_size)
```

> **注意**：PostgreSQL ARRAY 的 `@>` 操作符在 SQLAlchemy 中需要使用 `.op("@>")` 方法。`ilike` 用于模糊搜索（不区分大小写）。

### 3.4 权限控制

| 端点 | 权限逻辑 |
|------|----------|
| `POST /teachers/profile` | 任何登录用户（检查是否已有档案，防止重复创建） |
| `PUT /teachers/profile` | 仅教师角色，且只能修改自己的档案 |
| 其他 | 公开访问 |

### 3.5 异常处理

| 场景 | HTTP 状态码 | 错误信息 |
|------|------------|---------|
| 教师档案不存在 | 404 | "教师档案不存在" |
| 重复创建档案 | 400 | "您已拥有教师档案" |
| 无权修改他人档案 | 403 | "无权修改此档案" |
| 更新字段不合法 | 422 | Pydantic 自动验证 |

---

## 4. 执行模式

**模式**：single-agent

**理由**：本模块为单一功能模块的实现，涉及 2 个 Service 文件 + 1 个路由文件的修改，逻辑清晰、边界明确，适合单 Agent 逐步实现。

---

## 5. 实现步骤

### Step 1: 创建 `services/__init__.py` 导出

确保 `services/` 目录的 `__init__.py` 正确导出新模块。

### Step 2: 实现 `services/teacher_service.py`

实现以下函数：

1. **`search_teachers`** — 多条件动态查询
   - JOIN User 表获取 full_name 和 avatar_url
   - 动态构建 WHERE 条件（q, teacher_type, specialties, min/max_price, min_rating）
   - 仅返回 is_active=true 的教师
   - 支持 4 种排序方式
   - 分页 + 返回 (items, total) 元组

2. **`get_teacher_profile`** — 根据 ID 获取
   - JOIN User 表
   - 档案不存在时 raise ValueError

3. **`create_teacher_profile`** — 创建教师档案
   - 检查是否已有档案（user_id 唯一约束）
   - 创建 TeacherProfile
   - 如果用户还没有 teacher 角色，追加到 roles
   - 返回 TeacherProfileOut

4. **`update_teacher_profile`** — 更新教师档案
   - 查询档案，校验 ownership（user_id 匹配）
   - 仅更新非 None 字段（PATCH 语义）
   - 返回 TeacherProfileOut

### Step 3: 实现 `services/availability_service.py`

实现以下函数：

1. **`get_teacher_availability`** — 获取教师可用时间
   - 按 teacher_id 查询所有 Availability 记录
   - 返回 list[AvailabilityOut]

### Step 4: 更新 `api/v1/teachers.py` 路由

将 6 个端点从 `501 Not Implemented` 替换为真实 Service 调用：

1. `search_teachers` — 调用 `teacher_service.search_teachers`，组装 PaginatedResponse
2. `get_teacher` — 调用 `teacher_service.get_teacher_profile`
3. `create_teacher_profile` — 调用 `teacher_service.create_teacher_profile`
4. `update_teacher_profile` — 调用 `teacher_service.update_teacher_profile`
5. `get_teacher_reviews` — 直接查询 Review 表（简单查询，暂不抽到 Service）
6. `get_teacher_availability` — 调用 `availability_service.get_teacher_availability`

### Step 5: 验证

1. 确保 `uv run pytest` 能通过（如有测试）
2. 确保服务可启动：`uv run uvicorn app.main:app`
3. 确认 Swagger UI 端点正常响应

---

## 6. 风险和依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| PostgreSQL ARRAY 查询语法 | specialties 筛选可能不工作 | 使用 `.op("@>")` 操作符，参考 SQLAlchemy 文档 |
| 综合排名排序性能 | 复杂表达式可能影响查询性能 | MVP 阶段数据量小，后续可加物化视图 |
| `create_teacher_profile` 与 `auth/become-teacher` 功能重叠 | 两个端点都创建教师档案 | `create_teacher_profile` 作为独立教师管理入口，`become-teacher` 作为注册流程入口，两者逻辑保持一致 |

**依赖**：
- PostgreSQL 容器运行中
- 数据库迁移已执行（全局架构 Spec 已完成）
- auth_service 已实现（已完成）

---

## 7. 文档关联

- 后端架构: [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
- PRD: [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|产品需求文档]]
- ORM 模型: `backend/app/models/teacher_profile.py`
- Schema: `backend/app/schemas/teacher.py`
- 路由: `backend/app/api/v1/teachers.py`
