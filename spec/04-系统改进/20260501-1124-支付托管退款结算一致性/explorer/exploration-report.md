---
type: exploration-report
status: done
created: 2026-05-01
updated: 2026-05-01
git_branch: fix/spec-20260501-1124-payment-consistency
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
owner: spec-explorer
---

# 探索报告：支付托管退款结算一致性

## 探索范围

- Spec 计划：`writer/plan.md`
- 资金主链路：`backend/app/services/payment_service.py`
- 课程取消与完课入口：`backend/app/services/lesson_service.py`
- 评价状态变更：`backend/app/services/review_service.py`
- 自动释放任务：`backend/app/services/dispute_watcher.py`
- 支付 API、钱包服务、支付订单模型、相关测试：`backend/app/api/v1/payments.py`、`backend/app/services/wallet_service.py`、`backend/app/models/payment_order.py`、`backend/tests/api/v1/test_lessons.py`、`backend/tests/api/v1/test_payment_settlement.py`
- 历史经验：`EXP-002`、`KNOW-002`、`KNOW-003`

## 当前资金一致性 P0 问题确认

1. `<24h` 取消课程会让 `Lesson.status` 进入 `cancelled`，但基线实现未给活跃 `PaymentOrder` 写入 `held_until`。`dispute_watcher.run_once` 只扫描 `status='held' AND held_until < now()`，因此这类订单会长期停留在托管态，无法退款，也无法释放给教师。
2. 评价模块会在 `review_service.create_review` 中把课程从 `completed` 改成 `reviewed`。如果佣金阶梯只统计 `status='completed'`，已评价课程会从月完课时长中消失，导致 release 时抽成费率可能被错误抬高。
3. `release_payment_order` / `refund_payment_order` 已有状态级幂等短路，但仍需要 executor 审核并补测试确认：重复 release 不重复生成 `SettlementSnapshot`、`PayoutOrder`、教师钱包流水；重复 refund 不重复写学生钱包流水和 escrow 反向账本。
4. Mock 资金入口仍是当前产品化风险：`/wallet/topup`、`/payments/webhook/mock`、默认 `DEFAULT_PAYMENT_CHANNEL=mock` 没有生产环境禁用边界。按 plan 这是 P1，不应混入本次 P0 修复。

## WIP 改动现状

当前工作区已有 TeamLead 误写 WIP，explorer 不回退、不接管实现，只记录现状供 executor 审核。

### `lesson_service.py`

- WIP 在 `cancel_lesson` 中提前取得活跃订单，并在 `<24h` 且订单为 `held/disputed` 时写入：
  `held_until = scheduled_at + duration_minutes + settings.DISPUTE_WINDOW_HOURS`
- 方向正确，符合本 Spec P0：学员临近开课取消时订单保持 `held`，争议期到期后由 `dispute_watcher` 按常规 release。
- executor 注意点：
  - 确认 `scheduled_at` 已是 UTC 或经 `ensure_utc` 处理；当前 `_lesson_end` 直接相加，和现有代码风格一致，但测试要覆盖时区输入。
  - `<24h` 分支不应调用退款，不应把 `PaymentOrder.status` 改为 `refunded` 或 `released`。
  - 如果订单不存在或已非活跃状态，课程仍会 `cancelled`；这保持现有宽松行为，但资金异常应由后续审计/运维处理，不在本 Spec 内扩展。

### `payment_service.py`

- WIP 把佣金统计从 `Lesson.status == "completed"` 改为：
  `status not in ("cancelled", "expired") AND actual_end_at is not null`
- 方向正确，可覆盖 `reviewed` 完课；它实际定义的是“有实际结束时间的非终态失败课程”。
- executor 注意点：
  - 该口径会包含未来新增的非取消/非过期状态，只要存在 `actual_end_at` 就参与阶梯。当前状态机下主要是 `completed/reviewed`，但 writer 应明确这是有意口径。
  - release 中 `month = (lesson.actual_end_at or now).date()`，`<24h` 取消未上课的 release 会使用 `now` 所在月份计算费率；这是“学员违约全额结算给教师”的简化策略，建议本 Spec 不扩大调整，只在测试或 plan 中注明。

### `backend/tests/api/v1/test_payment_settlement.py`

- WIP 已补两个关键测试：
  - `<24h` 取消会设置 `held_until`
  - `reviewed` 且有 `actual_end_at` 的课程会参与佣金阶梯
- 方向正确，但覆盖不完整。tester/executor 应继续补：
  - 到期 held 订单经 `dispute_watcher.run_once` release 后只生成一份 snapshot/payout/settlement 流水。
  - 重复调用 `release_payment_order` 对 released 订单幂等返回原 payout。
  - 重复调用 `refund_payment_order` 对 refunded 订单不重复增加学生钱包余额。
  - `>=24h` 取消仍全额退款，避免 `<24h` 修复破坏既有测试。

## 风险与非本 Spec 范围

### 本 Spec 内风险

- 资金动作跨 `Wallet`、`Transaction`、`LedgerAccount`、`LedgerEntry`、`PaymentOrder`、`PayoutOrder`、`SettlementSnapshot`，测试必须检查副作用数量，不能只断言状态字段。
- `get_active_order_by_lesson` 未加行锁；高并发重复取消/退款理论上可能形成竞态。当前 API 层状态变更会降低概率，但 P0 幂等测试仍应覆盖服务层重复调用。
- `SettlementSnapshot.payment_order_id` 和 `PayoutOrder.payment_order_id` 有唯一约束，能兜住部分重复 release，但 executor 不能依赖异常作为正常幂等路径。
- `dispute_watcher` 单笔 release 包含 commit/rollback，适合测试自动释放主链路；测试中可直接把 `held_until` 调到过去并调用 `run_once`。

### 非本 Spec 范围

- 真实 VietQR/VNPay/MoMo、渠道签名验签、异步支付对账、税务合规。
- 生产环境禁用 mock topup / mock webhook / mock 默认 channel，除非 writer 把 P1 前移。
- DB CHECK 约束、LedgerEntry append-only trigger、SettlementSnapshot 禁止 DELETE trigger。
- 争议后台、人工仲裁、部分退款、教师提现失败补偿。
- 前端大改；本次最多保证后端状态可供后续展示。

## Handoff

### 给 writer

- 明确 P0 只收敛两条业务口径：`<24h` 取消写 `held_until` 并保持 held；佣金阶梯统计“非 cancelled/expired 且 actual_end_at 不为空”的有效完课。
- 把 `<24h` 取消未实际上课但最终 release 的费率月份口径写清楚：当前代码使用 `actual_end_at or now`，不要在本 Spec 中扩展复杂违约结算策略。
- P1 mock 生产边界、DB 约束和真实渠道放入后续 Spec，不要让 executor 在本轮顺手改。

### 给 tester

- 保留 WIP 两个测试方向，并补资金副作用断言：钱包余额、`Transaction` 数量、`SettlementSnapshot` 数量、`PayoutOrder` 数量、ledger entries 数量。
- 增加自动 release 测试：把 `held_until` 设为过去，调用 `dispute_watcher.run_once`，断言订单 released、教师钱包入账、重复 run 不再新增副作用。
- 增加 refund 幂等测试：同一订单 refund 两次，第二次不改变余额和流水数量。

### 给 executor

- 可以接管当前 WIP 作为起点，但必须逐行审核，不要默认 TeamLead WIP 已符合最终 plan。
- 不要回退现有 WIP；在其基础上补足幂等与测试。
- 严格限制修改范围：`lesson_service.py`、`payment_service.py`、必要测试文件。除非 writer 明确升级 P1，不改支付 API mock 禁用、DB 迁移或前端。
- 完成后运行后端目标测试，至少覆盖 `backend/tests/api/v1/test_lessons.py` 与 `backend/tests/api/v1/test_payment_settlement.py`。
