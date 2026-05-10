---
type: spec-plan
status: ready_for_executor
created: 2026-05-01
updated: 2026-05-01
spec_dir: spec/03-能力交付/20260501-1122-教师入驻排课授课收款闭环
git_branch: feat/spec-20260501-1248-teacher-supply-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
pr_url:
execution_mode: agent-team
tags:
  - spec
  - plan
  - teacher-supply-flow
related:
  - "[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]"
  - "[[../../../04-系统改进/20260501-1058-MVP到完善优化/writer/plan|MVP到完善优化]]"
  - "[[../../../03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan|学员找老师到预约上课闭环]]"
  - "[[../../../04-系统改进/20260501-1124-支付托管退款结算一致性/writer/plan|支付托管退款结算一致性]]"
---

# 教师入驻排课授课收款闭环

## 1. 概述

本 Spec 面向教师供给侧 P0 主链路：越南市场中文老师能够开通教师身份、维护教学档案和税务资料、设置可授课时段、确认/开始/结束课程，并在课程结算释放后看懂自己的收入与出款构成。

探索报告已确认当前代码中教师身份、教师档案写入、availability CRUD、课程确认/开始/结束、钱包、托管结算和出款列表的基础能力已经存在；本计划不重写支付系统和课堂系统，只补齐教师侧可工作闭环。

### 1.1 范围内

- 后端：
  - `AvailabilityUpdate` 最终态互斥校验、`is_recurring` 与 day/date 语义校验、DB CHECK 兜底。
  - 教师自有档案读取接口，支撑教师中心加载和编辑。
  - 教师课程动作的权限与错误语义：确认、开始、结束。
  - 教师统计同步或派生：`total_lessons`、`response_rate`。
  - 出款列表 DTO 扩展：gross、平台费、税费、net、争议期/到账解释所需字段。
- 前端：
  - `TeacherDashboard.tsx` 升级为教师工作台：入驻状态、档案编辑、排课 CRUD、待确认课程、确认/开始/结束、收入摘要。
  - `Classroom.tsx` 区分离开课堂与教师结束课程；教师结束时调用后端 `PATCH /lessons/{id}/end`。
  - `Payouts.tsx` 展示 gross / fee / tax / net 和出款状态解释。
  - `types/api.ts`、`format.ts` 补齐必要类型和格式化辅助。
- 验证：
  - 后端 pytest 覆盖 API 级主链路和支付结算字段。
  - 前端 `pnpm run build`。
  - tester 在 `tester/test-plan.md` 记录教师闭环手工验证。

### 1.2 范围外

- 不接入真实提现账户、银行打款、MoMo/VNPay 出款渠道。
- 不新增 Lesson 上的结算冗余字段；结算展示必须读取 `SettlementSnapshot`。
- 不新增课程相关 `wallet_service` 函数，不绕过 `payment_service` / `wallet_service` 直接改钱包。
- 不实现批量排课、请假、黑名单、运营审核后台、真实 KYC 审核。
- 不实现音视频能力；课堂仍沿用现有文字消息和占位视频界面。
- 不重做学员侧预约表单和学员中心；仅在必要处与教师动作联通。

## 2. 需求分析

### 2.1 现状依据

| 模块 | 当前状态 | 本 Spec 处理 |
|---|---|---|
| 教师开通 | `POST /auth/become-teacher` 已创建 `TeacherProfile` 并设置 `active_role=teacher` | 前端展示入驻完成状态，后端补自有档案读取 |
| 教师档案 | `POST /teachers/profile`、`PUT /teachers/profile` 已存在 | 补 `GET /teachers/me/profile`，教师中心接编辑表单 |
| 税务资料 | `GET/PATCH /teachers/me/tax-profile` 已存在 | 教师中心增加最小读取和编辑入口 |
| 排课 | `/availability` CRUD 已存在 | 修复 update 最终态校验，前端接列表/创建/编辑/删除 |
| 预约覆盖 | `lesson_service.create_lesson` 已校验 availability 覆盖 | 不改学员预约规则，仅保证教师排课不会写出混合态 |
| 课程动作 | `confirm` 已要求教师，`start/end` 目前允许学生或教师参与者 | 收紧为教师动作，稳定错误语义，前端接按钮 |
| 统计 | `avg_rating/total_reviews` 已由 review 同步，`total_lessons/response_rate` 未维护 | 增加教师统计同步 helper 或派生查询 |
| 出款 | `PayoutOrder`、`SettlementSnapshot` 已存在，`GET /payouts/me` 只返回净额 | 列表 DTO 暴露 gross/fee/tax/net 和解释字段 |
| 教师中心 | 只显示 upcoming 课程、钱包余额、占位按钮 | 改为完整 P0 工作台 |
| 出款页 | 只显示 net、status、payment_order_id 和 API 技术文案 | 改为面向教师的收入解释页面 |

### 2.2 P0 验收标准

| ID | 验收标准 |
|---|---|
| AC-P0-01 | 已登录用户开通教师身份后进入 `/dashboard/teacher`，页面能识别教师状态，加载自有教师档案、税务资料、钱包、排课、课程和收入摘要；非教师访问仍被引导到学员中心或开通教师入口。 |
| AC-P0-02 | 教师可在教师中心编辑档案字段：教学标题、简介、视频 URL、时薪、币种、教师类型、专长；保存后刷新仍能通过 `GET /teachers/me/profile` 读到最新值。 |
| AC-P0-03 | 教师可创建、编辑、删除可授课时段；周期时段只能有 `day_of_week`，指定日期时段只能有 `specific_date`；更新时最终态不允许 day/date 同时存在或同时为空。 |
| AC-P0-04 | `AvailabilityUpdate` 支持显式 `null` 清空旧字段：从指定日期切到周期模式时能清空 `specific_date`，从周期切到指定日期时能清空 `day_of_week`；错误请求返回 `400` 和稳定中文原因。 |
| AC-P0-05 | 教师中心按状态展示课程：待确认、待上课、进行中、已完成/已评价、已取消/已过期；`pending_confirmation` 课程可确认，确认成功后进入待上课。 |
| AC-P0-06 | 只有课程所属教师且当前 active role 为 teacher 时可执行 `confirm/start/end`；非教师、学生、非本人课程返回 `403`，课程不存在返回 `404`，状态不允许返回 `400`。 |
| AC-P0-07 | 教师可在可进入窗口内开始 `confirmed` 课程，开始后课程进入 `in_progress`；教师可结束 `in_progress` 课程，结束后课程进入 `completed`，写 `actual_end_at`，并通过 `payment_service.mark_lesson_completed` 写争议期。 |
| AC-P0-08 | 完课后教师统计更新或派生结果可见：`total_lessons` 反映 completed/reviewed 有效完课数，`response_rate` 反映待确认转确认的比例口径；教师搜索推荐排序不再长期使用默认零值。 |
| AC-P0-09 | 争议期释放后，`GET /payouts/me` 返回当前教师自己的出款记录，并包含 gross、平台费、VAT、PIT、税费合计、net、结算快照、争议期截止、释放/到账时间。 |
| AC-P0-10 | `Payouts` 页面用教师可理解的文案展示“课程收入、平台费、税费、实际到账、状态、到账时间/等待争议期”，不再展示面向用户的 API 技术文案。 |
| AC-P0-11 | 教师课堂页点击结束课程时调用 `PATCH /lessons/{id}/end`；普通离开不结束课程；教师结束后回到 `/dashboard/teacher`，学生离开仍回到 `/dashboard/student`。 |
| AC-P0-12 | 后端相关 pytest 通过，前端 `pnpm run build` 通过，tester 在 `[[../tester/test-plan|tester/test-plan.md]]` 记录教师闭环手工验证。 |

## 3. 设计方案

### 3.1 后端：教师自有档案与税务资料

#### 3.1.1 新增 `GET /teachers/me/profile`

新增端点：

```text
GET /api/v1/teachers/me/profile
response: TeacherProfileOut
auth: get_current_teacher
```

行为：

- 当前用户 `active_role != teacher` 时由 `get_current_teacher` 返回 `403`。
- 当前用户是教师但没有 `teacher_profile` 时返回 `404 教师档案不存在`。
- 返回 `TeacherProfileOut`，字段复用现有 schema。

> [!important]
> 该路由必须放在 `/{teacher_id}` 动态路由之前，避免 `/teachers/me/profile` 被当作 UUID 解析。

#### 3.1.2 继续复用 `PUT /teachers/profile`

教师中心档案编辑继续调用现有：

```text
PUT /api/v1/teachers/profile
body: TeacherProfileUpdate
response: TeacherProfileOut
auth: get_current_teacher
```

本 Spec 不改变公开教师详情 `GET /teachers/{teacher_id}` 的契约。

#### 3.1.3 税务资料入口

前端读取和编辑现有端点：

```text
GET /api/v1/teachers/me/tax-profile
PATCH /api/v1/teachers/me/tax-profile
```

教师中心只做 P0 最小展示与编辑：税务场景、越南税号、身份证/护照后四位等已有字段按 `TeacherTaxProfileOut/Update` 展示；如 schema 字段有限，以现有 schema 为准，不新增真实 KYC 审核流。

### 3.2 后端：AvailabilityUpdate 互斥和最终态校验

当前 `AvailabilityCreate` 已校验 `day_of_week` 与 `specific_date` 互斥，`AvailabilityUpdate` 缺失同等最终态校验。本 Spec 采用“patch 后最终态校验”。

#### 3.2.1 规则

| 字段组合 | 合法性 | 说明 |
|---|---|---|
| `day_of_week != null` 且 `specific_date == null` | 合法 | 周期时段 |
| `day_of_week == null` 且 `specific_date != null` | 合法 | 指定日期时段 |
| `day_of_week != null` 且 `specific_date != null` | 非法 | 返回 `400 不能同时指定 day_of_week 与 specific_date` |
| `day_of_week == null` 且 `specific_date == null` | 非法 | 返回 `400 须指定 day_of_week 或 specific_date` |
| `start_time >= end_time` | 非法 | 返回 `400 结束时间须晚于开始时间` |

`is_recurring` 最终态规则：

| 最终态 | `is_recurring` |
|---|---|
| 周期时段：`day_of_week != null` | 必须为 `true`；如果请求未传，服务层归一为 `true` |
| 指定日期时段：`specific_date != null` | 必须为 `false`；如果请求未传，服务层归一为 `false` |

#### 3.2.2 Patch 语义

`AvailabilityUpdate` 必须区分“未传”和“传 null”：

- `model_dump(exclude_unset=True)` 保留显式 `null`。
- 服务层先用旧值合并 patch 得到最终态，再校验。
- 允许以下模式切换：

```json
// 指定日期 -> 周期
{
  "day_of_week": 1,
  "specific_date": null,
  "is_recurring": true
}

// 周期 -> 指定日期
{
  "day_of_week": null,
  "specific_date": "2026-05-08",
  "is_recurring": false
}
```

#### 3.2.3 DB 兜底

更新 `backend/app/models/availability.py` 和 Alembic migration：

- 保留 `ck_availability_day_or_date`。
- 新增互斥 CHECK：

```sql
(
  (day_of_week IS NOT NULL AND specific_date IS NULL)
  OR
  (day_of_week IS NULL AND specific_date IS NOT NULL)
)
```

- 新增 `is_recurring` 与模式一致性 CHECK：

```sql
(
  (day_of_week IS NOT NULL AND is_recurring IS TRUE)
  OR
  (specific_date IS NOT NULL AND is_recurring IS FALSE)
)
```

迁移文件名由 executor 按当前 Alembic revision 链路创建，不复用已存在 revision id。

### 3.3 后端：教师课程动作与错误语义

#### 3.3.1 权限边界

本 Spec 将教师中心的履约动作定义为教师动作：

| 动作 | 端点 | 认证依赖 | 所属权 |
|---|---|---|---|
| 确认课程 | `PATCH /lessons/{id}/confirm` | `get_current_teacher` | `lesson.teacher_id == current_user.teacher_profile.id` |
| 开始课程 | `PATCH /lessons/{id}/start` | `get_current_teacher` | `lesson.teacher_id == current_user.teacher_profile.id` |
| 结束课程 | `PATCH /lessons/{id}/end` | `get_current_teacher` | `lesson.teacher_id == current_user.teacher_profile.id` |

需要调整：

- `backend/app/api/v1/lessons.py` 中 start/end 从 `get_current_user` 改为 `get_current_teacher`。
- `lesson_service.start_lesson`、`end_lesson` 内部改为教师所属权校验，不再使用参与者通用 `_can_access_lesson`。
- 学生仍可进入课堂和发送消息，但不能通过 start/end 改变课程状态。

#### 3.3.2 状态流转

| 当前状态 | 动作 | 成功后状态 | 错误 |
|---|---|---|---|
| `pending_confirmation` | confirm | `confirmed` | 非 pending 返回 `400 当前状态不可确认` |
| `confirmed` | start | `in_progress` | 非 confirmed 返回 `400 只有已确认的课程可以开始` |
| `in_progress` | end | `completed` | 非 in_progress 返回 `400 只有进行中的课程可以结束` |

`start` 时间窗口采用现有 `_classroom_entry_state` 规则：开课前 15 分钟到计划结束后 15 分钟内可开始；否则返回 `400`，detail 使用 `classroom_unavailable_reason`。

`end` 成功时：

- 写 `actual_end_at = now()`。
- 调用 `payment_service.mark_lesson_completed(db, lesson)`。
- 触发教师统计同步。
- 不直接释放出款；仍由争议期和 `dispute_watcher` 处理。

#### 3.3.3 HTTP 错误语义

| 场景 | HTTP | detail |
|---|---:|---|
| 未登录/无效 token | 401 | 鉴权依赖返回 |
| 当前 active role 不是 teacher | 403 | `需要教师角色权限，请切换到教师身份` |
| 教师操作非本人课程 | 403 | `只能操作自己的课程` |
| 课程不存在 | 404 | `课程不存在` |
| 状态不允许 | 400 | 当前动作对应中文原因 |
| 开始时间窗口不允许 | 400 | `_classroom_entry_state` 返回的不可进入原因 |

### 3.4 后端：教师统计同步或派生

本 Spec 选择“服务层同步 + 查询可派生校准”的 MVP 方案，不新增统计表。

#### 3.4.1 新增同步 helper

在 `teacher_service.py` 增加：

```python
async def sync_teacher_delivery_stats(db: AsyncSession, teacher_id: uuid.UUID) -> None:
    ...
```

同步字段：

| 字段 | 口径 |
|---|---|
| `total_lessons` | `Lesson.teacher_id = teacher_id` 且 `status in ('completed', 'reviewed')` 且 `actual_end_at IS NOT NULL` 的数量 |
| `response_rate` | `confirmed_or_later_count / actionable_count`，保留两位小数；无分母时为 `0.00` |

`response_rate` MVP 口径：

- 分母 `actionable_count`：`pending_confirmation`、`confirmed`、`in_progress`、`completed`、`reviewed`、`expired`。
- 分子 `confirmed_or_later_count`：`confirmed`、`in_progress`、`completed`、`reviewed`。
- `cancelled` 暂不纳入分母，因为当前模型没有 `cancelled_by`，无法区分学生取消、教师取消或双方协商取消。
- `expired` 纳入分母，表示教师超时未确认造成的响应失败。

#### 3.4.2 调用点

| 调用点 | 原因 |
|---|---|
| `confirm_lesson` 成功后 | 更新 response_rate |
| `expire_stale_pending_lessons` 将课程置为 `expired` 后 | 更新 response_rate |
| `end_lesson` 成功后 | 更新 total_lessons 和 response_rate |
| `review_service.create_review` 将课程置为 `reviewed` 后 | 保持 total_lessons 不因 reviewed 状态漂移 |

如果 executor 判断同步调用会导致服务循环导入，应把 helper 放入独立轻量模块，例如 `app/services/teacher_stats_service.py`，但不新增 DB 表。

### 3.5 后端：出款列表字段与解释

#### 3.5.1 权限

`GET /payouts/me` 改用 `get_current_teacher`，与教师中心一致要求当前 active role 为 teacher。当前用户必须存在 `teacher_profile`，否则返回 `403`。

#### 3.5.2 DTO

扩展 `backend/app/schemas/payment.py`。可在现有 `PayoutOrderOut` 上新增字段，也可新增 `PayoutOrderListItem` 并替换 `GET /payouts/me` response model；字段必须包含：

| 字段 | 来源 | 说明 |
|---|---|---|
| `id` | `PayoutOrder.id` | 出款单 ID |
| `lesson_id` | `PayoutOrder.lesson_id` | 来源课程 |
| `payment_order_id` | `PayoutOrder.payment_order_id` | 关联付款单 |
| `settlement_snapshot_id` | `PayoutOrder.settlement_snapshot_id` | 结算快照 |
| `status` | `PayoutOrder.status` | 出款状态 |
| `channel` | `PayoutOrder.channel` | 出款渠道 |
| `channel_txn_id` | `PayoutOrder.channel_txn_id` | 渠道流水 |
| `gross_amount` | `SettlementSnapshot.gross_amount` | 学生支付的课程收入 |
| `commission_rate` | `SettlementSnapshot.commission_rate` | 平台费率 |
| `commission_amount` | `SettlementSnapshot.commission_amount` | 平台费 |
| `vat_amount` | `SettlementSnapshot.vat_amount` | VAT |
| `pit_amount` | `SettlementSnapshot.pit_amount` | PIT |
| `tax_amount` | `vat_amount + pit_amount` | 税费合计，DTO 派生 |
| `net_amount` | `PayoutOrder.net_amount` 或 `SettlementSnapshot.net_amount` | 教师实际到账 |
| `tax_scenario` | `SettlementSnapshot.tax_scenario` | 税务场景 |
| `held_until` | `PaymentOrder.held_until` | 争议期截止 |
| `released_at` | `PaymentOrder.released_at` | 托管释放时间 |
| `paid_at` | `PayoutOrder.paid_at` | 出款到账时间 |
| `created_at` | `PayoutOrder.created_at` | 出款单创建时间 |

字段守恒：

```text
gross_amount = commission_amount + vat_amount + pit_amount + net_amount
tax_amount = vat_amount + pit_amount
```

#### 3.5.3 查询

`payment_service.list_payouts_by_teacher` 需要避免 N+1：

- 使用 `selectinload(PayoutOrder.settlement_snapshot)` 和 `selectinload(PayoutOrder.payment_order)`，或显式 join 查询 projection。
- 仍然只查询 `PayoutOrder.teacher_id == current_user.teacher_profile.id`。
- 保留 `status`、`page`、`page_size` 过滤分页。

#### 3.5.4 出款解释口径

`GET /payouts/me` 只返回已创建出款单。未过争议期的 held 付款单不会出现在出款单列表；教师中心收入摘要可以通过文案说明“课程完成后进入争议期，争议期结束才生成出款单”。本 Spec 不新增“待释放收入”独立 API。

### 3.6 前端：TeacherDashboard 工作台

`frontend/src/app/pages/TeacherDashboard.tsx` 作为 P0 教师工作台，不拆新路由。页面加载：

```text
GET /auth/me
GET /teachers/me/profile
GET /teachers/me/tax-profile
GET /availability
GET /lessons?role=teacher&page_size=100
GET /wallet
GET /payouts/me?page=1&page_size=10
```

如 `me.roles` 不含 teacher，返回学员中心或展示成为教师入口。如 `me.roles` 含 teacher 但 `active_role != teacher`，页面展示切换身份动作并调用现有 `POST /auth/switch-role` 后再加载教师 API。

#### 3.6.1 入驻状态

展示：

- 教师身份是否已开通。
- 档案完整度：标题、简介、时薪、教师类型、专长。
- 税务资料状态：已读取默认税务档案或已补充税号/证件后四位。
- 推荐动作：编辑档案、编辑税务资料、添加可授课时段。

#### 3.6.2 档案编辑

使用原地表单或 dialog：

| 字段 | 类型 | API |
|---|---|---|
| title | input | `TeacherProfileUpdate.title` |
| about | textarea | `TeacherProfileUpdate.about` |
| video_url | input | `TeacherProfileUpdate.video_url` |
| hourly_rate | number | `TeacherProfileUpdate.hourly_rate` |
| currency | select/input，默认 VND | `TeacherProfileUpdate.currency` |
| teacher_type | select | `TeacherProfileUpdate.teacher_type` |
| specialties | comma input 或 tag input | `TeacherProfileUpdate.specialties` |

保存成功后刷新 profile 与顶部统计。

#### 3.6.3 排课 CRUD

排课区包含：

- 列表：复用 `formatAvailabilitySlot`，展示周期/指定日期、开始时间、结束时间。
- 创建：模式切换 `weekly` / `date`。
  - weekly：提交 `{ day_of_week, specific_date: null, is_recurring: true, start_time, end_time }`
  - date：提交 `{ day_of_week: null, specific_date, is_recurring: false, start_time, end_time }`
- 编辑：必须带上清空字段，避免 update 最终态混合。
- 删除：确认后调用 `DELETE /availability/{id}`。
- 错误展示：将 `400` 的中文 detail 直接展示给教师。

#### 3.6.4 课程待办与动作

课程列表不再只请求 `upcoming=true`。前端按状态分组：

| 分组 | 状态 | 动作 |
|---|---|---|
| 待确认 | `pending_confirmation` | 确认 |
| 待上课 | `confirmed` | 可进入窗口内显示开始；可进入课堂时显示进入教室 |
| 进行中 | `in_progress` | 进入教室、结束课程 |
| 已完成 | `completed`, `reviewed` | 查看收入提示、查看出款页 |
| 已取消/已过期 | `cancelled`, `expired` | 只读 |

按钮调用：

```text
PATCH /lessons/{id}/confirm
PATCH /lessons/{id}/start
PATCH /lessons/{id}/end
```

动作成功后重新加载课程、profile 统计、wallet 和 payout 摘要。

#### 3.6.5 收入摘要

教师中心收入摘要不做完整财务报表，只展示 P0 可理解信息：

- 钱包余额：`GET /wallet`。
- 最近出款净额：`GET /payouts/me` 前 10 条求和或展示最近一笔。
- 最近出款状态：paid/pending/failed。
- 解释文案：课程完成后进入争议期，争议期结束生成出款；平台费和税费在出款页查看。

### 3.7 前端：Payouts gross / fee / tax / net 展示

`frontend/src/app/pages/Payouts.tsx` 改为教师收入明细：

| 展示项 | 字段 |
|---|---|
| 课程收入 | `gross_amount` |
| 平台费 | `commission_amount` + `commission_rate` |
| 税费 | `tax_amount`，展开可见 `vat_amount` / `pit_amount` |
| 实际到账 | `net_amount` |
| 状态 | `status` |
| 争议期截止 | `held_until` |
| 释放时间 | `released_at` |
| 到账时间 | `paid_at` |
| 来源课程 | `lesson_id`，可链接到后续课程详情；本 Spec 可先显示短 ID |
| 付款单 | `payment_order_id`，可链接 `/payments/orders/{id}` |

页面文案要求：

- 删除“数据来源：GET /api/v1/payouts/me”。
- 用教师语言解释：`gross` 是学生支付课程金额，平台费和税费扣除后，`net` 为实际到账。
- 空态说明：暂无出款记录；课程完成并过争议期后才会生成出款。

### 3.8 前端：Classroom 离开与结束

`frontend/src/app/pages/Classroom.tsx` 需要区分当前用户角色：

- 预检时已请求 `GET /lessons/{id}`，同时请求 `GET /auth/me`。
- 如果 `me.active_role === "teacher"` 且 lesson 为当前教师可操作课程：
  - 主按钮文案为“结束课程”。
  - 点击确认后调用 `PATCH /lessons/{id}/end`。
  - 成功后 `navigate("/dashboard/teacher")`。
- 学生或非教师：
  - 主按钮文案为“离开”。
  - 不调用 end API。
  - `navigate("/dashboard/student")`。
- 可以保留一个普通“离开”入口给教师，但不得与“结束课程”混为一个无 API 的按钮。

### 3.9 前端类型与格式化

`frontend/src/app/types/api.ts` 补：

- `TeacherProfileUpdate`
- `TeacherTaxProfileOut`
- `TeacherTaxProfileUpdate`
- `AvailabilityCreate`
- `AvailabilityUpdate`
- 扩展后的 `PayoutOrderOut` 或新增 `PayoutOrderListItem`

`frontend/src/app/lib/format.ts` 补：

- `formatPercentDecimal(rate: string | number): string`
- `formatDateTimeVN(iso: string | null): string`
- `formatPayoutStatus(status: string): string`

## 4. 执行模式

`execution_mode: agent-team` 表示实现阶段允许 spec-executor 在 TeamLead 协调下拆成后端、前端和验证子任务并行推进。所有代码改动仍必须严格追溯到本 `writer/plan.md`，不得借 agent-team 扩大范围。

建议分工：

| 子任务 | 责任边界 |
|---|---|
| 后端执行 | Availability 最终态校验、教师自有档案接口、课程动作权限/错误语义、教师统计、出款 DTO、pytest |
| 前端执行 | TeacherDashboard 工作台、Payouts 展示、Classroom 结束课程、类型/格式化、build |
| 验证执行 | API 回归、支付结算字段断言、浏览器手工闭环记录 |

## 5. 实现步骤

1. 后端先修排课数据边界：
   - 更新 `AvailabilityUpdate` 最终态校验或服务层最终态校验。
   - 更新 `availability_service.update_availability` 合并 patch 后校验。
   - 更新 `Availability` CHECK 约束和 Alembic migration。
   - 新增/调整 availability API 测试。
2. 后端补教师自有档案读取：
   - 在 `teachers.py` 的动态路由前增加 `GET /teachers/me/profile`。
   - 在 `teacher_service.py` 增加按 `user_id` 读取 profile 的 helper，或复用查询逻辑。
   - 补 `test_teachers.py` 断言教师可读取自有档案、非教师/未切换角色被拒绝。
3. 后端校准课程动作：
   - start/end API 改用 `get_current_teacher`。
   - 服务层改为教师所属权校验。
   - start 复用课堂可进入窗口，不允许过早/过晚开始。
   - end 保持调用 `payment_service.mark_lesson_completed`。
   - 补 `test_lessons.py` 教师 confirm/start/end、学生 start/end 禁止、非本人禁止、错误语义断言。
4. 后端落教师统计：
   - 增加 `sync_teacher_delivery_stats` 或等价独立 service。
   - 在 confirm、expire、end、review 调用。
   - 补完课数和响应率测试。
5. 后端扩展出款列表：
   - 扩展 payout response schema。
   - `list_payouts_by_teacher` eager load 或 projection 查询 `SettlementSnapshot` 和 `PaymentOrder`。
   - `payouts.py` 改用 `get_current_teacher`。
   - 补 `test_payment_settlement.py` 断言 gross/commission/vat/pit/tax/net/held_until/released_at/paid_at。
6. 前端补 API 类型和格式化：
   - 更新 `types/api.ts`。
   - 更新 `format.ts`。
7. 前端升级 `TeacherDashboard.tsx`：
   - 加载 profile、tax profile、availability、teacher lessons、wallet、payouts。
   - 实现入驻状态、档案编辑、税务资料最小编辑、排课 CRUD、课程动作、收入摘要。
   - 动作成功后局部刷新相关数据。
8. 前端升级 `Payouts.tsx`：
   - 使用扩展 DTO 展示 gross/fee/tax/net。
   - 加入状态和争议期解释。
   - 删除 API 技术文案。
9. 前端升级 `Classroom.tsx`：
   - 请求 `/auth/me` 区分教师/学生。
   - 教师结束课程调用 end API 并回教师中心。
   - 普通离开不改变课程状态。
10. 运行验证：
    - 后端 pytest 命令见测试计划引用。
    - 前端 `pnpm run build`。
    - executor 输出 `executor/summary.md`，列出实际文件、API 契约、测试结果和任何偏离本计划的说明。

## 6. 风险和依赖

| 风险/依赖 | 处理方式 |
|---|---|
| 支付合规约束 | 必须遵守 `.agents/rules/payment-system.md`：不在 Lesson 加结算字段，不绕过 TaxStrategy，不绕过 payment_service/wallet_service。 |
| `AvailabilityUpdate` null 语义 | 前端编辑时必须显式发送 null 清空旧模式字段，后端必须用 `exclude_unset=True` 保留 null。 |
| active_role 与 roles 不一致 | 教师拥有角色但未切换 active role 时，教师 API 会返回 403；前端需要提供切换身份动作或清晰提示。 |
| start/end 权限收紧 | 可能影响既有学生课堂测试；测试需更新为学生只能进入课堂/发消息，不能改变课程状态。 |
| response_rate 口径简化 | 当前无 `cancelled_by`，取消课程暂不纳入响应率分母；如后续需要区分教师取消，应另开 Spec 补模型字段。 |
| 出款列表只显示已生成出款 | 未过争议期的 held 订单不会出现在 `/payouts/me`；教师中心用文案解释，不新增待释放收入 API。 |
| 前端无自动化测试框架 | 本 Spec 最低验证为 `pnpm run build` + tester 浏览器手工主链路；不临时引入新测试框架。 |

## 7. 测试计划引用

测试计划已由 spec-tester 创建在 `[[../tester/test-plan|tester/test-plan.md]]`。本计划与测试计划共同要求 tester 至少覆盖以下验证点。

### 7.1 后端 pytest

建议命令：

```bash
cd backend
python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_auth.py tests/api/v1/test_teachers.py -q
python -m pytest tests/api/v1/test_lessons.py -q
python -m pytest tests/api/v1/test_payment_settlement.py -q
python -m pytest tests/api/v1/test_reviews.py -q
```

组合回归：

```bash
cd backend
python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q
```

新增或扩展断言：

- `AvailabilityUpdate`：
  - update 后 day/date 同时存在返回 400。
  - update 后 day/date 同时为空返回 400。
  - 指定日期切周期、周期切指定日期均可通过显式 null 完成。
  - `is_recurring` 与 day/date 模式不一致返回 400 或被服务层归一。
- 教师档案：
  - 教师可读取 `/teachers/me/profile`。
  - 非教师或未切换 active role 不能读取。
  - `PUT /teachers/profile` 后读取值一致。
- 课程动作：
  - 教师确认自己的 pending 课程成功。
  - 教师开始 confirmed 课程成功，过早/过晚返回 400。
  - 教师结束 in_progress 课程成功，写 `actual_end_at` 和 `PaymentOrder.held_until`。
  - 学生调用 start/end 返回 403。
  - 教师操作非本人课程返回 403。
- 教师统计：
  - confirm 后 `response_rate` 变化。
  - pending 过期后 `response_rate` 变化。
  - end 后 `total_lessons` 增加。
  - reviewed 状态不让 `total_lessons` 回落。
- 出款列表：
  - release 后 `/payouts/me` 返回 gross、commission、vat、pit、tax、net。
  - `gross = commission + vat + pit + net`。
  - 其他教师不能看到该出款。
  - active role 非 teacher 返回 403。

### 7.2 前端验证

构建：

```bash
cd frontend
pnpm run build
```

手工主链路：

- 教师注册/开通 -> 进入教师中心 -> 编辑档案 -> 新增可授课时段。
- 学员预约该教师 -> 教师中心看到待确认 -> 教师确认 -> 到可进入窗口后开始 -> 进入课堂 -> 教师结束课程。
- 调整 `held_until` 或运行 watcher 释放结算 -> 教师出款页展示 gross/fee/tax/net。
- 教师排课编辑覆盖周期/指定日期互相切换，确认前后端不会写出混合态。
- 学生进入课堂可以离开但不能结束课程；教师结束课程后回到教师中心。

## 8. 文档关联

- Team Context：`[[../lead/team-context|Team Context]]`
- 探索报告：`[[../explorer/exploration-report|探索报告]]`
- 测试计划：`[[../tester/test-plan|测试计划]]`
- 实现总结：`[[../executor/summary|实现总结]]`（待创建）
- 场景地图：`[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]`
- 学员闭环：`[[../../../03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan|学员找老师到预约上课闭环]]`
- 支付一致性：`[[../../../04-系统改进/20260501-1124-支付托管退款结算一致性/writer/plan|支付托管退款结算一致性]]`
- 支付规则：`.agents/rules/payment-system.md`
