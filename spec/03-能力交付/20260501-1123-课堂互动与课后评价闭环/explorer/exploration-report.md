---
title: 课堂互动与课后评价闭环探索报告
type: exploration-report
category: 03-能力交付
status: done
created: 2026-05-01
spec_dir: spec/03-能力交付/20260501-1123-课堂互动与课后评价闭环
git_branch: feat/spec-20260501-1339-classroom-review-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
owner: spec-explorer
tags:
  - spec
  - exploration
  - classroom
  - review
  - websocket
---

# 探索报告

## 1. 探索范围

本轮只做探索和文档产出，不修改业务代码，不修改 `writer/`、`tester/`、`lead/`。

重点阅读：

- 规划输入：`writer/plan.md`
- 后端课堂链路：`backend/app/api/v1/lessons.py`
- 后端服务：`lesson_service.py`、`message_service.py`、`lesson_room.py`、`review_service.py`
- 支付/统计依赖：`payment_service.py`、`teacher_stats_service.py`
- 后端测试：`test_lesson_messages.py`、`test_reviews.py`、`test_lessons.py`
- 前端页面：`Classroom.tsx`、`StudentDashboard.tsx`、`TeacherDashboard.tsx`
- 前端契约：`types/api.ts`、`lib/api.ts`
- 历史经验与前序 Spec：预约、教师供给、支付与 MVP 总探索文档

## 2. 检索到的历史经验

- `KNOW-001`：预约和教师模块已形成 `api/v1/* -> services/* -> models/*` 分层；预约成功会扣款并进入 `pending_confirmation`，教师确认后进入可上课状态。
- `KNOW-003`：支付已迁移为 `PaymentOrder`、`SettlementSnapshot`、`PayoutOrder` 口径；完课后写入争议期，真正结算由 watcher/release 完成。
- `EXP-002`：支付相关实现要以数据库状态和事务保证幂等；`Lesson.teacher_id` 指向 `TeacherProfile.id`，涉及教师用户钱包时需要通过 `TeacherProfile.user_id` 中转。
- MVP 总探索曾指出两个相关 P0：`<24h` 取消资金滞留、`reviewed` 状态影响佣金统计。当前分支代码中这两点已看到修复迹象：`cancel_lesson()` 为 `<24h` 取消写 `held_until`，`resolve_commission_rate()` 改为按 `status not in ("cancelled", "expired")` 且 `actual_end_at is not null` 统计。

## 3. 项目现状分析

### 3.1 后端课堂入口与状态机

`lesson_service.py` 已提供课堂入口派生字段：

- `ends_at`
- `can_enter_classroom`
- `classroom_unavailable_reason`

入口规则：

- `pending_confirmation`：不可进入，原因为等待老师确认。
- `confirmed`：开课前 15 分钟至课后 15 分钟可进入。
- `in_progress`：可进入。
- `completed/reviewed/cancelled/expired`：不可进入并给出原因。

状态动作现状：

- `PATCH /lessons/{id}/start` 只允许教师本人操作，要求状态为 `confirmed`，且必须在入口窗口内。
- `PATCH /lessons/{id}/end` 只允许教师本人操作，要求状态为 `in_progress`，成功后写 `actual_end_at`，调用 `payment_service.mark_lesson_completed()` 写争议期 deadline。
- 学员不能调用 start/end，测试已覆盖学生调用返回 403。

缺口：

- WebSocket 和消息接口只校验参与者身份，不校验课堂状态或入口窗口。当前依赖前端先请求 `GET /lessons/{id}` 做预检；如果绕过前端，已取消、未到时间或已完成课程仍可连接和写入消息。
- 错误响应仍是 `detail: str` 或 WS 内部 `code/message` 混合，前端能展示，但 tester 需要避免只按中文文案写过多脆弱断言。

### 3.2 后端消息与 WebSocket

已实现能力：

- `GET /lessons/{id}/messages` 分页返回历史消息，参与者可读，非参与者 403。
- `WS /lessons/{id}/ws?access_token=JWT` 完成握手后校验 token、账号启用状态、课程参与者身份。
- `type=chat` 消息会通过 `message_service.create_chat_message()` 持久化，去首尾空格，空内容和超过 2000 字符拒绝。
- `lesson_room_manager` 用内存字典维护每个 lesson 的 socket 集合，并对同课时广播。
- 测试已覆盖：非参与者 REST 403、WS 正常收发并落库、缺 token、伪 token、非成员、非法 JSON、房间广播单元测试。

缺口：

- `access_token` 放在 query string，可能进入日志、浏览器历史或代理追踪；P1 建议改短期 WS ticket。
- `lesson_room` 是单进程内存广播，多实例部署时不同进程之间不互通；P2 才需要 Redis Pub/Sub 或消息总线。
- WS 没有重连协议、心跳、离线补偿游标；前端目前通过历史消息拉取和 ID 去重缓解。
- REST 消息列表按 `created_at asc` 分页，第一页是最早消息；课堂 UI 当前请求 `page_size=100`。消息量超过 100 后会丢掉最新页或需要产品明确分页加载方向。

### 3.3 后端评价与结算口径

已实现能力：

- `POST /reviews` 只允许学生角色提交。
- `review_service.create_review()` 校验课程存在、评价者是该课学生、一课一评、课程必须是 `completed`。
- 写入评价后把课程状态改为 `reviewed`，同步教师平均分、评价数和交付统计。
- `teacher_stats_service` 已把 `completed/reviewed` 且 `actual_end_at is not null` 统计为有效完课。
- `payment_service.resolve_commission_rate()` 当前按非取消/过期且有 `actual_end_at` 统计月度完课，因此评价状态不再破坏阶梯佣金统计。

缺口：

- 评价 API 只支持创建和单条公开读取，没有“按 lesson 查询是否已评价”的接口。前端只能从 Lesson.status 判断 `completed/reviewed`，但拿不到该 lesson 的 review id 或内容。
- `ReviewCreate.content` 未限制长度；如接前端自由文本，建议给后端 schema 加 `max_length`，前端同步限制。
- `review_service` 依然把 `Lesson.status` 从履约状态变成评价状态；短期可接受，但中期建议拆分 `review_status` 或通过 review 存在性表达评价完成。

### 3.4 前端 Classroom

已实现能力：

- 进入课堂前并发请求 `GET /lessons/{id}` 和 `/auth/me`，根据 `can_enter_classroom` 决定是否加载历史消息和建立 WS。
- 无 token、无效课堂、未到时间、已取消等情况有阻断页。
- 历史消息加载后建立 WebSocket；收到 `chat` 按 id 去重追加。
- 发送消息前检查 WS open；发送失败以 `wsError` 展示。
- 教师身份下通过 `/teachers/me/profile` 判断是否为课程教师，主按钮可调用 `PATCH /lessons/{id}/end`；学生或非教师仅离开。
- 音视频、屏幕共享、课件、笔记是明确占位。

缺口：

- 连接状态只有错误提示，没有明确的 `connecting/connected/reconnecting/closed` UI 状态，也没有自动重连。
- 输入框未限制 2000 字符，超过限制只能等后端返回 WS validation error。
- `timeLeft` 初始化为课程时长秒数，不基于 `ends_at - now`，中途进入会显示完整时长而非剩余时间。
- 结束课程后教师直接回教师中心；学员侧没有从课堂结束态直接进入评价的路径。
- 页面文案明确“音视频占位”，符合当前 P0 文本课堂，但上线口径要避免让用户误以为视频已接入。

### 3.5 前端 StudentDashboard

已实现能力：

- 拉取 `/lessons?role=student&page=1&page_size=100`，按状态分组。
- `confirmed/in_progress` 且 `can_enter_classroom` 为 true 时展示“进入教室”。
- `completed` 显示“待评价”，`reviewed` 显示“已评价”。

缺口：

- “待评价”是不可操作按钮，没有评价表单、弹窗或评价页。
- 学习记录中的“待评价/已评价”同样不可交互。
- 没有 `ReviewCreate` 前端类型，也没有 `POST /reviews` 提交流程、提交中/失败/重复评价状态处理。
- 完成评价后需要刷新课程列表，否则本地状态不会从 `completed` 变为 `reviewed`。

### 3.6 前端 TeacherDashboard

已实现能力：

- 教师课程待办按状态展示。
- `pending_confirmation` 可确认，`confirmed` 可开始或进入教室，`in_progress` 可进入教室或结束课程。
- 完成/已评价课程展示“查看收入”，与教师收款闭环衔接。

缺口：

- 教师看不到学员评价反馈的入口；P0 可不做，P1 可在已完成/已评价区域展示最近评价或跳转公开教师详情页。
- `completedCount` 以本地 `completed/reviewed` 数量兜底，但真实统计优先用 `profile.total_lessons`，目前后端已同步有效完课。

## 4. 用户场景

### US-001 师生进入文字课堂

前置：学员预约、教师确认，课程在入口窗口内或已 `in_progress`。

流程：

1. 学员或教师从 Dashboard 点击“进入教室”。
2. 前端请求课程详情和当前用户。
3. 若 `can_enter_classroom=true`，拉取历史消息，建立 WS。
4. 任一方发送文本消息，双方同课时连接收到广播，消息可在刷新后从历史读取。

### US-002 状态不满足时阻断课堂

前置：课程处于待确认、未到进入时间、进入时间已过、已完成、已取消或已过期。

流程：

1. 用户访问 `/classroom/:id`。
2. 前端展示后端返回的 `classroom_unavailable_reason`。
3. 不拉取消息，不建立 WS。

后端缺口：如果用户直接连 WS，当前服务端不会按课堂状态阻断。

### US-003 教师结束课程并进入争议期

前置：课程 `in_progress`，当前用户是该课程教师。

流程：

1. 教师在课堂或教师中心点击结束课程。
2. 后端把 Lesson 置为 `completed`，写 `actual_end_at`。
3. 支付订单保持 `held`，写 `held_until = actual_end_at + DISPUTE_WINDOW_HOURS`。
4. 争议期后 watcher/release 生成结算快照和出款。

依赖：支付托管退款结算一致性 Spec 的 payment v2 口径。

### US-004 学员课后评价教师

前置：课程 `completed`，当前用户是该课程学员。

流程目标：

1. 学员在学习中心或课程结束页看到“评价”入口。
2. 提交总评分、可选维度评分、可选文字评价。
3. 后端创建 Review，课程变为 `reviewed`，教师评分和评价数同步。
4. 学员中心刷新后显示“已评价”，教师详情页公开展示评价。

当前缺口：前端尚无评价提交入口和表单。

## 5. 与前序 Spec 的依赖

### 5.1 支付 Spec

依赖点：

- 预约时已经创建并托管 `PaymentOrder`。
- 完课只写争议期，不直接给教师钱包入账。
- `reviewed` 课程已不影响 `resolve_commission_rate()` 的有效完课统计。

风险：

- 本 Spec 不应绕过 `payment_service` 或直接操作 Wallet。
- tester 应覆盖“先评价再 release”仍能按正确阶梯费率结算。

### 5.2 学员预约 Spec

依赖点：

- 学员中心已能按课程状态展示课程。
- `LessonListItem` 和 `LessonOut` 已包含课堂入口派生字段。
- 前端课堂页已利用 `can_enter_classroom` 做预检。

风险：

- 学员中心 `page_size=100` 是当前简化方案；大量课程时需要分页或服务端按场景过滤。
- 课堂历史消息也用 `page_size=100`，消息量增长后需要分页加载策略。

### 5.3 教师供给 Spec

依赖点：

- 教师工作台已接入确认、开始、结束课程。
- `GET /teachers/me/profile` 支持课堂页判断当前教师是否为该课程教师。
- 教师统计 `total_lessons/response_rate` 在 confirm/end/review 后同步。

风险：

- 如果教师未切到教师 active_role，课堂页 `teacherCanEnd=false`，只显示离开；这与当前权限入口一致，但前端提示可以更明确。

## 6. 后端缺口清单

| 优先级 | 缺口 | 影响 | 建议 |
|---|---|---|---|
| P0 | WS/消息写入不校验课堂状态和入口窗口 | 绕过前端可在已取消、未到时间、已完成课程继续聊天 | 在 `require_lesson_participant` 外新增课堂消息权限校验，至少 WS 写入和消息历史按 `can_enter_classroom` 或允许历史只读拆分 |
| P0 | 评价缺少 lesson 级查询/状态辅助 | 前端提交后难以展示已评价详情或防重复恢复 | 短期通过 Lesson.status 刷新；如要展示评价内容，新增 `GET /reviews?lesson_id=` 或在 LessonOut 加 review summary |
| P0 | `ReviewCreate.content` 无长度限制 | 长文本可能影响 UI/存储和滥用成本 | schema 增加 max length，前端同步限制 |
| P1 | WS token query string | 凭据易进日志 | 增加短期 classroom ticket，WS 使用 ticket |
| P1 | 错误响应格式不统一 | 前端/测试依赖中文文案脆弱 | 后续统一 `{code,message,field}` |
| P2 | 单进程广播 | 多实例部署时消息不互通 | Redis Pub/Sub 或消息总线 |

## 7. 前端缺口清单

| 优先级 | 缺口 | 影响 | 建议 |
|---|---|---|---|
| P0 | 学员中心“待评价”不可操作 | 课后信任闭环断开 | 在 StudentDashboard 加评价弹窗或独立页面，调用 `POST /reviews` |
| P0 | 前端缺 `ReviewCreate` 类型和评价提交状态 | 表单实现缺契约 | 在 `types/api.ts` 增加 `ReviewCreate`，复用 `apiFetchJson` |
| P0 | 提交评价后未刷新课程/教师评价 | 用户无法看到状态闭环 | 成功后重新拉课程列表，必要时提示“已评价” |
| P0 | 课堂 WS 连接状态不清晰 | 用户不知道是否能发送 | 增加连接中/已连接/已断开/重连中状态，并禁用未连接发送 |
| P1 | 无自动重连/心跳 | 临时断网后需要刷新页面 | P1 增加退避重连，重连后拉历史补齐 |
| P1 | 课堂剩余时间不基于 `ends_at` | 中途进入倒计时不准 | 用 `ends_at - now` 初始化并定时校准 |
| P2 | 课件/笔记/音视频仍占位 | 不满足完整课堂工具 | 后续独立 Spec 接 Agora/课件/记录 |

## 8. P0/P1/P2 建议

### P0

1. 接通学员课后评价入口：`completed` 课程可打开评价表单，提交 `POST /reviews`，成功后刷新课程列表。
2. 增加前端 `ReviewCreate` 类型和表单校验：总评分必填 1-5，其他评分和内容可选，内容长度与后端一致。
3. 明确课堂 WS 状态：连接中、已连接、失败/已断开；未连接时禁用发送或给出稳定提示。
4. 后端补课堂消息状态校验：WS 写入至少只允许 `confirmed` 入口窗口内或 `in_progress`；是否允许历史只读由 writer 决定。
5. 回归保护“评价不影响结算”：先评价后 release 时，`resolve_commission_rate()` 仍统计该课。

### P1

1. WebSocket ticket 鉴权，避免 JWT query string。
2. 课堂断线重连和历史消息补偿。
3. 课程结束页提供评价入口；教师侧展示评价反馈入口。
4. 增加 lesson 维度评价查询或在课程列表返回 `has_review/review_id`。
5. 统一课堂/评价错误码。

### P2

1. Redis Pub/Sub 支持多实例课堂。
2. 多媒体消息、课件上传、课堂笔记持久化。
3. 音视频 SDK 接入。
4. 课堂记录导出和运营侧争议查看。

## 9. 实现风险

- **状态耦合风险**：`Lesson.status=reviewed` 同时表达履约后和已评价；短期要继续保护支付、统计、列表筛选都把 `completed/reviewed` 作为完课类状态。
- **前后端状态重复判断风险**：前端已有课堂预检，但后端 WS 写入未强制校验；安全边界应以后端为准。
- **分页风险**：课堂历史消息和 Dashboard 课程均用 `page_size=100`，当前 MVP 可接受，后续数据量增长要调整。
- **测试数据时间窗口风险**：`start_lesson` 依赖当前时间和 15 分钟窗口，测试需要显式构造或更新 `scheduled_at`，避免时间漂移导致 flaky。
- **并发与多实例风险**：当前 WS 房间是内存表，P0 不应承诺跨实例实时性。
- **支付链路风险**：完课/评价不要直接触发教师到账；仍应由 payment watcher/release 在争议期后处理。

## 10. 建议测试覆盖

### 后端 pytest

1. `test_lesson_messages.py`
   - 保留现有鉴权和 WS happy path。
   - 新增：未到可进入时间、已取消、已完成课程连接/发送消息被拒绝。
   - 新增：超过 2000 字符消息返回 validation error 且不落库。
2. `test_reviews.py`
   - 新增：提交评价后再触发支付 release，阶梯费率统计包含 reviewed 课程。
   - 新增：content 超长被 422/400 拒绝（取决于 schema 实现）。
   - 保留重复评价、非本人评价、未完成课程评价拒绝。
3. `test_lessons.py`
   - 保留课堂入口派生字段矩阵。
   - 补充教师 end 后 `PaymentOrder.held_until` 与 `actual_end_at + DISPUTE_WINDOW_HOURS` 对齐。
   - 补充学生不能 end、非课程教师不能 end 的断言已存在或继续保留。

### 前端验证

1. `pnpm run build`：类型和构建门禁。
2. 浏览器 smoke：
   - 学员 completed 课程点击评价，提交成功后显示已评价。
   - 重复评价时前端展示后端错误且不崩溃。
   - 学员/教师进入课堂，历史消息加载，发送消息可显示。
   - 断开或伪造 WS token 时页面展示连接失败。
   - 教师课堂结束后回教师中心，学员中心出现待评价入口。
3. 建议保存 network/console/screenshot 到 tester artifacts，尤其是 `POST /reviews`、`GET /lessons` 刷新和 WS 消息。

## 11. 交接给 writer/tester 的重点结论

- 当前 P0 最大产品缺口是前端课后评价入口不可操作；后端评价 API 已可用。
- 当前 P0 最大后端边界缺口是 WS/消息写入只校验参与者，不校验课堂状态和进入窗口。
- 支付相关的 `reviewed` 统计问题在当前代码中已修复为按 `actual_end_at` 和非取消/过期统计，但必须加测试防回归。
- 音视频、课件、笔记、多实例广播不应进入本 Spec P0，保持 P1/P2。
- 下游建议接收方：`spec-writer`、`spec-tester`。
