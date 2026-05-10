---
type: spec-plan
status: ready_for_executor
created: 2026-05-01
updated: 2026-05-01
spec_dir: spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环
git_branch: feat/spec-20260501-1153-student-booking-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
pr_url:
execution_mode: agent-team
tags:
  - spec
  - plan
  - student-booking-flow
related:
  - "[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]"
  - "[[../../../04-系统改进/20260501-1058-MVP到完善优化/writer/plan|MVP到完善优化]]"
  - "[[../../../04-系统改进/20260501-1124-支付托管退款结算一致性/writer/plan|支付托管退款结算一致性]]"
---

# 学员找老师到预约上课闭环

## 1. 概述

本 Spec 面向学员侧 P0 主链路：学员从首页或教师列表进入教师详情页，选择可授课时段并提交预约，余额不足时能充值后恢复预约，预约成功后在学员中心看到明确的课程状态，并且只在允许规则内进入课堂。

探索报告已确认当前后端 `POST /lessons`、钱包扣款托管、教师 availability 校验、课程状态流转和课堂消息能力已经存在；本计划不重写这些模块，而是补齐 P0 缺口：

- 教师详情页接通真实预约创建。
- 后端补充同一教师/同一学员重叠预约的并发保护。
- 预约错误语义稳定到前端可恢复动作。
- 学员中心按课程状态分组，并按统一规则展示课堂入口。

### 1.1 范围内

- `TeacherProfile.tsx`：最小预约表单、提交 `POST /lessons`、余额不足恢复。
- `Wallet.tsx`：支持从预约页进入钱包、充值后返回原教师详情页继续预约。
- `StudentDashboard.tsx`：课程状态分组、历史包含 `reviewed`、课堂入口规则。
- `Classroom.tsx`：直达课堂链接的前端预检，禁止不可进入课程继续连接消息/WS。
- `lesson_service` / `lessons.py` / `schemas/lesson.py` / `models/lesson.py` / Alembic：并发重叠保护、错误语义、课程列表派生字段。
- 后端 pytest 与前端 build/手工主链路验证所需的最小测试补充。

### 1.2 范围外

- 不新增真实支付渠道、真实 VietQR 自动对账、VNPay/MoMo。
- 不新增课程相关 `wallet_service` 函数，不直接修改 `Wallet.balance`。
- 不重做教师搜索、推荐排序、收藏、再次预约、最近浏览。
- 不实现教师端确认 UI；教师确认链路由教师闭环 Spec 承接，本 Spec 可通过现有 `PATCH /lessons/{id}/confirm` 做验证。
- 不实现音视频课堂、课件、评价表单；课堂与评价体验由 `20260501-1123-课堂互动与课后评价闭环` 承接。

## 2. 需求分析

### 2.1 现状依据

| 模块 | 当前状态 | 本 Spec 处理 |
|---|---|---|
| 教师发现 | `Home.tsx` / `Teachers.tsx` 已能跳转 `/teachers/:id` | 不改搜索与推荐，仅接教师详情页预约入口 |
| 教师详情 | `TeacherProfile.tsx` 展示 teacher/reviews/availability，`预约试课` 无 handler | 增加可提交预约表单和错误恢复 |
| 预约 API | `POST /lessons` 已做教师有效性、未来时间、availability、重叠查询、扣款托管 | 保留事务边界，补 DB 层并发保护和稳定错误语义 |
| 支付 | `payment_service.create_order_for_lesson` 余额不足抛 `ValueError("余额不足")` | 前端识别余额不足并跳钱包恢复，不新增支付服务 |
| 学员中心 | 只区分 upcoming/completed，所有 upcoming 都显示课堂入口 | 改为状态分组和入口规则 |
| 课堂页 | 只校验参与者，直接拉消息并连 WS | 前端先拉课程详情，非允许状态不连接课堂 |

### 2.2 P0 验收标准

| ID | 验收标准 |
|---|---|
| AC-P0-01 | 已登录学员在教师详情页选择 availability 覆盖的未来时段、时长和 topic 后提交，后端返回 `201`，生成 `pending_confirmation` 课程，学生钱包被扣款，付款单进入托管，前端跳转 `/dashboard/student`。 |
| AC-P0-02 | 未登录用户点击预约时跳转 `/login`，登录后能回到原教师详情页，预约草稿不丢失。 |
| AC-P0-03 | 余额不足时预约失败不创建 lesson、不扣款；教师详情页展示“去充值后继续预约”，跳转 `/wallet` 后充值成功可返回原教师详情页继续提交原草稿。 |
| AC-P0-04 | 同一教师同一时间窗、同一学员同一时间窗的重叠预约被拒绝；并发请求只允许一个成功，失败请求返回稳定冲突语义且不会重复扣款。 |
| AC-P0-05 | 学员中心分组展示：待老师确认、待上课、进行中、已完成、已取消/已过期；`completed` 和 `reviewed` 都进入历史记录。 |
| AC-P0-06 | 课堂入口只在 `confirmed` 且处于进入窗口内，或 `in_progress` 时可用；`pending_confirmation`、`cancelled`、`expired`、`completed`、`reviewed` 均不显示可点击入口。 |
| AC-P0-07 | 用户直接访问 `/classroom/:id` 时，前端先读取课程详情；不可进入时展示原因并返回学员中心，不拉历史消息、不建立 WebSocket。 |
| AC-P0-08 | 通过后端课程/教师/课堂消息/支付组合回归，前端 `pnpm run build` 通过，并由 tester 在 `tester/test-plan.md` 中记录主链路手工验证。 |

## 3. 设计方案

### 3.1 后端契约

#### 3.1.1 `POST /lessons`

保持请求体不变：

```json
{
  "teacher_id": "uuid",
  "scheduled_at": "ISO datetime",
  "duration_minutes": 60,
  "topic": "试听课"
}
```

成功仍返回 `LessonOut`。失败语义按以下规则稳定：

| 场景 | HTTP | `detail` | 前端恢复动作 |
|---|---:|---|---|
| 未登录/登录过期 | 401 | 由鉴权依赖返回 | 跳转登录并保留预约草稿 |
| 非学生身份 | 403 | 由 `get_current_student` 返回 | 提示切换学生身份 |
| 教师不存在 | 404 | `教师不存在` | 返回教师列表 |
| 向自己预约、教师不可预约、过去时间、availability 不覆盖 | 400 | 沿用当前中文业务原因 | 停留表单并让用户修改 |
| 余额不足 | 400 | `余额不足` | 跳钱包充值并保留预约草稿 |
| 教师或学员时间窗冲突 | 409 | `该时段与已有课程冲突` | 重新加载 availability，引导换时段 |

> [!important]
> 本 Spec 不引入新的全局错误 envelope。前端继续使用 `ApiError.status` + `message/detail` 映射恢复动作，避免扩大 API 改造面。

#### 3.1.2 课程列表字段和状态

`Lesson.status` 仍使用现有履约状态，不新增 DB 状态字段：

```text
pending_confirmation | confirmed | in_progress | completed | reviewed | cancelled | expired
```

在 `LessonListItem` 和 `LessonOut` 增加派生字段，供学员中心和课堂页使用：

| 字段 | 类型 | 来源 |
|---|---|---|
| `ends_at` | datetime | `scheduled_at + duration_minutes` |
| `can_enter_classroom` | boolean | 状态 + 进入窗口派生 |
| `classroom_unavailable_reason` | string \| null | 不可进入时的稳定中文原因 |

课堂进入窗口固定为：开课前 15 分钟到计划结束后 15 分钟。

规则：

| 状态 | 学员中心分组 | 课堂入口 |
|---|---|---|
| `pending_confirmation` | 待老师确认 | 不可进入，原因：`等待老师确认` |
| `confirmed` 且未到窗口 | 待上课 | 不可进入，原因：`未到可进入时间` |
| `confirmed` 且在窗口内 | 待上课 | 可进入 |
| `confirmed` 且超过窗口 | 待上课 | 不可进入，原因：`课堂进入时间已过` |
| `in_progress` | 进行中 | 可进入 |
| `completed` / `reviewed` | 已完成 | 不可进入，原因：`课程已完成` |
| `cancelled` | 已取消/已过期 | 不可进入，原因：`课程已取消` |
| `expired` | 已取消/已过期 | 不可进入，原因：`课程已过期` |

### 3.2 后端并发保护

采用 PostgreSQL exclusion constraint 作为 P0 务实实现，理由是项目数据库为 PostgreSQL 16，且单纯应用层 `_has_overlap` 无法保护“并发时都未读到已有行”的空窗。

实现要求：

1. 保留 `lesson_service._has_overlap` 作为提交前友好错误校验。
2. 新增 Alembic 迁移 `backend/alembic/versions/004_lesson_overlap_constraints.py`：
   - `CREATE EXTENSION IF NOT EXISTS btree_gist`
   - 增加同教师排他约束 `ex_lessons_teacher_no_overlap`
   - 增加同学员排他约束 `ex_lessons_student_no_overlap`
   - 时间窗表达为 `tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_minutes), '[)')`
   - partial 条件：`status NOT IN ('cancelled', 'expired')`
3. 在 `backend/app/models/lesson.py` 的 `__table_args__` 声明同等 `ExcludeConstraint`，保证 `Base.metadata.create_all` 的测试库路径也覆盖约束。
4. 在 `backend/tests/conftest.py` 的 `Base.metadata.create_all` 前执行 `CREATE EXTENSION IF NOT EXISTS btree_gist`，否则测试库会因为 GiST UUID 操作符类缺失而无法建表。
5. `lesson_service.create_lesson` 在 `db.flush()` 插入 lesson 时捕获 `IntegrityError`：
   - 若约束名是上述两个排他约束，rollback 后抛 `LessonBookingConflict("该时段与已有课程冲突")`。
   - 其他数据库错误继续抛出，不吞掉未知问题。
6. `backend/app/api/v1/lessons.py` 将 `LessonBookingConflict` 映射为 `409 Conflict`。
7. 支付扣款仍只通过 `payment_service.create_order_for_lesson`，不得在课程服务中直接改钱包。

### 3.3 前端：TeacherProfile 预约表单

在 `frontend/src/app/pages/TeacherProfile.tsx` 内完成最小可用表单，不抽象新页面：

- 增加预约状态：`selectedSlot`、`durationMinutes`、`topic`、`submitting`、`bookingError`、`resumeHint`。
- 从 `AvailabilityOut[]` 派生未来 14 天可选时段：
  - 支持 `specific_date` 和每周 recurring `day_of_week`。
  - 以 30 分钟为步进生成开始时间。
  - 选项必须保证 `duration_minutes` 落在 availability 的 `start_time` 到 `end_time` 内。
  - 越南本地时间提交时用 `YYYY-MM-DDTHH:mm:ss+07:00` 转 ISO，避免浏览器本地时区把越南时间错转。
- 时长选项固定为 `30 / 60 / 90 / 120` 分钟，默认 60；价格预览按 `Math.ceil(hourly_rate * duration / 60)`。
- topic 为可选输入，最长 200 字，提交前 trim。
- 未登录时：
  - 将草稿写入 `sessionStorage`，key 为 `cnvn_pending_booking_v1`。
  - `navigate("/login", { state: { from: location } })`。
- 提交：
  - `apiFetchJson<LessonOut>("/lessons", { method: "POST", body: JSON.stringify(payload) })`
  - 成功后清除草稿，`navigate("/dashboard/student", { state: { bookingCreated: lesson.id } })`。
- 错误恢复：
  - `400` 且 message 包含 `余额不足`：保留草稿，展示充值动作，跳转 `/wallet?returnTo=/teachers/{id}&intent=booking`。
  - `409` 或 message 包含 `冲突`：提示重新选择时段，并重新拉取 availability。
  - message 包含 `可授课`：提示当前时段不可用。
  - `401/403`：提示登录或切换学生身份。

### 3.4 前端：Wallet 充值恢复

在 `frontend/src/app/pages/Wallet.tsx` 做最小恢复支持：

- 读取 query `returnTo` 和 `intent`。
- 当 `intent=booking` 且 sessionStorage 存在 `cnvn_pending_booking_v1` 时，页面顶部展示“充值后返回继续预约”的轻提示。
- Mock 充值成功后不自动提交预约，只显示或启用“返回继续预约”动作：
  - `returnTo` 必须以 `/teachers/` 开头，避免开放跳转。
  - 返回后 `TeacherProfile` 从 sessionStorage 恢复 slot/topic/duration，用户再次确认提交。
- 原有 VietQR/线下登记/交易流水不改业务语义。

### 3.5 前端：StudentDashboard 状态分组

在 `frontend/src/app/pages/StudentDashboard.tsx` 从当前两个查询改为以下加载方式：

- `GET /auth/me`
- `GET /wallet`
- `GET /lessons?role=student&page_size=100`

前端按 `status` 分组：

| 分组 | 状态 |
|---|---|
| 待老师确认 | `pending_confirmation` |
| 待上课 | `confirmed` |
| 进行中 | `in_progress` |
| 已完成 | `completed`, `reviewed` |
| 已取消/已过期 | `cancelled`, `expired` |

展示规则：

- 每个分组有明确空态，避免用户以为预约失败。
- 课程卡片展示 topic、教师名、时间、时长、价格、状态。
- 课堂入口只使用后端返回的 `can_enter_classroom`；不可进入时展示 `classroom_unavailable_reason`。
- `reviewed` 历史显示“已评价”，`completed` 显示“待评价”；评价表单不在本 Spec 实现。
- “即将开始的课程”标题改成状态分组后的页面结构，不再把所有 future lesson 都当成可进教室。

### 3.6 前端：Classroom 直达预检

在 `frontend/src/app/pages/Classroom.tsx` 连接消息和 WebSocket 前增加课程预检：

- 先请求 `GET /lessons/{lessonId}`。
- 若 `can_enter_classroom` 为 false：
  - 展示 `classroom_unavailable_reason`。
  - 提供返回 `/dashboard/student` 的操作。
  - 不请求 `/messages`，不建立 WebSocket。
- 若可进入，沿用现有历史消息和 WS 逻辑。

本 Spec 不自动调用 `PATCH /lessons/{id}/start` 或 `end`；课堂状态流转 UI 由课堂互动 Spec 承接。

## 4. 执行模式

`execution_mode: agent-team` 表示实现阶段允许 spec-executor 在 TeamLead 协调下拆成后端、前端和验证子任务并行推进。所有代码改动仍必须严格追溯到本 `writer/plan.md`，不得借 agent-team 扩大范围。

建议分工：

| 子任务 | 责任边界 |
|---|---|
| 后端执行 | DB 排他约束、错误语义、课程列表派生字段、pytest |
| 前端执行 | TeacherProfile 预约表单、Wallet 恢复、StudentDashboard 分组、Classroom 预检 |
| 验证执行 | 后端组合回归、前端 build、手工主链路记录 |

## 5. 实现步骤

1. 后端先落并发保护：
   - 新建迁移 `004_lesson_overlap_constraints.py`。
   - 更新 `Lesson.__table_args__`。
   - 更新测试库建表前 extension 初始化。
   - 新增/调整 `test_lessons.py` 重叠和并发用例。
2. 后端稳定错误和列表契约：
   - 新增 `LessonBookingConflict`。
   - `create_lesson` 捕获排他约束冲突并映射 409。
   - `LessonOut` / `LessonListItem` 增加 `ends_at`、`can_enter_classroom`、`classroom_unavailable_reason`。
   - `list_lessons` 和 `get_lesson` 统一使用同一派生规则。
3. 前端补类型：
   - `frontend/src/app/types/api.ts` 增加 `LessonOut`、`LessonCreate`、`LessonStatus`，并扩展 `LessonListItem` 派生字段。
4. 教师详情页接预约：
   - availability 生成 slot。
   - 表单校验、价格预览、提交 `POST /lessons`。
   - 登录、余额不足、冲突、availability 错误恢复。
5. 钱包页接恢复：
   - 读取 `returnTo` / `intent`。
   - 充值成功后允许回到教师详情页恢复草稿。
6. 学员中心改状态分组：
   - 加载完整学员课程列表。
   - 分组展示状态。
   - 课堂入口仅由 `can_enter_classroom` 控制。
   - 历史纳入 `reviewed`。
7. 课堂页补直达防线：
   - 先拉课程详情。
   - 不可进入时阻断消息和 WS。
8. executor 输出 `executor/summary.md`，列出实际文件、API 契约、测试结果和任何偏离本计划的说明。

## 6. 风险和依赖

| 风险/依赖 | 处理方式 |
|---|---|
| 支付一致性依赖 | 依赖 `支付托管退款结算一致性` Spec 的退款/结算口径；本 Spec 不改支付规则。 |
| `btree_gist` 扩展 | Alembic 和测试建表路径都必须创建 extension，否则排他约束无法稳定验证。 |
| 前端 slot 生成时区 | 固定按越南 `+07:00` 解释用户选择的日期时间，不使用浏览器本地时区直接构造预约时间。 |
| 教师确认 UI 不在本 Spec | 学员中心能展示 `pending_confirmation`；验证 confirmed/in_progress 可通过现有后端接口造数。 |
| 课堂状态流转 UI 不在本 Spec | 本 Spec 只控制入口可见性和直达预检，不接 start/end 按钮。 |
| 前端无自动化测试框架 | P0 至少跑 `pnpm run build`，并由 tester 记录浏览器手工主链路。 |

## 7. 测试计划引用

测试计划由 spec-tester 在 `[[../tester/test-plan|tester/test-plan.md]]` 创建。本计划要求 tester 至少覆盖以下验证点：

- 后端：
  - `cd backend; python -m pytest tests/api/v1/test_teachers.py -q`
  - `cd backend; python -m pytest tests/api/v1/test_lessons.py -q`
  - `cd backend; python -m pytest tests/api/v1/test_lesson_messages.py -q`
  - `cd backend; python -m pytest tests/api/v1/test_payment_settlement.py -q`
  - 组合：`cd backend; python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q`
- 后端新增断言：
  - 同一教师重叠预约拒绝。
  - 同一学员重叠预约拒绝。
  - 并发建课同一时间窗只成功一个，失败为 409，钱包不重复扣款。
  - `LessonListItem` / `LessonOut` 返回课堂入口派生字段。
- 前端：
  - `cd frontend; pnpm run build`
  - 手工主链路：登录学员 -> 钱包充值 -> 教师详情预约 -> 学员中心看到待确认 -> 调后端确认 -> 学员中心在进入窗口内显示课堂入口 -> 课堂可连接消息。
  - 手工恢复链路：余额不足预约 -> 去钱包充值 -> 返回教师详情页 -> 原草稿恢复并能再次提交。
  - 手工状态链路：pending/confirmed/in_progress/completed/reviewed/cancelled/expired 分组和课堂入口符合规则。

## 8. 文档关联

- Team Context：`[[../lead/team-context|Team Context]]`
- 探索报告：`[[../explorer/exploration-report|探索报告]]`
- 测试计划：`[[../tester/test-plan|测试计划]]`（待创建）
- 实现总结：`[[../executor/summary|实现总结]]`（待创建）
- 场景地图：`[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]`
- 总控规划：`[[../../../04-系统改进/20260501-1058-MVP到完善优化/writer/plan|MVP到完善优化]]`
- 支付规则：`.agents/rules/payment-system.md`
