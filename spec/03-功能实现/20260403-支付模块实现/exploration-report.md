---
title: 支付模块 - 探索报告
type: exploration-report
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - backend
  - payment
  - settlement
  - wallet
  - commission
related:
  - "[[plan|实现计划]]"
  - "[[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]]"
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 探索报告：支付模块

## 1. 检索到的历史经验

### [EXP-001] FastAPI 教师路由顺序与 PostgreSQL 教师搜索实现
- **相关点**：教师搜索时使用了 `scalar_subquery()` 进行全表最大值查询，用于归一化排序
- **可复用**：阶梯费率计算时需要查询教师月完课时，可参考类似的子查询模式

### [KNOW-001] CNVN 后端预约与教师模块要点
- **钱包现状**：已实现模拟充值、扣款（payment）、退款（refund），但无教师结算（settlement）类型
- **课程状态机**：`end_lesson()` 已存在，但只改状态到 `completed`，无资金操作
- **24h 规则**：当前是「24小时内禁止取消」，PRD 要求「24小时内取消不退款」
- **配置**：`PLATFORM_FEE_RATE` 固定 15%，PRD 要求阶梯费率

## 2. PRD 中的支付需求分析

### FR-005：支付与抽成

**业务规则**：
1. **支付方式**：MoMo、ZaloPay、银行转账（MVP 阶段：模拟充值）
2. **阶梯抽成规则**：
   - 月完课 ≤ 20 小时：抽成 20%
   - 月完课 21–50 小时：抽成 15%
   - 月完课 > 50 小时：抽成 10%
3. **结算时机**：课程完成后 T+1 结算给老师
4. **预付款模式**：学生预付款，课程完成后才向老师释放

### FR-003（取消规则）
- **原文**：「课程取消须提前 24 小时，否则不退款」
- **当前实现**：`cancel_lesson()` 在 `< 24h` 时直接拒绝（`raise ValueError`）
- **需要改为**：允许取消，但不退款

## 3. 项目现状分析

### 3.1 已有数据模型

**Lesson 模型**（`models/lesson.py`）：
- `price: int` - 课程价格（VND 整数）
- `platform_fee_rate: Decimal` - 平台费率（创建时写入，当前固定 0.15）
- `status: str` - 状态流转：`pending_confirmation → confirmed → in_progress → completed`
- `actual_end_at: datetime` - 实际结束时间（用于 T+1 结算）

**Transaction 模型**（`models/payment.py`）：
- `type: str` - 当前类型：`topup`, `payment`, `refund`
- `amount: int` - 金额（正数为入账，负数为出账）
- `lesson_id: uuid | None` - 关联课程

**缺失**：`settlement`（教师入账）和 `income`（平台收入）类型

### 3.2 已有服务接口

**wallet_service.py**：
- `debit_for_lesson()` - 学生扣款（创建预约时调用）
- `credit_refund()` - 退款（取消课程时调用）
- `topup()` - 模拟充值

**缺失**：教师结算入账函数

**lesson_service.py**：
- `end_lesson()` - 当前只改状态，需增加结算逻辑
- `cancel_lesson()` - 当前 `< 24h` 拒绝取消，需改为允许但不退款

### 3.3 配置

**config.py**：
- `PLATFORM_FEE_RATE: Decimal = Decimal("0.15")` - 固定 15%
- 需改为阶梯费率配置或计算函数

## 4. 核心功能缺口

### 4.1 教师结算（课程完成时入账）
**现状**：`end_lesson()` 只改状态
**需求**：
1. 计算教师应得：`teacher_amount = price * (1 - platform_fee_rate)`
2. 给教师钱包入账
3. 记录 `Transaction(type='settlement', amount=+teacher_amount)`
4. （可选）记录平台收入 `Transaction(type='income', amount=+platform_fee)`

### 4.2 阶梯费率计算
**现状**：固定 15%
**需求**：
1. 查询教师月完课时（`status=completed` 且在本月）
2. 按阶梯返回费率：
   ```
   if total_hours <= 20: return 0.20
   elif total_hours <= 50: return 0.15
   else: return 0.10
   ```

### 4.3 新增交易类型
**现状**：`topup`, `payment`, `refund`
**需求**：
- `settlement` - 教师结算入账（正数）
- `income` - 平台收入记录（可选，用于统计）

### 4.4 24 小时取消规则
**现状**：`< 24h` 禁止取消
**需求**：允许取消，但不退款
**修改点**：`cancel_lesson()` 中的逻辑分支

### 4.5 T+1 结算
**现状**：课程完成时立即结算
**需求**：MVP 阶段可保持立即结算，后续改为定时任务
**建议**：MVP 期间在 `end_lesson()` 中直接结算，便于测试

## 5. 对 Spec 创建的建议

### 5.1 实现方向

1. **新增 `settlement_service.py`**：
   - `calculate_platform_fee_rate(teacher_id, month)` - 计算阶梯费率
   - `settle_teacher_lesson(db, lesson: Lesson)` - 教师入账
   - （预留）`batch_settle_pending_lessons()` - T+1 批量结算

2. **修改 `lesson_service.py`**：
   - `end_lesson()` 调用 `settle_teacher_lesson()`
   - `cancel_lesson()` 修改 24h 逻辑

3. **扩展 `wallet_service.py`**：
   - 新增 `credit_settlement()` - 教师入账

4. **Schema 扩展**：
   - `schemas/payment.py` 增加 `SettlementOut`（如有需要）

### 5.2 已知的边界情况和风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| 并发结算 | 同一课程可能被多次结算 | 在 `settle_teacher_lesson()` 中检查 `lesson.settled_at` 字段或使用事务 |
| 月完课统计 | 需按自然月统计，跨时区问题 | 使用 `actual_end_at` + 教师时区或 UTC 统一 |
| 24h 取消退款 | 学生可能滥用取消 | 保留「24小时内不退款」规则，无特殊理由不退款 |
| 阶梯费率边界 | 20h 和 50h 的边界处理 | 明确规则：≤20h 用 20%，21-50h 用 15%，>50h 用 10% |

### 5.3 可复用的现有组件

- `wallet_service.get_wallet_by_user_id(lock=True)` - 扣款/入账的行级锁
- `lesson_service._price_vnd()` - 计价逻辑
- 预约模块的时区处理（`ensure_utc()`）
- PRD 中的阶梯费率定义（直接引用）

### 5.4 MVP 范围建议

**包含**：
- 课程完成时教师入账
- 阶梯费率计算
- 24h 取消规则修改
- 新增 `settlement` 交易类型

**不包含**（明确说明）：
- 真实支付网关（MoMo/ZaloPay）集成 - 保持模拟充值
- 自动化 T+1 定时任务 - MVP 立即结算
- 平台收入统计 - 可后续扩展

## 6. 数据库变更建议

### 6.1 Transaction.type 扩展
- 当前已有：`topup`, `payment`, `refund`
- 新增：`settlement`（必须），`income`（可选）

### 6.2 Lesson 模型（可选）
- 可增加 `settled_at: datetime | None` - 记录结算时间，防重入
- 可增加 `teacher_amount: int | None` - 记录教师实际入账金额

## 7. API 端点建议

**MVP 阶段不需要新增 HTTP 端点**：
- 结算逻辑在 `end_lesson()` 内部自动完成
- 教师可通过 `GET /wallet/transactions` 查看入账记录

**未来扩展**：
- `POST /settlements/withdraw` - 教师提现
- `GET /settlements/summary` - 结算统计（本月收入、待结算等）
