---
title: 教师入驻排课授课收款闭环-审查报告
type: review
category: 03-能力交付
status: 未确认
result: 通过
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
summary: "[[../executor/summary|summary]]"
test_report: "[[../tester/test-report|test-report]]"
tags:
  - spec
  - review
  - teacher-supply-flow
---

# Spec 审查报告

## 文档信息

- **审查日期**: 2026-05-01
- **审查对象**: `[[../writer/plan|writer/plan.md]]`、`[[../executor/summary|executor/summary.md]]`、`[[../tester/test-report|tester/test-report.md]]`
- **Spec 路径**: `spec/03-能力交付/20260501-1122-教师入驻排课授课收款闭环/`
- **代码范围**: 当前分支 `feat/spec-20260501-1248-teacher-supply-flow` 的工作区 diff 与未跟踪实现文件

---

## 1. 审查摘要

> [!success]
> 审查结论：passed。未发现阻塞 P0 验收或需要转交 `spec-debugger` 的业务缺陷。

| 类别 | 数量 | 状态 |
|---|---:|---|
| P0 验收标准 | 12 | 已覆盖 |
| 阻塞问题 | 0 | 无 |
| 非阻塞风险 | 2 | 需在合并/归档前关注 |
| 额外实现 | 0 | 未发现越界业务能力 |

**总体评价**：通过。实现基本遵循 `plan.md` 的 P0 范围，没有重写支付/课堂系统，也没有绕过既有支付结算链路。

**复审补充**：tester 证据修复已通过复审。`tester/test-report.md` 已明确 `20260501-1307-run-001` 作废，最终有效证据改为 `20260501-1325-run-002`；run-002 的命令门禁和 Chrome/CDP smoke 均为退出码 0，且证据目录中不再保留 `chrome-profile/`。

---

## 2. P0 验收核对

| 验收项 | Spec 位置 | 审查结果 | 代码/证据位置 |
|---|---|---|---|
| AC-P0-01 教师中心加载身份、档案、税务、钱包、排课、课程、收入摘要 | `writer/plan.md:78` | 已满足 | `frontend/src/app/pages/TeacherDashboard.tsx:180`、`frontend/src/app/pages/TeacherDashboard.tsx:193`、`frontend/src/app/pages/TeacherDashboard.tsx:444` |
| AC-P0-02 教师档案编辑后可通过自有接口读取 | `writer/plan.md:79` | 已满足 | `backend/app/api/v1/teachers.py:95`、`backend/app/api/v1/teachers.py:102`、`frontend/src/app/pages/TeacherDashboard.tsx:195` |
| AC-P0-03 排课 CRUD 与 day/date 最终态互斥 | `writer/plan.md:80` | 已满足 | `backend/app/services/availability_service.py:144`、`backend/app/services/availability_service.py:150`、`backend/app/models/availability.py:37` |
| AC-P0-04 `AvailabilityUpdate` 显式 `null` 清理旧字段 | `writer/plan.md:81` | 已满足 | `backend/app/services/availability_service.py:144`、`frontend/src/app/pages/TeacherDashboard.tsx:342`、`frontend/src/app/pages/TeacherDashboard.tsx:345` |
| AC-P0-05 教师中心按状态展示课程并确认 | `writer/plan.md:82` | 已满足 | `frontend/src/app/pages/TeacherDashboard.tsx:879`、`backend/app/services/lesson_service.py:370` |
| AC-P0-06 `confirm/start/end` 仅课程所属教师可执行 | `writer/plan.md:83` | 已满足 | `backend/app/api/v1/lessons.py:226`、`backend/app/api/v1/lessons.py:266`、`backend/app/api/v1/lessons.py:283`、`backend/app/services/lesson_service.py:444` |
| AC-P0-07 教师 start/end 状态流与争议期写入 | `writer/plan.md:84` | 已满足 | `backend/app/services/lesson_service.py:448`、`backend/app/services/lesson_service.py:471`、`backend/app/services/lesson_service.py:476` |
| AC-P0-08 教师完课数与响应率同步 | `writer/plan.md:85` | 已满足 | `backend/app/services/teacher_stats_service.py:24`、`backend/app/services/lesson_service.py:383`、`backend/app/services/review_service.py:73` |
| AC-P0-09 `/payouts/me` 返回教师自己的结算解释字段 | `writer/plan.md:86` | 已满足 | `backend/app/api/v1/payouts.py:15`、`backend/app/services/payment_service.py:428`、`backend/app/schemas/payment.py:79` |
| AC-P0-10 `Payouts` 页面展示教师可读收入解释 | `writer/plan.md:87` | 已满足 | `frontend/src/app/pages/Payouts.tsx:140`、`frontend/src/app/pages/Payouts.tsx:169`、`frontend/src/app/pages/Payouts.tsx:179` |
| AC-P0-11 教师课堂结束调用 end，普通离开不结束 | `writer/plan.md:88` | 已满足 | `frontend/src/app/pages/Classroom.tsx:240`、`frontend/src/app/pages/Classroom.tsx:244`、`frontend/src/app/pages/Classroom.tsx:254` |
| AC-P0-12 后端 pytest、前端 build、手工闭环验证 | `writer/plan.md:89` | 已满足，有 artifact 风险 | `tester/test-report.md:22`、`tester/test-report.md:24`、`tester/test-report.md:26`、`tester/test-report.md:28`、`tester/test-report.md:30` |

---

## 3. 重点风险审查

### 3.1 Availability update / migration / DB check

> [!success]
> 未发现明显 bug。服务层、模型 CHECK 和 migration 的规则方向一致。

- `AvailabilityUpdate` 使用 `model_dump(exclude_unset=True)` 保留显式 `null`，再合成 patch 后最终态，符合 `writer/plan.md:161` 的要求：`backend/app/services/availability_service.py:144`、`backend/app/services/availability_service.py:150`。
- day/date 互斥、至少一种模式、`is_recurring` 与模式一致均在 `_normalize_is_recurring` 覆盖：`backend/app/services/availability_service.py:116`、`backend/app/services/availability_service.py:122`、`backend/app/services/availability_service.py:127`。
- DB 兜底已落到模型和 migration：`backend/app/models/availability.py:37`、`backend/app/models/availability.py:45`、`backend/alembic/versions/005_availability_final_state_checks.py:21`、`backend/alembic/versions/005_availability_final_state_checks.py:32`。

### 3.2 教师 start/end 权限与课堂消息/学员链路

> [!success]
> start/end 已收紧为教师动作，课堂消息仍保留学生或教师参与者权限，没有看到破坏学员课堂消息链路的变更。

- start/end API 入口已从通用用户收紧为 `get_current_teacher`：`backend/app/api/v1/lessons.py:266`、`backend/app/api/v1/lessons.py:283`。
- 服务层校验课程所属教师，不再用参与者通用权限修改课程状态：`backend/app/services/lesson_service.py:436`、`backend/app/services/lesson_service.py:444`、`backend/app/services/lesson_service.py:459`、`backend/app/services/lesson_service.py:467`。
- 消息列表和 WebSocket 仍通过 `get_current_user` 与 `require_lesson_participant`，学生/教师都可参与课堂消息：`backend/app/api/v1/lessons.py:50`、`backend/app/services/message_service.py:26`、`backend/app/services/message_service.py:58`、`backend/app/services/lesson_service.py:282`。
- 回归测试包含课堂消息组合回归，测试报告记录 `test_lesson_messages.py` 纳入组合回归并通过：`tester/test-report.md:24`。

### 3.3 Payout DTO 与前端字段一致性

> [!success]
> 后端 DTO、查询预加载、前端类型和展示字段能对上。

- DTO 必填字段与 `writer/plan.md:302` 的字段表一致：`backend/app/schemas/payment.py:79`、`backend/app/schemas/payment.py:85`、`backend/app/schemas/payment.py:90`、`backend/app/schemas/payment.py:96`。
- DTO 从 `SettlementSnapshot` 和 `PaymentOrder` 派生 gross/commission/vat/pit/tax/held/released 字段：`backend/app/schemas/payment.py:105`、`backend/app/schemas/payment.py:114`、`backend/app/schemas/payment.py:119`、`backend/app/schemas/payment.py:125`。
- 查询按当前教师过滤并预加载关系，避免 N+1：`backend/app/services/payment_service.py:438`、`backend/app/services/payment_service.py:450`。
- 前端 `PayoutOrderOut` 与页面使用字段一致：`frontend/src/app/types/api.ts:235`、`frontend/src/app/types/api.ts:241`、`frontend/src/app/types/api.ts:247`、`frontend/src/app/pages/Payouts.tsx:75`、`frontend/src/app/pages/Payouts.tsx:169`。

### 3.4 测试证据

> [!success]
> tester 证据修复通过。旧 `smoke-cdp.log` 失败日志只存在于已作废的 run-001，不再作为最终证据或合并阻塞项。

- `tester/test-report.md` frontmatter 已设置 `run_id: 20260501-1325-run-002`、`supersedes: 20260501-1307-run-001`，测试概况也明确最终有效测试运行是 run-002：`tester/test-report.md:6`、`tester/test-report.md:7`、`tester/test-report.md:21`。
- `tester/test-report.md` 明确 `20260501-1307-run-001` 已作废，不作为最终结论依据，并说明 run-001 的 `smoke-cdp.log` 失败输出、退出码捕获不可靠和旧 `chrome-profile/` 问题：`tester/test-report.md:31`、`tester/test-report.md:33`、`tester/test-report.md:34`、`tester/test-report.md:35`。
- 复核文件系统后，`tester/artifacts/test-logs/` 下未发现任何 `chrome-profile` 目录；run-002 `service-stop.log` 记录已删除系统临时 profile：`tester/artifacts/test-logs/20260501-1325-run-002/service-stop.log`。
- run-002 后端专项：`28 passed, 4 warnings`，退出码 0：`tester/test-report.md:43`、`tester/artifacts/test-logs/20260501-1325-run-002/pytest-teacher-supply.exitcode`。
- run-002 后端组合回归：`47 passed, 5 warnings`，退出码 0：`tester/test-report.md:44`、`tester/artifacts/test-logs/20260501-1325-run-002/pytest-regression.exitcode`。
- run-002 前端 build：Vite build 通过，退出码 0：`tester/test-report.md:45`、`tester/artifacts/test-logs/20260501-1325-run-002/frontend-build.exitcode`。
- run-002 `git diff --check`：退出码 0，无 whitespace error，仅保留 Git LF/CRLF working copy warning：`tester/test-report.md:46`、`tester/artifacts/test-logs/20260501-1325-run-002/git-diff-check.exitcode`。
- run-002 Chrome/CDP smoke：`smoke-cdp.log` 为 `status:"passed"` 且列出 US-001..US-006，`smoke-cdp.exitcode` 为 0：`tester/test-report.md:47`、`tester/artifacts/test-logs/20260501-1325-run-002/smoke-cdp.log`、`tester/artifacts/test-logs/20260501-1325-run-002/smoke-cdp.exitcode`。
- run-002 用户流摘要同步记录 US-001..US-006 passed，包含教师入驻、档案保存、排课切换、课程确认、教师开始/结束和学生结束 403、出款解释截图：`tester/artifacts/test-logs/20260501-1325-run-002/user-flow.md`。

---

## 4. 问题清单

### 高优先级

无。

### 中优先级

无阻塞项。

### 低优先级 / 残留风险

1. **migration 会收紧历史数据约束**
   - 位置：`backend/alembic/versions/005_availability_final_state_checks.py:21`、`backend/alembic/versions/005_availability_final_state_checks.py:32`
   - 影响：如果正式库已有混合 day/date 或 `is_recurring` 不匹配记录，迁移会失败。
   - 建议：上线前执行一次历史 `availabilities` 数据检查；这是 `executor/summary.md` 已记录的残留风险。

2. **测试 warning 仍需后续跟踪**
   - 位置：`tester/artifacts/test-logs/20260501-1325-run-002/pytest-teacher-supply.log`、`tester/artifacts/test-logs/20260501-1325-run-002/pytest-regression.log`
   - 影响：FastAPI `on_event` deprecation warning 和 SQLAlchemy async cancel resource warning 未导致测试失败，不阻塞本 Spec 合并。
   - 建议：后续独立技术债清理，不需要本轮转交 `spec-debugger`。

---

## 5. 审查结论

> [!success]
> 可以进入合并/归档前流程。无需转交 `spec-debugger`。

- [x] 可以归档（P0 功能已完成，无阻塞不符项）
- [ ] 需要修复后再归档
- [ ] 严重不符，需要重新实现

### 结论说明

本轮审查未发现 Availability update/migration/DB check 的实现缺陷；教师 start/end 权限收紧没有破坏课堂消息或学员参与链路；payout DTO 与前端展示字段一致；测试证据覆盖了后端专项、后端组合回归、前端 build、端侧 smoke 和关键截图。残留风险均为合并/归档前的证据和数据迁移卫生问题，不构成业务阻塞。

复审后补充结论：run-001 已被明确作废，旧 `smoke-cdp.log` 失败输出不再阻塞合并；run-002 是最终有效证据且真实通过。当前不需要转交 `spec-debugger`。

## 6. 文档关联

- 设计文档：`[[../writer/plan|设计方案]]`
- 实现总结：`[[../executor/summary|实现总结]]`
- 测试报告：`[[../tester/test-report|测试报告]]`
