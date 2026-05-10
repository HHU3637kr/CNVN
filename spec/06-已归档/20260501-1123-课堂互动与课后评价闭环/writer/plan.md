---
type: spec-plan
status: ready
created: 2026-05-01
updated: 2026-05-01
spec_dir: spec/03-能力交付/20260501-1123-课堂互动与课后评价闭环
git_branch: feat/spec-20260501-1339-classroom-review-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
pr_url:
execution_mode: agent-teams
tags:
  - spec
  - plan
  - classroom
  - review
  - mvp-optimization
related:
  - "[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]"
  - "[[../../../04-系统改进/20260501-1058-MVP到完善优化/writer/plan|MVP到完善优化]]"
  - "[[../../../03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan|学员找老师到预约上课闭环]]"
  - "[[../../../03-能力交付/20260501-1122-教师入驻排课授课收款闭环/writer/plan|教师入驻排课授课收款闭环]]"
  - "[[../../../04-系统改进/20260501-1124-支付托管退款结算一致性/writer/plan|支付托管退款结算一致性]]"
---

# 课堂互动与课后评价闭环

## 1. 概述

本 Spec 面向课程履约后的 P0 主链路：师生在可进入窗口内进入课堂，通过已有 WebSocket 文本消息完成最小互动；教师结束课程后课程进入完课和争议期；学员在学习中心提交评价，评价沉淀到教师详情页，并且不破坏支付结算、教师完课统计和出款口径。

现有代码已经有课堂页、消息历史、WebSocket、课程开始/结束、评价 API 和教师详情评价列表。本计划不重做课堂系统，不引入音视频 SDK，不新增大范围多媒体能力，只把当前分散能力收敛成可验收闭环。

### 1.1 范围内

- 后端：
  - 统一课堂入口、历史消息和 WebSocket 的参与者校验与课程状态约束。
  - 稳定课堂相关 HTTP / WebSocket 错误语义，避免非参与者、已取消、未到时间等状态给出模糊错误。
  - 保持 `confirmed -> in_progress -> completed -> reviewed` 主状态流转清晰。
  - 校准评价写入后的支付结算、佣金阶梯和教师统计口径，确保 `reviewed` 不让完课从统计或结算中消失。
  - 补充必要后端测试。
- 前端：
  - 优化 `Classroom.tsx` 的课堂状态、连接状态、消息失败和结束课程体验。
  - 在 `StudentDashboard.tsx` 为 `completed` 课程接入评价提交表单或对话框。
  - 评价成功后刷新学习中心状态，并能在教师详情页评价列表看到评价。
  - 补齐 `types/api.ts` 中评价提交类型和课堂连接状态所需类型。
- 验证：
  - 后端 pytest 覆盖课堂进入、消息、状态流转、评价、结算/统计不回退。
  - 前端 `pnpm run build`。
  - tester 在 `[[../tester/test-plan|tester/test-plan.md]]` 记录课堂与评价闭环手工验证。

### 1.2 范围外

- 不接入 Agora、WebRTC、录播、屏幕共享、音视频权限申请或真实媒体流。
- 不实现 Redis Pub/Sub、多实例 WebSocket 广播、消息已读、输入中、撤回、附件、课件上传。
- 不新增课程笔记后端持久化；课堂页的课件与私人笔记仍可保留为明确占位。
- 不新增评价修改、删除、申诉、隐藏、举报和运营审核。
- 不新增待评价独立路由；P0 直接在学习中心完成评价。
- 不改支付核心状态机，不绕过 `payment_service`、`wallet_service`、`TaxStrategy` 或 `.agents/rules/payment-system.md`。

## 2. 需求分析

### 2.1 现状依据

| 模块 | 当前状态 | 本 Spec 处理 |
|---|---|---|
| 课堂详情 | `GET /lessons/{id}` 已返回 `can_enter_classroom`、`classroom_unavailable_reason`、`ends_at` | 保持契约，要求前端以该字段作为入口预检权威 |
| 课堂历史 | `GET /lessons/{id}/messages` 已按参与者鉴权返回分页消息 | 增加/校准课程状态约束和错误语义，防止取消、过早、非课堂状态继续当作可互动课堂 |
| WebSocket | `WS /lessons/{id}/ws?access_token=...` 已鉴权、落库、广播文本消息 | 保持 query token 方案为 P0，统一状态约束和连接状态反馈；短期 ticket 列为非目标 |
| 课堂页面 | `Classroom.tsx` 已预检课程、拉历史、连 WS、发送聊天；音视频/课件为占位 | 改善连接状态、失败提示、消息发送限制、教师结束后/学生离开后的路径 |
| 教师动作 | `PATCH /lessons/{id}/start/end` 已要求教师，结束课程写 `completed` 和 `held_until` | 本 Spec 不重新设计，只回归验证课堂页调用与状态反馈 |
| 学员中心 | `StudentDashboard.tsx` 已按课程状态分组，`completed` 只显示“待评价”按钮 | 接入真实评价表单和提交 API |
| 评价 API | `POST /reviews`、`GET /reviews/{id}`、`GET /teachers/{id}/reviews` 已存在 | 校准错误语义和前端接入；确保重复评价、非本人评价、非 completed 状态被拒绝 |
| 教师统计 | `teacher_stats_service` 已把 `completed/reviewed` 都算作有效完课 | 增加回归断言，防止评价后统计回落 |
| 佣金阶梯 | `payment_service.resolve_commission_rate` 已按 `status not in ('cancelled','expired')` 且 `actual_end_at` 统计 | 增加回归断言，防止 `reviewed` 影响结算阶梯 |

### 2.2 P0 验收标准

| ID | 验收标准 |
|---|---|
| AC-P0-01 | 师生作为课程参与者访问 `/classroom/:id` 时，前端先请求 `GET /lessons/{id}`；仅当 `can_enter_classroom=true` 才加载历史消息并建立 WebSocket。 |
| AC-P0-02 | 非参与者访问课堂详情、消息历史或 WebSocket 均被拒绝；HTTP 返回 `403`，WebSocket 返回 `type=error`、`code=forbidden` 后关闭。 |
| AC-P0-03 | `pending_confirmation`、过早的 `confirmed`、已过进入窗口的 `confirmed`、`cancelled`、`expired`、`completed`、`reviewed` 课程不可进入互动课堂；前端展示后端返回的中文不可进入原因，不建立 WebSocket。 |
| AC-P0-04 | 可进入课堂内，历史消息按时间正序展示；发送非空文本消息后，消息被写入 `messages` 表并通过同课时 WebSocket 广播，发送者本端也能拿到服务端 `id` 和 `created_at`。 |
| AC-P0-05 | WebSocket 至少区分 `connecting`、`connected`、`closed/error` 三种前端状态；未连接时发送按钮不可提交或显示“实时通道未就绪”。 |
| AC-P0-06 | 无效 JSON、空消息、超过 `MAX_CHAT_LENGTH=2000` 的消息不会落库，WebSocket 返回稳定错误消息且连接不断开。 |
| AC-P0-07 | 教师在课堂页点击“结束课程”调用 `PATCH /lessons/{id}/end`；成功后课程为 `completed`、写入 `actual_end_at`、`PaymentOrder.held_until`，并回到教师中心；学生点击“离开”不改变课程状态。 |
| AC-P0-08 | 学员中心对 `completed` 课程展示可操作的“去评价”；点击后可提交总评分、教学/准时/沟通子评分和文字内容；提交成功后课程状态变为 `reviewed`。 |
| AC-P0-09 | 评价只能由该课程学员提交，且只能提交一次；非本人、重复评价、非 `completed` 课程分别返回稳定错误，前端展示可读提示。 |
| AC-P0-10 | 评价成功后，教师详情页 `GET /teachers/{id}/reviews` 能展示最新评价，教师 `avg_rating`、`total_reviews` 同步更新。 |
| AC-P0-11 | 评价将课程从 `completed` 改为 `reviewed` 后，教师 `total_lessons` 不回落，佣金阶梯统计和已写入的 `PaymentOrder.held_until` 不受影响。 |
| AC-P0-12 | 后端相关 pytest 通过，前端 `pnpm run build` 通过，tester 产出课堂互动与课后评价闭环验证记录。 |

## 3. 设计方案

### 3.1 后端：课堂访问状态约束

当前 `lesson_service._classroom_entry_state()` 已集中计算课堂可进入状态。本 Spec 要求课堂互动相关入口复用同一口径。

#### 3.1.1 状态规则

| Lesson.status | 课堂互动 | 原因 |
|---|---|---|
| `pending_confirmation` | 不可进入 | `等待老师确认` |
| `confirmed` 且早于开课前 15 分钟 | 不可进入 | `未到可进入时间` |
| `confirmed` 且在开课前 15 分钟到计划结束后 15 分钟内 | 可进入 | `null` |
| `confirmed` 且晚于计划结束后 15 分钟 | 不可进入 | `课堂进入时间已过` |
| `in_progress` | 可进入 | `null` |
| `completed` 或 `reviewed` | 不可进入互动课堂 | `课程已完成` |
| `cancelled` | 不可进入 | `课程已取消` |
| `expired` | 不可进入 | `课程已过期` |

#### 3.1.2 服务层契约

在 `backend/app/services/lesson_service.py` 中保留 `require_lesson_participant()` 作为纯参与者校验；新增或扩展一个课堂互动专用 helper，例如：

```python
async def require_lesson_classroom_access(
    db: AsyncSession,
    user: User,
    lesson_id: uuid.UUID,
) -> Lesson:
    ...
```

行为：

- 先调用 `expire_stale_pending_lessons(db)`。
- 课程不存在：`LookupError("课程不存在")`。
- 当前用户不是 `student_id` 或 `teacher_profile.id == teacher_id`：`PermissionError("无权参与该课程")`。
- 当前状态不可互动：`ValueError(<classroom_unavailable_reason>)`。
- 成功返回 `Lesson` ORM。

#### 3.1.3 API 使用点

| 入口 | 使用校验 | 说明 |
|---|---|---|
| `GET /lessons/{id}` | `require_lesson_participant` 等价 | 详情可用于展示已完成/已取消状态，不强制可进入 |
| `GET /lessons/{id}/messages` | `require_lesson_classroom_access` | P0 只在互动课堂内拉历史；完成后的学习记录消息回放不做 |
| `WS /lessons/{id}/ws` | `require_lesson_classroom_access` | 非互动状态发送错误并关闭 |
| `message_service.create_chat_message` | `require_lesson_classroom_access` | 防止绕过 WS 层写入不可互动课程消息 |

> [!important]
> 本 Spec 不新增课后消息回放入口。若后续需要 completed 课程可查看聊天记录，应另开只读学习记录 Spec，避免与“不可进入互动课堂”混淆。

### 3.2 后端：WebSocket 协议与错误语义

继续使用当前协议：

```text
WS /api/v1/lessons/{lesson_id}/ws?access_token=<JWT>
```

客户端发送：

```json
{ "type": "chat", "content": "你好" }
```

服务端广播：

```json
{
  "type": "chat",
  "id": "...",
  "lesson_id": "...",
  "sender_id": "...",
  "content": "你好",
  "created_at": "2026-05-01T..."
}
```

错误帧：

```json
{ "type": "error", "code": "validation", "message": "消息内容不能为空" }
```

错误码约束：

| 场景 | code | 关闭连接 |
|---|---|---|
| 缺少 token / token 无效 | `unauthorized` | 是，`1008` |
| 账号禁用 | `forbidden` | 是，`1008` |
| 非课程参与者 | `forbidden` | 是，`1008` |
| 课程不存在 | `not_found` | 是，`1008` |
| 当前状态不可进入课堂 | `classroom_unavailable` | 是，`1008` |
| 非法 JSON | `invalid_json` | 否 |
| 不支持的消息类型 | `unsupported` | 否 |
| 空内容或超长内容 | `validation` | 否 |

P0 保留 query string token，因为浏览器原生 WebSocket 不能稳定设置 Authorization header；短期 WS ticket 属于 P1，不在本 Spec 实现。

### 3.3 后端：课程完成与评价状态约束

课程主状态仍为：

```text
pending_confirmation -> confirmed -> in_progress -> completed -> reviewed
```

#### 3.3.1 结束课程

`lesson_service.end_lesson()` 必须保持现有资金语义：

- 仅课程所属教师可结束。
- 仅 `in_progress` 可结束。
- 成功后：
  - `lesson.status = "completed"`。
  - `actual_end_at = now()`。
  - 调用 `payment_service.mark_lesson_completed(db, lesson)` 写 `PaymentOrder.held_until`。
  - 调用 `teacher_stats_service.sync_teacher_delivery_stats()`。

#### 3.3.2 提交评价

`review_service.create_review()` 保持现有规则，并补足回归验证：

- 课程不存在：`404`。
- 当前用户不是课程学员：`403`。
- 已存在评价：`400 该课程已评价`。
- 课程状态不是 `completed`：`400 仅已完成课程可评价`。
- 成功后同一事务：
  - 插入 `Review`。
  - `lesson.status = "reviewed"`。
  - 重算教师 `avg_rating`、`total_reviews`。
  - 同步教师 `total_lessons`、`response_rate`。

#### 3.3.3 评价不得破坏结算

必须保留或验证以下口径：

| 口径 | 要求 |
|---|---|
| 佣金阶梯 | `payment_service.resolve_commission_rate()` 按 `status not in ('cancelled','expired')` 且 `actual_end_at is not null` 统计；`reviewed` 必须计入 |
| 教师完课数 | `teacher_stats_service.DELIVERY_STATUSES` 包含 `completed` 和 `reviewed` |
| 争议期 | 评价不修改 `PaymentOrder.held_until`、`PaymentOrder.status`、`SettlementSnapshot`、`PayoutOrder` |
| 支付规则 | 禁止在评价服务直接修改钱包、账本、结算快照或出款单 |

### 3.4 前端：Classroom 页面改动

目标文件：`frontend/src/app/pages/Classroom.tsx`。

#### 3.4.1 预检流程

页面加载顺序：

1. 若无 token，展示“请先登录后再进入课堂”，不请求历史消息，不建立 WebSocket。
2. 并行请求：
   - `GET /lessons/{lessonId}`
   - `GET /auth/me`
3. 如果当前用户是教师，读取 `GET /teachers/me/profile` 以判断是否是该课程教师。
4. 如果 `lesson.can_enter_classroom !== true`，展示 `classroom_unavailable_reason`，不请求历史消息，不建立 WebSocket。
5. 如果可进入，加载 `GET /lessons/{lessonId}/messages?page=1&page_size=100`。
6. 历史消息加载完成或失败后建立 WebSocket；历史失败不阻止 WS，但需要展示历史加载错误。

#### 3.4.2 连接状态

新增前端状态：

```ts
type WsStatus = "idle" | "connecting" | "connected" | "closed" | "error";
```

UI 要求：

- 顶部或聊天面板展示“连接中 / 已连接 / 已断开 / 连接异常”。
- `connecting`、`closed`、`error` 状态下发送按钮禁用，或点击时提示“实时通道未就绪，请稍后重试”。
- 收到服务端 `type=error` 时展示 `message`；连接关闭后不自动无限重连，P0 只提示刷新页面重试。

#### 3.4.3 消息发送

- 输入为空时禁用发送。
- 前端可用 `maxLength={2000}` 对齐后端 `MAX_CHAT_LENGTH`。
- 发送后清空草稿；最终消息以服务端广播为准，不做本地乐观插入，避免重复。
- 消息列表根据 `sender_id === me.id` 区分“我/对方”。

#### 3.4.4 结束课程与离开

- 教师且属于该课程教师：
  - 主危险按钮为“结束课程”。
  - 点击确认后调用 `PATCH /lessons/{lessonId}/end`。
  - 成功后跳转 `/dashboard/teacher`。
  - 可保留“普通离开”，只跳转不改状态。
- 学员：
  - 主按钮为“离开”。
  - 点击只跳转 `/dashboard/student`。
  - 不调用 `end` API。

音视频、课件、笔记区域必须继续明确标识为占位或本地草稿，不得暗示已接入真实媒体能力。

### 3.5 前端：学员中心评价入口

目标文件：`frontend/src/app/pages/StudentDashboard.tsx`。

#### 3.5.1 展示规则

| Lesson.status | 展示 |
|---|---|
| `completed` | 显示“去评价”主按钮 |
| `reviewed` | 显示“已评价”只读标签 |
| 其他状态 | 不显示评价动作 |

评价入口可实现为同页 dialog/modal，不新增路由。

#### 3.5.2 评价表单

表单字段：

| 字段 | 约束 |
|---|---|
| `rating_overall` | 必填，1-5 |
| `rating_teaching` | 可选，1-5 |
| `rating_punctuality` | 可选，1-5 |
| `rating_communication` | 可选，1-5 |
| `content` | 可选，建议前端限制 500 字；后端当前无限制，本 Spec 不新增 DB 字段约束 |

提交：

```text
POST /api/v1/reviews
body:
{
  "lesson_id": "<lesson_id>",
  "rating_overall": 5,
  "rating_teaching": 5,
  "rating_punctuality": 5,
  "rating_communication": 5,
  "content": "..."
}
```

成功处理：

- 关闭表单。
- 清空错误。
- 重新加载 `/lessons?role=student&page=1&page_size=100`。
- 当前课程从 `completed` 进入 `reviewed` 分组展示。

失败处理：

- `400` 重复评价或非完课：展示后端中文 detail。
- `403` 非本人课程：展示“无权评价该课程”。
- 网络错误：保留表单内容，提示稍后重试。

### 3.6 前端：教师详情评价展示

目标文件：`frontend/src/app/pages/TeacherProfile.tsx`。

当前页面已经读取：

```text
GET /teachers/{id}/reviews?page_size=10
```

本 Spec 不重写教师详情页，只要求回归验证评价提交后：

- `GET /teachers/{id}` 的 `avg_rating`、`total_reviews` 更新。
- `GET /teachers/{id}/reviews` 列表出现新评价。
- 公开详情页无需登录即可读取评价列表。

如现有页面存在刷新时机问题，不在 `TeacherProfile.tsx` 做跨页状态同步；用户重新进入教师详情或刷新页面即可看到结果。

### 3.7 前端类型

目标文件：`frontend/src/app/types/api.ts`。

新增：

```ts
export interface ReviewCreate {
  lesson_id: string;
  rating_overall: number;
  rating_teaching?: number | null;
  rating_punctuality?: number | null;
  rating_communication?: number | null;
  content?: string | null;
}
```

如实现评价表单时抽象本地状态，可在页面内定义 `ReviewFormState`，不要求放入共享类型。

### 3.8 后端测试策略

本计划不替代 `tester/test-plan.md`，但 executor 必须配合 tester 保证以下 pytest 覆盖。

建议命令：

```bash
cd backend
python -m pytest tests/api/v1/test_lesson_messages.py tests/api/v1/test_lessons.py tests/api/v1/test_reviews.py tests/api/v1/test_payment_settlement.py -q
```

需要新增或调整断言：

- `test_lesson_messages.py`
  - 非参与者 `GET /messages` 返回 403。
  - `pending_confirmation`、过早 `confirmed`、`cancelled`、`completed/reviewed` 的 `GET /messages` 返回 400 和对应原因。
  - WebSocket 对不可进入课程返回 `code=classroom_unavailable` 后关闭。
  - WebSocket 空消息、超长消息返回 `validation` 且不落库。
  - 单课时双连接能收到同一条广播。
- `test_lessons.py`
  - 教师 start/end 状态流转仍为 `confirmed -> in_progress -> completed`。
  - 学生不能调用 end。
  - end 后 `actual_end_at` 和 `PaymentOrder.held_until` 非空。
- `test_reviews.py`
  - 学员对 completed 课程提交评价成功，状态变 `reviewed`。
  - 重复评价返回 400。
  - 非本人评价返回 403。
  - 非 completed 课程评价返回 400。
  - 评价后教师 `avg_rating`、`total_reviews`、`total_lessons` 正确。
- `test_payment_settlement.py`
  - `reviewed` 课程参与佣金阶梯统计。
  - 评价后不改写 `PaymentOrder.held_until`。

### 3.9 前端验证策略

构建：

```bash
cd frontend
pnpm run build
```

手工主链路：

1. 学员预约课程，教师确认并在可进入窗口开始课程。
2. 学员和教师分别进入 `/classroom/:id`。
3. 学员发送文字消息，教师端收到；教师发送文字消息，学员端收到。
4. 教师普通离开不结束课程；重新进入后历史消息仍在。
5. 教师点击结束课程，课程进入 `completed`，教师回到教师中心。
6. 学员中心出现“去评价”，提交评价后变为“已评价”。
7. 打开教师详情页，能看到评分和评价列表更新。
8. 检查浏览器控制台无未处理异常，网络请求错误有页面提示。

## 4. 执行模式

`execution_mode: agent-teams` 表示实现阶段允许 TeamLead 将后端、前端、测试验证拆给多个子 Agent 并行推进。所有实现仍必须严格追溯到本 `writer/plan.md`，不得借并行执行扩大到音视频、课件、运营审核或支付重构。

建议分工：

| 子任务 | 责任边界 |
|---|---|
| 后端执行 | 课堂访问 helper、消息/WS 状态约束、评价与统计/结算回归、pytest |
| 前端执行 | Classroom 连接状态与结束课程、StudentDashboard 评价表单、共享类型、build |
| 测试执行 | API 回归、浏览器主链路、测试报告和证据归档 |

## 5. 实现步骤

1. 后端统一课堂互动校验：
   - 在 `lesson_service.py` 增加 `require_lesson_classroom_access()` 或等价 helper。
   - 复用 `_classroom_entry_state()`，不可进入时抛 `ValueError(reason)`。
   - 不改变 `GET /lessons/{id}` 的详情读取语义。
2. 后端接入消息历史状态约束：
   - `message_service.list_messages()` 改用课堂互动校验。
   - `message_service.create_chat_message()` 改用课堂互动校验。
   - 保持 `MAX_CHAT_LENGTH = 2000`。
3. 后端接入 WebSocket 状态约束：
   - `lessons.py` 的 WS 建连鉴权后调用课堂互动校验。
   - 对 `ValueError` 返回 `code=classroom_unavailable`。
   - 保持 `unauthorized/forbidden/not_found/invalid_json/unsupported/validation` 错误码。
4. 后端补测试：
   - 扩展 `test_lesson_messages.py` 覆盖课堂状态约束和 WS 错误。
   - 扩展 `test_reviews.py` 覆盖评价后统计。
   - 扩展 `test_payment_settlement.py` 覆盖 `reviewed` 不破坏佣金/争议期。
5. 前端补类型：
   - 在 `types/api.ts` 增加 `ReviewCreate`。
   - 如需要，增加 `WsStatus` 页面局部类型。
6. 前端优化 `Classroom.tsx`：
   - 明确 `WsStatus`。
   - 未可进入时不建立 WS。
   - 发送按钮根据连接状态和草稿状态禁用。
   - 收到服务端错误帧时展示中文提示。
   - 保持教师结束课程与学生离开语义。
7. 前端接入学员评价：
   - 在 `StudentDashboard.tsx` 为 `completed` 课程实现评价 dialog/form。
   - 调用 `POST /reviews`。
   - 成功后刷新课程列表并展示 `reviewed`。
   - 错误直接展示后端 detail。
8. 前端最小回归教师详情：
   - 确认 `TeacherProfile.tsx` 仍按公开 API 展示评价。
   - 如类型缺失导致 build 失败，只补类型，不重写页面结构。
9. 运行验证：
   - 后端运行本计划列出的 pytest。
   - 前端运行 `pnpm run build`。
   - executor 在 `executor/summary.md` 记录实际改动文件、测试命令和任何偏离。

## 6. 风险和依赖

| 风险/依赖 | 处理方式 |
|---|---|
| 课堂历史消息完成后不可读 | P0 定义为互动课堂内历史；课后只读回放另开 Spec，避免本次扩大范围。 |
| WebSocket query token 暴露 | P0 维持现状；生产短期 ticket 或首包鉴权列 P1，不在本次实现。 |
| 状态约束收紧影响旧测试 | 同步更新测试期望：参与者不等于任何状态都可互动，互动入口以 `can_enter_classroom` 为准。 |
| `completed -> reviewed` 影响结算统计 | 回归断言 `reviewed` 计入完课和佣金阶梯；评价服务不得修改支付订单和钱包。 |
| 前端评价表单复杂度 | P0 用简单 dialog/form，不引入新表单库，不新增独立路由。 |
| 多实例广播 | 仍为单进程内存房间；Redis Pub/Sub 为 P2。 |
| 音视频占位误导 | 页面文案必须明确“文字实时/音视频占位”，不得暗示真实通话已接入。 |

## 7. 非目标

- 不实现真实音视频、录播、屏幕共享、课件上传、笔记云同步。
- 不实现 WebSocket 自动重连、离线队列、已读回执、输入中提示。
- 不实现评价修改、删除、申诉、举报、审核。
- 不新增支付、出款、结算表结构。
- 不改教师入驻、排课、预约创建、钱包充值主流程。
- 不新增全局通知、站内信、客服争议处理。

## 8. 文档关联

- Team Context：`[[../lead/team-context|Team Context]]`
- 探索报告：`[[../explorer/exploration-report|探索报告]]`（并行创建中）
- 测试计划：`[[../tester/test-plan|测试计划]]`
- 实现总结：`[[../executor/summary|实现总结]]`（待创建）
- 场景地图：`[[../../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN用户场景地图]]`
- 学员闭环：`[[../../../03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan|学员找老师到预约上课闭环]]`
- 教师供给闭环：`[[../../../03-能力交付/20260501-1122-教师入驻排课授课收款闭环/writer/plan|教师入驻排课授课收款闭环]]`
- 支付一致性：`[[../../../04-系统改进/20260501-1124-支付托管退款结算一致性/writer/plan|支付托管退款结算一致性]]`
- 支付规则：`.agents/rules/payment-system.md`
