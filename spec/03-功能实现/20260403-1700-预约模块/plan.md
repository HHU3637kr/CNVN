---
title: 预约模块实现
type: plan
category: 03-功能实现
status: 已完成
priority: 高
created: 2026-04-03
execution_mode: single-agent
tags:
  - spec
  - plan
  - lessons
  - availability
  - wallet
related:
  - "[[exploration-report|探索报告]]"
  - "[[test-plan|测试计划]]"
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 预约模块实现

## 1. 概述

### 1.1 背景

全局架构已定义 `lessons` 表与课程状态机，但 `lessons` / `availability` / `wallet` 相关路由均为 `501`。用户确认：**预约必须校验教师可授课时段（`availabilities`）**，且 **创建预约时从学生钱包扣款**、取消/超时按规则 **退款**。

### 1.2 目标

1. 实现教师 **可用时段 CRUD**（`/availability`），供预约校验使用。
2. 实现 **钱包最小能力**（查余额、流水、MVP 模拟充值），供预约扣款与测试。
3. 实现 **课程预约全流程**（`/lessons`）：创建、列表、详情、确认、取消、开始、结束，并落实状态机与 24h 规则。

### 1.3 范围

**包含**：

- `app/services/wallet_service.py`：`FOR UPDATE` 扣款/退款、`Transaction` 记录
- `app/services/availability_service.py`：CRUD + `scheduled_at`+`duration` 与时段匹配（越南时区）
- `app/services/lesson_service.py`：建课、冲突检测、惰性 `expired`、状态流转
- `app/config.py`：`PLATFORM_FEE_RATE`、`DEFAULT_TIMEZONE`（默认 `Asia/Ho_Chi_Minh`）
- 更新 `api/v1/payments.py`、`availability.py`、`lessons.py`
- `schemas/availability.py`：创建时校验 `day_of_week` 或 `specific_date` 与 `is_recurring` 一致

**不包含**（后续支付/评价模块）：

- 教师侧 **课时费结算**（`completed` 后给教师打款）
- 评价写入后 `reviewed` 状态联动（评价模块）
- 独立定时任务扫描过期（MVP 用列表/详情惰性处理）

---

## 2. 需求分析

### 2.1 计价

- `price = ceil(hourly_rate * duration_minutes / 60)`，单位 VND 整数。
- `platform_fee_rate` 使用配置 `Decimal`，写入 `lessons.platform_fee_rate`（业务展示/后续分账用）。

### 2.2 时段校验

- 将 `scheduled_at`（UTC）转为 `DEFAULT_TIMEZONE` 本地时间。
- 要求整节课 **不跨自然日**（开始与结束本地日期相同）。
- 匹配规则：
  - **周期性**：`is_recurring=True` 且 `day_of_week` 等于本地开始日期的 Python `weekday()`（周一=0…周日=6）
  - **一次性**：`specific_date` 等于本地开始日期
- 时间包含关系：`availability.start_time <= lesson_local_start.time()` 且 `availability.end_time >= lesson_local_end.time()`。

### 2.3 冲突

- 同一教师或同一学生：若存在课程状态 **非** `cancelled` / `expired`，且时间区间 `[scheduled_at, scheduled_at+duration)` 与已有课重叠，则拒绝创建。

### 2.4 钱包

- 建课前：`balance >= price`，否则 `400`。
- 同事务：`INSERT lesson` + 扣款 + `Transaction(type=payment, amount=-price, lesson_id=...)`。
- **取消**（允许状态 `pending_confirmation` 或 `confirmed`）：**始终允许取消**（学生或教师）。距 `scheduled_at` **≥24 小时**：全额退款并写 `Transaction(type=refund, amount=+price)`；**不足 24 小时**：**不退款**（规则由 [[../20260403-支付模块实现/plan|支付模块 Spec]] 统一，与 MVP 产品一致）。
- **expired**：`pending_confirmation` 且 `created_at + 24h < now()`，在列表/详情前批量惰性更新为 `expired` 并 **全额退款**。

### 2.5 状态流转

| 动作 | 前置状态 | 角色 | 后置状态 |
|------|----------|------|----------|
| 创建 | — | 学生 | `pending_confirmation` |
| 确认 | `pending_confirmation` | 教师（该课教师） | `confirmed` |
| 取消 | `pending_confirmation` / `confirmed` | 学生或教师 | `cancelled`（满 24h 退款；不足 24h 不退款） |
| 开始 | `confirmed` | 学生或教师（参与者） | `in_progress` |
| 结束 | `in_progress` | 学生或教师 | `completed` |

---

## 3. 设计方案

### 3.1 模块划分

- `wallet_service`：被 `lesson_service` 与 `payments` 路由调用。
- `availability_service`：被 `availability` 路由与 `lesson_service.validate_slot` 调用。
- `lesson_service`：唯一编排预约业务与状态机。

### 3.2 API 行为对齐

- `GET /lessons`：`role=student|teacher`，`upcoming` 过滤未来课；分页 `PaginatedResponse`。
- `LessonListItem`：`teacher_name` / `student_name` 通过 `User.full_name` 填充。

---

## 4. 执行模式

`execution_mode: single-agent`：由单一代码路径实现，无多 Agent 分工。

---

## 5. 实现步骤

1. 扩展 `config` 与 `datetime` 工具（时区、区间重叠）。
2. 实现 `wallet_service` 与 `payments` 路由。
3. 增强 `AvailabilityCreate` 校验并实现 `availability_service` 与路由。
4. 实现 `lesson_service` 与 `lessons` 路由；`lessons` 依赖注入 `User` + `AsyncSession`。
5. 新增 `tests/api/v1/test_lessons.py`（含充值、时段、冲突、状态机）。

---

## 6. 风险与依赖

- **依赖**：用户认证模块已可用（JWT、`become-teacher`）。
- **风险**：惰性过期在并发下列表可能重复处理——MVP 接受；后续可加唯一约束或后台任务。

---

## 7. 文档关联

- [[exploration-report|探索报告]]
- [[test-plan|测试计划]]
