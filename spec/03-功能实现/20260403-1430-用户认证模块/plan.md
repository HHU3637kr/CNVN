---
title: 用户认证模块实现
type: plan
category: 03-功能实现
status: 未确认
priority: 高
created: 2026-04-03
execution_mode: single-agent
tags:
  - spec
  - plan
  - 认证
  - JWT
  - auth
related:
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
  - "[[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]]"
---

# 用户认证模块实现

## 1. 概述

### 1.1 背景

后端全局架构已完成脚手架搭建（[[../../02-架构设计/20260402-1616-后端全局架构设计/summary|架构设计总结]]），6 个 Auth 端点已注册但均返回 `501 Not Implemented`。本 Spec 将实现用户认证的完整业务逻辑，是所有后续模块（教师、预约、支付等）的前置依赖。

### 1.2 目标

1. 实现注册/登录/JWT 签发的完整链路
2. 实现 Token 刷新机制
3. 实现角色切换（student ↔ teacher）和教师身份开通
4. 升级 `get_current_user` 依赖，从返回 dict 改为返回 ORM User 对象

### 1.3 范围

**包含**：
- 密码哈希工具（passlib/bcrypt）
- JWT access_token + refresh_token 签发与验证
- 6 个 Auth 端点的业务逻辑实现
- 注册时自动创建 Wallet
- `get_current_user` 依赖升级
- 单元测试

**不包含**：
- 手机号 OTP 登录（MVP 用邮箱密码即可）
- 第三方 OAuth 登录（微信/Google）
- 密码重置/忘记密码功能（后续迭代）
- 邮箱验证流程（后续迭代）

---

## 2. 需求分析

### 2.1 功能需求映射

| PRD 需求 | 本 Spec 覆盖 |
|----------|-------------|
| FR-001: 老师须通过手机号或邮箱注册 | 注册支持邮箱 + 可选手机号 |
| FR-001: 老师自主设置小时单价 | become-teacher 时提交 hourly_rate |
| 架构设计 5.3: 单账号多角色 | switch-role + become-teacher |
| 架构设计 5.1: JWT 方案 | access_token 30min + refresh_token 7d |

### 2.2 端点清单（6 个）

| # | 端点 | 当前状态 | 本 Spec 任务 |
|---|------|---------|-------------|
| 1 | `POST /auth/register` | 501 | 实现注册 + 创建 Wallet |
| 2 | `POST /auth/login` | 501 | 实现登录 + 签发 JWT |
| 3 | `POST /auth/refresh` | 501 | 实现 Token 刷新 |
| 4 | `GET /auth/me` | 501 | 实现获取当前用户 |
| 5 | `POST /auth/switch-role` | 501 | 实现角色切换 |
| 6 | `POST /auth/become-teacher` | 501 | 实现开通教师身份 |

### 2.3 业务规则

1. **注册**：邮箱唯一，密码 ≥ 8 字符，注册后自动创建 Wallet（balance=0）
2. **登录**：验证邮箱+密码，签发 JWT（payload 含 `sub=user_id`, `roles`, `active_role`）
3. **Token 刷新**：验证 refresh_token 有效性，签发新 token 对
4. **角色切换**：只能切换到自己已拥有的角色（roles 数组内）
5. **开通教师身份**：创建 TeacherProfile + 将 `teacher` 加入 roles + 创建初始 Wallet（如不存在）

---

## 3. 设计方案

### 3.1 新增文件

```
backend/app/
├── core/                       # 新建目录：核心工具
│   ├── __init__.py
│   └── security.py             # 密码哈希 + JWT 工具函数
├── services/                   # 已存在，新增文件
│   ├── __init__.py
│   └── auth_service.py         # 认证业务逻辑
└── tests/                      # 测试
    └── api/
        └── v1/
            └── test_auth.py    # 认证 API 测试
```

### 3.2 core/security.py — 安全工具

```python
# 密码哈希
hash_password(password: str) -> str
verify_password(plain: str, hashed: str) -> bool

# JWT
create_access_token(user_id: UUID, roles: list, active_role: str) -> str
create_refresh_token(user_id: UUID) -> str
decode_token(token: str) -> dict | None
```

**JWT Payload 设计**：

| Token | Payload 字段 | 有效期 |
|-------|-------------|--------|
| access_token | `sub`（user_id）, `roles`, `active_role`, `exp`, `type=access` | 30 分钟 |
| refresh_token | `sub`（user_id）, `exp`, `type=refresh` | 7 天 |

### 3.3 services/auth_service.py — 业务逻辑

| 方法 | 功能 | 关键逻辑 |
|------|------|---------|
| `register` | 用户注册 | 检查邮箱唯一 → 哈希密码 → 创建 User → 创建 Wallet |
| `login` | 用户登录 | 查询用户 → 验证密码 → 签发 token 对 |
| `refresh_token` | 刷新令牌 | 解码 refresh_token → 查询用户 → 签发新 token 对 |
| `get_me` | 获取用户信息 | 根据 user_id 查询 User ORM → 返回 UserOut |
| `switch_role` | 切换角色 | 校验目标角色在 roles 内 → 更新 active_role |
| `become_teacher` | 开通教师 | 创建 TeacherProfile → 追加 teacher 到 roles → 更新 active_role |

### 3.4 现有文件修改

| 文件 | 修改内容 |
|------|---------|
| `app/dependencies.py` | `get_current_user` 从返回 dict 改为返回 User ORM 对象（从 DB 查询） |
| `app/api/v1/auth.py` | 注入 service，调用业务逻辑替代 501 |
| `app/models/payment.py` | 确认 Wallet 模型已就绪（无需修改） |

### 3.5 get_current_user 升级方案

**当前**：解码 JWT 后返回 `{"user_id": ..., "roles": ..., "active_role": ...}` dict

**升级后**：
1. 解码 JWT 获取 `sub`（user_id）
2. 从数据库查询 User ORM 对象
3. 校验 `is_active` 状态
4. 返回 User 对象（下游依赖可 `.roles`, `.active_role` 等属性直接访问）

> [!important] 下游影响
> `get_current_teacher` 和 `get_current_student` 依赖 `get_current_user`，升级后无需额外改动（dict 访问改为属性访问，逻辑不变）。

---

## 4. 执行模式

**推荐模式**：单 Agent

**选择理由**：
- 单模块实现，文件变更范围小（新增 2 文件 + 修改 2 文件）
- 无并行开发需求
- 认证逻辑线性，无复杂分支

---

## 5. 实现步骤

### Step 1: 创建 core/security.py

1. 新建 `app/core/__init__.py` 和 `app/core/security.py`
2. 实现密码哈希：直接使用 **`bcrypt`** 库（`hashpw` / `checkpw`），与项目 `CLAUDE.md` 一致；**不**使用 passlib（与旧版 bcrypt 存在兼容性问题时弃用）。
3. 实现 JWT 创建与解码（`python-jose`）
4. 从 `app/config.py` 的 settings 读取密钥和过期时间

### Step 2: 创建 services/auth_service.py

1. 新建 `app/services/auth_service.py`
2. 实现 `register`：邮箱去重 → 密码哈希 → 创建 User + Wallet（同一事务）
3. 实现 `login`：查用户 → 验密码 → 签 token
4. 实现 `refresh_token`：解码 → 查用户 → 签新 token
5. 实现 `get_me`：查用户 → 返回
6. 实现 `switch_role`：校验 → 更新 active_role
7. 实现 `become_teacher`：创建 TeacherProfile → 更新 roles

### Step 3: 升级 dependencies.py

1. `get_current_user` 改为从 DB 查询 User ORM 对象
2. 增加 `is_active` 校验（非活跃用户返回 403）
3. 更新 `get_current_teacher` / `get_current_student` 适配属性访问

### Step 4: 实现 auth.py 路由

1. 注入 `AsyncSession` 数据库会话
2. 每个端点调用对应 service 方法
3. 移除所有 `raise HTTPException(status_code=501)`

### Step 5: 编写测试

1. 创建 `tests/api/v1/test_auth.py`
2. 测试用例覆盖：
   - 注册成功 / 邮箱重复
   - 登录成功 / 密码错误 / 用户不存在
   - Token 刷新成功 / 无效 token
   - 获取当前用户
   - 角色切换成功 / 切换到未拥有的角色
   - 开通教师身份成功 / 重复开通

---

## 6. 风险和依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| bcrypt 编译依赖在 Windows 上可能失败 | 注册/登录不可用 | 使用 `bcrypt` 纯 Python 回退或预编译 wheel |
| refresh_token 无黑名单机制 | 已注销 token 仍可刷新 | MVP 阶段可接受，后续引入 token 黑名单 |
| become-teacher 事务跨 User + TeacherProfile 两张表 | 部分写入不一致 | 使用同一个 AsyncSession 事务保证原子性 |

---

## 文档关联

- 架构设计 Spec: [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
- PRD: [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|产品需求文档]]
- 实现总结: [[summary|实现总结]] (待创建)
- 测试计划: [[test-plan|测试计划]] (待创建，由 spec-tester 创建)
