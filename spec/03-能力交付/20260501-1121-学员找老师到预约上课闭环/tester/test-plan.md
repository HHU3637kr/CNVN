---
title: 测试计划
type: test-plan
status: 未确认
created: 2026-05-01
git_branch: feat/spec-20260501-1153-student-booking-flow
plan: "[[../writer/plan|plan]]"
exploration: "[[../explorer/exploration-report|exploration-report]]"
tags:
  - spec
  - test-plan
  - student-booking-flow
---

# 测试计划

## 验收标准

- 后端预约主链路可由 pytest 自动验证：有余额且时段可用时创建 `pending_confirmation` 课程、生成托管付款、扣减学员钱包，并可进入确认、取消、开始、结束状态流转。
- 余额不足路径返回稳定业务错误，不创建 `Lesson`，不生成有效 `PaymentOrder`，不扣减钱包余额；前端可据此展示充值恢复动作。
- 同一教师、同一学员在非终态课程上的重叠时间窗必须被拒绝；若实现了 DB 排他约束或 advisory lock，并发创建同一时间窗时只能成功一个请求。
- 课程状态列表必须能支撑学员中心分组：`pending_confirmation`、`confirmed`、`in_progress`、`completed`、`reviewed`、`cancelled`、`expired` 不被错误归类；历史记录覆盖 `completed/reviewed`。
- 课堂入口状态相关接口风险必须被覆盖：pending/cancelled/expired/completed/reviewed 不应允许进入可互动课堂；confirmed 仅在约定可进入窗口内允许，in_progress 允许。
- 前端最低静态验证必须通过当前项目已有能力 `pnpm run build`，不得出现 TypeScript/Vite 构建错误。
- 测试执行阶段的 pytest、构建输出和端侧证据必须自动生成并保存到 `tester/artifacts/test-logs/<run-id>/`；不得手写或补造日志证据。

## 测试数据前置

| 数据项 | 准备方式 | 用途 | 注意事项 |
|---|---|---|---|
| PostgreSQL 测试库 | 使用 `backend/tests/conftest.py` 的 `postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/cnvn_test` | 后端 pytest | 测试库会被 `Base.metadata.create_all/drop_all` 管理，不得指向真实数据 |
| Ledger accounts | 复用/抽取现有 `ensure_ledger_accounts(db_session)`，为 `SYSTEM_ACCOUNT_CODES` 创建 `escrow`、`platform_revenue`、`tax_payable`、`teacher_payable` | 预约付款托管、退款、结算断言 | 预约成功用例必须在创建课程前准备，否则支付托管链路可能因系统账户缺失失败 |
| 学员账号 | `POST /api/v1/auth/register` 后登录，保留 student token | 预约、余额、学员课程列表、课堂入口 | 使用测试邮箱和脱敏角色标识 |
| 教师账号 | 注册登录后 `POST /api/v1/auth/become-teacher`，查询 `TeacherProfile.id` | 教师详情、availability、确认课程、教师冲突 | `Lesson.teacher_id` 使用 `TeacherProfile.id`，不是教师用户 `User.id` |
| Availability | 教师 token 调 `POST /api/v1/availability`，创建未来 7-10 天 `09:00:00-21:00:00` 的一次性可用时段 | 允许创建合法课程 | 课程 `scheduled_at` 用 `Asia/Ho_Chi_Minh` 本地时间构造后转 UTC |
| Wallet topup | 学员 token 调 `POST /api/v1/wallet/topup`，成功路径充值 `500_000` VND | 有余额预约和扣款断言 | 余额不足路径不充值或充值低于课程价格 |
| 重叠课程基线 | 先创建一节非终态课程，例如 15:00-16:00 | 教师/学员重叠冲突 | 覆盖完全重叠、部分重叠、边界相邻 `[)` 不重叠 |
| 课程状态矩阵 | 通过 API 状态流转或 DB fixture 构造不同 `Lesson.status` | 学员中心状态列表与课堂入口规则 | 若直接写 DB，仍要保证 student/teacher 外键和时间字段完整 |

## 测试用例

| 用例编号 | 描述 | 输入 | 预期输出 | 边界条件 |
|---|---|---|---|---|
| TC-BE-001 | 预约成功主路径 | 已创建 ledger accounts、学员、教师、availability；学员充值 `500_000`；`POST /api/v1/lessons` 提交未来 60 分钟课程 | HTTP 201；`status=pending_confirmation`；`price=hourly_rate`；学生钱包减少课程金额；存在 held 支付托管记录 | `scheduled_at` 必须落在 availability 内；课程价格按分钟向上取整 |
| TC-BE-002 | 余额不足拒绝预约 | 同 TC-BE-001，但学员不充值或余额小于课程价格 | HTTP 400，错误包含余额不足；数据库无新 lesson 或新 lesson 已回滚；钱包余额不变；无有效托管订单 | 失败后再次充值并提交应可成功 |
| TC-BE-003 | 同一教师重叠冲突 | 学生 A 已预约教师 T 的 15:00-16:00；学生 B 再预约 T 的 15:30-16:30 | 第二次请求 HTTP 400，错误包含课程冲突/时段冲突；只存在第一节有效课程；第二个学生不扣款 | exact overlap、partial overlap 都应拒绝；cancelled/expired 旧课不应阻断 |
| TC-BE-004 | 同一学员重叠冲突 | 学生 A 已预约教师 T1 的 15:00-16:00；学生 A 再预约教师 T2 的 15:30-16:30 | 第二次请求 HTTP 400；只保留第一节有效课程；钱包只扣一次 | 不同教师也必须按学生维度拒绝重叠 |
| TC-BE-005 | 并发预约同一教师同一时段 | 两个学生对同一教师同一时段并发 `POST /api/v1/lessons` | 只有一个请求成功；另一个返回稳定业务错误；成功方扣款一次；失败方不扣款；无双订 | 若使用 PostgreSQL exclusion constraint，需断言约束冲突被映射为业务错误 |
| TC-BE-006 | 课程列表按状态过滤 | 构造同一学生的 pending/confirmed/in_progress/completed/reviewed/cancelled/expired 课程，调用 `GET /api/v1/lessons?role=student` 与 `status=` 查询 | 全量列表只返回该学生课程；`status=` 精确过滤；历史列表或实现后的派生字段包含 completed/reviewed | `upcoming=true` 不应误把已取消/已过期课程作为可上课入口 |
| TC-BE-007 | 教师课程列表隔离 | 教师 token 调 `GET /api/v1/lessons?role=teacher` | 只返回该教师 profile 的课程，含学生名字段；非教师调用 teacher role 返回 400 | 确认 `teacher_id` 使用 profile id |
| TC-BE-008 | 课堂入口状态接口风险 | 对 pending/cancelled/expired/completed/reviewed 课程调用课堂详情、消息历史或 WebSocket 入口相关接口 | 不允许进入可互动课堂，返回 400/403 或明确不可进入原因；confirmed/in_progress 按规则允许 | 当前 `require_lesson_participant` 只校验参与者，执行阶段若未改造需标记为高风险缺口 |
| TC-BE-009 | 上课状态流转回归 | 已确认课程依次 `PATCH /start`、`PATCH /end` | confirmed -> in_progress -> completed；写入 `actual_start_at` / `actual_end_at`；支付 held_until 逻辑不回归 | 非 confirmed 不能 start；非 in_progress 不能 end |
| TC-FE-001 | 前端构建验证 | `cd frontend; pnpm run build` | Vite build 成功，无 TypeScript/模块解析错误 | 当前项目无 Vitest/Playwright 脚本，build 是最低静态门禁 |
| TC-FE-002 | 教师详情预约提交静态路径 | 构建覆盖 `TeacherProfile.tsx` 的表单、API 类型和错误处理 | 无缺失导入、无类型不匹配；余额不足提示/跳钱包代码可编译 | 不要求本阶段新增前端自动化框架 |
| TC-FE-003 | 学员中心状态分组静态路径 | 构建覆盖 `StudentDashboard.tsx` 状态分组、课堂入口按钮显示规则 | 不同状态的派生类型和 JSX 可编译；无未处理空值 | `reviewed` 必须进入历史记录逻辑 |
| TC-FE-004 | 钱包 return path 静态路径 | 构建覆盖 `Wallet.tsx` 充值后返回教师详情或恢复预约上下文 | return path/session state 代码可编译；不保存敏感 token 到证据 | 若未实现 return path，执行阶段列为未完成 |

## 用户使用场景（端侧/E2E 适用）

| 场景编号 | 用户角色 | 业务目标 | 前置数据 | 操作路径 | 关键断言 | 证据 |
|---|---|---|---|---|---|---|
| US-001 | 学员 | 从教师详情成功预约一节课 | 学员已登录且充值；教师有未来 availability | 首页/教师列表 -> 教师详情 -> 选择时段/时长/topic -> 提交预约 -> 学员中心 | 页面跳转到学员中心；课程显示待老师确认；后端 lesson 为 `pending_confirmation`；钱包余额减少 | console、network 摘要、关键截图、pytest/API 日志 |
| US-002 | 学员 | 余额不足后去充值并返回 | 学员已登录但余额不足；教师有 availability | 教师详情提交预约 -> 看到余额不足 -> 进入钱包充值 -> 返回教师详情/恢复预约 | 首次预约未创建课程且未扣款；充值后可继续预约成功 | console、network 摘要、钱包和预约截图 |
| US-003 | 学员 | 查看课程状态和课堂入口 | 构造 pending/confirmed/in_progress/completed/reviewed/cancelled/expired 课程 | 打开学员中心 | 状态分组正确；仅 confirmed 可进入窗口或 in_progress 显示课堂入口；终态不显示入口 | 页面截图、network 摘要、后端列表响应摘要 |
| US-004 | 学员 | 阻断不可进入课堂的课程 | pending/cancelled/expired/completed/reviewed 课程存在 | 直接访问 `/classroom/:id` 或点击入口相关路径 | 不进入可互动课堂；展示明确不可进入原因或返回学员中心 | console、network 摘要、截图、后端日志 |

> 当前仓库没有 Playwright/Cypress/Vitest browser 脚本。执行阶段如未新增自动化端侧能力，US 场景至少作为手工浏览器回归清单，并保留浏览器控制台、网络摘要和截图；若新增自动化能力，证据必须由自动化脚本生成。

## 覆盖率要求

- 后端功能覆盖率：P0 主路径、余额不足、教师/学员重叠冲突、课程列表状态、课堂入口状态风险全部覆盖。
- 后端回归覆盖：教师公开接口、课程预约/取消/上下课、课堂消息鉴权、支付托管退款结算组合回归。
- 前端静态覆盖：教师详情预约、钱包充值恢复、学员中心状态分组、课堂页入口阻断相关文件必须被 Vite build 覆盖。
- 代码覆盖率：当前项目未配置覆盖率门禁；本 Spec 不强制新增覆盖率工具，但新增 pytest 用例必须覆盖全部 P0 验收点。

## 日志与审计要求

### 关键路径可观测性

- 预约成功：保存 pytest 输出，断言 lesson、wallet、PaymentOrder/ledger 相关状态，证明扣款和托管一致。
- 余额不足：保存 pytest 输出，断言 rollback 后无 lesson、无有效支付订单、钱包余额不变。
- 重叠冲突：保存 pytest 输出，断言冲突错误、有效课程数量、失败方钱包余额；并发用例需保存两个请求结果摘要。
- 课程状态列表：保存 pytest 输出或 API 响应摘要，证明状态过滤、角色隔离和 completed/reviewed 历史口径。
- 课堂入口：保存接口返回、WebSocket 拒绝结果或页面阻断截图；若后端仍只校验参与者，测试报告必须记录风险和建议交给 spec-debugger。
- 前端构建：保存 `pnpm run build` 原始输出。

### 端侧审计日志

执行阶段每次测试运行创建独立目录：

```text
spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/tester/artifacts/test-logs/YYYYMMDD-HHMM-run-XXX/
├── environment.txt
├── pytest-booking-flow.log
├── pytest-regression.log
├── frontend-build.log
├── browser-console.ndjson
├── network-summary.json
├── backend.log
├── screenshots/
├── traces/
└── failure-trace.txt
```

- `environment.txt`：由命令自动采集 Python、pytest、Node/pnpm、数据库连接可达性、当前分支和提交信息；不得包含密码、token 或真实用户隐私。
- `pytest-booking-flow.log`：保存本 Spec 后端专项 pytest 输出。
- `pytest-regression.log`：保存后端组合回归输出。
- `frontend-build.log`：保存前端 build 输出。
- `browser-console.ndjson`、`network-summary.json`、`backend.log`、截图和 trace 只在执行端侧/浏览器场景时生成。
- 所有证据必须由测试命令、浏览器自动化、服务日志过滤或命令重定向生成；不得在测试结束后手写或补造。

## 测试环境要求

- Python 3.11 依赖已安装，后端可运行 `python -m pytest`。
- PostgreSQL 16 本机服务可连接，且存在 `cnvn_test` 测试库、`cnvn` 用户和 `cnvn_secret` 密码。
- 后端 pytest 使用 `backend/tests/conftest.py` 注入的 AsyncClient/TestClient，不依赖真实支付渠道。
- 前端依赖已安装；如缺少依赖，先在 `frontend` 执行 `pnpm install`，再运行 build。
- 测试账号、邮箱、手机号均使用随机后缀测试数据；证据中只保留角色和脱敏标识。

## 建议新增或调整的测试文件

| 文件 | 建议用例 | 说明 |
|---|---|---|
| `backend/tests/api/v1/test_lessons.py` | 新增教师重叠、学员重叠、并发只成功一个、余额不足 rollback 细化断言 | 复用现有注册、availability、wallet topup、ledger helper |
| `backend/tests/api/v1/test_lesson_messages.py` | 新增 pending/cancelled/expired/completed/reviewed 课堂入口拒绝用例 | 如果入口规则被下沉到 `require_lesson_participant` 或新服务，在此回归 REST + WebSocket |
| `backend/tests/api/v1/test_teachers.py` | 回归教师详情与公开 availability | 确认前端预约页依赖的教师公开数据不回归 |
| `backend/tests/api/v1/test_payment_settlement.py` | 组合回归 | 确认本 Spec 没破坏托管退款和佣金口径 |
| 前端现有构建配置 | `pnpm run build` | 当前无前端测试 runner，不新增框架时以 build 作为静态门禁 |

## 最终回归命令建议

后端专项预约闭环：

```powershell
cd backend
python -m pytest tests/api/v1/test_lessons.py -q
```

后端课堂入口与消息鉴权：

```powershell
cd backend
python -m pytest tests/api/v1/test_lesson_messages.py -q
```

后端教师公开数据、预约、课堂、支付组合回归：

```powershell
cd backend
python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q
```

前端静态/构建验证：

```powershell
cd frontend
pnpm run build
```

最终门禁建议按顺序执行：

```powershell
cd backend
python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q

cd ..\frontend
pnpm run build
```

## 本阶段边界

- 本阶段只创建测试计划，不运行测试。
- 不实现业务代码，不修改后端/前端测试代码。
- 不修改 `lead/team-context.md`、`writer/plan.md` 或 `explorer/exploration-report.md`；如需更新 TeamLead 账本，由 TeamLead 按写入权限处理。
