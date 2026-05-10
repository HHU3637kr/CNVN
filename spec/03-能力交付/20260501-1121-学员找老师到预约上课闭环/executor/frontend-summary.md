---
title: 前端执行总结
type: executor-summary
status: completed
created: 2026-05-01
executor: frontend
plan: "[[../writer/plan|plan]]"
test_plan: "[[../tester/test-plan|test-plan]]"
tags:
  - spec
  - executor
  - frontend
  - student-booking-flow
---

# 前端执行总结

> [!success]
> 已按 [[../writer/plan|设计方案]] 的前端边界完成教师详情预约、钱包充值恢复、学员中心状态分组和课堂直达预检。

## 实现内容

- `TeacherProfile.tsx`
  - 由教师 `AvailabilityOut[]` 生成未来 14 天可预约时段。
  - 支持 `specific_date` 和 `day_of_week` 周期时段，按 30 分钟步进生成开始时间。
  - 提交 `POST /lessons`，预约时间使用越南本地 `+07:00` ISO 字符串。
  - 未登录、余额不足、冲突、不可授课、401/403 均按 plan.md 恢复动作处理。
  - 使用 `sessionStorage` key `cnvn_pending_booking_v1` 保存和恢复预约草稿。
- `Wallet.tsx`
  - 支持 `intent=booking` 和 `returnTo`。
  - 仅允许 `/teachers/` 开头的返回路径，避免开放跳转。
  - Mock 充值成功后启用“返回继续预约”，不自动提交预约。
- `StudentDashboard.tsx`
  - 改为 `GET /lessons?role=student&page=1&page_size=100` 完整课程列表。
  - 按 `pending_confirmation`、`confirmed`、`in_progress`、`completed/reviewed`、`cancelled/expired` 分组展示。
  - 课堂入口只由 `can_enter_classroom === true` 控制。
  - `completed` 显示“待评价”，`reviewed` 显示“已评价”。
- `Classroom.tsx`
  - 先请求 `GET /lessons/{id}` 做前端预检。
  - `can_enter_classroom !== true` 时展示阻断原因并返回学习中心。
  - 不可进入时不请求历史消息，不创建 WebSocket。
- `types/api.ts`
  - 增加 `LessonStatus`、`LessonCreate`、`LessonOut`。
  - 扩展 `LessonListItem` 的 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
- `lib/bookingDraft.ts`
  - 新增预约草稿读写清理 helper。

## 验证

- `cd frontend; pnpm run build`
  - 结果：通过。
  - 输出摘要：Vite 6.3.5 build 成功，`1626 modules transformed`。
- `git diff --check -- frontend/src/app/types/api.ts frontend/src/app/lib/bookingDraft.ts frontend/src/app/pages/TeacherProfile.tsx frontend/src/app/pages/Wallet.tsx frontend/src/app/pages/StudentDashboard.tsx frontend/src/app/pages/Classroom.tsx`
  - 结果：通过，无 whitespace error；Git 仅提示这些文件下次触碰时会按本仓库设置转换 CRLF。

## 未完成和风险

> [!warning]
> 本前端 executor 未执行浏览器手工主链路，也未写入 `tester/artifacts/test-logs/`。该证据采集属于 tester 执行阶段。

- 前端运行时依赖后端 executor 完成 `LessonOut` / `LessonListItem` 的 `can_enter_classroom` 等派生字段；若后端尚未返回这些字段，课堂入口会按不可进入处理。
- 未新增前端自动化测试框架；本阶段按测试计划的最低静态门禁执行 `pnpm run build`。
- 当前工作树存在 backend 并行改动，本次前端执行未读取后端改动结果做端到端验证。

## 文档关联

- 设计方案：[[../writer/plan|plan]]
- 测试计划：[[../tester/test-plan|test-plan]]
