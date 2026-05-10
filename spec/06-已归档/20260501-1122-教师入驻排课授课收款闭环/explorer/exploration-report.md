---
type: exploration-report
status: done
created: 2026-05-01T12:51:11+08:00
updated: 2026-05-01T12:51:11+08:00
owner: spec-explorer
spec: 教师入驻排课授课收款闭环
git_branch: feat/spec-20260501-1248-teacher-supply-flow
---

# 探索报告

## 检索到的历史经验

- `EXP-001 FastAPI 教师路由与 PG 数组搜索`：教师公开路由应保持静态/子路径优先，`specialties` 使用 PostgreSQL ARRAY `.contains()`，推荐排序依赖 `total_lessons` 与 `response_rate`。
- `EXP-002 支付模块结算防重与数据模型关联`：`Lesson.teacher_id` 指向 `TeacherProfile.id`，资金或钱包侧需要经 `TeacherProfile.user_id` 中转。
- `KNOW-001 CNVN 后端预约与教师模块要点`：预约链路为可用时段覆盖校验、扣款托管、`pending_confirmation`、教师确认、开始、结束。
- `KNOW-003 CNVN 支付模块结算实现详解` 已部分过期：旧文档提到 `Lesson.settled_at / teacher_amount / platform_fee_rate`，但当前 `.agents/rules/payment-system.md` 与代码已迁移为 `PaymentOrder`、`PayoutOrder`、`SettlementSnapshot`，后续实现必须以现有支付合规模型为准。

## 项目现状分析

### 1. 教师入驻与档案

后端已有两条入口：

- `POST /auth/become-teacher`：`auth_service.become_teacher` 创建 `TeacherProfile`，向 `User.roles` 追加 `teacher`，并把 `active_role` 设为 `teacher`。见 `backend/app/services/auth_service.py:126`。
- `POST /teachers/profile` / `PUT /teachers/profile`：支持创建和更新教师档案。见 `backend/app/api/v1/teachers.py:67` 与 `backend/app/api/v1/teachers.py:80`。

前端已有两个入驻入口：

- `/register` 支持选择教师，注册后登录并调用 `/auth/become-teacher`，成功后跳转 `/dashboard/teacher`。
- `Layout` 中非教师用户可打开“成为教师”弹窗并调用 `/auth/become-teacher`。

当前缺口：

- 没有 `GET /teachers/me/profile` 或等价自有档案读取接口；`/auth/me` 的 `UserOut` 不含 `teacher_profile.id`，前端无法稳定加载自己的档案用于编辑。
- `TeacherDashboard` 的“档案设置”只是无事件按钮，未接 `PUT /teachers/profile`。
- 税务/KYC 接口存在：`GET/PATCH /teachers/me/tax-profile`，但教师中心没有读取和编辑入口。

### 2. 排课与可用时段

后端已有：

- `GET/POST/PUT/DELETE /availability` 管理自己的时段。
- `GET /teachers/{teacher_id}/availability` 公开读取老师时段。
- 预约时 `lesson_service.create_lesson` 调用 `availability_service.assert_slot_covered_by_availability`，按越南时区判断课程窗口是否被某个可用时段覆盖。见 `backend/app/services/lesson_service.py:222` 与 `backend/app/services/availability_service.py:52`。

当前缺口：

- `AvailabilityCreate` 已校验 `day_of_week` 与 `specific_date` 互斥且至少有一个。见 `backend/app/schemas/availability.py:14`。
- `AvailabilityUpdate` 没有同等校验，`availability_service.update_availability` 只校验 `start_time < end_time`，直接 `setattr`。这会允许把既有指定日期时段更新为同时含 `day_of_week` 与 `specific_date` 的混合状态。见 `backend/app/schemas/availability.py:23` 与 `backend/app/services/availability_service.py:111`。
- DB 只有 “day 或 date 至少一个” 与 `day_of_week` 范围约束，没有互斥约束；如果服务漏校验，数据库兜不住。
- `is_recurring` 与 `day_of_week/specific_date` 没有关联校验；当前覆盖逻辑只看 `specific_date` 优先，否则看 `day_of_week`，实际忽略 `is_recurring`。
- 前端教师中心没有任何可用时段列表、创建、编辑、删除入口。

### 3. 待确认课程、确认/开始/结束、课堂入口

后端已有：

- `GET /lessons?role=teacher`：按当前用户的 `teacher_profile.id` 查询教师课程；支持 `status`、`upcoming`、分页。见 `backend/app/services/lesson_service.py:292`。
- `PATCH /lessons/{id}/confirm`：要求教师身份且只能确认自己的 `pending_confirmation` 课程。见 `backend/app/services/lesson_service.py:366`。
- `PATCH /lessons/{id}/start` 与 `PATCH /lessons/{id}/end`：当前只要求当前用户是课程参与者，学生或教师都可以操作。见 `backend/app/services/lesson_service.py:431` 与 `backend/app/services/lesson_service.py:448`。
- `end_lesson` 会把课程置为 `completed`，写 `actual_end_at`，再调用 `payment_service.mark_lesson_completed` 写争议期 `held_until`，真正出款由 `dispute_watcher` 到期释放。见 `backend/app/services/lesson_service.py:458` 与 `backend/app/services/payment_service.py:164`。

前端现状：

- `TeacherDashboard` 只请求 `/auth/me`、`/lessons?role=teacher&upcoming=true&page_size=20`、`/wallet`。见 `frontend/src/app/pages/TeacherDashboard.tsx:36`。
- 教师中心只展示“接下来的课程”，未按 `pending_confirmation / confirmed / in_progress / completed` 分组；没有确认、开始、结束按钮。见 `frontend/src/app/pages/TeacherDashboard.tsx:150`。
- 进入教室按钮总是显示，不根据 `can_enter_classroom` 或状态禁用。见 `frontend/src/app/pages/TeacherDashboard.tsx:191`。
- `Classroom` 的“离开/结束课程”只 `navigate("/dashboard/student")`，没有调用 `PATCH /lessons/{id}/end`，且对教师也会跳学生中心。见 `frontend/src/app/pages/Classroom.tsx:224`。

当前缺口：

- 教师课程动作的后端接口存在，但前端完全未串联。
- `start/end` 权限口径需要 writer 决策：如果本 Spec 要求“教师确认/开始/结束”，后端应从参与者权限收紧到教师权限，或至少前端只暴露给教师。
- `TeacherDashboard` 用 `upcoming=true` 会排除已经开始或历史完成的课程，不足以作为教师完整工作台。

### 4. 出款查看与解释

后端已有：

- `PaymentOrder`：学生付款后进入 `held`，课程完成后写 `held_until`。
- `dispute_watcher.run_once`：扫描 `status='held' AND held_until < now()` 并调用 `payment_service.release_payment_order`。
- `release_payment_order`：计算阶梯佣金与税务策略，写不可变 `SettlementSnapshot`，创建 `PayoutOrder`，Mock 出款后给教师钱包入账并把 `PaymentOrder` 置为 `released`。见 `backend/app/services/payment_service.py:214`。
- `GET /payouts/me`：按当前用户的 `teacher_profile.id` 返回自己的出款单。见 `backend/app/api/v1/payouts.py:15`。

当前缺口：

- `PayoutOrderOut` 只返回 `net_amount/status/channel/payment_order_id/lesson_id` 等字段，不包含 `SettlementSnapshot` 的 `gross_amount / commission_amount / vat_amount / pit_amount / net_amount`。见 `backend/app/schemas/payment.py:79`。
- `payment_service.list_payouts_by_teacher` 只查 `PayoutOrder`，没有 join/eager load `SettlementSnapshot`。见 `backend/app/services/payment_service.py:427`。
- 前端 `Payouts` 只显示净额、状态、付款单 ID、创建时间和渠道，并且页面直接显示“数据来源”技术文案，不解释平台费、税费、争议期和到账语义。见 `frontend/src/app/pages/Payouts.tsx:71` 与 `frontend/src/app/pages/Payouts.tsx:83`。
- 付款单详情页 `PaymentOrderDetail` 能展示结算快照，但出款页没有链接过去；且教师无法从出款记录理解该笔来自哪节课、gross/fee/tax/net 如何构成。
- `GET /payouts/me` 使用 `get_current_user` 而非 `get_current_teacher`，只要用户拥有 `teacher_profile` 即可查看，不要求当前 active_role 为 teacher；是否符合角色切换规范需要 writer 明确。

### 5. 统计字段同步

模型字段已存在：

- `TeacherProfile.total_lessons`、`avg_rating`、`total_reviews`、`response_rate`。见 `backend/app/models/teacher_profile.py:31`。
- 教师搜索推荐排序使用 `total_lessons` 与 `response_rate`。见 `backend/app/services/teacher_service.py:51`。

当前缺口：

- `review_service._sync_teacher_review_stats` 只同步 `total_reviews` 与 `avg_rating`。见 `backend/app/services/review_service.py:20`。
- `lesson_service.end_lesson` 完课后没有同步 `TeacherProfile.total_lessons`。
- `confirm_lesson` 未记录响应时间或确认次数，`response_rate` 从未更新。
- 因为公开教师列表依赖这些字段，统计不同步会影响推荐排序、教师详情和教师中心质量指标。

## P0 缺口判定

| P0 问题 | 当前判定 | 说明 |
|---|---|---|
| 教师中心是否可完整工作 | 不完整 | 入驻入口存在，但教师中心缺自有档案读取/编辑、排课管理、待确认课程动作、收入解释。 |
| availability update 校验 | 后端缺口明确 | create 有互斥校验，update 没有；DB 也没有互斥兜底。 |
| 教师课程动作 | 后端可调用，前端未串联 | confirm/start/end API 存在；前端没有动作按钮；start/end 权限是否应只允许教师需决策。 |
| 出款解释 | 不足 | 出款列表只显示净额和 ID，不带结算快照与争议期/税费解释。 |
| 统计字段同步 | 不足 | total_lessons/response_rate 未维护，推荐排序和教师指标会长期为默认值。 |

## 需要修改的文件

### 后端

- `backend/app/schemas/availability.py`：为 `AvailabilityUpdate` 增加与 create 一致的最终态互斥语义，或定义明确 patch 模式。
- `backend/app/services/availability_service.py`：更新时合并旧值与 patch 后校验最终态；同步校验 `is_recurring` 与 `day_of_week/specific_date`。
- `backend/app/models/availability.py` 与新 Alembic migration：建议增加互斥 CHECK，避免绕过服务写入混合态。
- `backend/app/api/v1/teachers.py`、`backend/app/services/teacher_service.py`、`backend/app/schemas/teacher.py`：增加 `GET /teachers/me/profile` 或让 `/auth/me` 返回教师档案摘要，支撑前端档案编辑。
- `backend/app/services/lesson_service.py`：完课后同步 `total_lessons`；确认后同步 `response_rate` 或至少记录/重算响应率；按计划决定是否收紧 start/end 为教师动作。
- `backend/app/api/v1/payouts.py`、`backend/app/services/payment_service.py`、`backend/app/schemas/payment.py`：让教师出款列表返回 settlement snapshot 或出款明细 DTO，包含 gross、commission、tax、net、paid_at、来源课程。
- `backend/app/api/v1/payments.py`：如采用“出款页链接付款单详情”方案，可复用 `PaymentOrderDetail`；但列表态仍建议避免 N+1 请求。

### 前端

- `frontend/src/app/pages/TeacherDashboard.tsx`：改为教师工作台，包含入驻/档案状态、可用时段管理、待确认/待上课/进行中/已完成课程分组、确认/开始/结束动作、收入摘要。
- `frontend/src/app/pages/Classroom.tsx`：教师结束课程时调用 `PATCH /lessons/{id}/end`；离开与结束分离，教师返回 `/dashboard/teacher`。
- `frontend/src/app/pages/Payouts.tsx`：展示 gross、平台费、税费、net、状态、到账时间、来源课程和争议期解释；移除面向用户的 API 技术文案。
- `frontend/src/app/types/api.ts`：补 `TeacherProfileUpdate`、`AvailabilityCreate/Update`、`TeacherTaxProfileOut/Update`、带结算快照的出款 DTO。
- `frontend/src/app/lib/format.ts`：可复用时段展示，补结算费率/税费格式化辅助。
- `frontend/src/app/routes.tsx` / `frontend/src/app/Layout.tsx`：如拆分教师档案或排课子页，需要补路由和导航；否则在教师中心内联完成。

## 测试入口

### 后端 pytest

- 入驻与档案：`cd backend; pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py`
- 可用时段：建议新增 `backend/tests/api/v1/test_availability.py`，覆盖 create/update 互斥、切换 recurring/date 模式、非本人不可改。
- 教师课程动作：`cd backend; pytest tests/api/v1/test_lessons.py`，新增教师视角 confirm/start/end、非教师/非本人禁止、教师列表分组字段断言。
- 出款与结算解释：`cd backend; pytest tests/api/v1/test_payment_settlement.py`，新增 release 后 `/payouts/me` 返回 snapshot/gross/fee/tax/net 的断言。
- 统计同步：可放在 `test_lessons.py` 或新增 `test_teacher_stats.py`，覆盖完课后 `total_lessons`、确认率/响应率口径。
- 组合回归：`cd backend; pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py`

### 前端验证

- 构建入口：`cd frontend; pnpm build`
- 现有仓库未配置前端自动化测试；若 tester 要做场景验证，可沿用上一轮学员闭环的浏览器脚本思路，覆盖教师注册、排课、学生预约、教师确认/开始/结束、出款列表展示。

## 风险、依赖与建议实现顺序

### 风险

- 支付相关修改必须遵守 `.agents/rules/payment-system.md`：不能在 Lesson 新增结算冗余字段，结算展示应查 `SettlementSnapshot`；资金动作必须走 `payment_service`。
- `AvailabilityUpdate` 的 patch 语义要谨慎：如果前端从指定日期切到周期模式，需要能显式清空 `specific_date`；Pydantic `exclude_unset=True` 下 `null` 应作为清空字段处理。
- `start/end` 权限收紧可能影响现有测试和学生课堂入口；若产品允许学生发起开始，则前端仍应只在教师中心暴露教师动作。
- `response_rate` 口径尚未建模，直接算“已确认 / 待确认总数”会受过期、取消和时间窗口影响；建议 writer 明确 MVP 统计窗口。
- 出款解释如果在 `/payouts/me` 嵌套 snapshot，需要避免 N+1 查询并保证只返回当前教师自己的记录。

### 依赖

- 支付托管退款结算一致性 Spec 已完成基础合规改造，当前出款解释应基于 `PaymentOrder + PayoutOrder + SettlementSnapshot`。
- 学员闭环已提供预约、钱包、课堂入口的学生端模式；教师端可以复用 `LessonListItem.can_enter_classroom` 与格式化工具。
- 若要做完整前端 E2E，需要可运行 PostgreSQL 测试/开发库和前后端 dev server。

### 建议实现顺序

1. 后端先修 `AvailabilityUpdate` 最终态校验和测试，避免前端排课管理写出脏数据。
2. 补教师自有档案读取接口与前端教师中心档案/税务入口，保证入驻后可继续维护资料。
3. 扩展教师中心课程列表与动作：先按状态分组，再接 confirm/start/end，并修正课堂结束行为。
4. 补统计同步：完课数先落地；响应率按 writer 明确口径实现。
5. 扩展出款 DTO 和 `Payouts` 展示解释，最后补支付专项断言，避免破坏资金守恒链路。

## 给 spec-writer / spec-tester 的建议

- writer 应把 P0 定义为“最短可工作闭环”：教师能入驻、编辑档案、维护时段、确认/开始/结束课程、看到可解释的已释放出款。
- tester 应优先做 API 级闭环，再做前端冒烟：教师注册 -> 创建时段 -> 学生预约 -> 教师确认/开始/结束 -> 调整 `held_until` 或调用 watcher -> 教师出款页可解释。
- 本轮未探索外部资源；所有结论来自仓库代码、Spec 文档、项目规则和历史经验索引。
