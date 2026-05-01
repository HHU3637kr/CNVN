---
type: exploration-report
status: done
created: 2026-05-01
updated: 2026-05-01
git_branch: feat/spec-20260501-1153-student-booking-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
owner: spec-explorer
tags:
  - spec
  - exploration
  - student-booking-flow
---

# 探索报告：学员找老师到预约上课闭环

## 探索范围

- 当前 Spec：`spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan.md`
- 前端链路：`frontend/src/app/pages/Home.tsx`、`Teachers.tsx`、`TeacherProfile.tsx`、`StudentDashboard.tsx`、`Classroom.tsx`、`Wallet.tsx`、`frontend/src/app/types/api.ts`、`frontend/src/app/lib/http.ts`
- 后端链路：`backend/app/api/v1/teachers.py`、`lessons.py`、`payments.py`、`availability.py`，以及 `teacher_service.py`、`lesson_service.py`、`availability_service.py`、`payment_service.py`、`wallet_service.py`、`dispute_watcher.py`
- 数据模型与迁移：`backend/app/models/lesson.py`、`payment_order.py`、`availability.py`、`backend/alembic/versions/*`
- 测试入口：`backend/tests/api/v1/test_teachers.py`、`test_lessons.py`、`test_lesson_messages.py`、`test_payment_settlement.py`
- 历史经验/知识：`EXP-001`、`EXP-002`、`KNOW-001`、`KNOW-003`，以及近期支付一致性 Spec

## 检索到的历史经验

| 来源 | 可复用结论 |
|---|---|
| `EXP-001 FastAPI 教师路由与 PG 数组搜索` | 教师公开路由顺序、`specialties.contains(...)` 和推荐排序已落地；本 Spec 不应重写教师搜索，只需接上预约入口。 |
| `KNOW-001 CNVN 后端预约与教师模块要点` | 后端已有 `POST /lessons`，包含教师活跃、未来时间、availability 覆盖、冲突查询、扣款托管和 `pending_confirmation` 状态。 |
| `EXP-002 支付模块结算防重与数据模型关联` | `Lesson.teacher_id` 指向 `TeacherProfile.id`，钱包属于 `User`；涉及教师钱包/结算时必须经 `TeacherProfile.user_id` 中转。 |
| `KNOW-003 CNVN 支付模块结算实现详解` | 旧结算字段已从 `Lesson` 移除，当前资金状态以 `PaymentOrder`、`SettlementSnapshot`、`PayoutOrder` 为准。 |
| `支付托管退款结算一致性` Spec | `<24h` 取消写 `held_until`、`reviewed/actual_end_at` 参与佣金统计已实现并通过 `test_lessons.py + test_payment_settlement.py` 组合回归；本 Spec 可依赖该资金口径。 |

## 当前主链路现状

### 1. 教师发现与详情

- 首页推荐教师：`Home.tsx` 调 `GET /teachers?sort_by=recommended&page_size=4&page=1`，卡片跳转 `/teachers/:id`。
- 教师列表：`Teachers.tsx` 调 `GET /teachers`，支持 `q`、`sort_by`、分页；列表项只有“查看详情”，没有直接预约动作。
- 教师详情：`TeacherProfile.tsx` 并行调：
  - `GET /teachers/{id}`
  - `GET /teachers/{id}/reviews?page_size=10`
  - `GET /teachers/{id}/availability`
- 详情页展示开放时段，但只是文本列表；`预约试课` 是无 `onClick` 的静态按钮，没有选时段、没有 topic/duration 表单、没有钱包余额提示，也没有调用 `POST /lessons`。

### 2. 后端预约与托管

- API 入口：`POST /api/v1/lessons`，依赖 `get_current_student`。
- `lesson_service.create_lesson` 当前事务链路：
  1. 拒绝预约自己。
  2. 查询 `TeacherProfile`，要求存在且 `is_active`。
  3. `scheduled_at` 归一到 UTC，要求晚于当前时间。
  4. `availability_service.assert_slot_covered_by_availability` 校验整节课落在教师可授课窗口内。
  5. `_has_overlap` 查询同一教师或同一学员的非终态课程是否重叠。
  6. 按 `hourly_rate * duration_minutes / 60` 计算整数 VND 价格。
  7. 插入 `Lesson(status='pending_confirmation')`。
  8. `payment_service.create_order_for_lesson` 创建 `PaymentOrder`，Mock 渠道置 paid，锁学生钱包扣款，写 `Transaction(payment)` 和 escrow ledger，订单进入 `held`。
  9. commit 后返回 `LessonOut`。
- 余额不足时，`payment_service.create_order_for_lesson` 抛 `ValueError("余额不足")`，`create_lesson` rollback，API 返回 400 + `detail: "余额不足"`。
- `PaymentOrder` 有“同一 lesson 一条活跃订单”的部分唯一索引，但没有同一教师/学员时间窗不重叠的 DB 约束。

### 3. 学员中心与课堂入口

- `StudentDashboard.tsx` 入口鉴权靠本地 token；未登录重定向 `/login`。
- 页面加载：
  - `GET /auth/me`
  - `GET /lessons?role=student&upcoming=true&page_size=20`
  - `GET /lessons?role=student&status=completed&page_size=20`
  - `GET /wallet`
- “即将开始的课程”当前等价于“排课时间在未来的所有学员课程”，没有按 `pending_confirmation`、`confirmed`、`in_progress`、`cancelled`、`expired` 分组。
- upcoming 列表每一条都显示 `/classroom/{lesson.id}` 的“进入教室”，没有检查课程状态、是否已确认、是否已取消/过期、是否到可进入时间窗口。
- “学习记录”只取 `status=completed`，评价后变成 `reviewed` 的课程不会出现在历史记录里。
- `Classroom.tsx` 只用 `lessonId` 加 token 拉消息历史与 WebSocket；后端 `require_lesson_participant` 只校验“师生参与者”，不校验课程状态或时间窗口。因此只要是自己的 lesson，pending/cancelled/expired/completed 理论上都能进课堂聊天。
- 课堂页“离开/结束”只导航回 `/dashboard/student`，没有调用 `PATCH /lessons/{id}/start` 或 `end`；后端状态流转能力存在，但前端课堂没有接入。

## P0 缺口确认

### P0-1：TeacherProfile 预约按钮未创建课程

现状：
- `TeacherProfile.tsx` 的 `预约试课` 按钮没有 handler。
- availability 只显示窗口，不生成可提交的 `scheduled_at`。
- 前端类型缺少 `LessonCreate` / `LessonOut`，但可直接通过 `apiFetchJson` 调用。

建议：
- 在教师详情页加入最小预约表单：选择可用日期/时间、时长、topic。
- 提交 `POST /lessons`：`{ teacher_id, scheduled_at, duration_minutes, topic }`。
- 成功后跳转 `/dashboard/student`，并显示“待老师确认”状态。
- 如果未登录，跳转 `/login` 并保留返回路径。

### P0-2：余额不足恢复路径缺失

现状：
- 后端已有明确错误 `余额不足`。
- 钱包页支持 `/wallet`、`POST /wallet/topup`、交易流水和 VietQR 占位。
- 教师详情页没有触发预约 API，也没有把余额不足映射到“去充值后回来继续预约”。

建议：
- 前端在 `ApiError.status === 400` 且 message 包含 `余额不足` 时展示充值恢复动作。
- 跳转 `/wallet` 时保留 return state/query，例如 `returnTo=/teachers/{id}`，并把选择的 slot/topic/duration 暂存到 `sessionStorage` 或路由 state。
- 钱包充值完成后允许返回教师详情页继续提交，避免用户丢失上下文。
- 不在本 Spec 中新增课程相关 `wallet_service` 函数，遵守 `.agents/rules/payment-system.md`。

### P0-3：学员中心状态分组与课堂入口规则缺失

现状：
- upcoming 查询仅按 `scheduled_at >= now`，没有排除取消/过期，也没有区分待确认/待上课/进行中。
- 课堂入口对全部 upcoming 显示。
- 历史记录只查 `completed`，漏掉 `reviewed`。
- 后端课堂消息权限只看参与者，不看状态。

建议状态分组：

| 分组 | 状态 | 入口规则 |
|---|---|---|
| 待老师确认 | `pending_confirmation` | 不显示课堂入口；显示“等待老师确认/可取消”。 |
| 待上课 | `confirmed` | 仅在可进入窗口内显示课堂入口；窗口建议先按开课前 15 分钟到课程结束后 15 分钟，具体由 writer 固化。 |
| 进行中 | `in_progress` | 显示课堂入口。 |
| 已完成 | `completed` / `reviewed` | 不显示课堂入口；显示评价/再次预约入口。 |
| 已取消/已过期 | `cancelled` / `expired` | 不显示课堂入口；解释退款/不退款或超时原因。 |

后端可先不新增字段，由前端根据 `status` + `scheduled_at` + `duration_minutes` 计算 `canEnterClassroom`。如果 writer 希望契约更稳，应在 `LessonListItem` 返回 `ends_at` / `can_enter_classroom` / `classroom_unavailable_reason`。

### P0-4：后端并发/重叠预约保护不足

现状：
- `_has_overlap` 是普通查询：先查同一教师/学员的非终态课程，再插入新 lesson。
- `lessons` 表只有普通索引：`student_id`、`teacher_id`、`status`、`scheduled_at`。
- 没有 PostgreSQL exclusion constraint，也没有事务内教师/学员时间窗锁。
- 学生钱包扣款有 `SELECT ... FOR UPDATE`，但只串行同一学生钱包；无法保护“同一教师被不同学生并发预约同一时段”。

建议：
- 优先使用 PostgreSQL `btree_gist` + partial exclusion constraint，分别约束：
  - 同一 `teacher_id` 的非 `cancelled/expired` 课程时间窗不可重叠。
  - 同一 `student_id` 的非 `cancelled/expired` 课程时间窗不可重叠。
- 时间窗可表达为 `tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_minutes), '[)')`。
- 同步在 `Lesson.__table_args__` 或迁移中声明，测试库 `Base.metadata.create_all` 与生产 Alembic 都要覆盖；否则 pytest 仍测不到 DB 约束。
- 如果短期不做 DB 排他约束，至少用事务级 advisory lock 串行同一 teacher/student 的建课请求；单纯 `SELECT ... FOR UPDATE` 锁已有 lesson 不能保护“当前没有已有行”的并发空窗。
- API 层捕获 DB 约束冲突并映射为稳定业务错误，例如“该时段与已有课程冲突”，供前端恢复为重新选时段。

## 需要修改的文件

### 前端

| 文件 | 建议改动 |
|---|---|
| `frontend/src/app/pages/TeacherProfile.tsx` | 接入预约表单、选时段、提交 `POST /lessons`、错误恢复、成功跳转。 |
| `frontend/src/app/pages/StudentDashboard.tsx` | 按状态分组课程；按规则展示课堂入口；把 `reviewed` 纳入学习记录。 |
| `frontend/src/app/pages/Classroom.tsx` | 进入前加载 lesson 状态并阻断不可进入课程；必要时接入 `PATCH /lessons/{id}/start/end`。 |
| `frontend/src/app/pages/Wallet.tsx` | 支持充值后的 return path；可读取并展示从预约页带来的充值意图。 |
| `frontend/src/app/types/api.ts` | 增加 `LessonOut`、`LessonCreate`、`LessonStatus` 或课堂入口辅助类型。 |
| `frontend/src/app/lib/format.ts` | 如需要，补课时结束时间/进入窗口格式化工具。 |

### 后端

| 文件 | 建议改动 |
|---|---|
| `backend/app/services/lesson_service.py` | 补并发安全的重叠预约保护；保留现有 `_has_overlap` 作为友好错误前置校验。 |
| `backend/app/models/lesson.py` | 增加 DB 层重叠约束声明，或至少记录与迁移一致的索引/约束。 |
| `backend/alembic/versions/<new>_lesson_overlap_constraints.py` | 启用 `btree_gist`，增加 teacher/student 两个 partial exclusion constraint。 |
| `backend/app/api/v1/lessons.py` | 将 DB 约束冲突转换为前端可读业务错误；如 writer 选择后端返回入口规则，也在此扩展 schema。 |
| `backend/app/schemas/lesson.py` | 视计划增加 `LessonStatus`、`ends_at`、`can_enter_classroom` 或 `payment_order_id` 等列表字段。 |
| `backend/app/services/message_service.py` / `lesson_service.require_lesson_participant` | 若后端也要强制课堂状态规则，需要把“可参与课堂”与“可查看课时”分开。 |

## 测试入口

### 后端 pytest

- `cd backend; python -m pytest tests/api/v1/test_teachers.py -q`
  - 回归教师列表/详情/公开 availability。
- `cd backend; python -m pytest tests/api/v1/test_lessons.py -q`
  - 预约 happy path、余额不足、取消退款、开始/结束。
  - 本 Spec 应新增：同一教师重叠预约拒绝、同一学员重叠预约拒绝、并发建课只成功一个。
- `cd backend; python -m pytest tests/api/v1/test_lesson_messages.py -q`
  - 回归课堂消息鉴权与 WebSocket。
  - 如果后端阻断 pending/cancelled 课堂，应补对应用例。
- `cd backend; python -m pytest tests/api/v1/test_payment_settlement.py -q`
  - 回归 `<24h` held_until、`>=24h` 退款、佣金有效完课口径。
- 组合建议：`cd backend; python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q`

注意：`backend/tests/conftest.py` 使用 `postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/cnvn_test`，本机需先有 `cnvn_test` 测试库。近期支付测试已发现 `Base.metadata.create_all` 不执行 Alembic seed，涉及 ledger 的测试需要初始化固定账户。

### 前端

- 当前 `frontend/package.json` 只有 `dev` 和 `build`，没有 Vitest/Playwright/Cypress 测试入口。
- 最低验证：`cd frontend; pnpm run build`。
- 建议本 Spec 增加浏览器手工回归清单或后续引入 Playwright：登录学员 → 钱包充值 → 教师详情预约 → 学员中心看到待确认 → 教师确认 → 学员中心显示课堂入口 → 进入课堂消息页。

## 风险与依赖

| 风险/依赖 | 说明 |
|---|---|
| 支付一致性依赖 | 本 Spec 依赖 `20260501-1124-支付托管退款结算一致性` 的 `<24h` 取消和佣金统计修复；该 Spec 已有通过报告，但合并顺序仍要确认。 |
| DB 排他约束迁移风险 | PostgreSQL exclusion constraint 需要 `btree_gist`；测试库若只用 `Base.metadata.create_all`，必须确保模型或测试迁移路径能创建同等约束。 |
| 预约按钮暴露后会放大并发风险 | 如果先上前端预约而后端无 DB/锁保护，真实用户会触发双订和重复扣款争议。 |
| 课堂入口语义需产品确认 | “confirmed 是否可提前进入”“谁触发 start/end”“pending 能否进等候室”需要 writer 固化，避免前端和后端各自判断。 |
| `Lesson.status` 复用过多 | 当前履约、评价、取消/过期都塞进同一状态字段；本 Spec 短期按现状分组，中长期应拆评价状态或派生展示状态。 |
| 用户资料接口未实现 | `/users/me` 仍是 501；不阻塞本 Spec P0，但会影响后续学生中心个人资料完善。 |
| 前端无自动化测试 | 本轮 UI 改动容易出现回归；至少必须跑 build，并建议补一条真实浏览器主链路验证。 |

## 建议实现顺序

1. **后端先补重叠预约并发保护**：DB exclusion constraint 或 advisory lock + 约束冲突错误映射；补 `test_lessons.py` 重叠/并发用例。
2. **教师详情页接通预约创建**：选时段、时长、topic、登录态、`POST /lessons`、成功跳转学员中心。
3. **余额不足恢复路径**：教师详情页错误映射到钱包充值，钱包支持 return path，充值后回到原预约上下文。
4. **学员中心状态分组和课堂入口规则**：先用前端派生规则落地；如 writer 决定后端返回 `can_enter_classroom`，同步扩展 schema 和测试。
5. **课堂页入口防线**：加载 lesson 后阻断 pending/cancelled/expired/completed；如果纳入本 Spec，再接 `start/end` 状态流转。
6. **回归验证**：后端跑教师/课程/课堂消息/支付组合 pytest；前端跑 `pnpm run build`；补手工或自动浏览器主链路证据。

## 给下游角色的交接

### 给 spec-writer

- P0 不建议扩大到收藏、推荐、再次预约、真实支付渠道或用户资料编辑。
- 先把后端并发保护写入第一阶段，否则前端一接预约按钮就会暴露双订风险。
- 明确课堂入口规则的时间窗口与状态边界；若规则要后端权威返回，请在 `LessonListItem` 契约中定义字段。
- 余额不足恢复应复用现有 `/wallet` 和 `POST /wallet/topup`，不要新增课程相关 wallet 服务函数。

### 给 spec-tester

- 后端必须新增重叠预约测试，最好包含两个并发请求只成功一个的用例。
- 前端没有测试框架，测试计划应明确 build、手工浏览器主链路和关键错误恢复截图/日志证据。
- 学员中心测试要覆盖：pending 无课堂入口、confirmed 入口受时间窗控制、in_progress 有入口、cancelled/expired 无入口、completed/reviewed 入历史。
- 余额不足测试要断言：预约失败不创建 lesson、不扣款；用户可从提示进入钱包并返回原教师详情。
