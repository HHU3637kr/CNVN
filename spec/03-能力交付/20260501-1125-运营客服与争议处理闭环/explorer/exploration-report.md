---
type: exploration-report
status: completed
created: 2026-05-01
updated: 2026-05-01
role: spec-explorer
spec: 20260501-1125-运营客服与争议处理闭环
branch: feat/spec-20260501-1415-dispute-support-flow
---

# 探索报告

## 探索范围

本次只读检查了当前代码和 draft plan，重点覆盖：

- 后端：`backend/app/models/payment_order.py`、`backend/app/services/payment_service.py`、`backend/app/services/dispute_watcher.py`、`backend/app/api/v1/payments.py`、`backend/app/dependencies.py`、`backend/app/api/v1/auth.py`、`backend/app/api/v1/users.py`、`backend/app/services/auth_service.py`、`backend/app/models/user.py`、`backend/app/services/lesson_service.py`。
- 前端：`frontend/src/app/pages/StudentDashboard.tsx`、`TeacherDashboard.tsx`、`PaymentOrderDetail.tsx`、`Wallet.tsx`、`frontend/src/app/routes.tsx`、`frontend/src/app/types/api.ts`。
- 历史经验：`KNOW-002`、`KNOW-003`、`EXP-002`，主要用于支付结算、防重、`Lesson.teacher_id -> TeacherProfile.id -> User.id` 的模型关系参考。

> 按本次任务要求，只写入本文件；未更新 `lead/team-context.md`。

## 检索到的历史经验

- `KNOW-002` 记录了早期支付模块缺口：教师结算、阶梯费率、24h 取消规则、T+1/定时结算。当时的缺口大多已被后续支付订单/托管/结算实现替代，但“资金操作必须有明确状态边界”仍适用。
- `KNOW-003` 记录了结算实现细节，但内容部分滞后：当前代码已经不是 `settlement_service.py + Lesson.settled_at` 方案，而是 `PaymentOrder`、`PayoutOrder`、`SettlementSnapshot`、`dispute_watcher` 和 ledger 方案。
- `EXP-002` 对本 Spec 仍然关键：资金动作要用数据库状态做幂等；教师钱包不能直接用 `Lesson.teacher_id`，必须经 `TeacherProfile.user_id` 中转。

## 项目现状分析

### 后端支付与订单状态

`PaymentOrder` 当前状态集合为：

- `pending`
- `pending_3ds`
- `paid`
- `held`
- `released`
- `refunded`
- `disputed`

现有资金生命周期：

1. `lesson_service.create_lesson()` 创建课程后调用 `payment_service.create_order_for_lesson()`。
2. `create_order_for_lesson()` 创建 `PaymentOrder(status=pending)`，Mock 渠道置为 `paid`，扣学员钱包，ledger 记 escrow，然后订单转 `held`。
3. `lesson_service.end_lesson()` 将课程置为 `completed`，调用 `payment_service.mark_lesson_completed()` 写 `held_until = actual_end_at + DISPUTE_WINDOW_HOURS`。
4. `dispute_watcher.run_once()` 扫描 `status='held' AND held_until < now()` 的订单，调用 `release_payment_order()`。
5. `release_payment_order()` 只接受 `held`，生成 `SettlementSnapshot`、ledger 分录、`PayoutOrder`，教师钱包入账，订单转 `released`。
6. `refund_payment_order()` 允许 `held` 或 `disputed`，给学员钱包退款，ledger 反冲 escrow，订单转 `refunded`。

关键缺口：

- `disputed` 是订单状态，但没有任何 API 或服务会把订单置为 `disputed`。
- 没有 `DisputeCase` / `DisputeEvent` / 审计记录模型。
- `PaymentOrder.last_error` 只适合 watcher 错误，不适合作为争议处理记录。
- `release_payment_order()` 不接受 `disputed`，所以人工释放争议单不能直接复用，除非先把订单从 `disputed` 改回 `held`，这会污染状态语义。
- `refund_payment_order()` 接受 `disputed`，但没有 operator、reason 结构化审计，也没有幂等地绑定到某个争议处理动作。

### watcher 与争议阻断

`dispute_watcher.run_once()` 当前只扫描 `PaymentOrder.status == "held"`，所以如果 P0 发起争议时把订单状态切到 `disputed`，watcher 会天然跳过。

但如果 P0 只新增 `DisputeCase(status=open)` 而不改变订单状态，watcher 仍会自动 release，导致 open 争议被提前释放。draft plan 写了“open 争议阻止自动 watcher 提前 release”，writer 必须二选一并写清：

- 方案 A：发起争议时同步把 `PaymentOrder.status` 置为 `disputed`，关闭/驳回后再由人工动作决定 `refunded` 或 `released`。
- 方案 B：保留 `PaymentOrder.status='held'`，watcher 查询时 `NOT EXISTS open DisputeCase`。

建议 P0 采用方案 A，变更面小、与现有 `refund_payment_order(held/disputed)` 更匹配；同时需要新增人工释放函数支持 `disputed`。

### 课程与模型关系

`Lesson.teacher_id` 指向 `teacher_profiles.id`，不是 `users.id`。任何运营查询和响应体如果要展示教师用户信息，需要：

`DisputeCase.lesson_id -> Lesson.teacher_id -> TeacherProfile.user_id -> User`

现有课程列表响应 `LessonListItem` 已通过 join 展示 `student_name` / `teacher_name`，但争议详情需要更完整上下文，至少包括：

- lesson：id、status、scheduled_at、duration_minutes、topic、price、actual_start_at、actual_end_at、cancel_reason。
- payment_order：id、status、gross_amount、held_until、paid_at、released_at、refunded_at、channel、channel_txn_id。
- student：id、full_name、email、phone。
- teacher：teacher_profile.id、user_id、full_name、email、phone。
- settlement/payout：若已释放，需要 `SettlementSnapshot` 和 `PayoutOrder` 只读展示。

### 权限与临时运营权限

当前权限模型只有：

- `User.roles: ARRAY(String(20))`，默认 `{student}`。
- `User.active_role`，当前只支持 `student` / `teacher`。
- `require_role(required_role)` 会同时校验 `required_role in roles` 和 `active_role == required_role`。
- `SwitchRoleRequest.role` 正则只允许 `student|teacher`。
- 无 `admin`、`ops`、`support` 角色，也没有后台用户表。

P0 临时运营权限建议：

- 新增 `support` 角色常量，不改独立后台用户系统。
- `User.roles` 可包含 `support`，但不要强制 `active_role == support`，否则必须同步改 `SwitchRoleRequest`、前端角色切换和导航。
- 新增依赖 `get_current_support_user()` 或 `require_support_user()`：只检查 `current_user.is_active` 且 `"support" in current_user.roles`。
- P0 不提供公开注册/自助开通 support；通过数据库种子、手工 SQL 或管理脚本授予 `roles = array_append(roles, 'support')`。
- 所有运营处理 API 必须记录 `operator_user_id = current_user.id`。

不建议 P0 直接复用 teacher/student active role 或仅依赖邮箱白名单。争议处理涉及资金动作，必须有数据库内可审计的操作者身份。

### 后端 API 现状

`payments.py` 目前提供：

- `GET /api/v1/wallet`
- `GET /api/v1/wallet/transactions`
- `POST /api/v1/wallet/topup`
- `POST /api/v1/payments/orders`
- `POST /api/v1/payments/webhook/mock`
- `GET /api/v1/payments/orders/{order_id}`

`GET /payments/orders/{order_id}` 仅允许学员本人或课程对应教师查看。运营 API 不能直接复用该权限逻辑，需要新增支持权限。

建议 P0 新增独立路由文件：

- `backend/app/api/v1/disputes.py`
- 用户端：
  - `POST /api/v1/disputes`
  - `GET /api/v1/disputes/me`
  - `GET /api/v1/disputes/{case_id}`，仅参与者或 support 可见。
- 运营端：
  - `GET /api/v1/support/disputes`
  - `GET /api/v1/support/disputes/{case_id}`
  - `POST /api/v1/support/disputes/{case_id}/refund`
  - `POST /api/v1/support/disputes/{case_id}/release`
  - `POST /api/v1/support/disputes/{case_id}/close`

如要减少路由文件数量，也可放在 `disputes.py` 内用两个 router：`/disputes` 和 `/support/disputes`。

### 前端入口现状

`StudentDashboard.tsx`：

- 有课程列表、评价、钱包入口。
- “联系平台客服”只是无行为 button。
- 课程卡没有付款单 ID，也没有发起争议入口。

`TeacherDashboard.tsx`：

- 展示课程待办、钱包余额、出款摘要。
- 完成/已评价课程仅提供“查看收入”链接到 `/payouts`。
- 无争议入口、无争议状态提示。

`PaymentOrderDetail.tsx`：

- 通过 `/payments/orders/{orderId}` 展示订单和结算快照。
- 无争议入口、无处理记录、无状态中文化。

`Wallet.tsx`：

- 有付款单 UUID 手工查询入口。
- 有“线下转账登记（占位）”，只写 localStorage，不进入后端。
- 这可以作为运营客服的相邻入口，但不能作为争议系统的数据来源。

`routes.tsx`：

- 当前没有运营后台路由。
- P1 可新增 `/support/disputes` 和 `/support/disputes/:id`。
- P0 若 API-first，可以只在用户侧加发起入口和提示，运营通过 API/Swagger 处理。

前端 P0 最小建议：

- `PaymentOrderDetail` 增加“发起争议”按钮，仅当 `status` 为 `held` 或 `disputed` 且未 `released/refunded` 时显示。
- `StudentDashboard` 在已完成、已取消但仍可能结算的课程上加“联系平台客服/发起争议”入口；由于列表没有 payment_order_id，按钮可以先打开按 lesson 发起争议的表单，由后端解析活跃订单。
- `TeacherDashboard` 在已完成/已取消课程上加“查看争议状态/联系平台”入口，避免教师不知道收入为何未释放。
- `types/api.ts` 增加 `DisputeCaseOut`、`DisputeEventOut`、创建和处理 payload 类型。

## 对 Spec 创建的建议

### P0 建议

1. 新增争议模型与迁移。
   - `DisputeCase`: `id`、`lesson_id`、`payment_order_id`、`opened_by_user_id`、`opened_by_role`、`status`、`reason_code`、`description`、`resolution`、`operator_user_id`、`opened_at`、`resolved_at`、`created_at`、`updated_at`。
   - `DisputeEvent`: `id`、`case_id`、`actor_user_id`、`actor_role`、`event_type`、`message`、`metadata_json`、`created_at`。
   - `DisputeCase.status`: `open`、`under_review`、`resolved_refunded`、`resolved_released`、`closed`。
   - 建议加部分唯一索引：同一 `payment_order_id` 同时只允许一个 `status in ('open','under_review')` 的争议。

2. 用户发起争议 API。
   - 支持按 `lesson_id` 或 `payment_order_id` 发起。
   - 校验当前用户是学员本人或课程教师。
   - 仅允许订单 `held` 时发起；若已 `released/refunded`，返回 409。
   - 创建争议后把 `PaymentOrder.status` 从 `held` 置为 `disputed`，写 `DisputeEvent(opened)`。

3. 运营查询和处理 API。
   - 支持列表筛选：`status`、`payment_order_id`、`lesson_id`、`student_id`、`teacher_id`。
   - 详情聚合课程、订单、学生、教师、结算/出款、事件历史。
   - 处理动作：
     - refund：只允许 open/under_review 且订单 `disputed`，调用 `refund_payment_order()`，争议置 `resolved_refunded`。
     - release：只允许 open/under_review 且订单 `disputed`，调用新的 `release_disputed_payment_order()` 或扩展 `release_payment_order(allow_disputed=True)`，争议置 `resolved_released`。
     - close：不做资金动作，适用于误报/重复；如果订单仍需释放，应明确是否把订单改回 `held` 并恢复 watcher，或直接要求 operator 选择 release。

4. watcher 阻断。
   - P0 最小：发起争议时订单转 `disputed`，watcher 无需复杂 join。
   - 测试必须覆盖：`held_until < now` 且订单 `disputed` 时 `run_once()` 不处理。

5. 临时运营权限。
   - 新增 `support` 角色依赖，只查 `roles` 不查 `active_role`。
   - 不改 `SwitchRoleRequest` 的正则，避免前端角色切换和 dashboard 逻辑扩大变更。
   - 测试中直接创建带 `roles=["student","support"]` 的用户或修改用户 roles。

### P1 建议

- 前端最小运营后台：
  - `/support/disputes`：列表、状态筛选、搜索 lesson/order。
  - `/support/disputes/:id`：上下文、事件历史、退款/释放/关闭表单。
- 用户端展示“我的争议”。
- 处理历史展示 operator、reason、时间线。
- 争议状态在 `PaymentOrderDetail`、学生/教师 dashboard 显示。

### P2 建议

- 附件上传与凭证管理。
- 通知：站内消息、邮件、Zalo/短信。
- 双人审批或大额/高风险审批。
- 风险标签、SLA、客服分配。
- 对账工作台：线下转账登记、付款单、争议、ledger/payout 联动核对。

## 实现风险

- 资金幂等风险：人工 refund/release 可能被重复提交。必须用订单状态、争议状态和事务内行锁控制。
- 状态语义风险：如果既有 `PaymentOrder.status='disputed'` 又新增 `DisputeCase.status=open`，两者必须有单一写入路径，否则容易不一致。
- 人工释放风险：现有 `release_payment_order()` 只接受 `held`；直接把 `disputed` 改回 `held` 再释放会丢失争议状态，应提供明确的人工释放服务函数并记录事件。
- 结算不可逆风险：`released` 后已有 `SettlementSnapshot`、`PayoutOrder`、教师钱包和 ledger 入账，P0 不应支持 released 后退款；如要支持需另一个反向冲正 Spec。
- 权限扩大风险：`require_role()` 当前要求 active_role；新增 support 若直接改全局角色切换，可能影响 teacher/student 流程。P0 应新增窄依赖。
- 查询聚合风险：争议详情跨 `Lesson`、`User`、`TeacherProfile`、`PaymentOrder`、`SettlementSnapshot`、`PayoutOrder`，注意 `Lesson.teacher_id` 的真实含义。
- 前端入口风险：课程列表目前没有 `payment_order_id`，用户从 dashboard 发起争议时后端应支持 `lesson_id` 输入，避免先扩展所有列表响应。

## 测试覆盖建议

### 后端 P0

- 用户发起争议：
  - 学员可对自己的 `held` 订单发起。
  - 教师可对自己课程的 `held` 订单发起。
  - 非参与者 403。
  - `released/refunded` 订单发起返回 409。
  - 同一订单已有 open/under_review 争议时返回 409 或幂等返回既有 case。
  - 发起后 `PaymentOrder.status == "disputed"`。

- watcher：
  - `held_until < now` 且 `status=held` 会 release。
  - `held_until < now` 且 `status=disputed` 不会 release。
  - retry_count 规则保持不回归。

- 运营权限：
  - 无 support 角色访问运营列表/详情/处理动作 403。
  - 有 support 角色但 active_role 仍为 student/teacher 可以访问。
  - operator_user_id 正确记录。

- 运营处理：
  - refund：争议状态变 `resolved_refunded`，订单变 `refunded`，学员钱包回款，事件写入。
  - release：争议状态变 `resolved_released`，订单变 `released`，生成 snapshot/payout，教师钱包入账，事件写入。
  - 重复 refund/release 不产生重复 wallet/ledger/payout。
  - release 后不允许 refund；refund 后不允许 release。

### 前端 P0/P1

- `PaymentOrderDetail` 对 `held/disputed/released/refunded` 显示正确按钮/禁用状态。
- 学员 dashboard 发起争议入口能用 lesson_id 提交。
- 教师 dashboard 能看到争议状态或至少能进入客服入口。
- P1 运营页面：support 用户可进入，普通用户不可进入；处理动作提交 reason 后刷新状态和事件历史。

## 给 writer/tester 的关键结论

- P0 最小闭环应以 `DisputeCase + DisputeEvent + support 角色依赖 + 用户发起 + 运营 refund/release + watcher 跳过 disputed` 为主，不要先做附件、通知、审批。
- 发起争议时建议立即把 `PaymentOrder.status` 置为 `disputed`；这是阻止 watcher 自动 release 的最小且稳定方案。
- 人工释放不能直接复用当前 `release_payment_order()`，因为它拒绝 `disputed`；需要新增受控入口或参数，并在事件表记录 operator/reason。
- 临时运营权限建议只检查 `support in User.roles`，不要求 `active_role=support`，避免扩大 auth/switch-role 和前端导航改动。
- 前端 P0 可以先 API-first，但用户发起入口至少应落在 `PaymentOrderDetail`；dashboard 入口因缺 `payment_order_id`，建议让后端支持按 `lesson_id` 发起。
