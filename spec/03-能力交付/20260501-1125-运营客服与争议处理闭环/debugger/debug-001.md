---
title: 问题诊断-争议创建权限偏差
type: debug
category: 03-能力交付
status: 已确认
severity: 高
created: 2026-05-10
plan: "[[../writer/plan|plan]]"
summary: "[[../executor/summary|summary]]"
review: "[[../reviewer/review|review]]"
tags:
  - spec
  - debug
---

# 问题诊断

## 1. 问题概述

### 1.1 问题现象

`reviewer/review.md` 的 R-001 指出，`AC-P0-01` 要求只有学员本人可以对自己课程的活跃付款单发起争议，但当前实现允许课程教师发起争议；对应 API 测试 `backend/tests/api/v1/test_disputes.py` 还把教师发起争议返回 `201` 固化为正确行为。

### 1.2 预期行为

- 只有 `PaymentOrder.student_id == current_user.id` 的学员本人可以创建争议。
- 非本人学员、课程教师、无关用户都应返回 `403`。
- 非活跃付款单状态不允许新开争议，且不创建活动争议。
- 运营详情接口应有直接测试证据覆盖课程、付款单、双方用户、金额、`held_until` 和事件历史字段。

### 1.3 严重程度

- 级别：高
- 影响范围：争议创建权限边界、P0 验收项 AC-P0-01、后续权限回归测试可信度

### 1.4 诊断确认

- 用户确认步骤：`gate skipped by user`
- 本轮按用户明确授权直接进入修复，不等待额外门禁

## 2. 复现步骤

1. 创建一节已确认并已完成的课程，拿到对应 `PaymentOrder`。
2. 使用课程教师身份调用 `POST /api/v1/disputes`。
3. 当前测试 `test_teacher_can_create_dispute_and_unrelated_user_is_forbidden` 断言教师发起争议返回 `201`。
4. 结果：实现与测试共同允许教师创建争议，和 `writer/plan.md` 的学员本人限定不一致。

### 2.1 环境信息

- 操作系统：Windows / PowerShell
- Python 版本：项目运行时 Python 3.11
- 相关依赖：FastAPI、SQLAlchemy 2.0 async、pytest

### 2.2 历史经验检索

- 已检查 `spec/context/experience/` 中与支付、权限、付款单关联相关经验。
- 未发现可直接复用的争议创建权限案例；本次按 `writer/plan.md` 与 reviewer 结论直接修正实现偏差。

## 3. 根因分析

### 3.1 问题定位

- 问题代码位置：`backend/app/services/dispute_service.py`
- 相关测试位置：`backend/tests/api/v1/test_disputes.py`
- 问题类型：实现偏差

### 3.2 根因说明

当前 `create_dispute` 通过 `_can_access_lesson(current_user, lesson)` 校验创建权限。该辅助逻辑把课程学员和课程教师都视为“可访问课程”的主体，因此教师也能进入创建争议分支。测试文件又以教师成功创建争议作为断言，导致偏差被回归测试固化。

### 3.3 与 plan.md 的关系

> [!note] 设计关联
> `writer/plan.md` 已在 `AC-P0-01`、3.3.1 步骤 2 和 API 权限说明中明确限定“只有付款单学员本人可以发起争议”。问题不在设计遗漏，而在实现与测试同时偏离已确认设计。

## 4. 修复方案

### 4.1 方案描述

1. 收敛 `create_dispute` 创建权限，只允许 `current_user.id == order.student_id`。
2. 保留教师查看自己相关争议的能力，不收窄 `list_my_disputes` 和 `can_view_dispute`。
3. 把教师发起争议测试改为 `403`，并补充“无争议创建、订单状态不变”的断言。
4. 按 reviewer 建议补齐两类非阻塞测试缺口：
   - 非活跃付款单状态拒绝新建争议。
   - 运营详情接口字段完整性断言。

### 4.2 修改范围

- [ ] `backend/app/services/dispute_service.py` - 收敛创建权限，不影响查看权限
- [ ] `backend/tests/api/v1/test_disputes.py` - 修正教师权限断言并补齐状态/详情测试
- [ ] `lead/team-context.md` - 记录诊断、门禁跳过、修复与复测交接

### 4.3 风险评估

- 是否影响其他功能：低。改动仅限争议创建权限分支和对应测试。
- 是否需要回归测试：是。至少复跑争议 API 与支付结算相关测试，确保人工退款/释放闭环不回归。

## 5. 文档关联

- 设计文档：[[../writer/plan|plan]]
- 实现总结：[[../executor/summary|summary]]
- 审查报告：[[../reviewer/review|review]]
