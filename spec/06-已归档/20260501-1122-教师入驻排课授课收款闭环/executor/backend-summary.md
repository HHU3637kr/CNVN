---
title: 后端实现总结
type: executor-summary
role: backend
status: completed
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
test_plan: "[[../tester/test-plan|test-plan]]"
tags:
  - spec
  - executor
  - backend
  - teacher-supply-flow
---

# 后端实现总结

> [!success]
> 后端 P0 范围已按 `[[../writer/plan|plan]]` 和 `[[../tester/test-plan|test-plan]]` 完成，并通过专项与组合 pytest 回归。

## 实现范围

- Availability:
  - `AvailabilityUpdate` 使用 `model_dump(exclude_unset=True)` 保留显式 `null`。
  - `update_availability` 先合并 patch 最终态，再校验 day/date 互斥、至少一种模式、时间顺序和 `is_recurring` 语义。
  - `create_availability` 对未显式传入的 `is_recurring` 按模式归一，对显式不一致请求返回 400。
  - `Availability` 模型和 Alembic migration 新增互斥与模式一致性 CHECK。
- 教师档案:
  - 新增 `GET /api/v1/teachers/me/profile`，放在动态 `/{teacher_id}` 路由之前。
  - 新增 `teacher_service.get_teacher_profile_by_user_id`。
- 课程动作:
  - `PATCH /lessons/{id}/start`、`PATCH /lessons/{id}/end` 改用 `get_current_teacher`。
  - `confirm/start/end` 均校验课程所属教师；非本人返回 `403 只能操作自己的课程`。
  - `start` 复用课堂进入窗口，过早/过晚返回 `_classroom_entry_state` 的中文原因。
  - `end` 保持调用 `payment_service.mark_lesson_completed` 写争议期。
- 教师统计:
  - 新增 `teacher_stats_service.sync_teacher_delivery_stats`。
  - 在 confirm、pending 过期、end、review 后同步 `total_lessons` 和 `response_rate`。
- 出款:
  - `/payouts/me` 改用教师权限。
  - `PayoutOrderOut` 扩展 gross、commission、VAT、PIT、tax、net、tax_scenario、held_until、released_at 等解释字段。
  - `list_payouts_by_teacher` 使用 `selectinload` 预加载 `SettlementSnapshot` 和 `PaymentOrder`，避免 N+1。

## 改动文件

- `backend/app/models/availability.py`
- `backend/app/services/availability_service.py`
- `backend/app/services/teacher_service.py`
- `backend/app/services/teacher_stats_service.py`
- `backend/app/services/lesson_service.py`
- `backend/app/services/review_service.py`
- `backend/app/services/payment_service.py`
- `backend/app/api/v1/teachers.py`
- `backend/app/api/v1/lessons.py`
- `backend/app/api/v1/payouts.py`
- `backend/app/schemas/payment.py`
- `backend/alembic/versions/005_availability_final_state_checks.py`
- `backend/tests/api/v1/test_availability.py`
- `backend/tests/api/v1/test_teachers.py`
- `backend/tests/api/v1/test_lessons.py`
- `backend/tests/api/v1/test_payment_settlement.py`
- `backend/tests/api/v1/test_reviews.py`

## 测试结果

```powershell
cd backend
python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q
```

结果：`28 passed, 4 warnings in 21.90s`

```powershell
cd backend
python -m pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q
```

结果：`47 passed, 4 warnings in 42.89s`

## 风险和说明

> [!note]
> 本次后端执行未修改 `frontend/*`。工作树中的前端改动来自并行前端 executor。

- Alembic migration 会对 `availabilities` 增加更严格 CHECK；若历史数据存在 day/date 混合或 `is_recurring` 与模式不一致，正式迁移前需要先清理数据。
- `/payouts/me` 仍只返回已生成的 `PayoutOrder`；未过争议期的 held 付款单不会进入出款列表，符合本 Spec 边界。
- warnings 均为 FastAPI `on_event` deprecation，与本 Spec 行为无关。

## 文档关联

- 设计方案：`[[../writer/plan|plan]]`
- 测试计划：`[[../tester/test-plan|test-plan]]`
- 前端总结：`[[frontend-summary|frontend-summary]]`
