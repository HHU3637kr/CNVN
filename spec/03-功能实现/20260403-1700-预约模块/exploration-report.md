---
title: 预约模块 - 探索报告
type: exploration-report
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
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 探索报告：预约模块

## 1. 现状

| 组件 | 状态 |
|------|------|
| `models/lesson.py` | 已存在，含 `status` 默认 `pending_confirmation` |
| `api/v1/lessons.py` | 7 个端点均为 `501` |
| `api/v1/availability.py` | 4 个端点均为 `501`（预约校验依赖本模块） |
| `api/v1/payments.py`（`/wallet`） | 3 个端点均为 `501`（扣款/退款依赖钱包） |
| `dependencies.get_current_user` | 已返回 `User` ORM，非 dict |
| `auth_service.register` | 已创建 `Wallet` |

## 2. 架构依据

- **状态机**（全局架构 `plan.md`）：`pending_confirmation → confirmed → in_progress → completed`；`cancelled`（自 pending/confirmed，受 24h 规则约束）；`expired`（教师 24h 内未确认）。
- **金额**：`price` 整数 VND；`platform_fee_rate` 来自配置；教师 `hourly_rate` 按课时换算 `price`。
- **可用时段**：`availabilities` 表支持 `day_of_week` 周期性或 `specific_date` 一次性；`start_time`/`end_time` 为本地墙钟时间，与 `Asia/Ho_Chi_Minh` 对齐后校验整节课是否落在窗口内。

## 3. 依赖与风险

- 需新增 **时区与计价工具**（避免 naive datetime）。
- 钱包需 **行级扣款**（`SELECT ... FOR UPDATE`）与 `transactions` 记录，保证与建课同事务。
- `GET /lessons` 列表需在返回前 **惰性将超时未确认的课标为 expired 并退款**（MVP 不引入独立定时任务）。

## 4. 结论

在实现预约 API 的同时，**必须**落地 `availability` 与 `wallet` 最小可用实现，以满足「时段校验 + 扣款/退款」的验收前提。
