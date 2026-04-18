---
title: 支付系统合规改造实现方案
type: plan
category: 03-功能实现
status: 未确认
priority: 高
created: 2026-04-18
execution_mode: single-agent
tags:
  - spec
  - plan
  - backend
  - payment
  - escrow
  - tax
  - ledger
related:
  - "[[exploration-report|探索报告]]"
  - "[[../20260403-支付模块实现/plan|MVP 支付模块方案]]"
  - "[[../20260403-支付模块实现/summary|MVP 支付模块总结]]"
---

# 支付系统合规改造实现方案

## 1. 概述

### 1.1 背景

MVP（tag `v0.1.0-mvp`）已实现「学员钱包扣款 → 课程完成即刻结算 → 教师钱包入账」的单事务链路。参考 `docs/税务报告.docx` V2.0 第二章资金流和第四章税务场景要求，现阶段的直接结算方式存在三项合规缺口：

1. **无代收托管**：学员付款直接从钱包扣到"交易流水"，没有独立托管户概念
2. **无争议期**：课程完成即入账教师，缺少报告 §2.1 要求的 24h 争议缓冲
3. **无税务拆分**：统一用 `platform_fee_rate`，没有区分佣金 / VAT / PIT 等税种，也没有按 Tutor 身份分场景

### 1.2 目标

**本次 v0.2 合规骨架** 以「彻底重构」原则实施——**不保留任何 MVP 结算旧路径、不引入 Feature Flag、不留兼容层**。重点覆盖：

1. 订单级数据结构（`PaymentOrder` + `PayoutOrder` + `SettlementSnapshot`）
2. 系统户复式账本（托管户 / 平台营收户 / 应缴税金户 / 教师应付户）
3. 课程完成 → 24h 争议期 → 定时任务释放 → 教师钱包入账 的状态机
4. Tutor 三类税务场景分流（场景三暂用固定 10%）
5. 支付渠道抽象（`ChannelAdapter` + `MockChannel` 实现，为未来 VNPay/MoMo 预留接口）
6. **删除 MVP 结算相关旧代码**：`settlement_service.settle_teacher_lesson`、`wallet_service.debit_for_lesson / credit_refund / credit_settlement`、`Lesson` 上的结算快照字段、MVP 对应的测试套件

### 1.3 范围

#### 包含（v0.2）

- 数据层：5 张新表 + 1 个用户侧新模型（`TeacherTaxProfile`）
- 服务层：`tax/` 三场景策略 + `payment/channels/` 适配器 + `ledger_service` + 重构 `settlement_service`
- API 层：`POST /payments/orders`、`POST /payments/webhook/mock`、`GET /payouts/me` 及管理端列表
- 状态机：课程 `in_progress → completed → dispute_window → settled` 与订单 `pending → paid → held → released / refunded / disputed`
- 定时任务：`dispute_watcher` 扫描过期争议期的 `PaymentOrder` 完成释放
- Feature Flag：`PAYMENT_V2_ENABLED`，关闭时走现有 MVP 直接结算路径
- 单元 + 集成测试覆盖（由 spec-tester 产出 test-plan.md 详细化）

#### 不包含（留 v0.3+）

- 真实 VNPay / MoMo / Stripe 接入（仅 Mock 通道）
- 场景三（越南居民）累进 PIT 5%–35% 计算与年度累计收入追踪
- 100M VND VAT 豁免门槛追踪与提醒
- 中越 DTA 退税申请流程
- 教师提现申请与真实银行代发
- 跨境数据脱敏与中国母公司 BI 同步
- 历史 MVP 订单向新流程迁移（MVP 尚未承载生产数据，新老订单**不并存**，直接 drop/重建）

### 1.4 废弃替换清单（删除，不兼容）

本次**直接删除**以下 MVP 时期的代码与数据结构；开发分支合并后这些符号在代码库中不存在：

| 类别 | 对象 | 处置 |
|---|---|---|
| 服务 | `@d:\project\CNVN\backend\app\services\settlement_service.py` | **整体删除**。`calculate_platform_fee_rate` 阶梯费率逻辑**迁移**到 `payment_service.resolve_commission_rate`，其余丢弃 |
| 服务 | `wallet_service.debit_for_lesson` / `credit_refund` / `credit_settlement` | **删除**。这三个入口被 `payment_service.create_order_for_lesson` / `refund_payment_order` / `release_payment_order` 完整替代 |
| 服务 | `wallet_service.topup` | **保留**（模拟充值 MVP 通道，本次不替换） |
| 模型字段 | `Lesson.settled_at` / `Lesson.teacher_amount` / `Lesson.platform_fee_rate` | **删除**（alembic migration），结算数据统一查 `SettlementSnapshot` |
| 调用点 | `lesson_service.create_lesson` 对 `debit_for_lesson` 的调用 | **替换**为 `payment_service.create_order_for_lesson` |
| 调用点 | `lesson_service.end_lesson` 对 `settle_teacher_lesson` 的调用 | **替换**为 `payment_service.mark_lesson_completed` |
| 调用点 | `lesson_service.cancel_lesson` 对 `credit_refund` 的调用 | **替换**为 `payment_service.refund_payment_order`（`≥24h`）或状态保持（`<24h`） |
| 配置 | `settings.PLATFORM_FEE_RATE`（单一费率占位常量） | **删除**（被阶梯费率取代；阶梯费率常量保留并迁移命名空间） |
| 测试 | `@d:\project\CNVN\backend\tests\` 下专门测 MVP 结算/退款旧路径的用例 | **删除或改写**（在测试计划中归类为 "需要迁移/删除的旧测试"） |

**保留**：`Wallet` / `Transaction` 两张表（用户可提现余额），其 `type` 枚举扩展新值；`Lesson` 表本身（仅删除结算相关字段）；阶梯费率业务规则。

> 原则：合并本次 Spec 的代码后，**`grep -r "debit_for_lesson\|credit_refund\|credit_settlement\|settlement_service" backend/` 必须返回空**（import 与定义都不存在），作为"彻底重构完成"的机械校验。

## 2. 需求分析

### 2.1 功能需求

#### FR-001：学员付款单（PaymentOrder）

**描述**：学员下单时创建 `PaymentOrder`，标注渠道与流水；当前通过 Mock 渠道即时完成 `pending → paid`，付款完成后资金进入**托管户**（账本层），状态进入 `held`，等待课程完成与争议期过期。

**业务规则**：
- 一门课只允许 1 条活跃 `PaymentOrder`（`lesson_id` 唯一索引，排除已 `refunded` 的历史记录）
- `held_until` 字段在课程 `completed` 时才写入（= `actual_end_at + 24h`），创建时为 NULL
- 退款（`refunded`）只能从 `held` 或 `disputed` 状态流转，不能从 `released` 回退

#### FR-002：系统户账本（LedgerAccount + LedgerEntry）

**描述**：引入有限、封闭的复式记账账本，仅记录 **系统户之间** 的资金流转。用户可提现余额仍在 `Wallet`。

**账户集合**（固定 4 类，启动时 seed）：

| code | name | 余额语义 |
|---|---|---|
| `escrow` | 代收托管户 | 学员付款后、教师结算前的暂存池 |
| `platform_revenue` | 平台营收户 | 沉淀平台佣金 |
| `tax_payable` | 应缴税金户 | 代扣 VAT + PIT 的负债 |
| `teacher_payable` | 教师应付户 | 已 release 但未实际出款的负债（配合 `PayoutOrder`） |

**业务规则**：
- 每笔 `LedgerEntry` 必须借贷平衡（`sum(amount) = 0`）
- 每次业务事件产生一批 entries 共享同一个 `txn_group_id`（UUID）
- 账本是 append-only，不允许修改历史 entry

#### FR-003：Tutor 税务档案（TeacherTaxProfile）

**描述**：每位 Tutor 一张税务档案，决定结算时适用的税务策略。

**字段**：
- `tax_scenario`：`cn_resident` / `vn_passport_in_cn` / `vn_resident`，未填默认 `vn_resident`（最保守）
- `id_doc_type` + `id_doc_no`：身份证 / 护照 / CCCD
- `vn_tax_code`：越南税务识别码 10 位（可空）
- `vn_residency_days_ytd`：年内在越累计居住天数（场景二追踪，本次仅记录不自动计算）
- `kyc_verified_at`：核验时间

#### FR-004：税务计算策略（TaxStrategy）

**描述**：按 `tax_scenario` 分三个策略类，输入 `gross, commission_rate, teacher_tax_profile`，输出不可变 `SettlementSnapshot`。

**本次落地深度**（按路线A）：

| 场景 | 适用税率 | 实现说明 |
|---|---|---|
| `cn_resident` | `commission_rate` + 固定 `tax_rate=10%`（合并非居民代扣） | 最简单 |
| `vn_passport_in_cn` | 同上，**多记录** `vn_residency_days_ytd` 字段 | 风险提示前端做 |
| `vn_resident` | `commission_rate` + 固定 `tax_rate=10%`（占位，v0.3 替换为累进引擎） | 预留 `vat_amount / pit_amount` 分列字段 |

拆分公式固定为（参见探索报告 §3.3，本次简化为 VAT=0、全部税负记入 `pit_amount`）：

```
tutor_gross = gross × (1 - commission_rate)
tax_amount  = tutor_gross × tax_rate
net_amount  = tutor_gross - tax_amount
commission_amount = gross - tutor_gross
```

#### FR-005：课程完成 + 争议期状态机

**描述**：重构 `lesson_service.end_lesson`，不再即时结算；改为写入 `PaymentOrder.held_until = actual_end_at + 24h`，订单停留在 `held`。由定时任务扫描过期自动释放。

**状态流转**：

```
PaymentOrder:   pending ──create──▶ paid ──lesson.completed──▶ held ─(dispute_window 过期)─▶ released
                                              │                     │
                                              │                     └──student.dispute──▶ disputed
                                              │                                              │
                                              │                                              ├──uphold──▶ refunded
                                              │                                              └──reject──▶ released
                                              ├── cancel(≥24h 课前) ──▶ refunded
                                              └── cancel(<24h 课前) ──▶ held（等课程本应结束后按常规 release 给教师；学员违约）

Lesson.status:  scheduled → confirmed → in_progress → completed → dispute_window → settled
                                                          │
                                                          └─── cancel ──▶ cancelled
```

**B1 决议（2026-04-18）**：学员在课前不足 24h 取消的已付款资金，订单**保持 `held`**，`held_until = scheduled_at + duration + 24h`（即按原本的课程结束时间 + 争议期），随后走常规 release 流程，**全额结算给教师**（视为学员违约）。无需新增 `status` 枚举值，无需新增账本科目。

**B2 决议（2026-04-18）**：金额取整统一采用"倒推保守恒"策略——`tutor_gross = int(Decimal(gross) × (1 - commission_rate))`，`commission_amount = gross - tutor_gross`；`pit_amount = int(Decimal(tutor_gross) × tax_rate)`，`net_amount = tutor_gross - pit_amount - vat_amount`。任意一步只用一次 `int(...)` 截断，剩余全部由被动字段吸收，保证 `commission + vat + pit + net == gross`。

#### FR-006：Payout 出款单（PayoutOrder）

**描述**：`PaymentOrder` 释放时，按税务快照结果创建 `PayoutOrder`，状态 `pending`，立即调用 `wallet_service.credit_settlement` 给教师钱包入账并置为 `paid`（Mock 阶段）。

> 真实渠道阶段将：`pending → released(=已生成凭据) → paid(=银行回调确认)`。Mock 阶段合并这两步。

#### FR-007：争议期定时任务（dispute_watcher）

**描述**：周期性扫描 `PaymentOrder.status='held' AND held_until < now()`，使用 `FOR UPDATE SKIP LOCKED` 保证并发幂等，触发 release 流程。

**业务规则**：
- 重复运行 N 次结果必须与 1 次相同（幂等）
- 每次最多处理 100 条，避免单次锁表过久
- 失败的订单记录 `last_error` + 重试次数，超过 3 次转人工

#### FR-008：支付渠道抽象（ChannelAdapter）

**描述**：抽象 `PaymentChannelAdapter` 基类 + `MockChannel` 实现。MVP 阶段：
- `create_charge(order)` → 立即返回 `paid` 状态（模拟）
- `simulate_callback(order_id)` → 回调处理入口（供测试 + 未来真实 webhook 复用）

**接口设计**：

```python
class PaymentChannelAdapter(Protocol):
    channel: str

    async def create_charge(
        self, db: AsyncSession, order: PaymentOrder
    ) -> PaymentOrder: ...

    async def handle_callback(
        self, db: AsyncSession, payload: dict
    ) -> PaymentOrder: ...

    async def refund(
        self, db: AsyncSession, order: PaymentOrder, amount: int
    ) -> PaymentOrder: ...
```

### 2.2 非功能需求

| 维度 | 要求 |
|---|---|
| 幂等性 | 所有资金操作必须幂等（基于 `status` + 业务主键） |
| 一致性 | 单次结算的账本 entries + `SettlementSnapshot` + `PaymentOrder.status` + `PayoutOrder` 必须同一事务 |
| 可审计 | `LedgerEntry` append-only；`SettlementSnapshot` 不可变（数据库层用 trigger 禁止 UPDATE） |
| 可回滚 | Feature Flag `PAYMENT_V2_ENABLED=false` 时走旧路径 |
| 性能 | `dispute_watcher` 单次批处理 100 条 < 2s（基于 `FOR UPDATE SKIP LOCKED` + 批量更新） |
| 兼容 | 已有 API `GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup` 保持不变 |

## 3. 设计方案

### 3.1 模块架构

```
┌────────────────────────────────────────────────────────────┐
│                         API Layer                           │
│  lessons.py (现有，改造 end_lesson)                         │
│  payments.py (现有，新增 order/webhook)                     │
│  payouts.py  (新增)                                         │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                       Service Layer                         │
│                                                             │
│  lesson_service ──▶ payment_service ──▶ settlement_service  │
│                         │                     │             │
│                         ▼                     ▼             │
│                  payment/channels/       tax/               │
│                    MockChannel          CNResident          │
│                                         VNPassportInCN      │
│                                         VNResident          │
│                         │                     │             │
│                         └──────┬──────────────┘             │
│                                ▼                            │
│                        ledger_service                       │
│                                │                            │
│                                ▼                            │
│                     wallet_service (现有)                   │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                        Data Layer                           │
│  现有: User, TeacherProfile, Lesson, Wallet, Transaction    │
│  新增: PaymentOrder, PayoutOrder, SettlementSnapshot,       │
│        LedgerAccount, LedgerEntry, TeacherTaxProfile        │
└────────────────────────────────────────────────────────────┘
```

### 3.2 数据模型

#### 3.2.1 `payment_orders`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `lesson_id` | UUID FK→lessons | 唯一索引（WHERE status != 'refunded'） |
| `student_id` | UUID FK→users | |
| `gross_amount` | BIGINT | VND 学员实付 |
| `channel` | VARCHAR(20) | `mock` / 预留 `vnpay` / `momo` |
| `channel_txn_id` | VARCHAR(128) | 第三方流水号 |
| `status` | VARCHAR(20) | `pending / paid / held / released / refunded / disputed` |
| `held_until` | TIMESTAMPTZ NULL | 课程完成时写入 |
| `paid_at` | TIMESTAMPTZ NULL | |
| `released_at` | TIMESTAMPTZ NULL | |
| `refunded_at` | TIMESTAMPTZ NULL | |
| `last_error` | TEXT NULL | dispute_watcher 重试时记录 |
| `retry_count` | INT DEFAULT 0 | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**索引**：
- `UNIQUE (lesson_id) WHERE status != 'refunded'`（部分唯一）
- `INDEX (status, held_until)` 供 dispute_watcher 扫描

#### 3.2.2 `payout_orders`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `payment_order_id` | UUID FK→payment_orders UNIQUE | 一对一 |
| `lesson_id` | UUID FK→lessons | |
| `teacher_id` | UUID FK→teacher_profiles | |
| `settlement_snapshot_id` | UUID FK→settlement_snapshots | |
| `net_amount` | BIGINT | 教师净到账 |
| `status` | VARCHAR(20) | `pending / released / paid / failed` |
| `channel` | VARCHAR(20) | `mock` / `bank_manual` |
| `channel_txn_id` | VARCHAR(128) NULL | |
| `paid_at` | TIMESTAMPTZ NULL | |
| `last_error` | TEXT NULL | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

#### 3.2.3 `settlement_snapshots`（不可变）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `lesson_id` | UUID FK→lessons UNIQUE | |
| `payment_order_id` | UUID FK→payment_orders UNIQUE | |
| `tax_scenario` | VARCHAR(30) | 快照时的场景 |
| `gross_amount` | BIGINT | |
| `commission_rate` | NUMERIC(5,4) | 如 0.2000 |
| `commission_amount` | BIGINT | |
| `tax_rate` | NUMERIC(5,4) | 本次统一 0.1000 |
| `vat_amount` | BIGINT DEFAULT 0 | 预留，本次为 0 |
| `pit_amount` | BIGINT | 税额（本次等于 `tutor_gross × 10%`） |
| `net_amount` | BIGINT | |
| `calculated_at` | TIMESTAMPTZ | |

**约束**：数据库 trigger 拒绝 UPDATE（only INSERT/SELECT）。

#### 3.2.4 `ledger_accounts`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `code` | VARCHAR(40) UNIQUE | `escrow / platform_revenue / tax_payable / teacher_payable` |
| `name` | VARCHAR(100) | |
| `balance` | BIGINT DEFAULT 0 | 即时余额（冗余，由 entries 累加） |
| `created_at` | TIMESTAMPTZ | |

启动时通过 migration seed 4 条。

#### 3.2.5 `ledger_entries`（append-only）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `txn_group_id` | UUID | 同一业务事件的 entries 共享 |
| `account_id` | UUID FK→ledger_accounts | |
| `amount` | BIGINT | 正=借入，负=贷出，同组 sum=0 |
| `direction` | VARCHAR(10) | `debit` / `credit`（冗余字段便于查询） |
| `ref_type` | VARCHAR(30) | `payment_order / payout_order / refund / manual` |
| `ref_id` | UUID NULL | 关联业务对象 |
| `description` | VARCHAR(255) | |
| `created_at` | TIMESTAMPTZ | |

**索引**：`(txn_group_id)`, `(account_id, created_at)`, `(ref_type, ref_id)`。

#### 3.2.6 `teacher_tax_profiles`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `teacher_id` | UUID FK→teacher_profiles UNIQUE | |
| `tax_scenario` | VARCHAR(30) DEFAULT 'vn_resident' | |
| `id_doc_type` | VARCHAR(20) NULL | `cn_id / vn_cccd / passport` |
| `id_doc_no` | VARCHAR(40) NULL | |
| `vn_tax_code` | VARCHAR(20) NULL | |
| `vn_residency_days_ytd` | INT DEFAULT 0 | |
| `kyc_verified_at` | TIMESTAMPTZ NULL | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### 3.3 服务层详细设计

#### 3.3.1 `app/services/ledger_service.py`（新建）

```python
async def post_entries(
    db: AsyncSession,
    *,
    entries: list[tuple[str, int, str]],   # [(account_code, amount, direction)]
    ref_type: str,
    ref_id: uuid.UUID,
    description: str,
) -> uuid.UUID:
    """原子记账。amount 有符号，总和必须为 0。返回 txn_group_id。"""

async def get_balance(db: AsyncSession, account_code: str) -> int: ...

async def list_entries_by_ref(
    db: AsyncSession, ref_type: str, ref_id: uuid.UUID
) -> list[LedgerEntry]: ...
```

#### 3.3.2 `app/services/tax/base.py`（新建）

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class TaxCalculation:
    tax_scenario: str
    gross_amount: int
    commission_rate: Decimal
    commission_amount: int
    tax_rate: Decimal
    vat_amount: int
    pit_amount: int
    net_amount: int

class TaxStrategy(Protocol):
    scenario: str
    def calculate(
        self,
        gross: int,
        commission_rate: Decimal,
        profile: TeacherTaxProfile,
    ) -> TaxCalculation: ...

def get_strategy(scenario: str) -> TaxStrategy: ...
```

**三个实现**（`cn_resident.py` / `vn_passport_in_cn.py` / `vn_resident.py`）本次共享同一套"固定 10% 税率，全部计入 `pit_amount`，`vat_amount=0`"的公式；区别仅在 `scenario` 字段与日志输出。这样后续替换 `VNResidentStrategy` 为累进引擎时，其他两个保持不动。

#### 3.3.3 `app/services/payment/channels/base.py`（新建）

见 FR-008 的 Protocol 定义。`MockChannel` 实现：
- `create_charge`：立即将 `PaymentOrder.status` 置为 `paid`，写入 `paid_at` 与合成的 `channel_txn_id`
- `handle_callback`：基于 `payload.order_id` 定位订单，重复调用幂等
- `refund`：置为 `refunded` + 调度账本反向 entries

#### 3.3.4 `app/services/payment_service.py`（新建）

```python
async def create_order_for_lesson(
    db: AsyncSession, lesson: Lesson, *, channel: str = "mock"
) -> PaymentOrder:
    """学员下课时调用：扣 Wallet、创建 PaymentOrder、记账本 (escrow ← student)。"""

async def mark_lesson_completed(
    db: AsyncSession, lesson: Lesson
) -> PaymentOrder:
    """lesson_service.end_lesson 调用：写 held_until = actual_end_at + 24h。"""

async def release_payment_order(
    db: AsyncSession, order: PaymentOrder
) -> PayoutOrder:
    """争议期过期时调用：跑税务策略 → 落快照 → 记账本 → 创建 PayoutOrder → 入教师钱包。"""

async def refund_payment_order(
    db: AsyncSession, order: PaymentOrder, reason: str
) -> PaymentOrder: ...
```

#### 3.3.5 `app/services/dispute_watcher.py`（新建）

```python
async def run_once(db: AsyncSession, *, batch_size: int = 100) -> int:
    """
    扫描 status='held' AND held_until < now() 的订单，逐个 release。
    使用 FOR UPDATE SKIP LOCKED 保证幂等。返回处理条数。
    """
```

**调度**：通过 FastAPI 启动时的 `BackgroundTasks` 或 `asyncio.create_task` 起一个周期协程（每 60s 跑一次）。生产环境后续可替换为 Celery / APScheduler，本次不引入新依赖。

#### 3.3.6 `app/services/settlement_service.py`（**删除**）

整个文件**彻底删除**。其两个函数的归属：

- `calculate_platform_fee_rate(db, teacher_id, month)` → **迁移**到 `payment_service.resolve_commission_rate`，签名不变；仅 import 路径调整
- `settle_teacher_lesson(db, lesson)` → **删除**，职责由 `payment_service.release_payment_order` 接管（后者基于 `PaymentOrder`，不再接受裸 `Lesson`）

相应地，`app/services/__init__.py` 中的 `settlement_service` 导出一并移除；任何 import 它的文件（目前仅 `lesson_service.end_lesson`）改为 import `payment_service`。

### 3.4 记账事件表（账本方向约定）

> 约定：`escrow`、`tax_payable`、`teacher_payable`、`platform_revenue` 四个户均从**平台角度**记账，余额为正数。学员付款等价于"外部世界"对平台的一次转账，用 entries 表示平台内部的流转。

| 业务事件 | 账本变化 |
|---|---|
| 学员下单付款（Wallet→escrow） | Wallet.balance -= gross；`escrow += gross` 单边入账（标记 `ref_type=payment_order`，`direction=debit`），余额守恒在"系统户+钱包"层面 |
| 课程完成（只改订单状态） | 无账本事件 |
| 争议期过期 → release | `escrow -= gross`；`platform_revenue += commission`；`tax_payable += pit`；`teacher_payable += net`（四条 entries 同一 txn_group，sum=0） |
| PayoutOrder paid（Mock 立即完成） | `teacher_payable -= net`；Wallet(teacher).balance += net（和教师钱包 Transaction 同步写入，不进账本） |
| 退款（full） | `escrow -= gross`；Wallet(student).balance += gross |

> 说明：学员钱包和教师钱包**不进账本**，只通过"单边 entry + Wallet mutation"的双写机制保证业务层可追溯。这是路线 A "混合账本"的核心取舍。测试侧需校验：每次业务事件后，`escrow + tax_payable + teacher_payable + platform_revenue` 之和 + 所有用户 Wallet 余额 = 历史 topup 总额（全局资金守恒）。

### 3.5 API 设计

| Method & Path | 说明 | 请求 | 响应 |
|---|---|---|---|
| `POST /api/v1/payments/orders` | 学员发起付款（当前由 create_lesson 内部调用，本端点供未来外部前端使用） | `{ lesson_id, channel }` | `PaymentOrderOut` |
| `POST /api/v1/payments/webhook/mock` | Mock 渠道回调（测试用） | `{ order_id, event: 'paid'\|'failed' }` | `PaymentOrderOut` |
| `GET /api/v1/payouts/me` | Tutor 查询自己的出款单列表 | `?status=&page=&page_size=` | `PaginatedResponse[PayoutOrderOut]` |
| `GET /api/v1/payments/orders/{id}` | 查询付款单详情 | - | `PaymentOrderOut`（含 snapshot） |

> 现有端点（`GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup`）不变。

### 3.6 配置变更（`app/config.py`）

**删除**：`PLATFORM_FEE_RATE`（单一费率占位常量，已被阶梯费率取代）。

**新增**：

```python
# 争议期
DISPUTE_WINDOW_HOURS: int = 24
DISPUTE_WATCHER_INTERVAL_SECONDS: int = 60
DISPUTE_WATCHER_BATCH_SIZE: int = 100

# 税率（路线A简化；场景三后续替换为累进引擎）
TAX_RATE_CN_RESIDENT: Decimal = Decimal("0.10")
TAX_RATE_VN_PASSPORT_IN_CN: Decimal = Decimal("0.10")
TAX_RATE_VN_RESIDENT: Decimal = Decimal("0.10")
VAT_RATE: Decimal = Decimal("0.00")

# 支付渠道
DEFAULT_PAYMENT_CHANNEL: str = "mock"
```

**保留**：`COMMISSION_TIER_1/2/3_*` 阶梯费率常量不变。

> 无 Feature Flag。合并 Spec 后，新流程是**唯一路径**。

## 4. 执行模式

**固定为 `single-agent`**。

理由：
1. 改动集中在后端单一仓库内，无前后端并行联调阻塞
2. 数据模型、服务、API 虽多但有明确依赖顺序（data → service → api → scheduler），适合单 Agent 串行实现
3. 保证代码风格、命名、事务边界一致

## 5. 实现步骤

> 估计总工期 2-3 周。按阶段递交，每阶段结束都是可运行（且全量测试通过）的状态。

### 5.1 阶段 1：数据层 + 迁移（1-2 天）

- [ ] S1.1 新增 migration `002_add_payment_v2_tables.py`：6 张新表 + 4 条 ledger_accounts seed
- [ ] S1.2 新增 migration `003_drop_lesson_settlement_fields.py`：**删除** `Lesson.settled_at` / `Lesson.teacher_amount` / `Lesson.platform_fee_rate`
- [ ] S1.3 新增 ORM 模型：`PaymentOrder`、`PayoutOrder`、`SettlementSnapshot`、`LedgerAccount`、`LedgerEntry`、`TeacherTaxProfile`
- [ ] S1.4 同步修改 `Lesson` ORM（移除三个结算字段）
- [ ] S1.5 更新 `app/models/__init__.py` 导出
- [ ] S1.6 `SettlementSnapshot` 的 UPDATE 禁止 trigger（SQL 层，`op.execute` 显式 create/drop）
- [ ] S1.7 本地起 Docker 跑 `alembic upgrade head` 验证

### 5.2 阶段 2：账本服务 + 税务策略（1-2 天）

- [ ] S2.1 `ledger_service.py` 实现 `post_entries`、`get_balance`、`list_entries_by_ref`
- [ ] S2.2 `tax/base.py` + 三个策略实现（共享简化公式）
- [ ] S2.3 单元测试：账本借贷平衡校验、三个策略产出 `TaxCalculation` 数值准确

### 5.3 阶段 3：支付渠道抽象 + Mock（半天）

- [ ] S3.1 `payment/channels/base.py` Protocol
- [ ] S3.2 `payment/channels/mock.py` 实现
- [ ] S3.3 `payment/channels/__init__.py` 注册表 `get_channel(name)`

### 5.4 阶段 4：`payment_service` 核心流程（2-3 天）

- [ ] S4.1 `create_order_for_lesson`：创建订单 + Wallet 扣款 + 账本 entries
- [ ] S4.2 `mark_lesson_completed`：订单状态 paid → held + `held_until`
- [ ] S4.3 `release_payment_order`：跑策略 → 落快照 → 账本拆分 → `PayoutOrder` → 教师钱包入账
- [ ] S4.4 `refund_payment_order`：状态流转 + 账本反向
- [ ] S4.5 单元 + 集成测试（事务一致性、资金守恒）

### 5.5 阶段 5：删除 MVP 旧代码 + 接入新流程（1 天）

- [ ] S5.1 **删除** `app/services/settlement_service.py`；将 `calculate_platform_fee_rate` 迁移到 `payment_service.resolve_commission_rate`
- [ ] S5.2 **删除** `wallet_service.debit_for_lesson` / `credit_refund` / `credit_settlement` 三个函数
- [ ] S5.3 `lesson_service.create_lesson`：调用改为 `payment_service.create_order_for_lesson`
- [ ] S5.4 `lesson_service.end_lesson`：调用改为 `payment_service.mark_lesson_completed`
- [ ] S5.5 `lesson_service.cancel_lesson`：≥24h 走 `refund_payment_order`；<24h **仅更新 `Lesson.status='cancelled'` 并保持 `PaymentOrder.status='held'`**（按 B1 决议，等争议期过后自动 release 给教师）
- [ ] S5.6 `lesson_service.expire_stale_pending_lessons`：退款路径改为 `refund_payment_order`
- [ ] S5.7 **删除或改写** `@d:\project\CNVN\backend\tests\` 下专测 MVP 旧路径的用例（由 spec-tester 列表）
- [ ] S5.8 机械校验：`grep -r 'debit_for_lesson\|credit_refund\|credit_settlement\|settlement_service' backend/` 返回空

### 5.6 阶段 6：定时任务（半天）

- [ ] S6.1 `dispute_watcher.py` 实现 `run_once`
- [ ] S6.2 `main.py` 启动时创建周期 task
- [ ] S6.3 集成测试：模拟时间跳跃验证自动 release

### 5.7 阶段 7：API 端点（1 天）

- [ ] S7.1 `schemas/payment.py` 新增 `PaymentOrderOut` / `PayoutOrderOut` / `SettlementSnapshotOut`
- [ ] S7.2 `api/v1/payments.py` 新增 order/webhook 端点
- [ ] S7.3 `api/v1/payouts.py` 新增 Tutor 查询端点
- [ ] S7.4 `api/v1/router.py` 挂载
- [ ] S7.5 API 测试（FastAPI TestClient）

### 5.8 阶段 8：TeacherTaxProfile 接入 + KYC 默认值（半天）

- [ ] S8.1 `schemas/teacher.py` 扩展税务字段
- [ ] S8.2 教师开通流程 API 增加税务字段（可选）
- [ ] S8.3 未填时默认 `vn_resident`

### 5.9 阶段 9：文档与收尾（半天）

- [ ] S9.1 更新 `@d:\project\CNVN\CLAUDE.md` 中的架构段
- [ ] S9.2 新增 `backend/docs/payment-flow.md` 流程图
- [ ] S9.3 `summary.md` 由 spec-executor 产出

## 6. 风险和依赖

### 6.1 风险登记

| # | 风险 | 概率 | 影响 | 缓解策略 |
|---|---|---|---|---|
| R1 | 订单创建内嵌 Wallet 扣款后，事务边界横跨多表 | 中 | 高 | 同一 `db` session；订单 + 账本 entries + Wallet 扣减一次 `await db.commit()` 提交；编写专项并发测试 |
| R2 | 争议期定时任务并发幂等 | 中 | 高 | `FOR UPDATE SKIP LOCKED`；配合 `status` 字段多次检查 |
| R3 | `SettlementSnapshot` 不可变 trigger 在 Alembic 下跨版本迁移时要特别处理 | 低 | 中 | 迁移文件用 `op.execute(raw_sql)` 显式创建 trigger；downgrade 显式 drop |
| R4 | 资金守恒测试定义含糊 | 中 | 中 | 显式定义不变量：`Σ(ledger_accounts.balance) + Σ(wallets.balance) = Σ(topup amount)`；每个集成测试后断言 |
| R5 | 删除 `Lesson.settled_at` 等字段会影响已有前端/Schema 返回 | 中 | 中 | 同步审视 `schemas/lesson.py`、前端的 `LessonOut` 消费点；不再返回这些字段，改由 `SettlementSnapshot` 端点提供 |
| R6 | `TeacherTaxProfile` 默认值 `vn_resident` 对现有教师的回填 | 中 | 低 | Migration data 步骤：为所有现有 TeacherProfile 插入一条默认 TaxProfile |
| R7 | Mock 渠道语义与真实 VNPay 差异（例如真实渠道有 `pending_3ds` 态） | 低 | 中 | `PaymentOrder.status` 枚举预留 `pending_3ds`（本次不使用），接口层 `ChannelAdapter.create_charge` 返回 typed Enum |
| R8 | 删除旧测试用例导致覆盖率骤降 | 中 | 低 | spec-tester 在 test-plan 中对每个被删除的旧测试给出"新路径下的替代用例"映射 |

### 6.2 依赖

- **项目现有**：`Wallet` / `Transaction` / `Lesson` / `TeacherProfile` / `availability_service` / `wallet_service`
- **工具**：Alembic、SQLAlchemy 2.x、asyncpg、FastAPI、pytest-asyncio
- **本次不引入新三方依赖**（不装 Celery/APScheduler/SQLAlchemy-events）

## 7. 文档关联

- 探索报告：[[exploration-report|探索报告]]
- MVP 方案：[[../20260403-支付模块实现/plan|支付模块实现方案]]
- MVP 总结：[[../20260403-支付模块实现/summary|支付模块实现总结]]
- 后端架构：[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
- 测试计划：[[test-plan|测试计划]]（待 spec-tester 创建）
- 实现总结：[[summary|实现总结]]（待 spec-executor 创建）
