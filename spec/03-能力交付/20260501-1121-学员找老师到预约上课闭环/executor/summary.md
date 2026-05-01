---
title: 学员找老师到预约上课闭环-实现总结
type: summary
category: 03-能力交付
status: 未确认
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
test_plan: "[[../tester/test-plan|test-plan]]"
tags:
  - spec
  - summary
  - executor
  - student-booking-flow
---

# 实现总结

> [!success]
> 本 Spec 的后端预约保护、前端预约闭环、学习中心入口和命令级测试门禁已完成。浏览器端侧/E2E 证据未执行，作为归档前残留风险保留。

## 后端完成项

- [x] 课程重叠保护：通过 PostgreSQL exclusion constraints 覆盖教师和学员维度的非 `cancelled/expired` 课程重叠。
- [x] 并发冲突语义：应用层 `_has_overlap` 命中和数据库排他约束 `IntegrityError` 均映射为稳定业务冲突。
- [x] 预约失败保护：重叠、余额不足等失败路径不重复扣款。
- [x] 课堂入口派生字段：课程创建、详情、列表和状态流转响应统一填充 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
- [x] 后端回归测试：覆盖教师重叠、学员重叠、并发排他约束、派生字段矩阵、消息基础鉴权和支付结算组合回归。

## 前端完成项

- [x] 教师详情预约：根据教师 availability 生成未来 14 天可预约时段，支持 `specific_date` 和 `day_of_week`，按 30 分钟步进提交预约。
- [x] 预约草稿恢复：余额不足时保存 `cnvn_pending_booking_v1`，钱包充值后允许返回教师页继续预约。
- [x] 学员中心课程分组：按 `pending_confirmation`、`confirmed`、`in_progress`、`completed/reviewed`、`cancelled/expired` 分组展示课程。
- [x] 课堂直达预检：进入课堂前请求课程详情，`can_enter_classroom !== true` 时展示阻断原因，不请求历史消息，不建立 WebSocket。
- [x] 前端类型契约：补充 `LessonStatus`、`LessonCreate`、`LessonOut`，并扩展 `LessonListItem` 派生字段。

## 关键文件

### 后端

- `backend/alembic/versions/004_lesson_overlap_constraints.py`
- `backend/app/models/lesson.py`
- `backend/app/schemas/lesson.py`
- `backend/app/services/lesson_service.py`
- `backend/app/api/v1/lessons.py`
- `backend/tests/conftest.py`
- `backend/tests/api/v1/test_lessons.py`

### 前端

- `frontend/src/app/pages/TeacherProfile.tsx`
- `frontend/src/app/pages/Wallet.tsx`
- `frontend/src/app/pages/StudentDashboard.tsx`
- `frontend/src/app/pages/Classroom.tsx`
- `frontend/src/app/types/api.ts`
- `frontend/src/app/lib/bookingDraft.ts`

### 测试与文档

- `spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/executor/backend-summary.md`
- `spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/executor/frontend-summary.md`
- `spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/tester/test-report.md`
- `spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/tester/artifacts/test-logs/20260501-1217-run-001/`

## API 契约变化

- `POST /lessons`
  - 预约成功响应补充 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
  - 教师或学员时间重叠时返回 `409 Conflict`，错误语义为 `该时段与已有课程冲突`。
  - 余额不足等普通业务错误仍返回 `400`。
- `GET /lessons`
  - 列表项补充 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
  - 前端学员中心使用 `role=student&page=1&page_size=100` 拉取完整课程列表后进行本地状态分组。
- `GET /lessons/{id}`
  - 详情响应补充 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
  - 前端课堂页以该接口作为直达课堂预检依据。
- 课程状态流转响应
  - 与课程详情/列表保持一致，返回课堂入口派生字段。
- 未新增独立预约端点；前端基于现有教师 availability 数据生成可预约时间，并提交越南本地 `+07:00` ISO 时间。

## 测试结果摘要

| 门禁 | 命令 | 结果 |
|---|---|---|
| 后端组合回归 | `cd backend; python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q` | 通过，`25 passed, 4 warnings` |
| 前端构建 | `cd frontend; pnpm run build` | 通过，Vite build succeeded |
| Diff 检查 | `git diff --check` | 通过，退出码 0；存在 LF/CRLF 转换提示 |

> [!note]
> 本次测试 Run ID 为 `20260501-1217-run-001`，审计日志位于 `tester/artifacts/test-logs/20260501-1217-run-001/`。当前项目未配置覆盖率门禁，本次未采集覆盖率。

## 残留风险

> [!warning]
> 下列风险不影响本次命令级门禁结论，但需要在归档或上线前明确处置。

- 生产数据库若已有互相重叠的非 `cancelled/expired` lessons，新增 exclusion constraints 的 Alembic upgrade 会失败；上线前需要先执行数据清查或清理。
- 未执行 US-001 至 US-004 的浏览器端侧/E2E 流程，因此没有 console、network、截图或 trace 证据。
- 消息历史和 WebSocket 仍主要验证参与者鉴权，未在后端下沉完整课程状态/进入窗口阻断；当前 Spec 的课堂直达阻断依赖前端 `Classroom` 预检。
- 环境 Python 为 `3.13.11`，与项目说明的 Python 3.11 不一致；本次 pytest 在当前环境通过。
- `git diff --check` 通过，但日志中存在多处 LF 将被 Git 转换为 CRLF 的提示。
- 前端未新增自动化测试框架；本阶段以前端 build 作为最低静态门禁。

## 文档关联

- 设计文档: [[../writer/plan|设计方案]]
- 测试计划: [[../tester/test-plan|测试计划]]
- 测试报告: [[../tester/test-report|测试报告]]
- 后端执行总结: [[backend-summary|后端执行总结]]
- 前端执行总结: [[frontend-summary|前端执行总结]]
