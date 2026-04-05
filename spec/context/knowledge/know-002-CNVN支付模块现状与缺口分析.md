---
id: KNOW-002
title: CNVN 支付模块现状与缺口分析
type: 项目理解
keywords: [CNVN, 支付, 结算, 阶梯费率, 钱包, 课程状态机, T+1]
created: 2026-04-03
---

# CNVN 支付模块现状与缺口分析

## 概述

分析 CNVN 后端支付相关模块的当前实现状态，识别 PRD 需求与现有代码之间的差距，为支付模块实现 Spec 提供背景。

## 现状分析

### 已有能力

| 组件 | 当前状态 |
|------|----------|
| 钱包操作 | 模拟充值、学生扣款、退款 |
| 课程状态机 | 创建 → 确认 → 进行中 → 完成 |
| 24h 取消规则 | 当前是「24小时内禁止取消」 |
| 平台费率 | 固定 15% |

### 核心缺口

#### 1. 教师结算
- `end_lesson()` 只改状态到 `completed`，无资金操作
- 缺 `settlement` 交易类型
- `Lesson` 模型无 `settled_at` / `teacher_amount` 字段

#### 2. 阶梯费率
- PRD 要求：≤20h→20%、21-50h→15%、>50h→10%
- 当前实现：固定 15%（`config.PLATFORM_FEE_RATE`）

#### 3. 24h 取消规则
- PRD 要求：「24小时内取消不退款」
- 当前实现：`cancel_lesson()` 在 `< 24h` 时直接 `raise ValueError`

#### 4. T+1 结算
- PRD 要求：教师结算 T+1 到账
- MVP 建议：立即结算（便于测试，后续改为定时任务）

## 实现建议

### 新增服务
- `settlement_service.py`：
  - `calculate_platform_fee_rate(teacher_id, month)` - 计算阶梯费率
  - `settle_teacher_lesson(db, lesson: Lesson)` - 教师入账
  - （预留）`batch_settle_pending_lessons()` - T+1 批量结算

### 修改现有
- `lesson_service.end_lesson()`：调用结算逻辑
- `lesson_service.cancel_lesson()`：改为允许取消但不退款
- `wallet_service`：新增 `credit_settlement()`

### 数据库变更
- `Transaction.type` 增加：`settlement`（必须）、`income`（可选）
- `Lesson` 可选增加：`settled_at: datetime | None`、`teacher_amount: int | None`

## 相关文件

- `backend/app/services/lesson_service.py`
- `backend/app/services/wallet_service.py`
- `backend/app/models/payment.py`
- `backend/app/models/lesson.py`
- `backend/app/config.py`
- `spec/01-项目规划/20260330-1650-CNVN中越通项目PRD/plan.md`

## 参考

- [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD - 支付与抽成]]
- [[../../03-功能实现/20260403-1700-预约模块/plan|预约模块实现]]
