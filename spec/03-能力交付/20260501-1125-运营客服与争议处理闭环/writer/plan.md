---
type: spec-plan
status: ready
created: 2026-05-01
git_branch: feat/spec-20260501-1415-dispute-support-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
execution_mode: agent-teams
---

# 运营客服与争议处理闭环

## 1. 概述

### 1.1 背景

当前系统已经具备课程预约、托管付款、课程完成后进入争议期、`dispute_watcher` 到期自动释放、教师出款与学员退款能力。真实交易闭环仍缺少人工争议处理：用户无法正式发起争议，运营无法查看课程/付款上下文，也无法在受控权限与审计记录下执行人工退款或人工释放。

本 Spec 将现有 `PaymentOrder.status='disputed'` 从预留状态收敛为可执行产品闭环：争议打开后暂停自动释放，由运营客服按上下文处理，处理结果必须通过既有支付服务完成资金动作并保留审计。

### 1.2 目标

- 用户可以从课程或付款单发起争议，形成一条可追踪的 `DisputeCase`。
- 运营客服可以检索争议列表、查看课程/付款/双方用户上下文、记录处理过程。
- 运营客服可以在受控条件下执行人工退款或人工释放，并关闭争议。
- `dispute_watcher` 必须跳过已打开争议或 `PaymentOrder.status='disputed'` 的订单，不能自动释放。
- 前端提供最小可用入口，不建设完整后台工作台。

### 1.3 范围

纳入本 Spec：

- 后端争议模型、迁移、Schema、Service、API。
- 临时运营权限依赖。
- 支付动作约束与审计记录。
- watcher 跳过 open/disputed。
- 学员端/付款单详情的最小发起入口，以及运营端最小列表/详情/处理入口。
- 后端单元/集成测试、前端最小交互验证。

不纳入本 Spec：

- 附件上传、图片证据、聊天记录导入。
- 多级审批流、风控标签、复杂工单 SLA。
- 站内信、短信、邮件、Webhook 通知。
- 自动裁决、部分退款、赔付券、罚款、调课。
- 独立运营账号体系和完整权限管理后台。

## 2. 需求分析

### 2.1 P0 验收项

| ID | 验收项 |
|----|--------|
| AC-P0-01 | 学员本人可以对自己课程的活跃付款单发起争议；非本人课程/付款单返回 `403`，不存在返回 `404`。 |
| AC-P0-02 | 争议只能针对 `PaymentOrder.status in ('held', 'disputed')` 的订单；`released/refunded/pending/paid` 不允许新开争议。 |
| AC-P0-03 | 同一活跃付款单同一时间最多存在一个 `open` 或 `processing` 争议；重复发起返回现有争议或 `409`，不能创建多条待处理争议。 |
| AC-P0-04 | 发起争议时，`PaymentOrder.status` 必须置为 `disputed`，并写入 `DisputeEvent(type='opened')`。 |
| AC-P0-05 | `dispute_watcher.run_once` 不处理 `status='disputed'` 的订单，也不处理存在 `open/processing` 争议的订单；到期后仍保持托管。 |
| AC-P0-06 | 运营客服可以按状态分页查询争议列表，并查看争议详情中的课程、付款单、学员、教师、金额、`held_until` 和事件历史。 |
| AC-P0-07 | 运营客服可以接单/标记处理中，仅更新争议状态和事件记录，不触发资金动作。 |
| AC-P0-08 | 运营客服执行人工退款时，只能调用 `payment_service.refund_payment_order`；成功后订单为 `refunded`，争议为 `resolved_refunded`，事件记录包含 `operator_id` 和 `reason`。 |
| AC-P0-09 | 运营客服执行人工释放时，必须先关闭争议并把订单从 `disputed` 受控恢复为 `held`，再调用 `payment_service.release_payment_order`；成功后订单为 `released`，争议为 `resolved_released`，不能绕过结算快照、账本和出款流程。 |
| AC-P0-10 | 已 `released/refunded` 的订单不允许再次处理争议资金动作；重复处理返回幂等结果或 `409`，不能重复入账、重复出款或重复退款。 |
| AC-P0-11 | 临时运营权限必须阻止普通学员/教师调用运营 API；未授权返回 `403`。 |
| AC-P0-12 | 前端至少提供学员发起争议入口、付款单详情发起争议入口、运营争议列表/详情/处理入口；无附件、审批、通知。 |

### 2.2 用户故事

| 角色 | 场景 | 结果 |
|------|------|------|
| 学员 | 课程完成后对教学质量或未履约发起争议 | 付款单进入 `disputed`，自动释放停止，运营可见 |
| 教师 | 课程被争议后等待运营处理 | 资金仍在托管，不自动释放，也不立即退款 |
| 运营客服 | 查看争议上下文并决定退款或释放 | 系统执行受控资金动作并留下审计 |

### 2.3 状态定义

`DisputeCase.status`：

- `open`：用户已提交，等待运营处理。
- `processing`：运营已接手或补充处理记录。
- `resolved_refunded`：裁决退款给学员，终态。
- `resolved_released`：裁决释放给教师，终态。
- `closed_no_action`：关闭但不执行资金动作，终态；仅用于重复/误提交且付款单仍可按原规则处理。

`DisputeEvent.type`：

- `opened`
- `assigned`
- `note_added`
- `refunded`
- `released`
- `closed_no_action`

> [!important]
> 资金终态以 `PaymentOrder.status` 为准，争议终态必须与资金动作一致。`resolved_refunded` 对应 `refunded`，`resolved_released` 对应 `released`。

## 3. 设计方案

### 3.1 数据模型

新增 `backend/app/models/dispute.py`，并在 `backend/app/models/__init__.py` 导出。

#### 3.1.1 `DisputeCase`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 争议 ID |
| `lesson_id` | UUID | FK `lessons.id`, not null | 关联课程 |
| `payment_order_id` | UUID | FK `payment_orders.id`, not null | 关联付款单 |
| `student_id` | UUID | FK `users.id`, not null | 发起学员 |
| `teacher_id` | UUID | FK `teacher_profiles.id`, not null | 课程教师档案 |
| `status` | String(30) | not null, default `open` | 争议状态 |
| `reason_code` | String(50) | not null | 原因枚举字符串 |
| `description` | Text | nullable | 用户描述，最长由 Schema 限制 |
| `operator_id` | UUID | FK `users.id`, nullable | 当前处理人 |
| `resolution` | Text | nullable | 处理结论 |
| `resolved_at` | DateTime tz | nullable | 终态时间 |
| `created_at` | DateTime tz | not null | 创建时间 |
| `updated_at` | DateTime tz | not null | 更新时间 |

索引与约束：

- `INDEX (status, created_at)` 支持运营列表。
- `INDEX (payment_order_id)` 支持按付款单查询。
- PostgreSQL 部分唯一索引：`UNIQUE (payment_order_id) WHERE status IN ('open', 'processing')`，保证同一付款单只有一个活跃争议。

#### 3.1.2 `DisputeEvent`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 事件 ID |
| `dispute_id` | UUID | FK `dispute_cases.id`, not null | 关联争议 |
| `type` | String(30) | not null | 事件类型 |
| `actor_id` | UUID | FK `users.id`, nullable | 操作用户；系统事件可为空 |
| `note` | Text | nullable | 事件说明 |
| `from_status` | String(30) | nullable | 原状态 |
| `to_status` | String(30) | nullable | 新状态 |
| `created_at` | DateTime tz | not null | 创建时间 |

索引：

- `INDEX (dispute_id, created_at)` 支持详情时间线。

### 3.2 Schema

新增 `backend/app/schemas/dispute.py`。

```python
class DisputeCreate(BaseModel):
    lesson_id: UUID | None = None
    payment_order_id: UUID | None = None
    reason_code: Literal[
        "teacher_no_show",
        "student_no_show",
        "quality_issue",
        "technical_issue",
        "payment_issue",
        "other",
    ]
    description: str = Field(min_length=1, max_length=1000)

class DisputeHandleRequest(BaseModel):
    action: Literal["assign", "add_note", "refund", "release", "close_no_action"]
    reason: str = Field(min_length=1, max_length=1000)

class DisputeOut(BaseModel):
    id: UUID
    status: str
    reason_code: str
    description: str | None
    lesson_id: UUID
    payment_order_id: UUID
    student_id: UUID
    teacher_id: UUID
    operator_id: UUID | None
    resolution: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None

class DisputeDetailOut(DisputeOut):
    payment_order: PaymentOrderDetail
    lesson: LessonOut
    student_name: str | None
    teacher_name: str | None
    events: list[DisputeEventOut]
```

Schema 可以按现有 `PaymentOrderDetail` 和 `LessonOut` 做精简复用，但响应必须覆盖 P0 上下文字段。

### 3.3 Service

新增 `backend/app/services/dispute_service.py`。

#### 3.3.1 `create_dispute`

输入：`db`, `current_user`, `lesson_id | payment_order_id`, `reason_code`, `description`。

流程：

1. 根据 `payment_order_id` 或 `lesson_id` 定位 `PaymentOrder` 和 `Lesson`，必要时 `with_for_update()` 锁定付款单。
2. 校验当前用户是 `PaymentOrder.student_id`。
3. 校验订单状态为 `held` 或 `disputed`；若为 `disputed` 且已有活跃争议，返回现有争议或抛 `409`。
4. 校验无 `open/processing` 活跃争议。
5. 创建 `DisputeCase(status='open')`。
6. 将 `PaymentOrder.status` 置为 `disputed`，更新时间。
7. 写 `DisputeEvent(type='opened', actor_id=current_user.id, to_status='open')`。
8. `flush` 后返回争议。

#### 3.3.2 `list_disputes`

支持运营按 `status`、`page`、`page_size` 查询，默认按 `created_at desc`。P0 不做全文搜索和复杂筛选。

#### 3.3.3 `get_dispute_detail`

返回争议、课程、付款单、学员名称、教师名称、事件列表。必须校验运营权限。

#### 3.3.4 `handle_dispute`

输入：`action`, `reason`, `operator`。

通用约束：

- 使用事务内 `with_for_update()` 锁定 `DisputeCase` 和 `PaymentOrder`。
- 仅 `open/processing` 可执行处理动作。
- 所有动作写 `DisputeEvent`。
- `refund/release/close_no_action` 后争议进入终态，设置 `operator_id/resolution/resolved_at`。

动作规则：

| action | 允许状态 | 资金动作 | 状态变化 |
|--------|----------|----------|----------|
| `assign` | `open/processing` | 无 | `open -> processing` 或保持 `processing` |
| `add_note` | `open/processing` | 无 | 状态不变 |
| `refund` | `open/processing` 且订单 `disputed` | 调 `payment_service.refund_payment_order(db, order, reason)` | 争议 `resolved_refunded`，订单 `refunded` |
| `release` | `open/processing` 且订单 `disputed` | 先把订单受控置回 `held`，再调 `payment_service.release_payment_order(db, order)` | 争议 `resolved_released`，订单 `released` |
| `close_no_action` | `open/processing` 且订单 `disputed` | 无 | 争议 `closed_no_action`，订单回到 `held`，恢复 watcher 后续到期释放 |

> [!warning]
> `release_payment_order` 当前只接受 `held`，因此人工释放不能直接从 `disputed` 调用。`dispute_service` 必须在锁内记录即将处理的争议，受控恢复为 `held`，再调用既有 release 服务，避免复制结算、账本、出款逻辑。

### 3.4 API

新增 `backend/app/api/v1/disputes.py` 并在 `backend/app/api/v1/router.py` 注册。

#### 用户 API

| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| `POST` | `/disputes` | 登录用户，学生本人 | 发起争议 |
| `GET` | `/disputes/my` | 登录用户 | 查看自己作为学员或课程教师相关的争议 |
| `GET` | `/disputes/{dispute_id}` | 争议相关用户或运营 | 查看争议详情 |

`POST /disputes` 错误码：

- `400`：参数缺失、状态不允许。
- `403`：不是付款单学员本人。
- `404`：课程或付款单不存在。
- `409`：已有活跃争议。

#### 运营 API

| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| `GET` | `/ops/disputes` | 临时运营权限 | 分页列表，支持 `status` |
| `GET` | `/ops/disputes/{dispute_id}` | 临时运营权限 | 详情与事件时间线 |
| `POST` | `/ops/disputes/{dispute_id}/actions` | 临时运营权限 | `assign/add_note/refund/release/close_no_action` |

### 3.5 临时运营权限

本 Spec 不建设完整 RBAC。采用最小临时方案：

- 在 `backend/app/dependencies.py` 增加 `get_current_operator`。
- 判定方式：当前 `User.roles` 包含 `"operator"` 或 `"admin"` 即允许。
- 不要求 `active_role` 切换为 operator，因为当前前端和登录令牌尚无运营角色界面；但 token 解码后会重新查库，因此测试中直接给测试用户写入角色即可生效。
- 普通学员/教师调用 `/ops/*` 返回 `403`，错误信息为 `需要运营权限`。

> [!important]
> 这是临时运营权限，仅服务本 Spec 的人工处理闭环。独立运营账号、角色管理后台、权限审计策略不在本 Spec 内。

### 3.6 支付动作约束

- 不新增任何直接改钱包、账本、出款单的运营代码。
- 退款只能走 `payment_service.refund_payment_order`。
- 释放只能走 `payment_service.release_payment_order`。
- `release` 动作必须在争议服务事务内锁定订单，确认订单仍为 `disputed` 且争议仍活跃，再把订单恢复为 `held` 后调用 release。
- `close_no_action` 只恢复订单为 `held`，不立即释放；后续仍由 `dispute_watcher` 按 `held_until` 处理。
- 若订单已是 `released/refunded`，争议处理 API 返回 `409`，不得重复资金动作。
- 事件记录必须记录 `operator_id`、动作、原因、状态变化。

### 3.7 `dispute_watcher` 调整

当前 watcher 查询条件已限制 `PaymentOrder.status == "held"`，因此天然不会处理 `disputed`。本 Spec 仍要求显式补强：

- 查询层保持 `status='held'`，并额外排除存在 `DisputeCase.status IN ('open', 'processing')` 的订单。
- 增加测试覆盖：`held_until < now` 但存在活跃争议时，`run_once` 返回 `0`，订单保持 `held` 或 `disputed`，不生成 `PayoutOrder`。
- `close_no_action` 后订单回到 `held`，如果 `held_until` 已过期，下一轮 watcher 可以释放。

### 3.8 前端最小入口

新增或调整：

- `frontend/src/app/types/api.ts`：增加 `Dispute*` 类型。
- `frontend/src/app/pages/StudentDashboard.tsx`：在已完成/已评价课程卡片提供“发起争议”按钮，打开最小表单弹窗，提交 `POST /disputes`。
- `frontend/src/app/pages/PaymentOrderDetail.tsx`：当付款单状态为 `held/disputed` 时显示争议入口；`disputed` 显示已有争议提示。
- `frontend/src/app/pages/OpsDisputes.tsx`：最小运营页面，列表 + 选中详情 + 处理动作按钮/原因输入。
- `frontend/src/app/routes.tsx`：注册 `/ops/disputes`。

前端边界：

- 不做附件上传。
- 不做审批流。
- 不做通知中心。
- 不做完整运营导航；可以通过直接访问 `/ops/disputes` 使用。
- 普通用户访问运营页面时展示 `403/无权限` 状态。

## 4. 执行模式

### 4.1 执行模式选择

**推荐模式**：Agent Teams

选择理由：

- 后端模型/API/支付约束、前端最小入口、测试验证可以并行拆分。
- 涉及迁移、服务事务、权限、watcher、页面入口和测试，跨模块超过 3 个文件。
- 资金动作风险较高，需要测试 Agent 独立验证幂等和资金不重复。

### 4.2 Agent Teams 任务拆分

| 队友名称 | 职责 | 输入 | 输出 | 依赖 |
|----------|------|------|------|------|
| backend-implementer | 争议模型、迁移、Schema、Service、API、运营权限、watcher 调整 | 本计划第 3.1-3.7 节 | 后端代码与迁移 | 无 |
| frontend-implementer | 学员/付款单争议入口、运营最小页面、类型更新、路由 | 本计划第 3.8 节和后端 API 约定 | 前端代码 | 后端 API 路径约定 |
| tester | 后端资金/权限/watcher 测试、前端最小 smoke 验证 | 本计划第 2.1、6 节 | 测试报告和必要修复反馈 | backend/frontend 产出 |
| reviewer | 对照 P0 验收项审查实现范围，确认未引入附件/审批/通知 | plan.md + 实现总结 + 测试报告 | review.md | 全部实现完成 |

### 4.3 协作规则

- backend-implementer 先稳定 API 和 Schema 名称，frontend-implementer 按本计划约定接入。
- tester 发现资金重复、权限绕过、watcher 误释放时，直接退回 backend-implementer 修复。
- 任何 Agent 不得扩大到附件、审批、通知或完整 RBAC。
- 所有 Agent 不得回滚其他子 Agent 的改动。

## 5. 实现步骤

### 5.1 后端

1. 新建 `backend/app/models/dispute.py`，定义 `DisputeCase`、`DisputeEvent` 与关系。
2. 更新 `backend/app/models/__init__.py`，确保 Alembic 可发现模型。
3. 新建 Alembic migration，创建 `dispute_cases`、`dispute_events`、索引和活跃争议部分唯一索引。
4. 新建 `backend/app/schemas/dispute.py`。
5. 在 `backend/app/dependencies.py` 增加 `get_current_operator`。
6. 新建 `backend/app/services/dispute_service.py`，实现 create/list/detail/handle。
7. 新建 `backend/app/api/v1/disputes.py`，注册用户 API 和运营 API。
8. 更新 `backend/app/api/v1/router.py` include 新 router。
9. 调整 `backend/app/services/dispute_watcher.py` 查询，显式排除活跃争议。
10. 必要时更新 `backend/app/schemas/payment.py`，让付款单详情能表达争议状态或关联争议 ID；仅限最小展示需要。

### 5.2 前端

1. 更新 `frontend/src/app/types/api.ts`，增加争议请求/响应类型。
2. 在 `StudentDashboard.tsx` 的课程卡加入最小争议入口，状态限定为 `completed/reviewed` 且后端最终校验付款单状态。
3. 在 `PaymentOrderDetail.tsx` 增加状态为 `held/disputed` 时的争议入口和提交状态。
4. 新建 `OpsDisputes.tsx`，实现分页列表、详情、事件历史、动作表单。
5. 更新 `routes.tsx` 注册 `/ops/disputes`。

### 5.3 数据与兼容

- 迁移不回填历史争议。
- 现有 `payment_orders.status='disputed'` 若没有 `DisputeCase`，运营列表不可见；后续可通过数据修复处理，本 Spec 不做历史修复。
- 不改现有 `PaymentOrder` 状态枚举常量，只使用已有 `disputed`。

## 6. 测试计划

### 6.1 后端测试

新增或扩展 `backend/tests/api/v1/test_disputes.py`、`backend/tests/api/v1/test_payment_settlement.py`。

| ID | 类型 | 场景 | 断言 |
|----|------|------|------|
| T-BE-01 | API | 学员对本人 held 订单发起争议 | 返回 `201/200`；创建 `DisputeCase(open)`；订单变 `disputed`；写 `opened` event |
| T-BE-02 | 权限 | 非本人对付款单发起争议 | `403`，无争议和订单状态变化 |
| T-BE-03 | 状态 | released/refunded 订单发起争议 | `400` 或 `409`，无状态变化 |
| T-BE-04 | 幂等/唯一 | 同一订单重复发起争议 | 不产生第二条 active case |
| T-BE-05 | 运营权限 | 普通用户访问 `/ops/disputes` | `403` |
| T-BE-06 | 运营详情 | operator 查看详情 | 包含 lesson/payment/student/teacher/events |
| T-BE-07 | 人工退款 | operator action `refund` | 调用退款路径效果：订单 `refunded`，学员钱包回款，争议 `resolved_refunded`，事件记录 reason/operator |
| T-BE-08 | 人工释放 | operator action `release` | 生成 `SettlementSnapshot/PayoutOrder`，教师钱包入账，订单 `released`，争议 `resolved_released` |
| T-BE-09 | 重复处理 | 已终态争议再次 refund/release | `409` 或幂等返回，账本/钱包/出款不重复 |
| T-BE-10 | watcher 跳过 disputed | 到期 `disputed` 订单跑 `run_once` | processed=0，无 payout |
| T-BE-11 | watcher 跳过 open held | 到期 `held` 且存在 open case 跑 `run_once` | processed=0，订单仍 held |
| T-BE-12 | close_no_action | 关闭不处理资金 | 争议终态 `closed_no_action`，订单回 `held`，下一轮 watcher 可按到期释放 |

### 6.2 前端测试

- TypeScript 编译通过。
- 学员中心已完成课程能打开争议表单，提交成功后显示成功/已提交状态。
- 付款单详情 `held/disputed` 显示争议入口或状态提示。
- `/ops/disputes` 普通用户显示无权限；运营用户可查看列表、详情、提交 `assign/refund/release/close_no_action`。
- 不要求本 Spec 增加端到端附件、通知或审批验证。

### 6.3 回归测试

- 支付结算既有测试仍通过，尤其是 `release_payment_order`、`refund_payment_order`、`dispute_watcher.run_once`。
- 教师出款页仍只显示 release 后的 payout。
- 学员钱包流水在退款后只增加一次。

## 7. 风险和依赖

| 风险 | 影响 | 处理 |
|------|------|------|
| 人工释放从 `disputed` 到 `held` 的过渡写法不严谨 | 可能绕过状态机或重复释放 | 必须在 `dispute_service` 内锁定订单和争议，恢复 `held` 后立即调用既有 release 服务 |
| 临时运营权限过宽 | 普通用户可能误触运营 API | 仅允许 `roles` 包含 `operator/admin`；测试覆盖普通用户 403 |
| watcher 查询只按 `held` 过滤，未来状态变化可能误释放 | 活跃争议期间资金提前释放 | 显式加 `NOT EXISTS active dispute` 条件和测试 |
| 前端没有运营登录入口 | 验收不便 | P0 允许直接访问 `/ops/disputes`，测试账号通过后端种子或测试 fixture 添加角色 |
| 争议模型与支付托管一致性 Spec 同时演进 | 可能出现支付服务签名变动 | 资金动作只依赖既有 public service；若签名变化，执行 Agent 需同步调整调用 |

## 8. 非目标

- 不实现附件上传、图片证据、录屏证据。
- 不实现审批流、复核人、主管确认。
- 不实现通知系统、邮件、短信、站内信。
- 不实现复杂运营工作台、搜索聚合、SLA、标签。
- 不实现部分退款、补偿券、教师罚款。
- 不实现真实支付渠道争议回调。
- 不重构完整用户角色/RBAC 系统。

## 9. 文档关联

- 场景地图：[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]
- 总控规划：[[../../../04-系统改进/20260501-1058-MVP到完善优化/writer/plan|MVP到完善优化]]
- 支付托管一致性：[[../../../04-系统改进/20260501-1124-支付托管退款结算一致性/writer/plan|支付托管退款结算一致性]]
- 实现总结：[[../executor/summary|实现总结]]（待创建）
- 审查报告：[[../reviewer/review|审查报告]]（待创建）
