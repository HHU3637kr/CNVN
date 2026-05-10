---
title: 修复总结-争议创建权限收敛
type: debug-fix
category: 03-能力交付
status: 待复测
created: 2026-05-10
plan: "[[../writer/plan|plan]]"
debug: "[[debug-001|debug-001]]"
tags:
  - spec
  - debug-fix
---

# 修复总结

## 1. 修复概述

- 关联诊断：[[debug-001|debug-001]]
- 修复日期：2026-05-10
- 修复人员：spec-debugger / Codex
- 结论：已修复 AC-P0-01 实现偏差，并补齐 reviewer 标记的 P0 测试证据缺口，当前状态为 `ready-for-retest`

## 2. 修复内容

### 2.1 修改的文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `backend/app/services/dispute_service.py` | 修改 | 创建争议权限收敛为付款单学员本人 |
| `backend/tests/api/v1/test_disputes.py` | 修改 | 教师创建改为 `403`；补充非活跃状态拒绝与运营详情字段断言 |
| `lead/team-context.md` | 修改 | 更新 R-001 状态、handoff、runtime handle 和任务进度 |

### 2.2 关键修改

#### 创建权限

- 修改前：`create_dispute` 复用课程访问权限，课程教师也可进入创建分支。
- 修改后：`create_dispute` 直接校验 `current_user.id == order.student_id`，仅付款单学员本人允许创建争议。

#### 测试修正与补强

- 教师和无关用户发起争议统一返回 `403`，并断言：
  - 不创建任何 `DisputeCase`
  - `PaymentOrder.status` 保持原值
- 新增参数化测试覆盖 `released/refunded/pending/paid` 发起争议返回 `400`，且不创建活动争议。
- 新增运营详情测试，逐字段断言课程、付款单、学员、教师、金额、`held_until` 和 `events` 历史。

## 3. 验证结果

### 3.1 目标回归

- [x] 原阻塞问题已修复：教师发起争议不再返回 `201`
- [x] 非活跃付款单状态拒绝新建争议
- [x] 运营详情接口字段有直接测试证据

### 3.2 测试结果

```text
cd backend
pytest tests/api/v1/test_disputes.py tests/api/v1/test_payment_settlement.py -q
16 passed, 4 warnings in 17.22s
```

### 3.3 警告说明

- 现存 4 条 `FastAPI on_event` deprecation warnings，为既有项目警告，本次修复未新增失败或额外警告。

## 4. 重新验证建议

请 TeamLead 启动 spec-tester 重新验证以下用例/验收点：

- `AC-P0-01` / `T-BE-02`：非本人和教师发起争议返回 `403`
- `AC-P0-02` / `T-BE-03`：`released/refunded/pending/paid` 订单不能新开争议
- `AC-P0-06`：`/api/v1/ops/disputes/{id}` 返回完整上下文字段

## 5. 文档关联

- 设计文档：[[../writer/plan|plan]]
- 实现总结：[[../executor/summary|summary]]
- 审查报告：[[../reviewer/review|review]]
- 问题诊断：[[debug-001|debug-001]]
