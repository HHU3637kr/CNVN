---
title: 支付系统合规改造 — 实现总结
type: summary
category: 03-功能实现
status: 未确认
priority: 高
created: 2026-04-18
execution_mode: single-agent
tags:
  - spec
  - summary
  - backend
  - payment
  - escrow
  - tax
  - ledger
related:
  - "[[plan|实现方案]]"
  - "[[test-plan|测试计划]]"
  - "[[exploration-report|探索报告]]"
---

# 支付系统合规改造 — 实现总结

## 实现概述

严格按 `plan.md` 完成 v0.2 支付合规改造全部 9 个实现阶段。遵循 **彻底重构** 原则：
无 Feature Flag、无兼容层，MVP 结算旧路径（`settlement_service.py`、`wallet_service.debit_for_lesson / credit_refund / credit_settlement`、`Lesson` 三个结算字段）全部删除。

> [!success] 机械校验（plan.md §1.4 约定）
> ```bash
> grep -r 'debit_for_lesson\|credit_refund\|credit_settlement\|settlement_service\|PLATFORM_FEE_RATE' backend/app backend/tests
> # 返回空
> ```

## 变更清单

### 新增文件

| 文件 | 职责 |
|---|---|
| `@d:\project\CNVN\backend\app\models\payment_order.py` | `PaymentOrder` / `PayoutOrder` / `SettlementSnapshot` ORM |
| `@d:\project\CNVN\backend\app\models\ledger.py` | `LedgerAccount` / `LedgerEntry` ORM + 4 个系统户常量 |
| `@d:\project\CNVN\backend\app\models\teacher_tax_profile.py` | `TeacherTaxProfile` ORM + 3 个税务场景常量 |
| `@d:\project\CNVN\backend\app\services\ledger_service.py` | 复式账本原子记账（`post_entries` / `post_single_entry`）与余额查询 |
| `@d:\project\CNVN\backend\app\services\tax\base.py` | `TaxStrategy` Protocol + `TaxCalculation` + 三场景策略（共享"固定10%"公式）+ `get_strategy` 工厂 |
| `@d:\project\CNVN\backend\app\services\tax\__init__.py` | 导出 |
| `@d:\project\CNVN\backend\app\services\payment\channels\base.py` | `PaymentChannelAdapter` Protocol |
| `@d:\project\CNVN\backend\app\services\payment\channels\mock.py` | `MockChannel` 实现（create_charge / handle_callback / refund 均幂等） |
| `@d:\project\CNVN\backend\app\services\payment\channels\__init__.py` | 渠道注册表 `get_channel(name)` |
| `@d:\project\CNVN\backend\app\services\payment_service.py` | 核心编排：`resolve_commission_rate` / `create_order_for_lesson` / `mark_lesson_completed` / `release_payment_order` / `refund_payment_order` / `get_active_order_by_lesson` / `list_payouts_by_teacher` |
| `@d:\project\CNVN\backend\app\services\dispute_watcher.py` | 周期协程 + `run_once` 批处理（`FOR UPDATE SKIP LOCKED`），3 次失败转人工 |
| `@d:\project\CNVN\backend\app\api\v1\payouts.py` | `GET /payouts/me` |
| `@d:\project\CNVN\backend\app\schemas\tax_profile.py` | `TeacherTaxProfileOut` / `TeacherTaxProfileUpdate` |
| `@d:\project\CNVN\backend\alembic\versions\002_add_payment_v2_tables.py` | 6 张新表 + 4 条 ledger_accounts seed + 现有 TeacherProfile 回填默认 TaxProfile + `SettlementSnapshot` UPDATE 禁止 trigger |
| `@d:\project\CNVN\backend\alembic\versions\003_drop_lesson_settlement_fields.py` | 删除 `Lesson` 三个结算字段 |

### 删除文件

| 文件 | 备注 |
|---|---|
| `backend/app/services/settlement_service.py` | 其 `calculate_platform_fee_rate` 已迁移到 `payment_service.resolve_commission_rate` |
| `backend/tests/api/v1/test_payment_settlement.py` | 旧 MVP 结算套件；新覆盖由 spec-tester 在阶段四撰写 |

### 修改文件

| 文件 | 要点 |
|---|---|
| `@d:\project\CNVN\backend\app\config.py` | 删除 `PLATFORM_FEE_RATE`；新增 `DISPUTE_WINDOW_HOURS`、`DISPUTE_WATCHER_INTERVAL_SECONDS`、`DISPUTE_WATCHER_BATCH_SIZE`、三档 `TAX_RATE_*`、`VAT_RATE`、`DEFAULT_PAYMENT_CHANNEL`；保留阶梯费率常量 |
| `@d:\project\CNVN\backend\app\models\lesson.py` | 删除 `settled_at` / `teacher_amount` / `platform_fee_rate` 三字段 |
| `@d:\project\CNVN\backend\app\models\__init__.py` | 导出 6 个新 ORM |
| `@d:\project\CNVN\backend\app\services\__init__.py` | 移除 `settlement_service`；新增 `ledger_service` / `payment_service` |
| `@d:\project\CNVN\backend\app\services\wallet_service.py` | 删除 `debit_for_lesson / credit_refund / credit_settlement`；保留 `ensure_wallet / get_wallet_by_user_id / topup / list_transactions / count_transactions` |
| `@d:\project\CNVN\backend\app\services\lesson_service.py` | `create_lesson` 调 `payment_service.create_order_for_lesson`；`end_lesson` 调 `mark_lesson_completed`；`cancel_lesson` ≥24h 调 `refund_payment_order`，<24h 仅置 `cancelled` 保持 `held`（B1 决议）；`expire_stale_pending_lessons` 走 `refund_payment_order` |
| `@d:\project\CNVN\backend\app\schemas\lesson.py` | 移除 `platform_fee_rate` |
| `@d:\project\CNVN\backend\app\schemas\payment.py` | 新增 `PaymentOrderOut` / `PaymentOrderDetail` / `PayoutOrderOut` / `SettlementSnapshotOut` / `CreatePaymentOrderRequest` / `MockWebhookPayload` |
| `@d:\project\CNVN\backend\app\api\v1\payments.py` | 拆出 `payments_router`（`POST /payments/orders`、`POST /payments/webhook/mock`、`GET /payments/orders/{id}`） |
| `@d:\project\CNVN\backend\app\api\v1\teachers.py` | 新增 `GET/PATCH /teachers/me/tax-profile`，首次访问自动生成默认 TaxProfile |
| `@d:\project\CNVN\backend\app\api\v1\router.py` | 挂载 `wallet_router` / `payments_router` / `payouts_router` |
| `@d:\project\CNVN\backend\app\main.py` | `@on_event('startup')` 启动 `dispute_watcher` 周期协程；`@on_event('shutdown')` 停止 |

## 核心功能

### 1. 资金流六阶段状态机（FR-001 / FR-005）

```
学员下单 → create_order_for_lesson
  Wallet(student) -= gross
  escrow += gross（单边 entry，ref_type='payment_order'）
  PaymentOrder: pending → paid → held（held_until=NULL）

课程 end_lesson → mark_lesson_completed
  PaymentOrder.held_until = actual_end_at + 24h

争议期过期 → dispute_watcher.run_once (FOR UPDATE SKIP LOCKED) → release_payment_order
  税务策略落 SettlementSnapshot（DB trigger 禁止 UPDATE）
  账本四笔（平衡）：escrow-gross / platform_revenue+commission / tax_payable+(vat+pit) / teacher_payable+net
  创建 PayoutOrder(pending → paid, Mock 立即)
  教师应付 teacher_payable-net（单边） + Wallet(teacher)+net + Transaction(type='settlement')
  PaymentOrder → released；Lesson 侧不再写结算字段

学员 ≥24h 取消 → refund_payment_order
  PaymentOrder → refunded；escrow-gross（单边） + Wallet(student)+gross
学员 <24h 取消（B1 决议）
  Lesson → cancelled；PaymentOrder 保持 held；held_until=scheduled_at+duration+24h
  争议期过后按常规 release 全额结算给教师（学员违约）
```

### 2. 税务三场景策略（FR-004）

- 场景一 `cn_resident`、场景二 `vn_passport_in_cn`、场景三 `vn_resident` 共用 `_FlatRateStrategy`（固定 10%、VAT=0）
- 场景三保留 `vn_residency_days_ytd` 字段，v0.3 替换为累进 PIT 引擎时**仅需新增子类 + 改注册表**，其他两个策略不动
- 未填 TaxProfile 时自动生成 `vn_resident` 默认（惰性，在首次查询或 release 时触发）

### 3. B2 决议：金额取整"倒推保守恒"

`base._compute_flat` 中：
```
tutor_gross       = int(Decimal(gross) * (1 - commission_rate))
commission_amount = gross - tutor_gross       # 倒推
vat_amount        = int(Decimal(tutor_gross) * vat_rate)
pit_amount        = int(Decimal(tutor_gross - vat_amount) * tax_rate)
net_amount        = tutor_gross - vat_amount - pit_amount   # 倒推
```
内置 `assert commission + vat + pit + net == gross`。

### 4. 账本双模式

- `post_entries`：严格借贷平衡（`sum(amount)=0`），用于内部系统户流转（release 四笔）
- `post_single_entry`：允许单边 entry，用于跨"系统户 ↔ 用户 Wallet"边界的流转
- 资金守恒不变量（spec-tester 执行用）：`Σ(ledger.balance) + Σ(wallet.balance) == Σ(topup)`

### 5. Dispute Watcher

- 间隔 60s（可配）扫描过期 held 订单
- 单批 100（可配）
- `FOR UPDATE SKIP LOCKED` 并发幂等
- 异常路径：单订单失败 → `retry_count++` + 记录 `last_error`；`>=3` 次转人工（保持 `held`，不自动转 `failed`）

## 数据库变更

### 新增表（6 张）

| 表 | 关键约束 |
|---|---|
| `ledger_accounts` | `UNIQUE (code)`；启动 seed 4 条 |
| `ledger_entries` | append-only；`(txn_group_id)` / `(account_id, created_at)` / `(ref_type, ref_id)` 三个索引 |
| `payment_orders` | **部分唯一索引** `UNIQUE (lesson_id) WHERE status <> 'refunded'`；`(status, held_until)` 供 dispute_watcher 扫描 |
| `payout_orders` | `UNIQUE (payment_order_id)` |
| `settlement_snapshots` | `UNIQUE (lesson_id)` + `UNIQUE (payment_order_id)`；**`BEFORE UPDATE` trigger 拒绝所有修改** |
| `teacher_tax_profiles` | `UNIQUE (teacher_id)`；迁移时为现有所有 TeacherProfile 回填 `vn_resident` 默认 |

### 删除字段

- `lessons.settled_at`
- `lessons.teacher_amount`
- `lessons.platform_fee_rate`

## API 变更

### 新增端点

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| `POST` | `/api/v1/payments/orders` | 学员 | 独立发起付款（补单 / 未来独立支付页） |
| `POST` | `/api/v1/payments/webhook/mock` | 无 | Mock 渠道回调（测试） |
| `GET` | `/api/v1/payments/orders/{id}` | 学员或对应教师 | 付款单详情（含 snapshot） |
| `GET` | `/api/v1/payouts/me` | 教师 | 自己的出款单列表（带分页/状态过滤） |
| `GET` | `/api/v1/teachers/me/tax-profile` | 教师 | 本人税务档案（不存在时自动创建默认） |
| `PATCH` | `/api/v1/teachers/me/tax-profile` | 教师 | 更新税务档案 |

### 保留端点

`GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup` 行为不变。

## 遗留事项与后续 v0.3 方向

- 场景三累进 PIT + 年度累计收入追踪
- 100M VND VAT 豁免门槛追踪
- 真实 VNPay / MoMo Channel Adapter 实现（只需新增 `channels/vnpay.py` 并注册）
- 教师提现申请与银行代发出款（当前 PayoutOrder 直接由 release 流程同步置 paid）
- 中越 DTA 退税字段与跨境数据脱敏

## 遇到的问题与解决方案

> [!note] 1. 账本"平衡 vs 单边" 的抽象冲突
> **问题**：plan §3.4 要求学员付款、退款、教师出款按"单边 entry + Wallet 双写"处理，但 `ledger_service.post_entries` 严格要求 `sum=0`。
> **解决**：新增 `ledger_service.post_single_entry`，明确用于跨边界流转；内部系统户流转继续走 `post_entries`。守恒不变量在上层（spec-tester §3.1）统一断言。

> [!note] 2. 部分唯一索引的 SQLAlchemy 表达式形式
> **问题**：`postgresql_where=(status != 'refunded')` 在 class body 里引用同名局部变量会产生歧义。
> **解决**：改用 `sqlalchemy.text("status <> 'refunded'")`，既直观又明确走 Postgres 原生语义。

> [!note] 3. `SettlementSnapshot` 不可变 trigger 的 Alembic 表达
> **问题**：Alembic auto-generate 不生成 trigger；且 downgrade 需显式 drop。
> **解决**：在 `002_add_payment_v2_tables.py` 里用 `op.execute(raw_sql)` 显式 CREATE FUNCTION + CREATE TRIGGER；downgrade 先 DROP TRIGGER 再 DROP FUNCTION，然后 drop_table。

> [!note] 4. 现有 `pending_confirmation` 课程的退款路径与 PaymentOrder 生命周期绑定
> **问题**：`expire_stale_pending_lessons` 原本直接 `credit_refund` 学员；新架构下学员已有 `PaymentOrder` 处于 `held`，退款必须走 `refund_payment_order`。
> **解决**：重构后查 active order，若处于 `held` / `disputed` 则统一走 `refund_payment_order`；账本 + Wallet 双写一次完成。

## 未测试

按 `spec-execute` v2.0 流程，测试执行由 spec-tester 在阶段四负责。本阶段仅完成代码实现与机械校验（grep 返回空、文件结构合规）。

## 文档关联

- 实现方案: [[plan|支付系统合规改造实现方案]]
- 测试计划: [[test-plan|测试计划]]
- 探索报告: [[exploration-report|探索报告]]
- 前置 MVP: [[../20260403-支付模块实现/summary|MVP 支付模块总结]]
