---
title: 支付系统合规改造 — 探索报告
type: exploration-report
category: 03-功能实现
status: 已完成
priority: 高
created: 2026-04-18
tags:
  - spec
  - exploration
  - backend
  - payment
  - tax
  - escrow
related:
  - "[[../20260403-支付模块实现/plan|MVP 支付模块实现方案]]"
  - "[[../20260403-支付模块实现/summary|MVP 支付模块实现总结]]"
---

# 支付系统合规改造 — 探索报告

## 0. 任务背景

MVP（tag `v0.1.0-mvp`）已完成最基础的「学员扣款 → 阶梯抽成 → 教师钱包入账」链路。本次任务是**v0.2 合规骨架**改造，对标 `docs/税务报告.docx`（V2.0）要求：

- 资金六阶段时序（T+0 → T+2）含 **24h 争议期** 作为关键控制点
- **代收托管账户**：学员资金结算前属于"负债"，与平台运营账户隔离
- **Tutor 三类税务场景**：CN 居民 / 在华越南人 / 越南居民（本次简化：场景三暂用固定 10%，不做累进）
- 结算不可变快照（佣金 / VAT / PIT 分项）

> **路线确认：路线A — 合规骨架**
> Mock 渠道（保留 Channel Adapter 接口）+ 混合账本（系统户复式 + 用户 Wallet）+ 三场景分流简化税务 + VND 内部单一币种。

## 1. 检索到的历史经验

通过扫描 `@d:\project\CNVN\spec\context\` 索引（当前无 `exp-search` CLI，改用 Read 方式）：

| 记忆 ID | 标题 | 对本次任务的启示 |
|---|---|---|
| **EXP-002** | 支付模块结算防重与数据模型关联 | 资金操作防重机制：**数据库状态字段（如 `settled_at`）+ 事务**保证幂等；`Lesson.teacher_id` 指向 `TeacherProfile.id`，取教师 `User.id` 需中转 `TeacherProfile` 查询 |
| **KNOW-002** | CNVN 支付模块现状与缺口分析 | MVP 缺口：无真实渠道、无 T+1 定时任务、无平台收入报表、无教师提现。本次任务覆盖其中"T+1"相关（改用"24h 争议期后 release"模式） |
| **KNOW-003** | 支付模块结算实现详解 | 已落地的阶梯费率、24h 规则、防重机制，是本次改造的起点。必须兼容向后（已有 Lesson 的 `settled_at` / `teacher_amount` 字段继续沿用） |

**关键启示**：
- 防重设计要保留，并扩展到 `PaymentOrder` / `PayoutOrder` 层
- 24h 取消规则 **不等于** 24h 争议期。取消是"课前 24h"，争议期是"课后 24h"，需分清
- `Lesson.teacher_id` → `TeacherProfile.id` 的中转模式要在新税务查询中沿用

## 2. 项目现状分析

### 2.1 已落地的支付相关代码

| 文件 | 职责 | 现状 |
|---|---|---|
| `@d:\project\CNVN\backend\app\models\payment.py:11-52` | `Wallet` / `Transaction` ORM | 用户级钱包 + 交易流水，`Transaction.type` 目前支持 `topup/payment/refund/settlement` |
| `@d:\project\CNVN\backend\app\models\lesson.py:32-46` | 课程字段 | 含 `price`、`platform_fee_rate`（Numeric(3,2)）、`settled_at`、`teacher_amount`，**无 VAT / PIT / 税务场景** 字段 |
| `@d:\project\CNVN\backend\app\services\wallet_service.py` | 钱包原子操作 | `topup / debit_for_lesson / credit_refund / credit_settlement`，均用 `with_for_update()` 加行锁 |
| `@d:\project\CNVN\backend\app\services\settlement_service.py` | 结算逻辑 | `calculate_platform_fee_rate()` 阶梯费率 + `settle_teacher_lesson()` 一次性结算，**无托管、无争议期、无分税** |
| `@d:\project\CNVN\backend\app\services\lesson_service.py:334-354` | `end_lesson` | **直接触发结算**，没有"先 hold 再 release"的两步状态 |
| `@d:\project\CNVN\backend\app\services\lesson_service.py:276-314` | `cancel_lesson` | 课前 24h 规则（与争议期无关） |
| `@d:\project\CNVN\backend\app\api\v1\payments.py` | HTTP 端点 | 仅 `GET /wallet`、`GET /wallet/transactions`、`POST /wallet/topup` |
| `@d:\project\CNVN\backend\app\config.py:41-46` | 阶梯费率配置 | `COMMISSION_TIER_*`，无税率/币种配置 |

### 2.2 用户侧字段缺口

- `@d:\project\CNVN\backend\app\models\user.py:11-40` 无税务居住地字段
- `@d:\project\CNVN\backend\app\models\teacher_profile.py:12-53` 有 `currency`（默认 VND）和 `hourly_rate`，**无税务场景、CCCD、vn_tax_code、居住天数** 等字段

### 2.3 资金流现状 vs 报告要求

```
现状：      [学员钱包] --debit--> (扣除) --credit--> [教师钱包]     (同一事务，即时完成)
报告要求：  [学员钱包] --hold---> [托管户] --(24h)--> [税务拆分] --> [教师净到账]
                                    ↓                    ↓
                                 [平台营收]          [应缴税金户]
```

差距：**缺少托管户**、**缺少争议期状态机**、**缺少税务拆分快照**、**缺少 Payout 概念**。

## 3. 外部知识（报告要点抽取）

来自 `docs/税务报告.docx`（暂不入库，仅作参考；关键节点摘录到本报告）：

### 3.1 资金流六阶段（§2.1）

| 阶段 | 时点 | 系统动作 |
|---|---|---|
| 1 | T+0 学员下单 | 付款进入**代收托管账户**（非平台资产） |
| 2 | 课中 | 资金冻结状态 |
| 3 | T+0～T+1 课程完成 | 教师/学员确认 |
| 4 | **T+1 起 24h 争议期** | 无争议自动通过；有争议进入人工 |
| 5 | T+1 内部处理 | 按场景拆分：佣金、VAT、PIT、净额 |
| 6 | T+2 | Tutor 净额打款 |

### 3.2 Tutor 三类税务场景（§4）

| 场景 | 身份 | 核心规则 | 本次落地深度 |
|---|---|---|---|
| 一 | 中国大陆居民 | 适用中越 DTA，越南端按非居民代扣 | 固定税率（本次用 10%，后续按 DTA 细化） |
| 二 | 在华越南人 | 双重税务风险最高，183 天追踪 | 固定税率 + `vn_residency_days_ytd` 字段预留 |
| 三 | 越南居民 | 累进 PIT 5%-35% + 100M VAT 门槛 | **本次简化为固定 10%**，累进与 VAT 门槛延后 v0.3 |

### 3.3 单笔订单资金拆分公式（§2.2）

```
gross           = 学员支付金额（VND，含 VAT）
commission      = gross × platform_fee_rate
tutor_gross     = gross - commission
vat             = tutor_gross × vat_rate
pit             = (tutor_gross - vat) × pit_rate
net             = tutor_gross - vat - pit
```

本次作为不可变 `SettlementSnapshot` 存储，结算后不再动。

### 3.4 合规硬约束（§6 & §9）

- 托管户**不可挪用**，需独立银行户 + 账务隔离
- 原始交易数据**不可直传中国境内服务器**（v0.2 暂不涉及跨境同步，本条记在 out-of-scope）
- 所有身份核验记录**留存 10 年**（本次只保证字段设计允许，不实现自动归档）

## 4. 对 Spec 创建的建议

### 4.1 建议的实现方向

**数据层（优先级 P0，必做）**：

1. 新表 `payment_orders`：学员付款单。状态 `pending → paid → held → released / refunded / disputed`
2. 新表 `payout_orders`：Tutor 出款单。状态 `pending → released → paid / failed`
3. 新表 `settlement_snapshots`：不可变快照。按拆分公式落库
4. 新表 `ledger_accounts` + `ledger_entries`：**系统户**复式账本（托管户 / 平台营收户 / 应缴税金户）
5. 新表 `teacher_tax_profiles`：Tutor 税务档案（`tax_scenario`、`id_doc_no`、`vn_tax_code`、`vn_residency_days_ytd`、`kyc_verified_at`）

**服务层（P0）**：

6. 新模块 `app/services/tax/`：`base.TaxStrategy` 接口 + 三场景子类。入参 `(gross, teacher_tax_profile)`，出参 `SettlementSnapshot`
7. 新模块 `app/services/payment/channels/`：`ChannelAdapter` 基类 + `MockChannel` 实现
8. 重构 `settlement_service.settle_teacher_lesson`：拆成 `hold_payment_for_lesson` / `release_after_dispute_window` 两步；课程完成时只创建 `PayoutOrder(status=pending)` + 计算 `held_until = completed_at + 24h`
9. 新定时任务 `dispute_watcher`：扫描 `held_until < now()` 的 held 单，调用税务策略 → 落快照 → 转 released → 入教师钱包
10. `wallet_service` 改造：新增 `hold_for_lesson` 语义（学员钱包 -X，托管户 +X 同笔账本条目）

**接口层（P0）**：

11. 新端点 `POST /payments/orders`、`POST /payments/webhook/{channel}`（Mock 回调）、`GET /payouts/me`

**兼容（P1）**：

12. 已有 `Lesson.settled_at / teacher_amount / platform_fee_rate` 保留但语义收窄为"最终结算快照摘要"，具体数据以 `SettlementSnapshot` 为准
13. MVP 的直接结算路径走向"立刻 hold + 立刻 release（跳过争议期）"作为 feature flag，便于回滚测试

### 4.2 已知的边界情况和风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 现有 `debit_for_lesson` 是"创建课程即扣钱"，与"先 hold 后 release"的两步模型冲突 | 改造 `create_lesson`：扣款 → 同时创建 `PaymentOrder(status=paid)` 并立刻进 `held` 状态 |
| R2 | 争议期定时任务的幂等性 | 用 `PaymentOrder.status=held AND held_until<now() FOR UPDATE SKIP LOCKED` 保证单次处理 |
| R3 | 旧的 `Lesson.settled_at` 字段语义变化 | 保留但逐步由 `SettlementSnapshot.id` 引用替代；迁移时按存量数据补生成快照 |
| R4 | 退款路径：课前 24h 取消 vs 争议期申诉成功，两条路径 | 统一走 `PaymentOrder.refund()` 出口；前者直接从 held 到 refunded，后者从 held 到 disputed 再到 refunded |
| R5 | Mock 渠道的"webhook 回调"在单元测试中如何模拟 | 提供 `POST /payments/webhook/mock` 端点 + 测试夹具直接调用 ChannelAdapter 的 `simulate_callback()` |
| R6 | 复式账本和用户 Wallet 并存的边界 | 明确规则：系统户（托管/营收/税金）用账本；用户可提现余额用 Wallet。文档列出每个场景走哪条路径 |
| R7 | `TeacherTaxProfile` 字段未填时的默认行为 | 未填 → 默认 `场景三 / 固定 10%`（最接近合规且最保守）+ 在 Tutor 开通页强制引导补全 |

### 4.3 可复用的现有组件

- `@d:\project\CNVN\backend\app\services\wallet_service.py` 的行锁模式（`with_for_update()`）→ 账本扣减直接沿用
- `Transaction` 表可扩展 `type` 枚举：新增 `hold / release / tax_withhold / payout`
- 现有 `Lesson.platform_fee_rate` → 迁移到 `SettlementSnapshot.commission_rate`
- `settings.COMMISSION_TIER_*` 阶梯费率沿用，税率新增 `settings.VAT_RATE`、`settings.PIT_RATE_CN_RESIDENT` 等

### 4.4 明确 out-of-scope（v0.2 不做）

- 真实 VNPay / MoMo 接入（仅 Mock）
- 场景三的累进 PIT 计算与年度累计追踪（暂用固定 10%）
- 场景三的 100M VND VAT 豁免门槛追踪
- DTA 退税申请流程
- 教师提现申请（`PayoutOrder → 银行` 的出款链路只模拟）
- 跨境数据脱敏回传中国母公司
- 历史数据迁移（本次作为"新订单走新流程"，旧 Lesson 保持原状态）

## 5. 产出物路径

- 探索报告（本文件）：`@d:\project\CNVN\spec\03-功能实现\20260418-1810-支付系统合规改造\exploration-report.md`
- 实现计划（待 spec-writer 产出）：同目录 `plan.md`
- 测试计划（待 spec-tester 产出）：同目录 `test-plan.md`

## 6. 给 spec-writer / spec-tester 的交接说明

**spec-writer** 可直接从 §4.1 建议的 5 + 6 + 3 = 14 个实现点起草 plan.md；数据模型字段已详尽，只需补 ERD 图与迁移顺序。

**spec-tester** 关注 §4.2 的 R1-R7 七个风险点作为测试场景种子；建议补充：
- 并发下单时托管户扣减一致性（账本复式平衡校验）
- 争议期定时任务的幂等测试（重复跑 N 次结果不变）
- 税务场景切换测试（未填 → 默认场景三；后补 → 下次结算生效）
