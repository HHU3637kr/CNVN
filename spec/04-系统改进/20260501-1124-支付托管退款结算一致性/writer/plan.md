---
type: spec-plan
status: draft
created: 2026-05-01
git_branch: pending-spec-start
base_branch: pending-spec-start
execution_mode: single-agent
---

# 支付托管退款结算一致性

## 概述

本 Spec 聚焦资金状态机：学员付款入托管、课程取消退款、争议期释放、教师结算和出款。目标是先修复会影响真实交易可信度的 P0 一致性问题。

## 现有能力

- API：`GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup`、`POST /payments/orders`、`GET /payments/orders/{id}`、`POST /payments/webhook/mock`、`GET /payouts/me`。
- 服务：`wallet_service.topup`、`payment_service.create_order_for_lesson`、`refund_payment_order`、`mark_lesson_completed`、`release_payment_order`、`dispute_watcher.run_once`、`ledger_service.post_entries`。
- 数据：`Wallet`、`Transaction`、`PaymentOrder`、`PayoutOrder`、`SettlementSnapshot`、`LedgerAccount`、`LedgerEntry`。

## 缺口

- `<24h` 取消课程未写 `PaymentOrder.held_until`，资金可能永久 held。
- 评价将课程从 `completed` 改为 `reviewed`，佣金阶梯只统计 `completed`，会影响结算。
- Mock topup、mock webhook、默认 mock channel 缺生产环境边界。
- 支付 v2 主链路缺 pytest 回归。

## 需求边界

### P0

- `<24h` 取消时订单保持 held，并设置 `held_until = scheduled_at + duration + dispute_window`。
- `reviewed` 或有 `actual_end_at` 的有效完课参与佣金阶梯。
- release/refund/webhook 重复处理不重复生成快照、出款或钱包流水。
- 为关键资金状态补 pytest。

### P1

- 生产环境禁用 Mock 资金入口。
- DB 状态 CHECK、LedgerEntry append-only、SettlementSnapshot 禁止 DELETE。

### P2

- 接入真实 VietQR/VNPay/MoMo、渠道验签、对账和税务策略。

## 设计方案

### 后端

- 在 `lesson_service.cancel_lesson` 的 `<24h` 分支写活跃订单 `held_until`。
- 在 `payment_service.resolve_commission_rate` 调整有效完课口径。
- 对重复 release/refund 保持幂等短路。
- 用测试覆盖资金不变量。

### 前端

- 本 Spec P0 不做大前端，只确保付款单/钱包后续能解释 held、refunded、released 状态。

## 实现步骤

1. 为本 Spec 单独执行 `$spec-start`，创建独立实现分支。
2. 修复 `<24h` 取消写 `held_until`。
3. 修复佣金统计口径。
4. 补支付相关 pytest。
5. 运行后端测试并写 `executor/summary.md`。

## 风险和依赖

- 资金动作必须通过 `payment_service` / `wallet_service`，不能绕过账本。
- DB 约束和真实支付渠道放到后续小步 Spec。

## 文档关联

- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`

