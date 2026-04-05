---
id: KNOW-001
title: CNVN 后端预约与教师模块要点
type: 项目理解
keywords: [CNVN, FastAPI, 预约, 教师, 钱包, 可用时段, JWT]
created: 2026-04-03
---

# CNVN 后端预约与教师模块要点

## 概述

中越通（CNVN）后端在全局架构脚手架之上，已实现 **认证**、**教师（搜索/档案/公开评价与时段）**、**可用时段 CRUD**、**钱包（模拟充值/流水）**、**课程预约（状态机、24h 取消、惰性过期）** 等能力；技术栈为 FastAPI + SQLAlchemy 2 async + PostgreSQL。

## 详细内容

### 核心架构

- **分层**：`api/v1/*` → `services/*` → `models/*`；部分只读列表在路由内联查询（如教师评价列表）。
- **认证**：JWT；`get_current_user` 对 `User` 使用 `selectinload(teacher_profile)`，避免异步会话下懒加载报错。
- **配置**：`PLATFORM_FEE_RATE`、`DEFAULT_TIMEZONE`（默认 `Asia/Ho_Chi_Minh`）用于预约计价与时段校验。

### 数据流（预约）

1. 学生 `POST /lessons`：校验教师活跃、未来时间、**availabilities 覆盖**、**与已有课冲突**、余额充足 → 扣款 → `pending_confirmation`。
2. 教师确认 / 双方取消（≥24h）/ 开始 / 结束：按状态机流转；超时未确认可惰性标 `expired` 并退款。
3. 钱包：`payment` / `refund` / `topup` 记 `transactions`。

### 数据流（教师）

- `GET /teachers`：多条件 + 仅 `is_active`；`recommended` 加权排序。
- `GET /teachers/{id}`、`/{id}/availability`、`/{id}/reviews`：公开读；详情与列表均需教师存在且活跃（404）。
- `POST /teachers/profile` 与 `POST /auth/become-teacher` 均创建档案，需统一「已有档案则拒绝」语义。

### 关键模块与文件

| 模块 | 主要路径 |
|------|----------|
| 认证 | `app/services/auth_service.py`, `app/api/v1/auth.py` |
| 教师 | `app/services/teacher_service.py`, `app/api/v1/teachers.py` |
| 时段 | `app/services/availability_service.py`, `app/api/v1/availability.py` |
| 钱包 | `app/services/wallet_service.py`, `app/api/v1/payments.py` |
| 课程 | `app/services/lesson_service.py`, `app/api/v1/lessons.py` |

## 相关文件

- `backend/app/main.py`
- `spec/03-功能实现/20260403-1700-预约模块/summary.md`
- `spec/03-功能实现/20260403-教师模块实现/summary.md`

## 参考

- [[../../02-架构设计/20260402-1616-后端全局架构设计/summary|后端全局架构总结]]
