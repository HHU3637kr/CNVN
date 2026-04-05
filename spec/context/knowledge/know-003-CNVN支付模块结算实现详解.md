---
id: KNOW-003
title: CNVN 支付模块结算实现详解
type: 项目理解
keywords: [CNVN, 支付, 结算, 阶梯费率, 钱包, 数据流, 交易类型]
created: 2026-04-03
related:
  - "[[know-002-CNVM支付模块现状与缺口分析|支付模块缺口分析]]"
  - "[[../../../03-功能实现/20260403-支付模块实现/plan|支付模块实现方案]]"
---

# CNVN 支付模块结算实现详解

## 概述

支付模块已完成教师结算功能的实现，包括阶梯抽成计算、防重复结算机制和 24h 取消规则修正。本文档详细记录实现后的架构、数据流和关键组件。

---

## 核心架构

### 分层结构

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  lessons.py (end_lesson, cancel_lesson)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ lesson_service   │───▶│ settlement_service│              │
│  │                  │    │                  │              │
│  │ - end_lesson()   │    │ - calculate_fee()│              │
│  │ - cancel_lesson()│    │ - settle_lesson()│              │
│  └──────────────────┘    └──────────────────┘              │
│                              │                              │
│                              ▼                              │
│                    ┌──────────────────┐                     │
│                    │ wallet_service   │                     │
│                    │                  │                     │
│                    │ - credit_settlement()                  │
│                    └──────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  Wallet, Transaction, Lesson (ORM Models)                   │
└─────────────────────────────────────────────────────────────┘
```

### 设计考量

**为什么 settlement_service 独立于 wallet_service？**

| 服务 | 职责 | 边界 |
|------|------|------|
| `settlement_service` | 结算业务逻辑、阶梯费率计算 | 知道"如何计算费率"、"何时结算" |
| `wallet_service` | 钱包基础操作（入账、出账、查询） | 只负责"余额变动"、"交易记录" |

这样设计的好处：
- **单一职责**：结算逻辑复杂（费率计算、月统计），独立出来便于维护
- **可复用性**：`wallet_service` 保持通用，不依赖结算业务
- **可测试性**：费率计算可独立测试

---

## 数据流

### 课程完成结算流程

```
用户调用 POST /api/v1/lessons/{id}/end
       │
       ▼
lesson_service.end_lesson()
       │
       ├─▶ 权限校验（教师或管理员）
       ├─▶ 状态校验（必须是 in_progress）
       ├─▶ 更新状态 → completed
       │   设置 actual_end_at = now()
       │
       └─▶ settlement_service.settle_teacher_lesson(lesson)
              │
              ├─▶ 防重复检查：if lesson.settled_at: return
              │
              ├─▶ calculate_platform_fee_rate(teacher_id, month)
              │       │
              │       ├─▶ 计算月份范围（UTC）
              │       ├─▶ 查询当月 completed 课程
              │       ├─▶ 累计 duration_minutes
              │       └─▶ 返回阶梯费率（20%/15%/10%）
              │
              ├─▶ 计算金额
              │   teacher_amount = price × (1 - fee_rate)
              │
              ├─▶ 通过 TeacherProfile 获取 teacher_user_id
              │
              ├─▶ wallet_service.credit_settlement()
              │       │
              │       ├─▶ 行级锁获取钱包
              │       ├─▶ 增加余额
              │       └─▶ 创建 Transaction(type='settlement')
              │
              └─▶ 标记课程已结算
                  lesson.settled_at = now()
                  lesson.teacher_amount = teacher_amount
                  lesson.platform_fee_rate = fee_rate
```

---

## 关键功能

### 1. 阶梯费率计算

**规则**：
```
月完课时长（小时）    费率
≤ 20                 20%
21 - 50              15%
> 50                 10%
```

**实现位置**：`settlement_service.py::calculate_platform_fee_rate()`

**关键点**：
- 使用 UTC 时间按月统计（避免时区混乱）
- 统计 `status=completed` 且 `actual_end_at` 在当月的课程
- 累计 `duration_minutes` 后除以 60 转小时
- 边界处理：`<= 20` 用 20%，`<= 50` 用 15%，否则 10%

### 2. 防重复结算

**实现位置**：`settlement_service.py::settle_teacher_lesson()`

**机制**：
- 入口检查：`if lesson.settled_at is not None: return`
- 事务保证：整个结算流程在一个事务中
- 标记字段：`settled_at`、`teacher_amount`、`platform_fee_rate`

### 3. 24h 取消规则

**规则**：
- `≥ 24h`：允许取消，全额退款
- `< 24h`：允许取消，不退款

**实现位置**：`lesson_service.py::cancel_lesson()`

**关键修改**：原逻辑是 `< 24h` 直接 `raise ValueError`，现改为允许取消但跳过退款调用。

---

## 交易类型

| 类型 | 方向 | 说明 | 金额符号 |
|------|------|------|----------|
| `topup` | 正数 | 用户充值 | +amount |
| `payment` | 负数 | 学生支付课程 | -amount |
| `refund` | 正数 | 课程退款 | +amount |
| `settlement` | 正数 | 教师结算入账（新增） | +amount |

---

## 数据库变更

### Lesson 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `settled_at` | `datetime \| NULL` | 结算时间，防重入标记 |
| `teacher_amount` | `int \| NULL` | 教师实际入账金额 |
| `platform_fee_rate` | `Decimal \| NULL` | 实际结算使用的费率 |

**迁移文件**：`backend/alembic/versions/001_add_settlement_fields.py`

---

## 配置变更

### config.py

```python
# 阶梯费率配置
COMMISSION_TIER_1_RATE: Decimal = Decimal("0.20")  # ≤20h
COMMISSION_TIER_1_HOURS: int = 20

COMMISSION_TIER_2_RATE: Decimal = Decimal("0.15")  # 21-50h
COMMISSION_TIER_2_HOURS: int = 50

COMMISSION_TIER_3_RATE: Decimal = Decimal("0.10")  # >50h
```

---

## 未实现功能（按 plan.md）

- 真实支付网关集成（MoMo/ZaloPay）
- T+1 定时任务结算（MVP 采用立即结算）
- 平台收入统计和报表
- 教师提现功能
- `income` 交易类型（平台收入记录）

---

## 相关文件

| 类型 | 文件路径 |
|------|----------|
| Service | `backend/app/services/settlement_service.py` |
| Service | `backend/app/services/wallet_service.py` |
| Service | `backend/app/services/lesson_service.py` |
| Model | `backend/app/models/payment.py` |
| Model | `backend/app/models/lesson.py` |
| Model | `backend/app/models/teacher_profile.py` |
| Config | `backend/app/config.py` |
| Migration | `backend/alembic/versions/001_add_settlement_fields.py` |
| Test | `backend/tests/api/v1/test_payment_settlement.py` |
