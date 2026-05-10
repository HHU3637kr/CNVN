---
title: 学员找老师到预约上课闭环-审查报告
type: review
category: 03-能力交付
status: 已复审
result: passed
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
summary: "[[../executor/summary|summary]]"
test_report: "[[../tester/test-report|test-report]]"
tags:
  - spec
  - review
  - student-booking-flow
  - spec/已通过
---

# Spec 审查报告

## 文档信息

- 审查日期: 2026-05-01
- 审查对象: `writer/plan.md`、`executor/summary.md`、`tester/test-report.md`、当前工作树代码 diff
- Spec 路径: `spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/`
- 当前分支: `feat/spec-20260501-1153-student-booking-flow`

> [!success]
> 基于 `tester/test-report.md` 的 run-002 补充端侧验证和 artifacts 抽查，之前的“端侧证据不足”已关闭。US-001 至 US-004 均有截图、DOM、console、network/API 与 audit 证据；未发现需要 spec-debugger 接手的运行时 bug。

## 1. 审查摘要

| 类别 | 数量 | 状态 |
|---|---:|---|
| 已完成 | 8 | P0 代码路径和端侧证据满足 |
| 未完成 | 0 | 无 |
| 不符项 | 0 | 未发现明显实现偏离 |
| 额外项 | 1 | 后端引入 `lesson_time_range` helper，属于 PostgreSQL IMMUTABLE 约束的合理实现差异 |

总体评价: passed。run-002 已补齐前次复审要求的 US-001 至 US-004 端侧验证证据，可关闭“端侧证据不足”问题。

## 2. P0 验收核对

| 验收项 | 审查结论 | 依据 |
|---|---|---|
| AC-P0-01 教师详情提交预约、扣款托管、跳学员中心 | 已完成 | 计划定义见 `writer/plan.md:68`；前端提交和跳转在 `frontend/src/app/pages/TeacherProfile.tsx:293`、`frontend/src/app/pages/TeacherProfile.tsx:311`；后端创建、flush、付款托管在 `backend/app/services/lesson_service.py:248`、`backend/app/services/lesson_service.py:257`；成功路径测试在 `backend/tests/api/v1/test_lessons.py:171` |
| AC-P0-02 未登录登录后恢复草稿 | 已完成 | 计划定义见 `writer/plan.md:69`；草稿 helper 在 `frontend/src/app/lib/bookingDraft.ts:29`、`frontend/src/app/lib/bookingDraft.ts:40`；未登录保存并跳登录在 `frontend/src/app/pages/TeacherProfile.tsx:293`；恢复草稿在 `frontend/src/app/pages/TeacherProfile.tsx:210`；run-002 对同一草稿恢复机制的端侧证据见 `tester/test-report.md:115`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:63`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:66` |
| AC-P0-03 余额不足后充值恢复 | 已完成 | 计划定义见 `writer/plan.md:70`；余额不足保存草稿并跳钱包在 `frontend/src/app/pages/TeacherProfile.tsx:324`；钱包安全返回和按钮状态在 `frontend/src/app/pages/Wallet.tsx:58`、`frontend/src/app/pages/Wallet.tsx:168`、`frontend/src/app/pages/Wallet.tsx:180`；余额不足后端测试在 `backend/tests/api/v1/test_lessons.py:291`；run-002 端侧补测通过见 `tester/test-report.md:115`、`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:13`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:92` |
| AC-P0-04 教师/学员重叠和并发冲突 | 已完成 | 计划定义见 `writer/plan.md:71`；Alembic 约束在 `backend/alembic/versions/004_lesson_overlap_constraints.py:43`、`backend/alembic/versions/004_lesson_overlap_constraints.py:54`；模型同等约束在 `backend/app/models/lesson.py:63`、`backend/app/models/lesson.py:76`；409 映射在 `backend/app/api/v1/lessons.py:44`；测试在 `backend/tests/api/v1/test_lessons.py:352`、`backend/tests/api/v1/test_lessons.py:408`、`backend/tests/api/v1/test_lessons.py:457` |
| AC-P0-05 学员中心状态分组、reviewed 入历史 | 已完成 | 计划定义见 `writer/plan.md:72`；分组定义在 `frontend/src/app/pages/StudentDashboard.tsx:33`；`completed/reviewed` 历史在 `frontend/src/app/pages/StudentDashboard.tsx:260` |
| AC-P0-06 课堂入口只按允许状态展示 | 已完成 | 计划定义见 `writer/plan.md:73`；后端派生规则在 `backend/app/services/lesson_service.py:40`、`backend/app/services/lesson_service.py:68`；前端只用 `can_enter_classroom` 显示入口在 `frontend/src/app/pages/StudentDashboard.tsx:82`、`frontend/src/app/pages/StudentDashboard.tsx:125` |
| AC-P0-07 直达课堂前端预检，不拉消息/WS | 已完成 | 计划定义见 `writer/plan.md:74`；课堂先读详情在 `frontend/src/app/pages/Classroom.tsx:112`；不可进入时阻断在 `frontend/src/app/pages/Classroom.tsx:125`；消息和 WebSocket 只在允许后执行在 `frontend/src/app/pages/Classroom.tsx:140`、`frontend/src/app/pages/Classroom.tsx:171`、`frontend/src/app/pages/Classroom.tsx:174`；run-002 直达阻断端侧证据见 `tester/test-report.md:117`、`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:17`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:157`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:160` |
| AC-P0-08 回归、build、主链路手工验证 | 已完成 | 命令门禁通过见 `tester/test-report.md:32`、`tester/test-report.md:33`、`tester/test-report.md:34`；端侧补充验证 run-002 通过见 `tester/test-report.md:95`、`tester/test-report.md:98`、`tester/test-report.md:114`、`tester/test-report.md:115`、`tester/test-report.md:116`、`tester/test-report.md:117`、`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:18` |

## 3. 后端审查

> [!success]
> 未发现排他约束、迁移或测试建表路径的明显代码 bug。

| 检查点 | 结论 | 依据 |
|---|---|---|
| Alembic 迁移 | 通过 | 创建 `btree_gist` 和 `lesson_time_range`，再新增教师/学员 exclusion constraints: `backend/alembic/versions/004_lesson_overlap_constraints.py:20`、`backend/alembic/versions/004_lesson_overlap_constraints.py:23`、`backend/alembic/versions/004_lesson_overlap_constraints.py:43`、`backend/alembic/versions/004_lesson_overlap_constraints.py:54` |
| downgrade | 通过 | 先删约束再删 helper function: `backend/alembic/versions/004_lesson_overlap_constraints.py:64` |
| `Base.metadata.create_all` 测试建表 | 通过 | 测试建表前创建 extension 和 helper: `backend/tests/conftest.py:30`、`backend/tests/conftest.py:34`；模型声明同等 `ExcludeConstraint`: `backend/app/models/lesson.py:63`、`backend/app/models/lesson.py:76` |
| 冲突语义 | 通过 | `_has_overlap` 和 DB `IntegrityError` 都映射到 `LessonBookingConflict`: `backend/app/services/lesson_service.py:226`、`backend/app/services/lesson_service.py:248`、`backend/app/services/lesson_service.py:252`；API 返回 409: `backend/app/api/v1/lessons.py:44` |
| 扣款事务顺序 | 通过 | lesson 先 flush，排他冲突在付款前处理；付款仅通过 `payment_service.create_order_for_lesson`: `backend/app/services/lesson_service.py:248`、`backend/app/services/lesson_service.py:257` |
| 课堂入口派生字段 | 通过 | `LessonOut` / `LessonListItem` 统一由 `_lesson_payload` 填充: `backend/app/services/lesson_service.py:68`、`backend/app/services/lesson_service.py:90`、`backend/app/services/lesson_service.py:100` |

残留风险: 生产库若已有互相重叠的非 `cancelled/expired` lessons，迁移加约束会失败。该风险已在 `executor/summary.md:98` 记录，上线前需要数据清查。

## 4. 前端审查

> [!success]
> 未发现预约草稿、时区提交、余额不足恢复、学员中心入口或课堂预检的明显代码 bug。

| 检查点 | 结论 | 依据 |
|---|---|---|
| 预约 slot 与越南时区 | 通过 | 未来 14 天、30 分钟步进、`+07:00` ISO 提交在 `frontend/src/app/pages/TeacherProfile.tsx:94` |
| 草稿保存/恢复 | 通过 | sessionStorage helper 在 `frontend/src/app/lib/bookingDraft.ts:29`、`frontend/src/app/lib/bookingDraft.ts:40`；教师详情恢复在 `frontend/src/app/pages/TeacherProfile.tsx:210`；未登录保存并跳登录在 `frontend/src/app/pages/TeacherProfile.tsx:293` |
| 余额不足恢复 | 通过 | 余额不足保留草稿并跳钱包在 `frontend/src/app/pages/TeacherProfile.tsx:324`；钱包只允许 `/teachers/` 返回路径在 `frontend/src/app/pages/Wallet.tsx:58`、`frontend/src/app/pages/Wallet.tsx:59` |
| 学员中心分组 | 通过 | 使用 `GET /lessons?role=student&page=1&page_size=100` 在 `frontend/src/app/pages/StudentDashboard.tsx:164`；分组和历史口径在 `frontend/src/app/pages/StudentDashboard.tsx:33`、`frontend/src/app/pages/StudentDashboard.tsx:260` |
| 课堂预检 | 通过 | 先取课程详情，失败/不可进入时展示阻断原因；消息和 WebSocket 只在 `classroomAllowed` 后执行: `frontend/src/app/pages/Classroom.tsx:112`、`frontend/src/app/pages/Classroom.tsx:125`、`frontend/src/app/pages/Classroom.tsx:140`、`frontend/src/app/pages/Classroom.tsx:171` |

残留风险: 无阻塞项。run-002 已为预约、余额不足恢复、学员中心分组和课堂直达阻断补充浏览器端侧证据。

## 5. 测试报告审查

> [!success]
> 测试报告已足以关闭前次复审的端侧证据缺口。run-001 支持命令级门禁通过；run-002 补齐 US-001 至 US-004 浏览器端侧证据。

已满足:

| 门禁 | 证据 |
|---|---|
| 后端组合回归 | `tester/test-report.md:32`，25 passed |
| 前端 build | `tester/test-report.md:33`，Vite build succeeded |
| diff-check | `tester/test-report.md:34`，退出码 0 |
| US-001 教师详情预约成功 | `tester/test-report.md:114`；`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:8`；`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:34`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:37` |
| US-002 余额不足充值后恢复预约 | `tester/test-report.md:115`；`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:13`；`tester/artifacts/test-logs/20260501-1228-run-002/api-summary.json:146`、`tester/artifacts/test-logs/20260501-1228-run-002/api-summary.json:147` |
| US-003 学员中心状态分组和课堂入口规则 | `tester/test-report.md:116`；`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:15`；`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:121`、`tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json:124` |
| US-004 不可进入课堂阻断且不进消息/WS | `tester/test-report.md:117`、`tester/test-report.md:137`；`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:17`；`tester/artifacts/test-logs/20260501-1228-run-002/scripts/web-e2e-cdp.mjs:602`、`tester/artifacts/test-logs/20260501-1228-run-002/scripts/web-e2e-cdp.mjs:604` |

复审关注:

| 项 | 结论 | 依据 |
|---|---|---|
| run-001 端侧未执行 | 已由 run-002 覆盖，不再作为失败项 | `tester/test-report.md:95`、`tester/test-report.md:98`、`tester/test-report.md:138` |
| run-002 无录屏/trace | 非阻塞；已有截图、DOM、console、network、API 和 audit 摘要覆盖前次缺口 | `tester/test-report.md:121` 至 `tester/test-report.md:131`、`tester/test-report.md:138` |
| `web-e2e-runner.log` 留有一次 SQL 语法错误输出 | 非阻塞观察；最终 setup、audit 和 case_results 证据显示补测运行已通过 | `tester/artifacts/test-logs/20260501-1228-run-002/web-e2e-runner.log:1`、`tester/artifacts/test-logs/20260501-1228-run-002/setup-sql.log:2`、`tester/artifacts/test-logs/20260501-1228-run-002/setup-sql.log:12`、`tester/artifacts/test-logs/20260501-1228-run-002/audit.log:18` |

## 6. 问题清单

> [!success]
> 前次高优先级问题“端侧主链路未执行，缺少浏览器证据”已关闭。

### 高优先级

无。

### 中优先级

无。

### 低优先级

1. LF/CRLF 转换提示
   - 证据位置: `tester/test-report.md:25`、`tester/test-report.md:87`
   - 问题: 不影响当前功能，也不影响本次 passed 结论。
   - 建议: 归档前如项目有统一换行规则，可单独处理；不要混入业务修复。

2. run-002 `web-e2e-runner.log` 含一次旧 SQL 语法错误输出
   - 证据位置: `tester/artifacts/test-logs/20260501-1228-run-002/web-e2e-runner.log:1`
   - 复审判断: 非阻塞。最终 `audit.log:18` 记录 run.pass，`api-summary.json:145` 至 `api-summary.json:149` 记录四个 case 均 passed。

## 7. 审查结论

- 最终结论: passed。
- 是否可以归档: 可以进入归档确认。
- 是否需要 spec-debugger: 不需要。run-002 未发现运行时 bug 或业务阻塞。
- 是否支持合并: 支持。命令级门禁和端侧证据均已满足本次复审范围。
- 复审判断: 前次“端侧证据不足”已关闭。

## 8. 文档关联

- 设计文档: [[../writer/plan|设计方案]]
- 实现总结: [[../executor/summary|实现总结]]
- 测试计划: [[../tester/test-plan|测试计划]]
- 测试报告: [[../tester/test-report|测试报告]]
