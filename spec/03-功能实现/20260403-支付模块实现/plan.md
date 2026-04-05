---
title: 支付模块实现方案
type: plan
category: 03-功能实现
status: 未确认
priority: 高
created: 2026-04-03
execution_mode: single-agent
tags:
  - spec
  - plan
  - backend
  - payment
  - settlement
related:
  - "[[exploration-report|探索报告]]"
  - "[[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]]"
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 支付模块实现方案

## 1. 概述

### 1.1 背景

CNVN 中越通平台的支付模块需要实现课程结算功能。当前系统已有基础的钱包操作（充值、扣款、退款），但缺少教师结算入账和阶梯抽成计算逻辑。根据 PRD 需求，需要实现：

1. 课程完成时自动结算给教师（扣除平台抽成）
2. 根据教师月完课量计算阶梯抽成费率
3. 修改 24 小时取消规则（允许取消但不退款）
4. 新增交易类型支持

### 1.2 目标

1. 实现教师自动结算功能，课程完成后自动入账到教师钱包
2. 实现阶梯抽成费率计算（≤20h→20%、21-50h→15%、>50h→10%）
3. 修改课程取消逻辑，24 小时内允许取消但不退款
4. 新增 `settlement` 交易类型
5. 保证结算过程的数据一致性（防重复结算）

### 1.3 范围

**包含**：
- 课程完成时教师入账结算
- 阶梯抽成费率计算
- 24h 取消规则修正
- 新增 `settlement` 交易类型
- 防重复结算机制

**不包含**：
- 真实支付网关（MoMo/ZaloPay）集成（保持模拟充值）
- 自动化 T+1 定时任务（MVP 立即结算）
- 平台收入统计和报表
- 教师提现功能

## 2. 需求分析

### 2.1 功能需求

#### FR-001: 课程结算

**描述**：课程完成时，自动将课程金额扣除平台抽成后入账到教师钱包

**输入**：
- 课程记录（包含 price、teacher_id、student_id）
- 当前时间（用于计算月完课时）

**输出**：
- 教师钱包余额增加
- 创建 `settlement` 类型交易记录
- （可选）创建 `income` 类型平台收入记录

**业务规则**：
1. 平台抽成 = 课程价格 × 费率（阶梯计算）
2. 教师入账 = 课程价格 - 平台抽成
3. 只结算 `status=completed` 的课程
4. 同一课程只能结算一次

#### FR-002: 阶梯费率计算

**描述**：根据教师当月完课总时长计算平台抽成费率

**输入**：
- 教师ID
- 月份（默认当前月）

**输出**：
- 费率（0.20、0.15 或 0.10）

**业务规则**：
```
月完课时长（小时）    费率
≤ 20                 20%
21 - 50              15%
> 50                 10%
```

**边界处理**：
- ≤ 20h 用 20%
- 21 - 50h 用 15%
- > 50h 用 10%

#### FR-003: 24h 取消规则修正

**描述**：修改课程取消逻辑，允许 24 小时内取消，但不退款

**输入**：
- 课程ID
- 当前时间

**输出**：
- 课程状态改为 `cancelled`
- 不执行退款操作

**业务规则**：
- ≥ 24h：允许取消，全额退款
- < 24h：允许取消，不退款

### 2.2 数据需求

#### 新增交易类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `settlement` | 正数 | 教师结算入账 |
| `income` | 正数 | 平台收入（可选，用于统计） |

#### 可选模型扩展

**Lesson 模型**（可选新增字段）：
- `settled_at: datetime | None` - 记录结算时间，防重入
- `teacher_amount: int | None` - 记录教师实际入账金额

## 3. 设计方案

### 3.1 架构设计

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
│                    │ - credit_settlement() │                  │
│                    └──────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  Wallet, Transaction, Lesson (ORM Models)                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件设计

#### 3.2.1 settlement_service.py（新增）

**职责**：结算业务逻辑、阶梯费率计算

**核心方法**：

```python
async def calculate_platform_fee_rate(
    db: AsyncSession,
    teacher_id: str,
    month: date
) -> Decimal:
    """
    计算教师当月平台抽成费率

    规则：
    - 月完课 ≤ 20h：20%
    - 月完课 21-50h：15%
    - 月完课 > 50h：10%

    Args:
        db: 数据库会话
        teacher_id: 教师ID
        month: 目标月份

    Returns:
        费率（0.20、0.15 或 0.10）
    """

async def settle_teacher_lesson(
    db: AsyncSession,
    lesson: Lesson
) -> Transaction:
    """
    课程完成时结算给教师

    流程：
    1. 检查是否已结算（防重复）
    2. 计算阶梯费率
    3. 计算教师入账金额
    4. 给教师钱包入账
    5. 创建结算交易记录
    6. 标记课程已结算

    Args:
        db: 数据库会话
        lesson: 课程记录

    Returns:
        结算交易记录
    """
```

#### 3.2.2 wallet_service.py（扩展）

**新增方法**：

```python
async def credit_settlement(
    db: AsyncSession,
    user_id: str,
    amount: int,
    lesson_id: str | None = None
) -> Transaction:
    """
    教师结算入账

    Args:
        db: 数据库会话
        user_id: 用户（教师）ID
        amount: 入账金额（正数）
        lesson_id: 关联课程ID

    Returns:
        交易记录
    """
```

#### 3.2.3 lesson_service.py（修改）

**修改点**：

1. `end_lesson()` 方法：增加结算调用
2. `cancel_lesson()` 方法：修改 24h 逻辑

```python
# end_lesson() 修改后流程
async def end_lesson(db, lesson_id, user_id, ...):
    # 1. 权限校验
    # 2. 状态校验
    # 3. 更新状态为 completed
    # 4. 【新增】调用 settle_teacher_lesson()
    await settlement_service.settle_teacher_lesson(db, lesson)
    # 5. 返回结果
```

```python
# cancel_lesson() 修改后流程
async def cancel_lesson(db, lesson_id, user_id, ...):
    # 1. 权限校验
    # 2. 状态校验
    # 3. 计算 24h 逻辑
    if hours_until_start < 24:
        # 【修改】允许取消，但不退款
        # 只改状态，不调用 credit_refund()
    else:
        # ≥ 24h：允许取消，全额退款
        await wallet_service.credit_refund(...)
    # 4. 返回结果
```

### 3.3 数据流设计

#### 课程完成结算流程

```
用户调用 POST /lessons/{id}/end
       │
       ▼
lesson_service.end_lesson()
       │
       ├─▶ 权限校验
       ├─▶ 状态校验
       ├─▶ 更新状态 → completed
       │
       └─▶ settlement_service.settle_teacher_lesson()
              │
              ├─▶ 检查是否已结算（防重）
              ├─▶ calculate_platform_fee_rate()
              │       │
              │       └─▶ 查询教师月完课时
              │       └─▶ 计算阶梯费率
              │
              ├─▶ 计算入账金额 = price × (1 - rate)
              ├─▶ wallet_service.credit_settlement()
              │       │
              │       └─▶ 更新钱包余额
              │       └─▶ 创建 Transaction(type=settlement)
              │
              └─▶ 标记课程已结算
```

### 3.4 配置变更

**config.py**：

```python
# 阶梯费率配置
COMMISSION_TIER_1_RATE: Decimal = Decimal("0.20")  # ≤20h
COMMISSION_TIER_1_HOURS: int = 20

COMMISSION_TIER_2_RATE: Decimal = Decimal("0.15")  # 21-50h
COMMISSION_TIER_2_HOURS: int = 50

COMMISSION_TIER_3_RATE: Decimal = Decimal("0.10")  # >50h
```

> [!tip] 费率计算逻辑封装在 settlement_service 中，config 只存储常量

## 4. 执行模式

### 执行模式选择

**推荐模式**：单 Agent（single-agent）

**选择理由**：
1. 本次实现主要涉及后端代码修改（Service 层扩展），无并发开发需求
2. 接口边界清晰，基于现有代码结构扩展
3. 无复杂的前后端联调场景
4. 单 Agent 可确保代码风格一致性

## 5. 实现步骤

### 5.1 阶段 1：基础结构（30 分钟）

- [ ] 创建 `settlement_service.py` 文件
- [ ] 实现 `calculate_platform_fee_rate()` 方法
- [ ] 实现 `settle_teacher_lesson()` 方法骨架

### 5.2 阶段 2：Wallet 扩展（15 分钟）

- [ ] 在 `wallet_service.py` 中新增 `credit_settlement()` 方法
- [ ] 确保行级锁正确应用

### 5.3 阶段 3：Lesson Service 集成（30 分钟）

- [ ] 修改 `lesson_service.end_lesson()` 集成结算逻辑
- [ ] 修改 `lesson_service.cancel_lesson()` 修改 24h 规则
- [ ] 确保事务边界正确

### 5.4 阶段 4：配置和测试（15 分钟）

- [ ] 更新 `config.py` 添加阶梯费率配置
- [ ] 手动测试验证核心流程
- [ ] 检查边界情况（重复结算、费率边界）

### 5.5 阶段 5：文档和收尾（15 分钟）

- [ ] 更新相关文档
- [ ] 代码审查和格式化

## 6. 风险和依赖

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 并发结算（同一课程多次结算） | 高 | 中 | 在 `settle_teacher_lesson()` 中检查 `settled_at` 字段，使用数据库事务保证原子性 |
| 月完课统计跨时区问题 | 中 | 低 | 使用 UTC 统一处理，查询时按教师时区或 UTC 转换 |
| 阶梯费率边界处理（20h、50h） | 中 | 中 | 明确规则：≤20h 用 20%，21-50h 用 15%，>50h 用 10%。添加单元测试验证 |
| 24h 取消退款逻辑漏洞 | 中 | 低 | 保留现有退款逻辑，只修改 24h 分支，确保 ≥24h 仍正常退款 |

**依赖项**：
- 现有 `wallet_service.py` 的 `get_wallet_by_user_id(lock=True)` 方法
- 现有 `lesson_service.py` 的 `end_lesson()` 和 `cancel_lesson()` 方法
- 数据库已有 `Wallet` 和 `Transaction` 模型

## 7. 文档关联

- 实现总结: [[summary|实现总结]] (待创建)
- 测试计划: [[test-plan|测试计划]] (待创建，由 spec-tester 创建)
- 参见 [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]] 中的 FR-005 支付与抽成
- 参见 [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
