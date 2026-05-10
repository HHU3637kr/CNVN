---
title: 测试报告
type: test-report
status: 已通过
created: 2026-05-01
run_id: 20260501-1325-run-002
supersedes: 20260501-1307-run-001
git_branch: feat/spec-20260501-1248-teacher-supply-flow
plan: "[[../writer/plan|plan]]"
test-plan: "[[test-plan|test-plan]]"
tags:
  - spec
  - test-report
  - teacher-supply-flow
---

# 测试报告：教师入驻排课授课收款闭环

## 测试概况

- 最终有效测试运行：`20260501-1325-run-002`
- 审计日志目录：`tester/artifacts/test-logs/20260501-1325-run-002/`
- 被替代测试运行：`20260501-1307-run-001`
- 命令门禁：5/5 通过
- 端侧 smoke：US-001..US-006 通过
- 失败：0
- 代码覆盖率：项目未配置 coverage 门禁，本次未生成覆盖率报告。

## 被替代证据说明

`20260501-1307-run-001` 已作废，不作为本报告最终结论依据。作废原因：

- `smoke-cdp.log` 保留的是失败输出，和该 run 的 `test-report.md` / `user-flow.md` 通过结论不一致。
- `smoke-cdp.exitcode` 曾因 PowerShell 管道捕获方式不可靠而记录为 0，不能证明 Chrome/CDP smoke 真实通过。
- 该 run 曾保留临时浏览器 profile：`tester/artifacts/test-logs/20260501-1307-run-001/chrome-profile/`。

清理结果：`20260501-1307-run-001/` 作废运行目录已删除；最终审计证据仅以 `20260501-1325-run-002/` 为准。

## 执行命令与结果

| 命令 | 日志 | 退出码 | 结果 |
|---|---|---:|---|
| `cd backend; python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q` | `tester/artifacts/test-logs/20260501-1325-run-002/pytest-teacher-supply.log` | 0 | 通过：`28 passed, 4 warnings in 22.11s` |
| `cd backend; python -m pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q` | `tester/artifacts/test-logs/20260501-1325-run-002/pytest-regression.log` | 0 | 通过：`47 passed, 5 warnings in 33.05s` |
| `cd frontend; pnpm run build` | `tester/artifacts/test-logs/20260501-1325-run-002/frontend-build.log` | 0 | 通过：Vite `1626 modules transformed`，`built in 1.78s` |
| `git diff --check` | `tester/artifacts/test-logs/20260501-1325-run-002/git-diff-check.log` | 0 | 通过：无 whitespace error；仅有 Git LF/CRLF working copy warning |
| Chrome/CDP smoke runner | `tester/artifacts/test-logs/20260501-1325-run-002/smoke-cdp.log` | 0 | 通过：US-001..US-006 均完成 |

## 测试过程中的修改记录

| 修改类型 | 描述 | 关联文档 |
|---|---|---|
| 证据清理 | 删除作废运行目录 `20260501-1307-run-001/`，避免无效 smoke 输出与最终证据混淆。 | `tester/artifacts/test-logs/20260501-1325-run-002/` |
| 临时测试脚本 | 在 run-002 的 `scripts/` 下复制并修正 smoke DB 初始化、结算释放、Chrome/CDP smoke runner；修正真实退出码捕获，并将 Chrome profile 放到系统临时目录，结束后清理。 | `tester/artifacts/test-logs/20260501-1325-run-002/scripts/` |
| Bug 修复 | 无业务代码修复。 | - |

## 日志与审计证据

### 测试运行

- Run ID：`20260501-1325-run-002`
- 环境信息：`tester/artifacts/test-logs/20260501-1325-run-002/environment.txt`
- 测试账号/角色：自动生成的 teacher/student 测试账号，报告和 `user-flow.md` 仅保留脱敏邮箱。
- 浏览器：本地 Chrome headless，通过 CDP 采集 console、network 和截图。
- 服务停止日志：`tester/artifacts/test-logs/20260501-1325-run-002/service-stop.log`
- 临时 profile：使用系统临时目录，结束后已删除；run-002 证据目录未保留 `chrome-profile/`。
- 脱敏检查：生成证据文件未发现凭证、会话或明文密码类信息；`network-summary.json` 不保存请求/响应 body。

### 关键路径日志验证

| 关键路径 | 关联用例 | 证据类型 | 证据位置 | 结果 |
|---|---|---|---|---|
| Availability update 最终态互斥、显式 null 切换 | TC-BE-001..004、US-003 | pytest、network、截图 | `pytest-teacher-supply.log`、`network-summary.json`、`screenshots/us-001-us-002-us-003-us-004-teacher-dashboard.png` | 通过 |
| 教师档案读取与保存 | TC-BE-005..006、US-001..002 | pytest、network、截图 | `pytest-teacher-supply.log`、`network-summary.json`、dashboard 截图 | 通过 |
| 教师课程确认/开始/结束 | TC-BE-007..010、US-004..005 | pytest、backend log、network、截图 | `pytest-teacher-supply.log`、`backend.log`、`network-summary.json`、`screenshots/us-005-classroom-teacher-view.png` | 通过 |
| 学生不能结束课程 | US-005 | network、backend log | `network-summary.json` 记录 `PATCH /lessons/{id}/end` 返回 403；`backend.log` 同步记录 | 通过 |
| 完课后结算释放与出款解释字段 | TC-BE-012、US-006 | pytest、release log、network、截图 | `pytest-teacher-supply.log`、`release-payment.log`、`screenshots/us-006-payouts-explanation.png` | 通过 |

### 端侧审计留存

- Smoke 运行摘要：`tester/artifacts/test-logs/20260501-1325-run-002/smoke-cdp.log`
- Smoke 退出码：`tester/artifacts/test-logs/20260501-1325-run-002/smoke-cdp.exitcode`
- 用户流摘要：`tester/artifacts/test-logs/20260501-1325-run-002/user-flow.md`
- 控制台日志：`tester/artifacts/test-logs/20260501-1325-run-002/browser-console.ndjson`
- 网络摘要：`tester/artifacts/test-logs/20260501-1325-run-002/network-summary.json`
- 后端日志：`tester/artifacts/test-logs/20260501-1325-run-002/backend.log`
- 截图：
  - `screenshots/us-001-register-entry.png`
  - `screenshots/us-001-us-002-us-003-us-004-teacher-dashboard.png`
  - `screenshots/us-005-classroom-teacher-view.png`
  - `screenshots/us-006-payouts-explanation.png`
- trace/录屏：本次 smoke 未启用；流程稳定复现且已保留 console/network/backend/screenshot。

## 用户场景执行结果

| 场景编号 | 结果 | UI 证据 | Console | Network | 后端日志 | 备注 |
|---|---|---|---|---|---|---|
| US-001 教师入驻 | 通过 | `us-001-register-entry.png`、dashboard 截图 | `browser-console.ndjson` | `POST /auth/register`、`POST /auth/become-teacher`、`POST /auth/switch-role` 均成功 | `backend.log` | 教师档案 ID 见 `user-flow.md` |
| US-002 档案保存 | 通过 | dashboard 截图 | `browser-console.ndjson` | `PUT /teachers/profile` 200 | `backend.log` | 保存后 title/hourly_rate 见 `user-flow.md` |
| US-003 排课 | 通过 | dashboard 截图 | `browser-console.ndjson` | `POST /availability` 201，`PUT /availability/{id}` 200/200 | `backend.log` | date -> weekly -> date |
| US-004 确认课程 | 通过 | dashboard 截图 | `browser-console.ndjson` | `PATCH /lessons/{id}/confirm` 200 | `backend.log` | pending -> confirmed |
| US-005 开始/结束课程、学生不能结束 | 通过 | classroom 截图 | `browser-console.ndjson` | teacher start 200，student end 403，teacher end 200 | `backend.log` | 教师 end 由 smoke runner 的 Node fetch 执行并写入 network summary |
| US-006 出款解释 | 通过 | `us-006-payouts-explanation.png` | `browser-console.ndjson` | `GET /payouts/me?page=1&page_size=50` 200 | `backend.log`、`release-payment.log` | 默认税务资料下完成 release 并展示出款页 |

## 发现的 Bug

无。本轮证据修复未发现需要转交 `spec-debugger` 的业务缺陷。

## 残留风险

- pytest 仍输出 FastAPI `on_event` deprecation warning，属于既有生命周期 API 警告，不影响本 Spec 验收。
- 组合回归中 `test_lesson_messages.py::test_ws_rejects_non_member` 输出 SQLAlchemy async cancel 的 resource warning；用例通过，本轮未修改业务代码。
- `git diff --check` 通过，但 Windows 环境输出多处 LF 将被 CRLF 替换的 warning；未发现 whitespace error。
- 端侧 smoke 是 Chrome/CDP + runner 组合验证，不是完整点击式 Playwright/Cypress E2E；已覆盖接口状态、页面加载、console/network/backend log 与截图，但没有逐控件点击断言。
- smoke 为生成出款解释截图，使用临时脚本直接调用 `payment_service.release_payment_order` 释放测试订单；这只用于测试库证据采集，不代表产品侧新增手动释放入口。
- 根据用户写入范围，本轮未修改 `lead/team-context.md`。

## 最终测试结果

通过。最终结论仅基于 `20260501-1325-run-002`：后端专项、后端组合回归、前端构建、`git diff --check` 和 US-001..US-006 Chrome/CDP smoke 均真实通过；`smoke-cdp.exitcode` 为 0，`smoke-cdp.log` 为通过摘要；run-002 未保留浏览器 profile。

当前不需要转交 `spec-debugger`。

## 测试策略沉淀判断

- 结论：无需新增或更新通用测试策略。
- 原因：本次 Chrome/CDP smoke 的做法已落在现有 Web E2E 策略覆盖范围内，临时脚本和数据库释放步骤属于 CNVN 当前 Spec 的一次性验证实现。

## 文档关联

- 设计文档：`[[../writer/plan|设计方案]]`
- 测试计划：`[[test-plan|测试计划]]`
- 实现总结：`[[../executor/summary|实现总结]]`
