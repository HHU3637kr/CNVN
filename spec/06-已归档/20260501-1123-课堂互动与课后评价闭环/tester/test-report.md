---
title: 测试报告
type: test-report
status: done
created: 2026-05-01
updated: 2026-05-01
plan: "[[../writer/plan|plan]]"
test-plan: "[[test-plan|test-plan]]"
run_id: 20260501-1349-run-001
tags:
  - spec
  - test-report
  - classroom
  - review
---

# 测试报告：课堂互动与课后评价闭环

## 测试概况

- Run ID: `20260501-1349-run-001`
- 审计日志目录: `spec/03-能力交付/20260501-1123-课堂互动与课后评价闭环/tester/artifacts/test-logs/20260501-1349-run-001/`
- 测试时间: 2026-05-01
- 测试账号/角色: `teacher.*@example.test`、`student.*@example.test`、`intruder.*@example.test`
- 设备/浏览器: Headless Chrome/CDP，临时 profile 位于系统 temp，运行结束后已删除，见 `service-stop.log`
- 测试用例总数: 6 个浏览器 smoke 场景 + 后端 API 回归 + 前端 build + diff check
- 通过: 全部最终验证通过
- 失败: 0 个未解决失败
- 代码覆盖率: 本次未采集覆盖率

## 命令结果

| 编号 | 命令 | 退出码 | 结果 | 日志 |
|---|---|---:|---|---|
| CMD-001 | `cd backend; python -m pytest tests/api/v1/test_lesson_messages.py tests/api/v1/test_lessons.py tests/api/v1/test_reviews.py tests/api/v1/test_payment_settlement.py -q` | 0 | 31 passed, 4 warnings | `tester/artifacts/test-logs/20260501-1349-run-001/pytest-classroom-review.log` |
| CMD-002 | `cd backend; python -m pytest tests/api/v1 -q` | 0 | 54 passed, 4 warnings | `tester/artifacts/test-logs/20260501-1349-run-001/pytest-api-v1.log` |
| CMD-003 | `cd frontend; pnpm run build` | 0 | Vite build 成功，1626 modules transformed | `tester/artifacts/test-logs/20260501-1349-run-001/frontend-build.log` |
| CMD-004 | `git diff --check` | 0 | 无 whitespace error；仅 LF/CRLF working copy warning | `tester/artifacts/test-logs/20260501-1349-run-001/git-diff-check.log` |
| CMD-005 | Chrome/CDP smoke | 0 | US-001 到 US-006 全部 passed | `tester/artifacts/test-logs/20260501-1349-run-001/smoke-cdp.log` |

补充记录：`pytest-api-v1.first-attempt.exitcode` 为 `TIMEOUT_EXTERNAL`，第一次完整 API 回归被外层工具超时中断；随后用同一命令受控重跑并以退出码 0 完整通过。Smoke 前三次为脚本数据准备调试失败，证据保存在 `smoke-cdp.attempt1/2/3.*`；最终 `smoke-cdp.exitcode=0`。

## 用户场景执行结果

| 场景编号 | 结果 | 关键断言 | 证据 |
|---|---|---|---|
| US-001 课堂阻断 | 通过 | 未到可进入时间的 confirmed 课程展示阻断原因，未建立 WS | `screenshots/us-001-classroom-blocked.png`、`user-flow.md`、`network-summary.json` |
| US-002 课堂消息/WS | 通过 | 课堂 WS 已连接，消息发送后回显并可由 messages 接口读回 | `screenshots/us-002-classroom-chat.png`、`user-flow.md`、`network-summary.json` |
| US-003 教师结束课程 | 通过 | 教师课堂页点击结束课程后返回教师中心，课程状态为 `completed` | `screenshots/us-003-teacher-ended-course.png`、`api-summary.json` |
| US-004 学员评价提交 | 通过 | 学员提交评价后课程状态为 `reviewed`，教师评价列表出现该评价 | `screenshots/us-004-student-review-entry.png`、`screenshots/us-004-student-reviewed.png`、`screenshots/us-004-teacher-profile-review-visible.png` |
| US-005 越权评价拒绝 | 通过 | 第三方学员 POST `/reviews` 返回 403 | `user-flow.md`、`network-summary.json` |
| US-006 重复评价拒绝 | 通过 | 同一学员重复 POST `/reviews` 返回 400 | `user-flow.md`、`network-summary.json` |

## 日志与审计证据

### 测试运行

- 环境信息: `tester/artifacts/test-logs/20260501-1349-run-001/environment.txt`
- 起始 Git 状态: `tester/artifacts/test-logs/20260501-1349-run-001/git-status-start.txt`
- 后端专项 pytest: `pytest-classroom-review.log` / `pytest-classroom-review.exitcode`
- 后端 API 回归: `pytest-api-v1.log` / `pytest-api-v1.exitcode`
- 前端构建: `frontend-build.log` / `frontend-build.exitcode`
- diff check: `git-diff-check.log` / `git-diff-check.exitcode`
- Smoke 数据库初始化: `smoke-db-setup.log`
- Smoke 服务日志: `backend.log`、`backend.err.log`、`frontend-dev.log`、`frontend-dev.err.log`
- Smoke 结果: `smoke-cdp.log` / `smoke-cdp.exitcode`
- 服务清理: `service-stop.log`

### 关键路径日志验证

| 关键路径 | 关联用例 | 证据类型 | 证据位置 | 结果 |
|---|---|---|---|---|
| 课堂入口阻断 | US-001 | 截图、网络摘要、用户流 | `screenshots/us-001-classroom-blocked.png`、`network-summary.json`、`user-flow.md` | 通过 |
| 课堂消息与 WebSocket | US-002 | 截图、网络摘要、后端日志、API 断言 | `screenshots/us-002-classroom-chat.png`、`backend.log`、`network-summary.json` | 通过 |
| `in_progress -> completed` | US-003 | 截图、API 摘要、后端日志 | `screenshots/us-003-teacher-ended-course.png`、`api-summary.json`、`backend.log` | 通过 |
| `completed -> reviewed` | US-004 | 截图、API 摘要、教师评价列表断言 | `screenshots/us-004-student-reviewed.png`、`screenshots/us-004-teacher-profile-review-visible.png`、`api-summary.json` | 通过 |
| 越权/重复评价拒绝 | US-005, US-006 | 网络摘要、用户流 | `network-summary.json`、`user-flow.md` | 通过 |
| 结算/统计回归 | TC-BE-020 | pytest 断言 | `pytest-classroom-review.log`、`pytest-api-v1.log` | 通过 |

### 端侧审计留存

- 控制台日志: `tester/artifacts/test-logs/20260501-1349-run-001/browser-console.ndjson` 和 `console/browser-console.ndjson`
- 网络摘要: `tester/artifacts/test-logs/20260501-1349-run-001/network-summary.json` 和 `network/network-summary.json`
- 用户流: `tester/artifacts/test-logs/20260501-1349-run-001/user-flow.md`
- API 摘要: `tester/artifacts/test-logs/20260501-1349-run-001/api-summary.json`
- 截图: `tester/artifacts/test-logs/20260501-1349-run-001/screenshots/`
- 录屏/trace: 本次 smoke 稳定通过，未生成录屏或 trace
- 脱敏检查: 已检查 `network-summary.json`，未发现 Authorization、Cookie、Bearer、明文 password 或未脱敏 `access_token`；网络摘要不保存完整 body

## 测试过程中的修改记录

| 修改类型 | 描述 | 关联文档 |
|---|---|---|
| 测试脚本 | 在 `tester/artifacts/test-logs/20260501-1349-run-001/scripts/` 下创建 smoke runner 与数据库初始化脚本，只用于本次验证 | `scripts/run-smoke.ps1`、`scripts/smoke-cdp.mjs`、`scripts/setup_smoke_db.py` |
| 测试数据调整 | Smoke 初始数据准备曾因两个课程时间重叠触发 409；最终改为使用独立教师和非重叠时间窗口 | `smoke-cdp.attempt1.log`、`smoke-cdp.attempt2.log`、`smoke-cdp.attempt3.log` |

## 发现的 Bug

无需要移交 spec-debugger 的未解决业务缺陷。

说明：Smoke 前三次失败均为 tester 脚本/数据准备问题，不是业务代码缺陷；最终同一 run 下浏览器 smoke 已通过。

## 最终测试结果

结论：通过。

本 Spec 的课堂阻断、课堂消息/WebSocket、教师结束课程、学员评价提交后 `reviewed`、越权/重复评价拒绝、教师评价列表可见、支付结算/统计回归、前端构建和 diff check 均已完成真实验证并归档证据。

## 测试策略沉淀判断

- 结论：无需新增或更新通用测试策略
- 原因：本次 Web/CDP 证据采集、network 脱敏、临时 Chrome profile 清理均已被现有 Web E2E 策略覆盖；本轮脚本调整属于 CNVN 当前数据模型的一次性测试数据准备。

## 文档关联

- 设计文档: `[[../writer/plan|设计方案]]`
- 测试计划: `[[test-plan|测试计划]]`
- 实现总结: `[[../executor/summary|实现总结]]`
