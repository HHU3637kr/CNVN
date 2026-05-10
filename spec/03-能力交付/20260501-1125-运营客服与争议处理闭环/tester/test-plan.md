---
title: 测试计划
type: test-plan
status: 未确认
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - test-plan
---

# 测试计划

## 验收标准

1. 用户争议闭环可追溯：只有付款单学员本人可以对自己参与且存在活跃 `PaymentOrder` 的课程/付款单发起 open 争议，成功后写入争议主记录、事件记录、操作者、原因、关联 lesson/payment_order，并让订单进入可阻止自动 release 的争议态或争议标记。
2. 权限边界明确：课程教师、非课程参与者不可发起争议；非运营角色不可访问运营查询和处理 API；无登录态返回 401，有登录但角色不符返回 403。
3. 状态机防重复：同一 lesson/payment_order 已存在 open 争议时再次发起必须被拒绝，不能产生第二条 open 争议、重复事件或重复资金动作。
4. 运营处理可审计：运营可查询争议列表/详情/上下文，可执行人工退款、人工释放、关闭/驳回，并记录 operator、reason、action、前后状态和关联 request id。
5. 资金动作只走 `payment_service`：人工退款必须调用 `payment_service.refund_payment_order`，人工释放必须调用 `payment_service.release_payment_order`；重复提交和并发提交保持幂等，不重复写 ledger、wallet、settlement snapshot、payout 或 refund transaction。
6. watcher 安全：open 争议存在时，`dispute_watcher.run_once()` 不得自动 release 对应 held 订单；争议关闭且处理结果允许 release 后，watcher 或人工 release 才能推进。
7. 前端入口可用：学员中心或付款单详情的争议入口可见、可提交、可展示成功/失败状态；运营入口只对运营角色可用。
8. 质量门禁通过：目标后端 pytest、全量前端 build、Chrome/CDP smoke 均 exit code = 0；失败时必须留下自动生成的日志、截图、network 摘要和后端日志证据。

## 测试用例

| 用例编号 | 描述 | 输入 | 预期输出 | 边界条件 |
|---------|------|------|---------|---------|
| TC-BE-001 | 学员对自己的已付款/held 课程发起争议 | student token；lesson_id；payment_order_id；reason；RUN_ID | 返回 201/200；`DisputeCase.status=open`；关联 lesson/payment_order/student/teacher；写 `DisputeEvent(created)`；订单进入 disputed 或存在 open 争议阻塞标记 | reason 最小/最大长度、lesson 与 payment_order 不匹配 |
| TC-BE-002 | 教师不能发起争议 | teacher token；lesson_id；reason | 返回 403 或业务错误码 `forbidden`；不写 DisputeCase/Event；订单状态不变 | 教师仍可查看与自己相关的争议详情 |
| TC-BE-003 | 非参与者不可发起争议 | unrelated user token；有效 lesson_id/payment_order_id | 返回 403 或业务错误码 `forbidden`；不写 DisputeCase/Event；订单状态不变 | 课程存在但用户无关系 |
| TC-BE-004 | 未登录不可发起争议 | 无 Authorization | 返回 401；无副作用 | token 过期同样拒绝 |
| TC-BE-005 | 重复 open 争议被拒绝 | 同一 lesson/payment_order 连续两次 POST | 第一次成功；第二次 409 或业务错误码 `dispute_already_open`；open 记录数仍为 1 | 并发两次 POST 只能成功一次 |
| TC-BE-006 | 非 held/可争议订单不可发起争议 | pending/released/refunded 订单 | 返回 400/409；不写 open 争议 | 已 release 后不得回退资金 |
| TC-BE-007 | 运营查询争议列表 | operator token；status=open；分页参数 | 返回分页列表；包含 status、lesson、payment_order、initiator、opened_at、last_event_at | 空列表、非法 status、分页边界 |
| TC-BE-008 | 运营查询争议详情上下文 | operator token；dispute_id | 返回课程、订单、学生、教师、付款、处理历史和当前可执行动作 | 不存在 dispute 返回 404 |
| TC-BE-009 | 普通用户不能进运营争议 API | student/teacher token 调运营 list/detail/action | 返回 403；无数据泄露；无处理事件 | 无登录返回 401 |
| TC-BE-010 | 运营人工退款走 `payment_service.refund_payment_order` | operator token；open dispute；action=refund；reason；idempotency_key | 争议关闭为 refunded/resolved；PaymentOrder=refunded；学生钱包退款一次；ledger/refund transaction 一次；事件写 operator/reason | 重复相同 idempotency_key 返回同一结果 |
| TC-BE-011 | 运营人工释放走 `payment_service.release_payment_order` | operator token；open dispute；action=release；reason；idempotency_key | 争议关闭为 released/resolved；PaymentOrder=released；SettlementSnapshot/PayoutOrder/教师钱包入账一次；事件写 operator/reason | 重复和并发 release 不重复入账 |
| TC-BE-012 | 已退款争议再释放被拒绝 | refunded dispute/order 调 action=release | 返回 409；资金和事件不发生非法二次处理 | 状态不可逆 |
| TC-BE-013 | 已释放争议再退款被拒绝 | released dispute/order 调 action=refund | 返回 409；资金和事件不发生非法二次处理 | 状态不可逆 |
| TC-BE-014 | open 争议阻止 watcher 自动 release | held 且 `held_until < now()` 的订单；存在 open dispute；调用 `dispute_watcher.run_once()` | processed 不包含该订单；PaymentOrder 仍未 released；无 SettlementSnapshot/PayoutOrder；日志说明 skip disputed/open case | batch 内混合正常过期订单时，其他订单仍 release |
| TC-BE-015 | 争议关闭后 watcher 行为符合处理结果 | open dispute 关闭为 rejected/allow_release 后，held_until 过期并调用 watcher | 若设计允许 watcher 后续 release，则只 release 一次；若关闭已人工 release，则 watcher processed=0 | 以 writer 最终状态机为准 |
| TC-BE-016 | 处理事件审计字段完整 | 任意创建/处理争议动作 | 每条事件含 action、actor_id、actor_role、reason、created_at、request_id/RUN_ID、before_status、after_status | 不保存 token、密码、完整隐私 |
| TC-BE-017 | 数据库约束保护 open 唯一性 | 直接或并发创建同一 payment_order open dispute | 唯一约束或事务锁保证只存在一条 open 争议 | PostgreSQL 下验证，不能只靠应用内查询 |
| TC-BE-018 | API 错误响应一致 | 构造 validation/not_found/forbidden/conflict | 返回结构符合项目现有错误约定；HTTP status 正确；无 500 | 错误路径要有后端日志 |
| TC-FE-001 | 前端 production build | `cd frontend; pnpm build` | exit code = 0；无 TypeScript/Vite 构建错误 | 新增页面/路由/API 类型必须参与 build |
| TC-FE-002 | 学员争议入口可用 | Chrome/CDP 登录学员；进入学员中心或付款单详情；点击争议入口；提交 reason | 页面出现成功状态或争议详情；network 记录 POST 争议成功；无 console error | 后端返回重复 open 时显示可理解错误 |
| TC-FE-003 | 教师侧不提供发起争议入口 | Chrome/CDP 登录教师；进入教师中心相关课程 | 不展示教师发起争议入口；直接调用创建 API 返回 403 | 教师仍可等待运营处理并查看相关争议 |
| TC-FE-004 | 运营争议列表和处理入口可用 | Chrome/CDP 登录运营；进入运营页面；筛选 open；打开详情；执行 refund/release 的 dry-run 或测试库真实动作 | 列表/详情渲染；处理成功后状态刷新；network status 正确；关键截图归档 | 运营动作必须使用测试库订单 |
| TC-FE-005 | 无权限用户不能进入运营前端/API | 登录 student/teacher 访问运营路由并直接请求运营 API | 前端不可见或跳转/拒绝；API 返回 403；network 无敏感数据 | 手动改 URL 也不能越权 |

## 用户使用场景（端侧/E2E 适用）

| 场景编号 | 用户角色 | 业务目标 | 前置数据 | 操作路径 | 关键断言 | 证据 |
|---------|----------|----------|----------|----------|----------|------|
| US-001 | 学员 | 对已完成但未结算的课程发起争议 | student_A 与 teacher_A 有 completed/dispute_window 课程；PaymentOrder=held；钱包已扣款 | 登录学员 -> 学员中心/付款单详情 -> 点击争议入口 -> 输入 reason -> 提交 | UI 显示 open 争议；POST 创建争议 2xx；订单未 release；后端日志含 RUN_ID/request_id | screenshot、browser-console.ndjson、network-summary.json、backend.log |
| US-002 | 教师 | 被争议后等待运营处理 | teacher_A 是课程教师；PaymentOrder=held/disputed | 登录教师 -> 查看相关课程/争议状态或等待运营处理 | 不提供教师发起争议入口；直接调用创建 API 返回 403；教师相关查看权限不被破坏 | screenshot、network、backend.log |
| US-003 | 非参与用户 | 被禁止发起争议 | unrelated_user_B；lesson/payment_order 属于 A | 登录 B -> 直接打开或调用争议入口/API | UI 不提供入口或提交失败；API 403；无 DisputeCase/Event | screenshot、network-summary.json、backend.log |
| US-004 | 学员 | 重复发起 open 争议被拒绝 | US-001 已创建 open 争议 | 再次从入口提交或直接重放 POST | 显示“已有处理中争议”类错误；HTTP 409/业务冲突；open 记录仍 1 条 | screenshot、network、pytest DB 断言 |
| US-005 | 运营 | 查询 open 争议并查看上下文 | operator_A；至少 1 条 open dispute | 登录运营 -> 运营争议列表 -> 筛选 open -> 打开详情 | 列表/详情包含课程、双方、订单、金额、历史事件；无 console error | screenshot、network、backend.log |
| US-006 | 运营 | 人工退款处理争议 | operator_A；open dispute；PaymentOrder=held/disputed | 详情页点击退款 -> 输入 reason -> 确认 | 状态刷新为 refunded/resolved；学生钱包只增加一次；处理历史出现 operator/reason | screenshot、network、backend.log、pytest 资金断言 |
| US-007 | 运营 | 人工释放处理争议 | operator_A；open dispute；PaymentOrder=held/disputed | 详情页点击释放 -> 输入 reason -> 确认 | 状态刷新为 released/resolved；教师钱包和 payout 只写一次；处理历史完整 | screenshot、network、backend.log、pytest 资金断言 |
| US-008 | 普通用户 | 不能访问运营能力 | student_A 或 teacher_A | 直接访问运营路由；直接请求运营 list/detail/action API | 前端拒绝或跳转；API 401/403；响应不包含争议详情 | screenshot、network-summary.json |

## 覆盖率要求

- 后端新增/修改模块行覆盖率：`dispute` API、schema、model、service、watcher 分支和 payment_service 调用适配合计 >= 85%；支付资金动作相关新增分支 >= 90%。
- 功能覆盖率：P0 用例 TC-BE-001 至 TC-BE-014 必须全部自动化；P1 运营列表/详情/处理历史至少覆盖 API 自动化和 Chrome/CDP smoke。
- 权限覆盖率：每个运营 API 至少覆盖 unauthenticated、non-operator、operator 三类角色。
- 幂等覆盖率：人工 refund/release 均覆盖重复请求和并发请求；断言数据库最终状态，而不只断言 HTTP status。
- 端侧覆盖率：至少覆盖 1 条成功创建争议、1 条重复/拒绝路径、1 条运营处理路径、1 条无权限运营访问路径。

## 测试环境要求

### 后端 pytest

- 建议命令：
  - `cd backend; pytest tests/api/v1/test_disputes.py tests/api/v1/test_payment_settlement.py -q`
  - 回归门禁：`cd backend; pytest -q`
- 新增测试文件建议：`backend/tests/api/v1/test_disputes.py`，复用现有 auth、lesson、wallet、payment fixture；如需 watcher 回归，可在 `test_payment_settlement.py` 增加 open dispute skip 用例。
- pytest 必须使用 PostgreSQL 测试库执行，确保部分唯一索引、事务锁、`FOR UPDATE SKIP LOCKED` 和并发幂等行为真实生效。
- 每个关键资金用例都要断言：
  - `PaymentOrder.status`、`released_at`、`refunded_at`、`held_until`
  - `DisputeCase.status` 与 `DisputeEvent` 数量/字段
  - `Wallet.balance` 只变化一次
  - ledger/transaction/refund/payout/settlement snapshot 不重复
  - repeated idempotency key 与并发请求的最终状态一致

### 前端 build

- 命令：`cd frontend; pnpm build`
- exit code 必须为 0。
- 若新增运营路由、争议表单或 API 类型，build 必须覆盖这些 import；不得留下未使用的错误类型、缺失字段或路由引用错误。

### Chrome/CDP smoke

- 启动依赖：
  - 后端：`cd backend; uvicorn app.main:app --host 127.0.0.1 --port 8000`
  - 前端：`cd frontend; pnpm dev --host 127.0.0.1 --port 5173`
- 使用 Chrome/CDP 或项目已有 smoke runner，浏览器类型为 Chrome，至少覆盖桌面视口 `1366x900`；如入口在移动布局变化明显，补 `390x844`。
- 稳定选择器策略：优先 `data-testid`，其次 role/name/label；不要依赖易变中文长文案或 nth-child。
- smoke 必须自动采集：
  - `browser-console.ndjson`：console error、pageerror、unhandled rejection、关键业务日志
  - `network-summary.json`：争议和运营 API 的 method、url、status、duration、request_id；脱敏 headers/body
  - `screenshots/`：争议提交成功、重复拒绝、运营详情、处理完成、无权限拒绝
  - `backend.log`：按 RUN_ID/request_id 过滤出的后端日志
  - `audit.log`：case id、角色、时间戳、exit code、失败堆栈

## 测试数据

| 数据编号 | 角色/对象 | 要求 | 用途 |
|---------|-----------|------|------|
| TD-001 | student_A | 已登录学员；钱包余额足够；与 teacher_A 有已付款课程 | 发起争议、退款断言 |
| TD-002 | teacher_A | 已入驻教师；拥有 TD-001 课程 | 教师创建争议 403、运营释放断言 |
| TD-003 | unrelated_user_B | 普通学员或教师；不参与 TD-001 课程 | 非参与者 403 |
| TD-004 | operator_A | 运营/客服角色，具备争议查询和处理权限 | 运营 list/detail/action |
| TD-005 | non_operator_admin_or_user | 登录但无运营权限 | 运营 API 403 |
| TD-006 | held_order_1 | `PaymentOrder.status=held`，`held_until > now()` 或正常争议期内 | 创建 open 争议 |
| TD-007 | expired_held_order_with_open_dispute | `PaymentOrder.status=held`，`held_until < now()`，存在 open dispute | watcher skip |
| TD-008 | expired_held_order_without_dispute | `PaymentOrder.status=held`，`held_until < now()`，无 open dispute | watcher 正常 release 对照组 |
| TD-009 | released_order | 已 release，已有 SettlementSnapshot/PayoutOrder | 不可发起争议/不可退款回退 |
| TD-010 | refunded_order | 已 refund，学生钱包已回款 | 不可 release |

测试数据必须在测试运行中创建或由可重复 seed 脚本生成。不得使用真实用户、真实手机号、真实支付凭据或生产数据。所有 reason 可包含 RUN_ID，但不得包含 token、密码或隐私。

## 日志与审计要求

### 关键路径可观测性

- 必须验证以下关键路径留下可追溯证据：
  - 用户创建争议：请求身份、参与关系校验、订单状态校验、open 唯一性、DisputeCase/Event 写入。
  - 权限拒绝：非参与者、非运营、未登录访问的拒绝日志或审计事件。
  - 运营处理：operator、action、reason、before_status、after_status、request_id/RUN_ID。
  - 资金动作：人工 refund/release 进入 `payment_service`，并记录关联 payment_order_id、ledger/transaction/payout/snapshot id。
  - watcher skip：open dispute 导致 held 过期订单跳过 release 的日志或可观测计数。
  - 幂等/并发：重复请求返回稳定结果，数据库无重复副作用。
- 每个关键路径至少保留一种证据：pytest 断言、后端日志片段、trace/request id、数据库审计字段、任务执行记录或自动化截图。
- 日志断言覆盖成功、失败、拒绝和无副作用路径；任何非预期 5xx 直接判失败。

### 端侧审计日志

- 审计日志目录：`spec/03-能力交付/20260501-1125-运营客服与争议处理闭环/tester/artifacts/test-logs/YYYYMMDD-HHMM-run-XXX/`
- 建议结构：

```text
tester/artifacts/test-logs/<RUN_ID>/
├── audit.log
├── backend.log
├── browser-console.ndjson
├── network-summary.json
├── pytest.log
├── frontend-build.log
├── smoke-exitcode.txt
├── screenshots/
├── traces/
└── recordings/
```

- 证据必须由测试命令、测试脚本、浏览器自动化或服务日志采集自动生成；Agent 不得在测试结束后手写、补写或伪造日志、JSON、trace、录屏和截图。
- `network-summary.json` 只保存 method、url path、status、duration、request_id、case_id、错误摘要；不得保存 Authorization、Cookie、token、password、secret 或完整请求/响应 body。
- `backend.log` 通过 RUN_ID/request_id 过滤或由测试启动服务时自动重定向生成；不能把无关整份日志直接塞入证据目录。
- `audit.log` 必须包含 run id、case id、测试角色（脱敏）、开始/结束时间、命令、exit code 和失败堆栈摘要。

## Exit Code 与证据门禁

| 命令 | 通过标准 | 必留证据 |
|------|----------|----------|
| `cd backend; pytest tests/api/v1/test_disputes.py tests/api/v1/test_payment_settlement.py -q` | exit code = 0；P0 争议/资金/watcher 用例全通过 | `pytest.log`、必要 DB 断言摘要、backend.log |
| `cd backend; pytest -q` | exit code = 0；无支付/课程/认证回归失败 | `pytest-full.log` 或 CI 日志链接 |
| `cd frontend; pnpm build` | exit code = 0 | `frontend-build.log` |
| Chrome/CDP smoke | exit code = 0；无非预期 console error、pageerror、unhandled rejection；关键 network 无 5xx | `audit.log`、`browser-console.ndjson`、`network-summary.json`、`screenshots/`、`backend.log`、`smoke-exitcode.txt` |

若任何命令 exit code 非 0，`tester/test-report.md` 必须记录失败命令、exit code、失败用例、证据路径、预期与实际，并向 TeamLead 提交 bug handoff；不得把手工复述当作通过证据。
