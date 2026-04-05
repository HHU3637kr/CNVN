---
title: 用户认证模块实现 - 实现总结
type: summary
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - backend
  - auth
  - JWT
  - 认证
related:
  - "[[plan|设计方案]]"
---

# 实现总结：用户认证模块

## 完成状态：✅ 全部完成

## 产出清单

### 新增文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `app/core/__init__.py` | 0 | 核心工具包初始化 |
| `app/core/security.py` | 59 | 密码哈希（bcrypt）+ JWT 签发/验证 |
| `app/services/auth_service.py` | 155 | 认证业务逻辑（6 个方法） |
| `tests/api/v1/test_auth.py` | 210 | 认证 API 测试（12 个用例） |

### 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| `app/dependencies.py` | 重写 | `get_current_user` 从返回 dict 升级为从 DB 查询 User ORM 对象 |
| `app/api/v1/auth.py` | 重写 | 6 个端点从 501 占位改为调用 auth_service |
| `tests/conftest.py` | 重写 | 搭建异步测试数据库 fixture |
| `pyproject.toml` | 修改 | passlib → bcrypt，添加 pytest 配置 |

### API 端点实现

| 端点 | 状态 | 说明 |
|------|------|------|
| `POST /auth/register` | ✅ | 注册 + 自动创建 Wallet |
| `POST /auth/login` | ✅ | 邮箱密码验证 + JWT 签发 |
| `POST /auth/refresh` | ✅ | refresh_token 验证 + 新 token 对签发 |
| `GET /auth/me` | ✅ | 返回当前用户信息 |
| `POST /auth/switch-role` | ✅ | 校验角色归属后切换 active_role |
| `POST /auth/become-teacher` | ✅ | 创建 TeacherProfile + 追加 teacher 角色 |

## 测试结果

> [!success] 12 个测试用例全部通过
> 覆盖：注册成功/重复、登录成功/密码错误/用户不存在、Token 刷新成功/无效、获取用户、角色切换成功/未拥有、开通教师成功/重复

## 验收结果

| # | 标准 | 结果 |
|---|------|------|
| AC-1 | 注册功能可用，自动创建 Wallet | ✅ |
| AC-2 | 登录功能可用，返回 JWT | ✅ |
| AC-3 | Token 刷新功能可用 | ✅ |
| AC-4 | get_current_user 返回 ORM 对象 | ✅ |
| AC-5 | 角色切换逻辑正确 | ✅ |
| AC-6 | become-teacher 创建 TeacherProfile | ✅ |
| AC-7 | 12 个测试用例全部通过 | ✅ |

## 遇到的问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| passlib 与 bcrypt 5.x 不兼容 | passlib 1.7.4 无法识别新版 bcrypt 的 `__about__` 属性 | 弃用 passlib，直接使用 `bcrypt` 库调用 `hashpw`/`checkpw` |
| 测试 event loop 冲突 | asyncpg 连接与 pytest 的 event loop 不匹配 | conftest.py 使用 `scope="session"` 的 `event_loop` fixture |
| 测试数据冲突 | 多个测试共用同一邮箱/手机号 | 使用 `uuid.uuid4().hex[:8]` 生成唯一标识 |
| 测试间数据持久化 | 数据库在测试间不清理 | 每个测试使用独立 engine + session，测试后 rollback + dispose |

## 设计决策记录

1. **bcrypt 直接调用**：弃用 passlib，直接使用 `bcrypt` 库，避免版本兼容问题
2. **注册自动创建 Wallet**：保证每个用户都有钱包，后续支付模块无需额外判断
3. **become-teacher 同一事务**：User.roles 更新 + TeacherProfile 创建在同一事务，保证原子性
4. **refresh_token 无黑名单**：MVP 阶段可接受，后续迭代引入 token 黑名单或 Redis

## 文档关联

- 设计文档: [[plan|设计方案]]
- 架构设计: [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
- PRD: [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|产品需求文档]]
