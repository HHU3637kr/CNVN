---
title: 测试计划
type: test-plan
status: draft
created: 2026-05-01
git_branch: feat/spec-20260501-1339-classroom-review-flow
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - test-plan
---

# 测试计划：课堂互动与课后评价闭环

## 验收标准

- 后端 pytest 覆盖课堂参与者鉴权、课堂不可进入状态、历史消息读取、WebSocket 文本收发和错误状态、教师 start/end 权限、课后评价权限与重复提交拒绝。
- 只有课时参与者可以读取消息和连接课堂 WebSocket；非参与者、无 token、无效 token 必须被拒绝，并返回可断言的 HTTP 状态码或 WS error code。
- 课堂入口状态可由课程列表和详情稳定表达：`confirmed` 进入窗口内、`in_progress` 可进入；`pending_confirmation`、未到时间、进入时间已过、`completed/reviewed`、`cancelled`、`expired` 不可进入并有明确原因。
- 课堂历史消息按课时分页返回，WebSocket chat 消息会 trim 内容、写入数据库、广播给当前课堂连接，并能被后续历史消息接口读回。
- WebSocket 错误状态覆盖 `unauthorized`、`forbidden`、`invalid_json`、`unsupported`、`validation`，失败路径不得产生脏消息。
- 只有授课教师能 start/end 课程；学生、非授课教师和时间窗口外 start 必须被拒绝；end 后课程进入 `completed` 且保留结算托管状态。
- 学员只能对自己的 `completed` 课程提交一次评价；重复评价、非学员/非本人、未完成课程评价必须拒绝。
- 评价把课程标记为 `reviewed` 后，不得破坏教师完课统计、佣金阶梯和结算统计口径；`reviewed` 与具备 `actual_end_at` 的有效完课仍参与统计。
- 前端必须能通过 `pnpm build`；Chrome/CDP smoke 必须覆盖课堂阻断、课堂聊天、教师结束课程、学员完课后评价入口/提交和评价后状态刷新。
- 测试执行阶段所有命令退出码、浏览器证据、网络摘要和后端/pytest 日志均保存到当前 Spec 的 tester 日志目录，且不得保存 token、Cookie、密码或真实用户隐私。

## 后端 pytest 覆盖

| 用例编号 | 优先级 | 描述 | 输入/准备 | 关键断言 | 建议落点 |
|---|---|---|---|---|---|
| TC-BE-001 | P0 | 消息历史参与者鉴权 | 创建学生、授课教师、已确认课程，再用第三方账号请求 `/lessons/{id}/messages` | HTTP 403；不返回消息列表 | `backend/tests/api/v1/test_lesson_messages.py` |
| TC-BE-002 | P0 | 参与者读取空历史消息 | 学生预约、教师确认，学生请求 messages | HTTP 200；`total = 0`；`items = []` | `test_lesson_messages.py` |
| TC-BE-003 | P0 | 历史消息读回 WS 写入内容 | 同一课程通过 WS 发送 `  hello ws  ` 后再次请求 messages | 历史消息 total +1；content 被 trim 为 `hello ws`；sender_id 为发送者 | `test_lesson_messages.py` |
| TC-BE-004 | P0 | WS 无 token 拒绝 | 连接 `/lessons/{uuid}/ws` 不带 query token | 收到 `{type:error, code:unauthorized}` 后关闭 | `test_lesson_messages.py` |
| TC-BE-005 | P0 | WS 无效 token 拒绝 | query `access_token=not-a-valid-jwt` | 收到 `unauthorized`；无消息写入 | `test_lesson_messages.py` |
| TC-BE-006 | P0 | WS 非参与者拒绝 | 第三方账号 token 连接已确认课程 | 收到 `forbidden`；无消息写入 | `test_lesson_messages.py` |
| TC-BE-007 | P0 | WS 非法 JSON 错误 | 参与者连接后发送 `not-json{{{` | 收到 `invalid_json`；连接可继续或受控关闭；无消息写入 | `test_lesson_messages.py` |
| TC-BE-008 | P0 | WS unsupported type 错误 | 参与者发送 `{"type":"ping"}` | 收到 `unsupported`；messages total 不增加 | `test_lesson_messages.py` |
| TC-BE-009 | P0 | WS 空内容校验 | 参与者发送 `{"type":"chat","content":"   "}` | 收到 `validation`；messages total 不增加 | `test_lesson_messages.py` |
| TC-BE-010 | P0 | WS 文本收发和广播 | 同课时建立学生、教师两个连接，学生发送 chat | 两端均收到同一条 chat payload；DB 持久化一条消息 | `test_lesson_messages.py`，双连接如 TestClient 跨 loop 不稳定则保留 `LessonRoomManager` 单元测试 |
| TC-BE-011 | P0 | 课堂不可进入状态矩阵 | 构造 `pending_confirmation`、未到时间、窗口内 confirmed、窗口过期 confirmed、`in_progress`、`completed`、`reviewed`、`cancelled`、`expired` | `can_enter_classroom` 和 `classroom_unavailable_reason` 与矩阵一致；detail/list 一致 | `backend/tests/api/v1/test_lessons.py` |
| TC-BE-012 | P0 | 学生不能 start/end | 学生对自己的 confirmed/in_progress 课程调用 start/end | HTTP 403；错误为教师角色权限；课程状态不变 | `test_lessons.py` |
| TC-BE-013 | P0 | 非授课教师不能操作 | 教师 B 对教师 A 的课程 confirm/start/end | HTTP 403；错误为只能操作自己的课程 | `test_lessons.py` |
| TC-BE-014 | P0 | 教师 start 时间窗校验 | 授课教师对未到可进入时间的 confirmed 课程 start | HTTP 400；detail 为未到可进入时间；状态仍 confirmed | `test_lessons.py` |
| TC-BE-015 | P0 | 教师 start/end 成功流转 | 授课教师在窗口内 start 后 end | `confirmed -> in_progress -> completed`；写入 `actual_start_at/actual_end_at`；`PaymentOrder.status = held` | `test_lessons.py` |
| TC-BE-016 | P0 | 学员完成后提交评价 | completed 课程由本人学生 POST `/reviews` | HTTP 201；评价字段保存；教师 `avg_rating/total_reviews` 更新；课程状态为 `reviewed` | `backend/tests/api/v1/test_reviews.py` |
| TC-BE-017 | P0 | 重复评价拒绝 | 同一学生同一 lesson 连续提交两次评价 | 第二次 HTTP 400；detail 包含已评价；评价数量仍为 1 | `test_reviews.py` |
| TC-BE-018 | P0 | 越权评价拒绝 | 第三方学生评价别人的 completed 课程 | HTTP 403；不创建 Review；课程状态仍 completed | `test_reviews.py` |
| TC-BE-019 | P0 | 未完成课程评价拒绝 | 对 pending/confirmed/in_progress 课程提交评价 | HTTP 400；detail 包含已完成；不创建 Review | `test_reviews.py` |
| TC-BE-020 | P0 | `reviewed` 不破坏结算统计 | completed 课程评价后变为 reviewed，再执行教师交付统计/佣金阶梯统计 | `total_lessons` 不回退；`reviewed` 或 `actual_end_at` 有效完课仍计入佣金统计；PaymentOrder 托管/释放口径不因 reviewed 丢失 | `test_reviews.py` + `test_payment_settlement.py` |

## 后端回归命令

专项课堂与评价回归：

```powershell
cd backend
python -m pytest tests/api/v1/test_lesson_messages.py tests/api/v1/test_lessons.py tests/api/v1/test_reviews.py -q
```

结算统计联动回归：

```powershell
cd backend
python -m pytest tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q
```

完整后端 API 回归：

```powershell
cd backend
python -m pytest tests/api/v1 -q
```

若本机启用 `uv`，可使用等价命令 `uv run pytest ...`；执行报告必须记录实际使用的命令。

## 前端 Build 与静态检查

| 用例编号 | 优先级 | 描述 | 命令/输入 | 关键断言 | 证据 |
|---|---|---|---|---|---|
| TC-FE-001 | P0 | 前端生产构建 | `cd frontend; pnpm build` | 退出码 0；无 TypeScript/Vite 构建错误 | `frontend-build.log`、`frontend-build.exitcode` |
| TC-FE-002 | P0 | 课堂页阻断态渲染 | 浏览器打开不可进入课程 `/classroom/:id` | 显示“暂时不能进入课堂”和后端原因；不建立 WS | screenshot、console、network |
| TC-FE-003 | P0 | 课堂页历史消息和实时消息 | 参与者进入可进入课程，等待历史消息加载，发送聊天 | 显示历史消息；新消息显示“我/对方”；无未处理 console error | screenshot、network、browser-console |
| TC-FE-004 | P0 | WS 未就绪错误提示 | 在连接未 open 或被服务端拒绝时点击发送 | 页面显示“实时通道未就绪”或后端错误；不清空不可恢复状态 | screenshot、console |
| TC-FE-005 | P0 | 教师结束课程入口 | 教师进入课堂点击结束课程并确认 | 调用 `PATCH /lessons/{id}/end`；成功后回教师中心；课程状态变 completed | network、screenshot |
| TC-FE-006 | P0 | 学员完课后评价入口 | 学员中心出现 completed 课程 | 显示待评价入口；提交后刷新为已评价；教师详情评价列表可见新评价 | screenshot、network |
| TC-FE-007 | P1 | 重复评价端侧恢复 | 已 reviewed 课程再次尝试评价入口或直接提交 | UI 不提供重复入口，或 API 400 被清晰展示；不出现 5xx/空白页 | screenshot、network |

## Chrome/CDP Smoke 场景

执行阶段使用项目既有浏览器自动化方式；若未集成 Playwright/Cypress，可复用当前 Spec 日志目录中的 CDP 脚本模式，通过 Chrome DevTools Protocol 自动采集 console、network 和截图。

| 场景编号 | 用户角色 | 业务目标 | 前置数据 | 操作路径 | 关键断言 | 证据 |
|---|---|---|---|---|---|---|
| US-001 | 学员 | 不可进入课程时获得明确原因 | 构造 `pending_confirmation` 或未到时间 confirmed 课程 | 登录学员 -> 学员中心 -> 点击/直接打开课堂 URL | 课堂阻断页展示后端原因；无 WS 请求；无未处理 console error | `screenshots/us-001-classroom-blocked.png`、network、console |
| US-002 | 学员 + 教师 | 课堂文字互动闭环 | 构造窗口内 confirmed 或 in_progress 课程，至少一条历史消息 | 学员进入课堂 -> 查看历史消息 -> 发送文本 -> 教师端或同端刷新查看 | GET messages 200；WS 连接成功；chat payload 入库并回显 | screenshots、`network-summary.json`、`backend.log` |
| US-003 | 教师 | 结束课程并触发完课状态 | 同一课程处于 in_progress，教师登录 | 教师进入课堂 -> 点击结束课程 -> 确认 -> 返回教师中心 | PATCH end 200；状态 completed；学生端不再可进入课堂 | screenshots、network、backend.log |
| US-004 | 学员 | 完课后提交评价 | US-003 课程 completed，学生登录 | 学员中心 -> 待评价入口 -> 填写评分/内容 -> 提交 | POST reviews 201；课程变 reviewed；学习记录显示已评价；教师详情评价可见 | screenshots、network、backend.log |
| US-005 | 第三方学员 | 越权评价被拒绝 | completed 课程属于学员 A，学员 B 登录 | 学员 B 直接调用评价提交路径或 UI 跳转尝试 | POST reviews 403；无评价记录；无 5xx | network、backend.log |
| US-006 | 学员 | 重复评价被拒绝 | 已 reviewed 课程 | 重复提交同 lesson review 或刷新后查入口 | POST reviews 400 或 UI 不显示提交入口；状态仍 reviewed；统计不重复增加 | screenshots、network |

## 测试数据准备

执行阶段必须使用测试库和测试账号，不使用真实用户数据。

基础数据：

- 学员 A：普通学生账号，钱包充值 500000 VND。
- 学员 B：越权验证账号，钱包可不充值。
- 教师 A：已完成 `become-teacher`，hourly_rate 为 60000 VND，创建覆盖测试日期的 availability。
- 教师 B：非授课教师，用于 start/end 越权验证。
- Ledger 账户：确保 `escrow`、`platform_revenue`、`tax_payable`、`teacher_payable` 已存在；pytest fixture 已在测试库自动初始化。

课程数据：

- `pending_confirmation`：验证课堂入口等待确认。
- `confirmed` 未到时间：验证未到可进入时间。
- `confirmed` 进入窗口内：验证课堂进入、历史消息和 WS。
- `confirmed` 进入时间已过：验证课堂进入时间已过。
- `in_progress`：验证课堂继续进入和教师 end。
- `completed`：验证学员可评价。
- `reviewed`：验证已评价状态和统计不回退。
- `cancelled` / `expired`：验证课堂不可进入。

时间处理：

- API 入参统一使用 UTC ISO 字符串；越南本地时间构造可沿用 `vn_dt_local(...).astimezone(ZoneInfo("UTC"))`。
- 为避免时间窗不稳定，pytest 中可直接调整测试库 Lesson 的 `scheduled_at` 到当前 UTC 前后固定分钟数，并立即 commit 后执行 start/end。

## 日志与审计要求

### 关键路径可观测性

- 参与者鉴权：保存 HTTP/WS 拒绝状态、error code、关联 lesson id 摘要和 pytest 断言输出。
- 课堂状态流转：保存 `confirmed -> in_progress -> completed -> reviewed` 的接口响应摘要、DB 状态断言和相关 PaymentOrder 状态断言。
- 历史消息与 WS：保存 messages total、chat payload 摘要、sender_id 断言、WS error code 断言。
- 评价写入：保存 Review 创建响应摘要、重复/越权/未完成拒绝响应摘要、教师评分统计断言。
- 结算统计：保存 `reviewed` 参与教师交付统计/佣金统计的服务函数或接口断言；证明评价后不影响已完成课程统计。
- 前端端侧：保存 console、network、截图和必要 trace；主成功路径不允许存在未解释的 `console.error`、未处理异常或 5xx。

### 执行阶段证据目录结构

每次测试运行创建独立 run 目录：

```text
spec/03-能力交付/20260501-1123-课堂互动与课后评价闭环/tester/artifacts/test-logs/YYYYMMDD-HHMM-run-XXX/
├── audit.log
├── environment.txt
├── git-status-start.txt
├── pytest-classroom-review.log
├── pytest-classroom-review.exitcode
├── pytest-payment-regression.log
├── pytest-payment-regression.exitcode
├── frontend-build.log
├── frontend-build.exitcode
├── smoke-cdp.log
├── smoke-cdp.exitcode
├── browser-console.ndjson
├── network-summary.json
├── backend.log
├── api-summary.json
├── user-flow.md
├── failure-trace.txt
├── scripts/
├── screenshots/
├── recordings/
└── traces/
```

文件要求：

- `audit.log`：由测试 runner 自动记录 run id、用例编号、开始/结束时间、执行状态、脱敏账号角色。
- `environment.txt`：由命令自动写入 Python、pytest、Node、pnpm、Chrome 版本、当前分支、commit、测试库可达性；不得写入数据库密码原文以外的 token/secret。
- `*.exitcode`：每个命令的原始退出码，0 表示通过，非 0 表示失败或阻塞。
- `browser-console.ndjson`：由 CDP/浏览器自动化监听 console/pageerror 生成。
- `network-summary.json`：只保存 method、url path、status、duration、request id、错误摘要；不得保存 Authorization、Cookie、完整请求/响应 body。
- `backend.log`：由服务启动重定向或按 RUN_ID/request id 过滤生成，不能事后手写补造。
- `screenshots/`：至少包含课堂阻断、课堂聊天、教师结束、评价提交/已评价状态。
- `traces/` / `recordings/`：复杂交互失败或偶发失败时必须保留。

## 退出码与通过判定

| 命令 | 通过条件 | 失败处理 |
|---|---|---|
| `python -m pytest tests/api/v1/test_lesson_messages.py tests/api/v1/test_lessons.py tests/api/v1/test_reviews.py -q` | 退出码 0，专项用例全通过 | 保存 log/exitcode；失败用例进入 bug handoff |
| `python -m pytest tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q` | 退出码 0，结算统计回归通过 | 保存 log/exitcode；若环境阻塞，记录为 blocked |
| `python -m pytest tests/api/v1 -q` | 退出码 0，API 全回归通过 | 非本 Spec 失败需标注是否相关 |
| `pnpm build` | 退出码 0 | 构建失败直接阻塞前端 smoke |
| Chrome/CDP smoke | 退出码 0，所有 US 场景断言通过 | 保存 console/network/screenshots/trace 并提交 bug handoff |

最终通过必须同时满足：

- P0 后端专项和结算联动回归通过。
- 前端 build 通过。
- Chrome/CDP smoke 的 P0 场景通过，且证据目录完整。
- 证据脱敏检查通过：没有 token、Cookie、Authorization header、密码、密钥、完整手机号、真实用户隐私。
- 如存在环境阻塞，`tester/test-report.md` 必须给出阻塞证据、影响范围和未测风险，不能以手写日志替代真实执行证据。

## 测试环境要求

- Python 3.11，安装 `backend/pyproject.toml` 中运行与 dev 依赖。
- PostgreSQL 16 本机服务可连接；测试库连接串由 `backend/tests/conftest.py` 使用：`postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/cnvn_test`。
- `cnvn_test` 是测试专用库，pytest fixture 会 drop/create 全部表；不得指向真实或共享生产数据。
- Node/pnpm 可用；前端依赖已安装，执行目录为 `frontend`。
- Chrome/Chromium 可用并允许 CDP 自动化；前端 dev server 和后端 API server 可由 smoke 脚本启动或由测试前置步骤启动。
- 测试使用 mock topup/mock payment 路径，不依赖真实 VietQR/VNPay/MoMo 渠道。

## 本阶段边界

- 本阶段只创建测试计划，不运行测试。
- 不修改业务代码、测试代码、writer 或 explorer 产物。
- explorer 报告尚未落盘时，执行阶段需重新核对其结论；若 explorer/writer 后续调整接口边界，spec-tester 应更新本计划对应用例和证据要求。
