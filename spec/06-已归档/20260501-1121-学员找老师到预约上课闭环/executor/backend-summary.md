---
title: 后端执行总结
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
  - student-booking-flow
---

# 后端执行总结

> [!success]
> 后端范围已完成：课程重叠并发保护、冲突错误语义、课程入口派生字段和 pytest 覆盖均已落地。

## 改动文件

- `backend/alembic/versions/004_lesson_overlap_constraints.py`
  - 创建 `btree_gist` extension。
  - 创建 `lesson_time_range(timestamptz, integer)` immutable SQL helper。
  - 增加 `ex_lessons_teacher_no_overlap` 和 `ex_lessons_student_no_overlap` exclusion constraints。
- `backend/app/models/lesson.py`
  - 在 `Lesson.__table_args__` 中声明同等 `ExcludeConstraint`，覆盖 `Base.metadata.create_all` 测试建表路径。
- `backend/tests/conftest.py`
  - 测试库建表前创建 `btree_gist` 和 `lesson_time_range`。
  - `create_all` 后种子系统 ledger accounts，避免支付预约测试依赖文件执行顺序。
- `backend/app/services/lesson_service.py`
  - 新增 `LessonBookingConflict`。
  - `_has_overlap` 命中和 DB 排他约束 `IntegrityError` 均稳定映射为 `该时段与已有课程冲突`。
  - `LessonOut` / `LessonListItem` 统一填充 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
- `backend/app/api/v1/lessons.py`
  - `LessonBookingConflict` 返回 `409 Conflict`。
  - 余额不足等普通业务错误仍返回 `400`。
- `backend/app/schemas/lesson.py`
  - 扩展 `LessonOut` 和 `LessonListItem` 响应字段。
- `backend/tests/api/v1/test_lessons.py`
  - 覆盖教师重叠、学员重叠、并发排他约束、失败不扣款、派生字段矩阵。

## 约束实现说明

直接把 `tstzrange(scheduled_at, scheduled_at + make_interval(...), '[)')` 放入 GiST exclusion constraint 时，PostgreSQL 拒绝建索引，错误为 `functions in index expression must be marked IMMUTABLE`。实际实现改为 immutable SQL helper `lesson_time_range(...)` 包装同一时间窗表达式，再由 Alembic 和 `create_all` 路径共同创建。

## 课堂入口边界

本后端实现按 `plan.md` 的主契约，在 `GET /lessons`、`GET /lessons/{id}`、`POST /lessons` 和状态流转返回中提供入口派生字段。未在 `require_lesson_participant` 下沉消息历史或 WebSocket 的状态阻断；课堂直达阻断按本 Spec 由前端预检完成。

## 测试结果

- `cd backend; python -m py_compile app/models/lesson.py app/schemas/lesson.py app/services/lesson_service.py app/api/v1/lessons.py tests/conftest.py tests/api/v1/test_lessons.py alembic/versions/004_lesson_overlap_constraints.py`
  - 通过。
- `cd backend; python -m pytest tests/api/v1/test_lessons.py -q`
  - `8 passed, 4 warnings`
- `cd backend; python -m pytest tests/api/v1/test_lesson_messages.py -q`
  - `7 passed, 4 warnings`
- `cd backend; python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q`
  - `25 passed, 4 warnings`

> [!warning]
> warnings 均为现有 FastAPI `on_event` deprecation warning，本次未处理。

## 未完成风险

- 生产数据库若已有互相重叠的非 `cancelled/expired` lessons，新增 exclusion constraints 的 Alembic upgrade 会失败；上线前需要先跑数据清查或清理。
- 消息历史和 WebSocket 仍只校验参与者，不校验课堂入口时间窗；当前 Spec 的阻断职责由前端课堂预检承担。

## 文档关联

- 设计方案：[[../writer/plan|plan]]
- 测试计划：[[../tester/test-plan|test-plan]]
