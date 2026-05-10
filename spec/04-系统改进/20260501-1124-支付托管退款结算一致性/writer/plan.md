---
type: spec-plan
status: ready_for_executor
created: 2026-05-01
git_branch: fix/spec-20260501-1124-payment-consistency
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
execution_mode: single-agent
---

# 支付托管退款结算一致性

## 概述

本 Spec 聚焦支付托管链路中的两个 P0 一致性缺陷：`<24h` 取消课程后托管订单缺少争议期释放时间，以及评价后课程状态变为 `reviewed` 导致佣金阶梯统计漏算。目标是在不扩大支付系统能力边界的前提下，让现有托管、退款、争议期释放和佣金结算口径保持一致。

当前工作区已存在 TeamLead 误写的 WIP 代码与测试。该 WIP 不是 TeamLead 直接完成实现，必须由后续 spec-executor 审核、接管并决定保留、修正或重写；executor 仍需按本计划输出 `executor/summary.md`，并说明采纳了哪些既有 WIP。

## 现有能力

- API：`GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup`、`POST /payments/orders`、`GET /payments/orders/{id}`、`POST /payments/webhook/mock`、`GET /payouts/me`。
- 服务：`wallet_service.topup`、`payment_service.create_order_for_lesson`、`refund_payment_order`、`mark_lesson_completed`、`release_payment_order`、`dispute_watcher.run_once`、`ledger_service.post_entries`。
- 数据：`Wallet`、`Transaction`、`PaymentOrder`、`PayoutOrder`、`SettlementSnapshot`、`LedgerAccount`、`LedgerEntry`。

## 缺口

- `<24h` 取消课程未写 `PaymentOrder.held_until`，资金可能永久 held。
- 评价将课程从 `completed` 改为 `reviewed` 后，如佣金阶梯只按状态统计 `completed`，会漏算已经实际完成的课程。
- 上述两个缺陷缺少针对性 pytest 回归。

## 需求边界

### P0 范围

- `<24h` 取消时订单保持 held，并设置 `held_until = scheduled_at + duration + dispute_window`。
- 佣金阶梯统计以有效完课为口径：排除 `cancelled`、`expired`，并要求 `actual_end_at` 落在统计月份内；`reviewed` 且有 `actual_end_at` 的课程必须参与统计。
- 补对应 pytest：
  - `<24h` 取消后 `PaymentOrder.status` 保持 `held`，且 `held_until` 写为课程结束时间加争议期。
  - `reviewed` 且有 `actual_end_at` 的历史课程参与 `resolve_commission_rate` 月度小时统计。

### 本 Spec 不做

- 生产环境 mock 资金入口门禁。
- DB CHECK / trigger / append-only 约束扩展。
- 运营争议后台、人工释放或人工退款流程。
- 真实支付渠道接入、渠道验签、对账和税务策略扩展。
- 前端大改造。
- release/refund/webhook 幂等性专项治理，除非 executor 审核 WIP 时发现它是完成 P0 pytest 的必要最小修复。

## 设计方案

### 后端

- 在 `lesson_service.cancel_lesson` 的 `<24h` 分支写活跃订单 `held_until`。
- 在 `payment_service.resolve_commission_rate` 调整有效完课统计口径，使用 `actual_end_at` 作为月份归属，排除取消/过期课程。
- executor 必须审核当前 WIP 是否满足上述最小设计；如满足可接管保留，如存在偏差则按本计划修正。

### 前端

- 本 Spec 不改前端。

## 执行模式

`execution_mode: single-agent` 表示实现阶段由单个 spec-executor 严格执行本计划。它不否定 spec-start 下 TeamLead、explorer、writer、tester、executor 等项目级角色协作。

## 实现步骤

1. 已为本 Spec 单独执行 `$spec-start`，创建独立实现分支 `fix/spec-20260501-1124-payment-consistency`。
2. executor 审核当前工作区 WIP，确认哪些改动来自 TeamLead 误写，并在 `executor/summary.md` 中记录接管结果。
3. 校准 `backend/app/services/lesson_service.py`：
   - 定位 `cancel_lesson` 中 `hours_until < 24` 且活跃订单状态为 `held` / `disputed` 的分支。
   - 保持订单不退款、不转 released。
   - 写入 `order.held_until = lesson.scheduled_at + duration_minutes + settings.DISPUTE_WINDOW_HOURS`。
4. 校准 `backend/app/services/payment_service.py`：
   - 定位 `resolve_commission_rate`。
   - 月度统计使用 `Lesson.actual_end_at` 过滤月份。
   - 仅排除 `cancelled`、`expired`，并要求 `actual_end_at is not None`，确保 `reviewed` 课程不漏算。
5. 校准 `backend/tests/api/v1/test_payment_settlement.py`：
   - 覆盖 `<24h` 取消写 `held_until`。
   - 覆盖 `reviewed` + `actual_end_at` 课程进入佣金阶梯统计。
6. 运行对应 pytest，至少包括：
   - `backend/tests/api/v1/test_payment_settlement.py`
7. executor 输出 `executor/summary.md`，说明最终文件变更、WIP 接管情况和 pytest 结果。

## 风险和依赖

- 资金动作必须通过 `payment_service` / `wallet_service`，不能绕过账本。
- `<24h` 取消写 `held_until` 后，后续自动释放依赖现有 `dispute_watcher` 能按 `held_until` 到期释放 held 订单；本 Spec 不改 watcher 主流程。
- 佣金统计改为 `actual_end_at` 口径后，历史无 `actual_end_at` 的完成课程不会进入阶梯统计；这是本 Spec 的有效完课判定边界。
- 当前 WIP 已污染工作区，executor 必须先审核再接管，不能把 TeamLead 误写视为已完成实现。
- 生产 mock 门禁、DB 约束、运营后台、真实渠道均已推迟，后续需要独立 Spec 承接。

## 文档关联

- Team Context：`spec/04-系统改进/20260501-1124-支付托管退款结算一致性/lead/team-context.md`
- 探索报告：`spec/04-系统改进/20260501-1124-支付托管退款结算一致性/explorer/exploration-report.md`
- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`
