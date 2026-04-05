---
title: 预约模块 - 实现总结
type: summary
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - backend
  - lessons
  - availability
  - wallet
related:
  - "[[plan|实现计划]]"
  - "[[test-plan|测试计划]]"
  - "[[test-report|测试报告]]"
  - "[[exploration-report|探索报告]]"
---

# 实现总结：预约模块

## 完成状态：已完成

## 产出清单

### Spec 文档

| 文档 | 状态 |
|------|------|
| exploration-report.md | 已完成 |
| plan.md | 已完成 |
| test-plan.md | 已完成 |
| summary.md | 本文档 |

### 代码（`backend/app/`）

| 模块 | 说明 |
|------|------|
| `config.py` | `PLATFORM_FEE_RATE`、`DEFAULT_TIMEZONE`（默认 `Asia/Ho_Chi_Minh`） |
| `core/datetime_utils.py` | UTC 归一化、本地课时窗口、区间重叠 |
| `services/wallet_service.py` | 钱包确保、模拟充值、扣款、退款、流水分页 |
| `services/availability_service.py` | 教师时段 CRUD、预约前时段覆盖校验 |
| `services/lesson_service.py` | 建课、冲突检测、惰性 `expired`、状态机、列表联表姓名 |
| `api/v1/payments.py` | `GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup` |
| `api/v1/availability.py` | 可用时段 CRUD |
| `api/v1/lessons.py` | 预约与状态流转端点 |
| `dependencies.py` | `get_current_user` 预加载 `teacher_profile`（异步安全） |
| `schemas/availability.py` | `AvailabilityCreate` 互斥校验 `day_of_week` / `specific_date` |

### 测试

| 文件 | 说明 |
|------|------|
| `tests/api/v1/test_lessons.py` | 无时段拒绝、成功流+取消退款、余额不足、开始/结束；24h 内取消不退款见 `test_payment_settlement.py` |

## 业务规则落地摘要

1. **计价**：`price = ceil(hourly_rate * duration_minutes / 60)`（VND 整数）。
2. **时段**：越南本地时区下整节课落在教师某条 `availabilities` 窗口内，且不可跨自然日。
3. **钱包**：预约成功扣款（`payment`）；**取消**：距开课满 24 小时全额退款（`refund`），不足 24 小时 **不退款**；教师超时未确认（`expired`）全额退款（`refund`）。细则与 [[../20260403-支付模块实现/summary|支付模块总结]] 一致。
4. **状态机**：`pending_confirmation` → `confirmed` → `in_progress` → `completed`；`cancelled`；`expired`（教师 24h 未确认）。
5. **取消**：状态须为 `pending_confirmation` / `confirmed`；**任意提前量均可发起取消**，退款与否仅由距开课是否满 24 小时决定（见上条）。

## 验收

- `pytest tests/api/v1/test_lessons.py` 全部通过。
- 与 [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|全局架构]] 中课程状态机一致。

## 后续建议

- 教师课时费入账、平台分账（支付模块）。
- 独立定时任务批量 `expired`，减轻列表惰性更新。
- `GET /teachers/{id}` 等公开接口实现后，前端可直接用教师 ID 预约。
