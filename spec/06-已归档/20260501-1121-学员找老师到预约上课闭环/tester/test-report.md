---
title: 测试报告
type: test-report
status: 未确认
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
test-plan: "[[test-plan|test-plan]]"
tags:
  - spec
  - test-report
  - student-booking-flow
---

# 测试报告

## 测试概况

- Run ID: `20260501-1217-run-001`
- 审计日志目录: `tester/artifacts/test-logs/20260501-1217-run-001/`
- 命令门禁总数：3
- 通过：3
- 失败：0
- 后端 pytest：25 passed, 0 failed, 4 warnings
- 前端 build：passed
- `git diff --check`：passed，存在 LF/CRLF 转换提示
- 代码覆盖率：当前项目未配置覆盖率门禁，本次未采集覆盖率

## 执行命令与结果

| 命令 | 日志 | 结果 |
|---|---|---|
| `cd backend; python -m pytest tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py -q` | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 通过，25 passed, 4 warnings |
| `cd frontend; pnpm run build` | `tester/artifacts/test-logs/20260501-1217-run-001/frontend-build.log` | 通过，Vite build succeeded |
| `git diff --check` | `tester/artifacts/test-logs/20260501-1217-run-001/git-diff-check.log` | 通过，退出码 0；仅 LF 将转换为 CRLF 的 Git 提示 |

退出码记录见 `tester/artifacts/test-logs/20260501-1217-run-001/command-results.txt`。

## 测试过程中的修改记录

| 修改类型 | 描述 | 关联文档 |
|---|---|---|
| 无 | 本阶段未修改业务代码或测试代码，只生成测试报告和本次运行日志 | — |

## 日志与审计证据

### 测试运行

- Run ID: `20260501-1217-run-001`
- 审计日志目录: `tester/artifacts/test-logs/20260501-1217-run-001/`
- 环境信息: `tester/artifacts/test-logs/20260501-1217-run-001/environment.txt`
- 测试账号/角色: pytest fixture 自动生成的测试用户；未保存真实用户隐私
- 设备/浏览器/App 版本: 未执行浏览器端侧测试；Node `v24.12.0`，pnpm `10.28.2`
- 脱敏检查: 未保存 token、密码、密钥或真实用户隐私；数据库密码未写入 environment

### 关键路径日志验证

| 关键路径 | 关联用例 | 证据类型 | 证据位置 | 结果 |
|---|---|---|---|---|
| 教师公开数据、详情和 availability | TC-BE-007 | pytest 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 通过 |
| 预约成功、余额不足、取消、上下课状态流转 | TC-BE-001, TC-BE-002, TC-BE-009 | pytest 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 通过 |
| 同一教师/同一学员重叠冲突、并发排他约束、不重复扣款 | TC-BE-003, TC-BE-004, TC-BE-005 | pytest 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 通过 |
| 课程列表和课堂入口派生字段 | TC-BE-006, TC-BE-008 | pytest 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 部分通过；后端列表/详情字段已验证，消息历史和 WebSocket 状态阻断仍是残留风险 |
| 课堂消息参与者鉴权和 WebSocket 基础回归 | TC-BE-008 | pytest 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 通过基础鉴权回归 |
| 支付托管退款结算组合回归 | TC-BE-001, TC-BE-002, 支付回归 | pytest 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/pytest-regression.log` | 通过 |
| 前端预约、钱包恢复、学员中心分组、课堂预检静态路径 | TC-FE-001 至 TC-FE-004 | build 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/frontend-build.log` | 通过静态构建 |
| whitespace / 冲突标记检查 | 门禁补充 | Git 输出 | `tester/artifacts/test-logs/20260501-1217-run-001/git-diff-check.log` | 通过 |

### 端侧审计留存

- 控制台日志: 未生成；本次未执行浏览器自动化或手工浏览器采集
- 网络摘要: 未生成；本次未执行浏览器自动化或手工浏览器采集
- 截图: `tester/artifacts/test-logs/20260501-1217-run-001/screenshots/`，目录已创建但未生成截图
- 录屏/trace: `tester/artifacts/test-logs/20260501-1217-run-001/recordings/` / `tester/artifacts/test-logs/20260501-1217-run-001/traces/`，目录已创建但未生成录屏或 trace

## 发现的 Bug

- 无命令级失败。
- 未创建 debug handoff。

## 残留风险

- 未执行 US-001 至 US-004 的浏览器端侧/E2E 流程，因此没有 console、network、截图或 trace 证据；本次只完成测试计划要求的后端组合回归和前端静态构建门禁。
- `executor/summary.md` 不存在；本次读取了 `executor/backend-summary.md` 和 `executor/frontend-summary.md` 作为实现总结输入。
- 环境 Python 为 `3.13.11`，与项目说明的 Python 3.11 不一致；本次 pytest 在当前环境通过。
- `pg_isready` 不可用，`environment.txt` 只记录 PostgreSQL 5432 TCP 可达；pytest 通过可证明测试库在实际测试中可用。
- 后端消息历史和 WebSocket 入口仍主要验证参与者鉴权，未下沉完整课程状态/进入窗口阻断；当前 Spec 依赖前端 `Classroom` 预检阻断直达课堂。
- `git diff --check` 通过，但日志中存在多处 LF 将被 Git 转换为 CRLF 的提示。

## 最终测试结果

结论：命令门禁通过。

后端组合回归、前端构建和 `git diff --check` 均通过，未发现需要 spec-debugger 接手的命令级失败。端侧浏览器主链路证据未执行，作为归档前残留验证风险保留。

## 补充端侧验证

> [!success]
> Reviewer 指出的 US-001 至 US-004 端侧证据不足已在 `20260501-1228-run-002` 补测通过。本节结论覆盖上方 run-001 中“未执行浏览器端侧/E2E”的残留风险。

### 测试运行

- Run ID: `20260501-1228-run-002`
- 审计日志目录: `tester/artifacts/test-logs/20260501-1228-run-002/`
- 专用测试库: `cnvn_e2e_20260501_1228_run_002`
- 本地服务: FastAPI `http://127.0.0.1:8002`，Vite `http://127.0.0.1:5174`
- 浏览器: Chrome Headless `147.0.7727.117`，通过 DevTools Protocol 自动化采集
- 服务清理: 已停止，见 `tester/artifacts/test-logs/20260501-1228-run-002/service-stop.log`
- 脱敏检查: `network-summary.json` 未保存 Authorization、Cookie、access token、密码或真实用户隐私；Chrome 临时 profile 已清理，仅保留必要证据文件

### 用户场景执行结果

| 场景编号 | 结果 | UI 证据 | Console | Network/API | 备注 |
|---|---|---|---|---|---|
| US-001 教师详情预约成功后学员中心显示待老师确认 | 通过 | `screenshots/us001-01-teacher-profile.png`, `screenshots/us001-02-dashboard-pending.png`, `dom-summary.json` | `browser-console.ndjson` | `network-summary.json`, `api-summary.json` | 页面完成 `POST /api/v1/lessons` 201；学员中心 DOM 显示 `待老师确认`、`等待老师确认`、余额扣减到 `₫440.000` |
| US-002 余额不足去充值，充值后返回继续预约 | 通过 | `screenshots/us002-01-wallet-before-topup.png`, `screenshots/us002-02-wallet-after-topup.png`, `screenshots/us002-03-draft-restored.png`, `screenshots/us002-04-dashboard-pending-after-recovery.png` | `browser-console.ndjson` | `network-summary.json`, `api-summary.json` | 首次预约返回 400 并跳钱包；钱包展示“充值后返回继续预约”；充值后返回教师页恢复草稿，再次提交后学员中心显示待确认 |
| US-003 学员中心状态分组和课堂入口规则 | 通过 | `screenshots/us003-01-dashboard-state-groups.png`, `dom-summary.json` | `browser-console.ndjson` | `network-summary.json` | DOM 覆盖 `待老师确认`、`待上课`、`进行中`、`已完成`、`已取消/已过期`；可进入状态显示“进入教室”，不可进入状态显示阻断原因 |
| US-004 直接访问不可进入课堂显示阻断原因且不进入互动课堂 | 通过 | `screenshots/us004-01-classroom-blocked.png`, `dom-summary.json` | `browser-console.ndjson` | `network-summary.json` | 直接访问 pending 课程 `/classroom/:id` 显示“暂时不能进入课堂 / 等待老师确认”；Network 未出现 `/messages` 请求或 `/api/v1/lessons/{id}/ws` WebSocket |

### 端侧审计留存

- 环境信息: `tester/artifacts/test-logs/20260501-1228-run-002/environment.txt`
- 自动化脚本: `tester/artifacts/test-logs/20260501-1228-run-002/scripts/web-e2e-cdp.mjs`
- 审计事件: `tester/artifacts/test-logs/20260501-1228-run-002/audit.log`
- 用户操作路径: `tester/artifacts/test-logs/20260501-1228-run-002/user-flow.md`
- 控制台日志: `tester/artifacts/test-logs/20260501-1228-run-002/browser-console.ndjson`
- 网络摘要: `tester/artifacts/test-logs/20260501-1228-run-002/network-summary.json`
- API/测试数据摘要: `tester/artifacts/test-logs/20260501-1228-run-002/api-summary.json`
- DOM 摘要: `tester/artifacts/test-logs/20260501-1228-run-002/dom-summary.json`
- 服务日志: `tester/artifacts/test-logs/20260501-1228-run-002/backend.stderr.log`, `frontend.stdout.log`
- 初始化日志: `tester/artifacts/test-logs/20260501-1228-run-002/db-create.log`, `alembic-upgrade.log`, `setup-sql.log`
- 截图目录: `tester/artifacts/test-logs/20260501-1228-run-002/screenshots/`

### Web E2E 审计结论

- 控制台错误: 无业务 `console.error` 或未处理异常；仅 Vite dev server debug 和 React DevTools 提示。
- 网络失败: 业务接口未出现 5xx；US-002 的 `POST /api/v1/lessons` 400 为预期余额不足路径。
- 课堂阻断: US-004 只读取课程详情并显示阻断原因，未进入消息历史或课堂 WebSocket。
- 残留风险: 仍未采集录屏/trace；本次四条路径已有截图、DOM、console、network 和 API 摘要，足以覆盖 reviewer 指出的端侧证据缺口。
- Bug handoff: 未发现需要交给 spec-debugger 的运行时 bug。

## 测试策略沉淀判断

- 结论：无需新增或更新通用测试策略
- 原因：本次仅执行当前项目既有 pytest/build/diff-check 门禁；未形成新的跨项目测试方法。浏览器端侧证据缺口已由现有 Web E2E 策略覆盖，不在本次未经用户确认的写入范围内修改 skill 策略库。

## 文档关联

- 设计文档: [[../writer/plan|设计方案]]
- 测试计划: [[test-plan|测试计划]]
- 后端执行总结: [[../executor/backend-summary|后端执行总结]]
- 前端执行总结: [[../executor/frontend-summary|前端执行总结]]
