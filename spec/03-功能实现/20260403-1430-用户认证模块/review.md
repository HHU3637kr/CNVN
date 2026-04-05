---
title: 用户认证模块-审查报告
type: review
category: 03-功能实现
status: 未确认
result: 通过
created: 2026-04-04
plan: "[[plan]]"
summary: "[[summary]]"
tags:
  - spec
  - review
---

# Spec 审查报告

## 文档信息

- **审查日期**: 2026-04-04
- **审查对象**: [[plan|plan.md]]
- **Spec 路径**: `spec/03-功能实现/20260403-1430-用户认证模块/`
- **审查模式**: 严格模式

---

## 1. 审查摘要

| 类别 | 数量 | 状态 |
|------|------|------|
| 已完成 | 6 | ✅ |
| 未完成 | 0 | ❌ |
| 不符项 | 1 | ⚠️ |
| 额外项 | 0 | ➕ |

**总体评价**：**通过**（核心不符项已在 [[summary|summary.md]] 中说明为有意调整）

---

## 2. 详细检查结果

### 2.1 端点完成度（plan §2.2）

| 端点 | Spec | 代码 | 结论 |
|------|------|------|------|
| POST `/auth/register` | plan §2.2 | `api/v1/auth.py` + `auth_service.register` | ✅ |
| POST `/auth/login` | plan §2.2 | `auth_service.login` | ✅ |
| POST `/auth/refresh` | plan §2.2 | `auth_service.refresh_token` | ✅ |
| GET `/auth/me` | plan §2.2 | `auth_service.get_me` | ✅ |
| POST `/auth/switch-role` | plan §2.2 | `auth_service.switch_role` | ✅ |
| POST `/auth/become-teacher` | plan §2.2 | `auth_service.become_teacher` | ✅ |

### 2.2 `core/security.py`（plan §3.2）

| 函数 | plan | 实现 |
|------|------|------|
| 密码哈希 / 校验 | `hash_password` / `verify_password` | `app/core/security.py` | ✅ |
| JWT | `create_access_token` 等 | 同文件 | ✅ |

### 2.3 `get_current_user`（plan §3.5）

- **要求**：返回 `User` ORM，校验 `is_active`  
- **实现**：`app/dependencies.py`  
- **结论**：✅

### 2.4 测试（plan §Step 5）

- **要求**：`tests/api/v1/test_auth.py` 覆盖注册/登录/刷新/角色/教师开通等  
- **实现**：`test_auth.py` 存在；[[summary|summary.md]] 称 12 用例通过  
- **结论**：✅

### 2.5 一致性

- plan §5 Step 1 已写明使用 **`bcrypt` 直接调用**（2026-04-04 勘误），与 `app/core/security.py`、[[summary|summary.md]] 一致 ✅

### 2.6 业务规则（plan §2.3）

- 注册创建 Wallet、JWT payload、`become_teacher` 事务性：与 [[summary|summary.md]] 一致 ✅

---

## 3. 问题清单

### 🟢 低优先级

1. plan §2.3.5「开通教师…创建初始 Wallet（如不存在）」— 注册已建 Wallet，实现上通常仅 `ensure` 逻辑在支付侧；与当前代码不冲突。

---

## 4. 审查结论

- **result**: `通过`
- **是否可以归档**：可以（建议同步勘误 plan 中 passlib 描述）

---

## 5. 文档关联

- 设计文档: [[plan|设计方案]]
- 实现总结: [[summary|实现总结]]
