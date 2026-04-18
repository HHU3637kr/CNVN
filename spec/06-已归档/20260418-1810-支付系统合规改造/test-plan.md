---
title: 支付系统合规改造 — 测试计划
type: test-plan
category: 03-功能实现
status: 未确认
priority: 高
created: 2026-04-18
plan: "[[plan]]"
tags:
  - spec
  - test-plan
  - backend
  - payment
  - tax
  - ledger
---

# 支付系统合规改造 — 测试计划

## 0. 范围与策略

**测试对象**：本次 v0.2 支付合规改造的 14 个实现点（见 `plan.md` §5）。

**测试分层**：

| 层 | 工具 | 目标 |
|---|---|---|
| 单元（Unit） | `pytest` + `pytest-asyncio` + SQLite/Postgres testdb | 纯函数（税务策略、阶梯费率）+ Service 独立逻辑 |
| 集成（Integration） | `pytest` + Postgres testdb + transaction rollback | 跨服务 + DB 事务 + 账本平衡 + 状态机流转 |
| 端到端（E2E / API） | `fastapi.testclient.TestClient` | HTTP 端点 + Auth 依赖 + Schemas |
| 并发 / 幂等 | `asyncio.gather` + 手动触发 | `dispute_watcher` 多实例、webhook 重放、重复 release |
| 回归 | 现有 `@d:\project\CNVN\backend\tests\` 套件（删除/重写后） | 实现完成后未被本 Spec 涉及的用例仍全部通过 |

**重构策略（毫无兼容）**：无 Feature Flag；本 Spec 合并后旧结算路径在代码库不存在。现有 `@d:\project\CNVN\backend\tests\` 下任何依赖 `debit_for_lesson / credit_refund / credit_settlement / settlement_service` 的测试**必须删除或重写**，由本文档 §2.6 统一管理迁移映射。

## 1. 验收标准

本次改造**整体通过**的判定条件（必须**全部**满足）：

1. **功能闭环**：从学员下单 → 课程完成 → 24h 争议期 → 自动 release → 教师钱包入账，端到端一条链路可跑通
2. **资金守恒不变量**始终成立（见 §3 定义），任意一步后断言都为真
3. **状态机边界**：`PaymentOrder` / `PayoutOrder` / `Lesson` 三个状态机不能出现非法跃迁
4. **幂等性**：关键操作（webhook 回调、`release_payment_order`、`dispute_watcher.run_once`）重复调用结果不变
5. **税务快照不可变**：`SettlementSnapshot` 记录一旦写入，DB 层拒绝 UPDATE
6. **重构机械校验**：`grep -r 'debit_for_lesson\|credit_refund\|credit_settlement\|settlement_service' backend/` 返回空；`grep -r 'PLATFORM_FEE_RATE' backend/` 也返回空（旧单一费率已删）。保留的现有测试（未涉及被删接口的部分）全部通过
7. **代码覆盖率**：新增模块（`ledger_service`、`tax/`、`payment_service`、`payment/channels/`、`dispute_watcher`）行覆盖率 ≥ 85%
8. **性能**：`dispute_watcher.run_once(batch_size=100)` 在含 100 条 held 订单的 testdb 上 < 2s

## 2. 测试用例

### 2.1 单元测试（U-xxx）

| 用例编号 | 模块 | 描述 | 输入 | 预期输出 | 边界条件 |
|---|---|---|---|---|---|
| U-001 | `tax.cn_resident` | 固定 10% 税率计算 | `gross=500000, rate=0.2` | `net = 500000×0.8×0.9 = 360000`，`commission=100000`，`pit=40000`，`vat=0` | 整数向下取整策略 |
| U-002 | `tax.vn_passport_in_cn` | 同 U-001 公式 | `gross=500000, rate=0.15` | `net=382500, commission=75000, pit=42500` | 税率字段填对 |
| U-003 | `tax.vn_resident` | 同 U-001 公式（v0.2 占位） | `gross=1, rate=0.2` | `net=0, commission=0/1, pit=0/1` | **极小金额取整不丢钱**（守恒） |
| U-004 | `tax.get_strategy` | 工厂 | `'cn_resident'` | 返回 `CNResidentStrategy` 实例 | 未知 scenario 抛 `ValueError` |
| U-005 | `settlement.calculate_platform_fee_rate` | 阶梯费率（回归） | 教师月完课 19h / 20h / 21h / 50h / 51h | 0.20 / 0.20 / 0.15 / 0.15 / 0.10 | 边界 20/50 包含在较低档 |
| U-006 | `ledger_service.post_entries` | 账本平衡 | `entries=[('escrow', +100, 'debit'), ('escrow', -100, 'credit')]` | `txn_group_id` UUID | 单独户双向也成立 |
| U-007 | `ledger_service.post_entries` | 失衡拒绝 | `entries` sum=50 | `ValueError("借贷不平衡")` | 一定要在 DB 写入前拦截 |
| U-008 | `ledger_service.get_balance` | 查余额 | 连续 3 笔 entries | 累计正确 | 不存在的账户 → 0 或抛异常（选定一种） |
| U-009 | `channels.mock.create_charge` | 立即 paid | `PaymentOrder(status='pending')` | 返回 `status='paid'`, `paid_at` 非空 | `channel_txn_id` 非空 |
| U-010 | `channels.mock.handle_callback` | 幂等 | 同一 payload 调用 2 次 | 第 2 次无状态变化 | 不抛异常 |

### 2.2 集成测试（I-xxx）

#### 2.2.1 正常链路

| 用例编号 | 描述 | 关键断言 |
|---|---|---|
| I-001 | 学员下单 → `PaymentOrder(paid) → held`（未 completed 前） | Wallet(student) -= gross；`escrow += gross`；账本 entries 正确；`held_until IS NULL` |
| I-002 | 课程 end_lesson → `held_until = actual_end_at + 24h` | `PaymentOrder.status='held'`；`Lesson.status='dispute_window'`；无账本新事件 |
| I-003 | `release_payment_order` 手动触发 | `SettlementSnapshot` 写入；4 条账本 entries；`PayoutOrder.status='paid'`；Wallet(teacher) += net；`Lesson.status='settled'` |
| I-004 | `dispute_watcher.run_once` 处理过期单 | 同 I-003 断言 + 处理条数返回正确 |
| I-005 | 全链路 E2E（API） | `POST /lessons` → `POST /lessons/{id}/confirm` → `.../start` → `.../end` → 时间跳跃 → 查 `PayoutOrder` |

#### 2.2.2 状态机非法跃迁

| 用例编号 | 描述 | 预期 |
|---|---|---|
| I-006 | 未付款订单直接 release | 抛 `ValueError("订单状态非 held")` |
| I-007 | 已 released 订单再次 release | 幂等：无新账本 entries，无新 PayoutOrder |
| I-008 | 已 refunded 订单触发 release | 抛异常，无副作用 |
| I-009 | 课程未 `completed` 就进 `dispute_watcher` | 不处理（过滤条件不命中） |
| I-010 | 课前 24h+ 取消 → 全额退款路径 | `PaymentOrder.status='refunded'`；Wallet(student) += gross；`escrow -= gross` |
| I-011 | 课前 24h 内取消 → 不退款 | `Lesson.status='cancelled'`；`PaymentOrder.status` 保持 `held`（或定义为 `released → platform_revenue` 另记）※ 需与 spec-writer 对齐 |

> ⚠️ **I-011 边界待确认**：plan.md §3.4 未明确"课前 24h 内取消不退款"时资金最终流向。建议：保留 `held` 直到课程本应结束，再按常规 release 给教师（相当于学员违约，全额结算给教师）。此点提请用户在门禁 2 一并确认。

#### 2.2.3 资金守恒不变量

| 用例编号 | 描述 | 预期 |
|---|---|---|
| I-012 | 单笔下单付款后 | `Σ(ledger.balance) + Σ(wallet.balance) = Σ(topup)` |
| I-013 | 单笔 release 后 | 守恒仍成立 |
| I-014 | 单笔退款后 | 守恒仍成立 |
| I-015 | 混合场景：10 笔下单、6 笔 release、2 笔 refund、2 笔 held | 守恒成立 |

> **资金守恒不变量定义**：
> `Σ(ledger_accounts.balance for all 4 accounts) + Σ(wallets.balance for all users) == Σ(all historical 'topup' transactions amount)`
> 该不变量是路线 A 混合账本的核心正确性保证，每个集成测试 teardown 前必须断言。

#### 2.2.4 并发与幂等

| 用例编号 | 描述 | 预期 |
|---|---|---|
| I-016 | 同一 `PaymentOrder` 并发 2 个 `release_payment_order` | 只有一个成功，另一个返回已处理；无重复入账 |
| I-017 | `dispute_watcher.run_once` 并发 3 实例 | 所有 held 过期订单被处理且每单仅处理一次（`FOR UPDATE SKIP LOCKED` 生效） |
| I-018 | Mock webhook 同一 `order_id` 连续 3 次 | 第 1 次状态变更，后 2 次无副作用 |
| I-019 | `dispute_watcher.run_once` 重复跑 5 次 | 第 2 次起处理条数 = 0 |

#### 2.2.5 税务场景分流

| 用例编号 | 描述 | 预期 |
|---|---|---|
| I-020 | 未填 `TeacherTaxProfile` | 默认 `vn_resident`，10% 税率 |
| I-021 | 填 `cn_resident` | 策略选中 CNResident，快照 `tax_scenario='cn_resident'` |
| I-022 | 结算后补填 `TaxProfile`，再结算下一课 | 下一课按新场景计算（上一课快照不变） |

### 2.3 API 端点测试（A-xxx）

| 用例编号 | 路径 | 场景 | 预期 |
|---|---|---|---|
| A-001 | `POST /payments/orders` | 合法学员、合法课程 | 201 + `PaymentOrderOut`，status=`paid`/`held` |
| A-002 | `POST /payments/orders` | 已有活跃订单的课程再次下单 | 409 Conflict |
| A-003 | `POST /payments/webhook/mock` | 合法 payload | 200，订单状态更新 |
| A-004 | `POST /payments/webhook/mock` | 非法 `order_id` | 404 |
| A-005 | `GET /payouts/me` | Tutor 登录 | 200，仅返回自己的 PayoutOrder |
| A-006 | `GET /payouts/me` | 非 Tutor（学生）调用 | 403 |
| A-007 | `GET /payments/orders/{id}` | Order 所属学员 | 200 + 含 `settlement_snapshot` |
| A-008 | `GET /payments/orders/{id}` | 无关用户 | 403 |
| A-009 | 现有 `GET /wallet`、`POST /wallet/topup` | 任意用户 | 回归通过，无变化 |

### 2.4 数据库层测试（D-xxx）

| 用例编号 | 描述 | 预期 |
|---|---|---|
| D-001 | `SettlementSnapshot` UPDATE | DB trigger 抛异常，拒绝 |
| D-002 | `PaymentOrder.lesson_id` 部分唯一索引 | 同一课程两条 refunded + 一条 held 允许；两条 held 冲突 |
| D-003 | `LedgerEntry` 插入后删除 | 允许插入，**禁止删除**（业务层约束，不强制 DB 层） |
| D-004 | `ledger_accounts` 4 条种子数据 | `alembic upgrade head` 后存在 |
| D-005 | Alembic downgrade | `002_add_payment_v2_tables.py` 可逆 |

### 2.5 性能测试（P-xxx）

| 用例编号 | 描述 | 预期 |
|---|---|---|
| P-001 | `dispute_watcher.run_once` 处理 100 条 held 过期订单 | 端到端 < 2s |
| P-002 | 批量并发 10 个学员同时下单同一教师不同课程 | 无死锁，全部成功 |

## 3. 测试不变量与辅助断言

### 3.1 资金守恒

```python
async def assert_fund_conservation(db: AsyncSession):
    """单一数据源真相 = Σ(topup)，任何业务事件后必须守恒。"""
    ledger_total = await db.scalar(
        select(func.coalesce(func.sum(LedgerAccount.balance), 0))
    )
    wallet_total = await db.scalar(
        select(func.coalesce(func.sum(Wallet.balance), 0))
    )
    topup_total = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == 'topup')
    )
    assert ledger_total + wallet_total == topup_total, (
        f"守恒失败: ledger={ledger_total} wallet={wallet_total} topup={topup_total}"
    )
```

### 3.2 账本借贷平衡

```python
async def assert_txn_group_balanced(db, txn_group_id):
    total = await db.scalar(
        select(func.sum(LedgerEntry.amount))
        .where(LedgerEntry.txn_group_id == txn_group_id)
    )
    assert total == 0
```

### 3.3 状态机合法性

为每个状态机定义 `ALLOWED_TRANSITIONS: dict[str, set[str]]`，测试覆盖全部合法边 + 至少 3 条非法边。

## 4. 覆盖率要求

| 模块 | 行覆盖率目标 | 关键路径覆盖 |
|---|---|---|
| `app/services/ledger_service.py` | ≥ 90% | 全部 public 函数 + 借贷不平衡分支 |
| `app/services/tax/*.py` | ≥ 95% | 三个策略 × 正常 + 极小金额 |
| `app/services/payment_service.py` | ≥ 90% | 正常 + 所有状态机边界 |
| `app/services/payment/channels/mock.py` | ≥ 85% | create / callback / refund |
| `app/services/dispute_watcher.py` | ≥ 85% | 正常、空结果、重试失败 |
| `app/api/v1/payments.py` + `payouts.py` | ≥ 80% | 每个端点的成功 + 主要失败分支 |
| 总体新增代码 | ≥ 85% | — |

## 5. 测试环境要求

- **Python**：3.11+
- **Postgres testdb**：与生产同版本，不允许用 SQLite 替代（因依赖 `FOR UPDATE SKIP LOCKED` 和部分唯一索引）
- **pytest 依赖**：`pytest`, `pytest-asyncio`, `pytest-cov`, `httpx` (或 fastapi TestClient)
- **时间模拟**：用 `freezegun` 或显式注入 `now_fn` 依赖，以便测试 24h 争议期过期而不等待真实时间
- **数据夹具**：
  - `seed_users(student, teacher)` — 基础用户、教师档案、默认 TaxProfile、钱包充值
  - `seed_lesson(status='confirmed')` — 按状态生成 Lesson
  - `seed_paid_payment_order(lesson)` — 已付款+held 的订单，指定 `held_until`
- **测试数据库隔离**：每个测试用例 begin → run → rollback；跨测试不共享状态

## 6. 接口边界决议与旧测试迁移映射

### 6.1 已确认决议（2026-04-18 门禁 2 通过）

| 议题 | 决定 |
|---|---|
| 重构策略 | 彻底重构，无 Feature Flag，无兼容层，直接删除 MVP 结算源文件与相关测试 |
| `TeacherTaxProfile` 默认值 | `vn_resident` + 10%，未填时自动生成 |
| 取整策略（B2） | 守恒优先：所有金额 `int`（VND 最小单位），计算用 `Decimal`，最终 `int(...)` 截断；`commission_amount = gross - tutor_gross` 倒推保证 `commission + vat + pit + net == gross` |
| 课前<24h 取消（B1） | 订单保持 `held`，`held_until = scheduled_at + duration + 24h`，争议期过后按常规 release **全额结算给教师**（学员违约）；无新状态值 |
| Mock 通道 `paid` 时机 | `create_charge` 内同步置为 `paid`，不经过异步 webhook |
| `dispute_watcher` 失败重试 | 3 次后转人工（`status='held'` 保持，`retry_count` 记录；不自动转 `failed`） |

### 6.2 旧测试迁移映射（阶段 5 S5.7 的细化清单）

> spec-executor 在删除旧测试前，必须逐条对照本表确认"旧用例的验收意图已被新用例覆盖"。表格在 `spec-executor` 实施阶段 S5.7 时根据实际 `tests/` 文件树补齐（本 Spec 创建时尚未逐文件扫描，预计覆盖：`test_lessons.py`、`test_payments.py`、`test_settlement.py` 等）。

关键映射原则：

| 旧用例类型 | 新用例完整覆盖点 |
|---|---|
| 调用 `debit_for_lesson` 验证扣款 | I-001 —— 下单跟账 + Wallet -= gross |
| 调用 `credit_refund` 验证退款 | I-010 —— ≥24h 取消退款路径 |
| 调用 `credit_settlement` 验证入账 | I-003 / I-004 —— release 后教师 Wallet 增额 |
| `settle_teacher_lesson` 防重幂等 | I-007 —— 已 released 订单重复 release |
| 阶梯费率 | U-005 —— `payment_service.resolve_commission_rate` 给入边界 |
| 24h 取消权限与状态校验 | A-001/A-002（API） + I-011 新购定的资金流向 |

> 若上表中某个旧用例找不到新对应，**必须先回到 spec-writer 补充新用例，再删除旧测试**。不允许因为删除而陷入覆盖空白。

## 7. 文档关联

- 实现计划：[[plan|支付系统合规改造实现方案]]
- 探索报告：[[exploration-report|探索报告]]
- 测试报告（待 spec-tester 执行阶段产出）：[[test-report|测试报告]]
