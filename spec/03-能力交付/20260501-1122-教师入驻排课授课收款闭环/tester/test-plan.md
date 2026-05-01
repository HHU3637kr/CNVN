---
title: 测试计划
type: test-plan
status: 未确认
created: 2026-05-01
git_branch: feat/spec-20260501-1248-teacher-supply-flow
plan: "[[../writer/plan|plan]]"
exploration: "[[../explorer/exploration-report|exploration-report]]"
tags:
  - spec
  - test-plan
  - teacher-supply-flow
---

# 测试计划：教师入驻排课授课收款闭环

## 验收标准

- 后端 pytest 必须覆盖教师供给侧 P0 主路径：入驻/档案更新、排课更新校验、教师课程列表、确认、开始、结束、争议期释放后出款可见。
- `AvailabilityUpdate` 必须按“更新后的最终态”校验互斥：`day_of_week` 与 `specific_date` 不能同时存在，且至少保留一种排课模式；从周期切到指定日期或反向切换时，必须通过显式清空旧字段完成。
- 教师档案更新必须只允许教师本人操作，更新后自有档案读取、公开教师详情或教师中心依赖字段保持一致。
- 教师课程列表必须只返回当前教师 `TeacherProfile.id` 下的课程，并能支撑待确认、待上课、进行中、已完成分组；确认/开始/结束状态流转必须写入对应时间字段和结算触发字段。
- 出款查询必须只允许教师本人查看自己的出款记录；课程完成并释放结算后，教师可在 `/payouts/me` 看到包含 gross、平台费、税费、net、来源课程和状态的可解释记录。
- 前端最低门禁为 `pnpm run build` 成功；端侧 smoke 必须覆盖教师注册/入驻、排课、查看待确认课程、确认/开始/结束、出款解释页。
- 测试执行证据必须由 pytest、构建命令、浏览器自动化、服务日志过滤或命令重定向自动生成到 `tester/artifacts/test-logs/<run-id>/`；不得手写补造日志、JSON、trace 或截图。

## 测试数据前置

| 数据项 | 准备方式 | 用途 | 关键约束 |
|---|---|---|---|
| PostgreSQL 测试库 | 使用 `backend/tests/conftest.py` 的 `postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/cnvn_test` | 后端 pytest | 只允许测试库；执行前确认不承载真实数据 |
| Ledger accounts | 复用或抽取 `ensure_ledger_accounts(db_session)`，为 `SYSTEM_ACCOUNT_CODES` 创建 `escrow`、`platform_revenue`、`tax_payable`、`teacher_payable` | 预约扣款、托管、释放、出款断言 | 创建课程前准备，避免支付链路因系统账户缺失失败 |
| 学生账号 | `POST /api/v1/auth/register` + `POST /api/v1/auth/login` | 预约课程、钱包充值、学生维度隔离断言 | 邮箱/手机号使用随机后缀，证据只保留脱敏角色 |
| 教师账号 A/B | 注册登录后 `POST /api/v1/auth/become-teacher`，查询 `TeacherProfile.id` | 教师本人权限、非本人权限、课程动作、出款隔离 | `Lesson.teacher_id` 使用 `TeacherProfile.id`，不是 `User.id` |
| 教师档案 | 使用完整 `TeacherProfileCreate`，再用 `PUT /api/v1/teachers/profile` 更新 title/about/hourly_rate/specialties | 档案更新和前端入驻状态 | 更新后需验证自有读取和公开详情一致 |
| Availability | 教师 token 创建未来 7-10 天的一次性时段，以及一个周期时段 | 预约覆盖、排课管理、update 互斥 | 课程时间用 `Asia/Ho_Chi_Minh` 本地时间构造后转 UTC |
| Wallet topup | 学生 token 调 `POST /api/v1/wallet/topup`，例如 `500_000` VND | 预约扣款和支付托管 | 余额不足路径不充值或低于课程价格 |
| Lesson/payment release | 创建课程 -> 教师确认 -> 教师开始 -> 教师结束；手动将 `PaymentOrder.held_until` 调整为过去或直接调用 `payment_service.release_payment_order` | 出款释放后可见、settlement snapshot 断言 | release 前后分别断言 `/payouts/me` 不可见/可见 |
| 端侧用户 | 一组教师、一组学生，使用测试环境账号 | Web smoke | 不保存 token、Cookie、密码、完整手机号或真实用户隐私 |

## 后端 Pytest 用例

| 用例编号 | 优先级 | 描述 | 输入/准备 | 关键断言 | 建议文件 |
|---|---|---|---|---|---|
| TC-BE-001 | P0 | Availability update 最终态互斥：周期时段被错误补入 `specific_date` | 教师创建 `day_of_week=1` 周期时段；`PUT /availability/{id}` 只传 `specific_date` | 返回 400；错误指向 `day_of_week` 与 `specific_date` 互斥；DB 中旧时段未变成混合态 | 新增 `backend/tests/api/v1/test_availability.py` |
| TC-BE-002 | P0 | Availability update 最终态互斥：指定日期时段被错误补入 `day_of_week` | 教师创建 `specific_date` 一次性时段；更新只传 `day_of_week` | 返回 400；DB 不存在同时有 `day_of_week` 和 `specific_date` 的记录 | `test_availability.py` |
| TC-BE-003 | P0 | Availability 模式切换必须显式清空旧字段 | 周期时段更新为 `{day_of_week: null, specific_date: "YYYY-MM-DD", is_recurring: false}`；再反向切换 | 两次切换均成功；最终态只有一种模式；`is_recurring` 与 day/date 语义一致 | `test_availability.py` |
| TC-BE-004 | P0 | Availability update 边界校验和本人权限 | 非本人教师更新他人时段；本人提交 `start_time >= end_time` 或清空 day/date | 非本人返回 404/403；非法时间返回 400；至少一种排课模式被保留 | `test_availability.py` |
| TC-BE-005 | P0 | 教师档案更新成功 | 教师入驻后 `PUT /teachers/profile` 更新 title/about/hourly_rate/specialties | HTTP 200；返回字段为新值；`GET /teachers/me/profile` 或等价自有档案读取返回新值；公开详情无旧值 | 调整 `backend/tests/api/v1/test_teachers.py` |
| TC-BE-006 | P0 | 教师档案更新权限 | 学生或未入驻用户调用 `PUT /teachers/profile`；教师 B 尝试影响教师 A | 非教师返回 403；只能更新当前登录教师自己的 profile | `test_teachers.py` |
| TC-BE-007 | P0 | 教师课程列表按本人隔离和状态分组 | 为教师 A/B 构造 pending/confirmed/in_progress/completed/reviewed/cancelled 课程；教师 A 调 `GET /lessons?role=teacher&page_size=100` 和 `status=` | 只返回教师 A 课程；待确认、待上课、进行中、已完成可由状态字段稳定分组；不混入教师 B | 调整 `backend/tests/api/v1/test_lessons.py` |
| TC-BE-008 | P0 | 教师确认课程 | 学生预约教师 A 课程，状态 `pending_confirmation`；教师 A 调 `PATCH /lessons/{id}/confirm` | 返回 200；状态变 `confirmed`；非本人教师、学生、重复确认或非 pending 状态返回 403/400 | `test_lessons.py` |
| TC-BE-009 | P0 | 教师开始课程 | 已确认课程；教师 A 调 `PATCH /lessons/{id}/start` | 状态变 `in_progress`；写 `actual_start_at`；非本人教师/非教师不得开始；非 confirmed 状态返回 400 | `test_lessons.py` |
| TC-BE-010 | P0 | 教师结束课程并触发争议期 | `in_progress` 课程；教师 A 调 `PATCH /lessons/{id}/end` | 状态变 `completed`；写 `actual_end_at`；对应 `PaymentOrder.status=held` 且 `held_until` 非空；教师 `total_lessons` 按计划同步 | `test_lessons.py` |
| TC-BE-011 | P0 | 出款本人权限 | 教师 A/B 各自有或无 payout；学生、未登录、教师 B 调 `/payouts/me` | 未登录 401；非教师 403；教师 B 不可看到教师 A 的 `PayoutOrder`；分页 total/items 只属于本人 | 调整 `backend/tests/api/v1/test_payment_settlement.py` 或新增 `test_payouts.py` |
| TC-BE-012 | P0 | 结算释放后教师可见出款明细 | 完成课程并让 `held_until` 到期；调用 `dispute_watcher.run_once` 或 `payment_service.release_payment_order`；教师 A 调 `/payouts/me` | release 前列表为空或无该笔；release 后出现该课程 payout；返回 gross、commission/platform fee、VAT/PIT 或 tax、net、lesson_id、payment_order_id、status、paid_at/预计到账字段；教师钱包增加 net | `test_payment_settlement.py` |
| TC-BE-013 | P1 | 教师响应率/完课数同步回归 | 教师确认多节课、完成课程 | `response_rate` 按 writer 明确口径变化；`total_lessons` 与有效完课数一致；公开教师排序字段不回归 | `test_lessons.py` 或新增 `test_teacher_stats.py` |

## 用户使用场景（端侧/E2E 适用）

| 场景编号 | 用户角色 | 业务目标 | 前置数据 | 操作路径 | 关键断言 | 证据 |
|---|---|---|---|---|---|---|
| US-001 | 教师 | 注册并完成入驻 | 无账号或已注册学生账号 | `/register` 选择教师身份 -> 填写账号和教师资料 -> 提交 -> 进入 `/dashboard/teacher` | 用户拥有 teacher role；教师中心显示入驻/档案状态；无未处理 console error | `browser-console.ndjson`、`network-summary.json`、入驻成功截图 |
| US-002 | 教师 | 更新教师档案 | 已入驻教师 | 打开教师中心档案区域 -> 修改 title/about/hourly_rate/specialties -> 保存 | 页面展示新档案；关键请求 200；刷新后仍为新值 | 控制台日志、网络摘要、保存前后截图 |
| US-003 | 教师 | 设置和切换可授课时段 | 已入驻教师 | 教师中心排课区域 -> 创建指定日期时段 -> 编辑为周期时段或反向切换 -> 保存 | UI 明确周期/指定日期两种模式；保存后列表只显示一种模式；互斥错误可见且不会写入混合态 | 网络摘要、排课列表截图、错误态截图 |
| US-004 | 教师 | 查看待确认课程并确认 | 学生已预约一节 `pending_confirmation` 课程 | 打开 `/dashboard/teacher` -> 查看待确认列表 -> 点击确认 | 课程从待确认移动到待上课；按钮状态更新；后端状态为 `confirmed` | 页面截图、`PATCH /lessons/{id}/confirm` 摘要、后端日志 |
| US-005 | 教师 | 开始并结束课程 | 已确认课程处于可进入窗口，教师已登录 | 教师中心点击进入课堂或开始 -> `/classroom/:id` -> 开始/结束课程 -> 返回教师中心 | confirmed -> in_progress -> completed；课堂结束后返回教师中心；不会跳到学生中心；后端写入 actual_start/end | 截图、网络摘要、console、backend log |
| US-006 | 教师 | 查看出款解释页面 | 已完成并释放结算的一节课 | 打开 `/payouts` | 页面解释 gross、平台费、税费、net、争议期/到账状态、来源课程；不显示面向用户的 API 技术文案 | 出款页截图、`GET /payouts/me` 网络摘要 |
| US-007 | 教师/学生 | 出款权限拒绝路径 | 学生账号或无教师 profile 账号 | 直接访问 `/payouts` 或触发 `/payouts/me` | 页面展示需要教师身份或跳转登录；无敏感出款数据泄露 | 错误态截图、网络摘要 |

> 当前仓库没有 Playwright/Cypress 脚本。执行阶段若仍未新增自动化框架，端侧 smoke 可使用浏览器自动化脚本或手工浏览器验证，但 console、network、截图、服务日志仍必须由工具自动采集到 run 目录。

## 覆盖率要求

- 后端功能覆盖率：P0 验收点 100% 覆盖，包含成功、失败、权限拒绝和状态非法路径。
- 后端回归覆盖：教师、availability、lesson、payment settlement、payout 相关测试必须组合执行。
- 前端静态覆盖：`TeacherDashboard.tsx`、`Register.tsx`、`Classroom.tsx`、`Payouts.tsx`、API 类型和格式化工具必须被 Vite build 覆盖。
- 代码覆盖率：当前项目未配置 coverage 门禁；本 Spec 不强制新增覆盖率工具，但新增 pytest 必须覆盖全部 P0 行为。

## 日志与审计要求

### 关键路径可观测性

- Availability 更新：保存 pytest 输出和失败路径断言，证明最终态不会写入混合 day/date。
- 教师档案：保存 pytest 输出，断言自有读取、公开读取或教师中心依赖字段同步。
- 教师课程动作：保存 pytest 输出，断言 list/confirm/start/end 的状态、时间字段和本人权限。
- 结算释放：保存 pytest 输出或后端日志，断言 `PaymentOrder`、`SettlementSnapshot`、`PayoutOrder`、教师钱包和 ledger 关键状态。
- 端侧 smoke：每条用户场景至少关联 console、network、截图；复杂失败保留 trace 或录屏。

### 端侧审计日志目录规范

执行阶段每次测试运行创建独立目录：

```text
spec/03-能力交付/20260501-1122-教师入驻排课授课收款闭环/tester/artifacts/test-logs/YYYYMMDD-HHMM-run-XXX/
├── environment.txt
├── pytest-teacher-supply.log
├── pytest-regression.log
├── frontend-build.log
├── browser-console.ndjson
├── network-summary.json
├── backend.log
├── user-flow.md
├── screenshots/
├── traces/
├── recordings/
└── failure-trace.txt
```

- `environment.txt`：由命令自动采集 Python、pytest、Node/pnpm、数据库可达性、当前分支和提交；不得包含密码、token、Cookie 或真实隐私。
- `pytest-teacher-supply.log`：保存本 Spec 后端专项 pytest 原始输出。
- `pytest-regression.log`：保存后端组合回归原始输出。
- `frontend-build.log`：保存 `pnpm run build` 原始输出。
- `browser-console.ndjson`：由浏览器监听 console/pageerror/unhandled rejection 自动生成。
- `network-summary.json`：只保存 method、url、status、耗时、request id、错误摘要；禁止保存 Authorization、Cookie、token、密码、完整请求/响应 body。
- `backend.log`：由服务启动重定向或按 run id/request id 过滤生成。
- `screenshots/`、`traces/`、`recordings/`：由浏览器工具自动生成，覆盖成功、失败和权限拒绝关键状态。

## 测试环境要求

- Python 3.11 依赖已安装，后端可运行 `python -m pytest`。
- PostgreSQL 16 本机服务可连接，且存在 `cnvn_test` 测试库、`cnvn` 用户和 `cnvn_secret` 密码。
- 后端 pytest 使用 `backend/tests/conftest.py` 注入的 AsyncClient/TestClient，不依赖真实支付渠道。
- 前端依赖已安装；如缺少依赖，先在 `frontend` 执行 `pnpm install`，再运行 build。
- 端侧 smoke 需要可运行后端服务、前端 dev server、测试数据库和测试账号；所有证据必须脱敏。

## 建议新增或调整的测试文件

| 文件 | 建议覆盖 | 说明 |
|---|---|---|
| `backend/tests/api/v1/test_availability.py` | update 最终态互斥、显式清空切换模式、非法时间、本人权限 | 当前仓库没有独立 availability 测试文件，建议新增 |
| `backend/tests/api/v1/test_teachers.py` | 教师档案更新、自有档案读取、非教师拒绝 | 复用现有教师注册和 profile helper |
| `backend/tests/api/v1/test_lessons.py` | 教师课程列表、确认、开始、结束、权限拒绝、完课统计同步 | 复用现有预约、ledger、wallet helper |
| `backend/tests/api/v1/test_payment_settlement.py` | 课程完成后 held_until、release 后 payout 可见、settlement snapshot 字段、教师钱包 net 入账 | 复用支付结算现有 helper |
| `backend/tests/api/v1/test_payouts.py`（可选） | `/payouts/me` 本人权限和分页过滤 | 若出款权限用例增长，建议从 payment settlement 拆出 |
| 端侧脚本或测试运行目录脚本 | 教师注册/入驻、排课、确认/开始/结束、出款解释 smoke | 当前不要求本阶段实现脚本，只规定执行阶段证据形态 |

## 最终回归命令建议

后端专项教师供给闭环：

```powershell
cd backend
python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q
```

若拆出出款专项：

```powershell
cd backend
python -m pytest tests/api/v1/test_payouts.py tests/api/v1/test_payment_settlement.py -q
```

后端组合回归：

```powershell
cd backend
python -m pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q
```

前端构建门禁：

```powershell
cd frontend
pnpm run build
```

最终门禁建议按顺序执行并重定向到 run 目录：

```powershell
$RUN_ID = Get-Date -Format "yyyyMMdd-HHmm"
$LOG_DIR = "spec/03-能力交付/20260501-1122-教师入驻排课授课收款闭环/tester/artifacts/test-logs/$RUN_ID-run-001"
New-Item -ItemType Directory -Force -Path "$LOG_DIR/screenshots", "$LOG_DIR/traces", "$LOG_DIR/recordings" | Out-Null

cd backend
python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q *> "../$LOG_DIR/pytest-teacher-supply.log"
python -m pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q *> "../$LOG_DIR/pytest-regression.log"

cd ..\frontend
pnpm run build *> "../$LOG_DIR/frontend-build.log"
```

端侧 smoke 执行阶段补充：

```powershell
# 由浏览器自动化或 smoke 脚本写入同一个 $LOG_DIR：
# browser-console.ndjson, network-summary.json, backend.log, user-flow.md, screenshots/, traces/
```

## 本阶段边界

- 本阶段只创建测试计划，不运行测试。
- 不实现业务代码，不修改后端/前端测试代码。
- 不修改 `lead/team-context.md`、`writer/plan.md` 或 `explorer/exploration-report.md`；TeamLead 账本如需更新，由 TeamLead 按写入权限处理。
