---
title: 测试报告
type: test-report
status: passed
created: 2026-05-10
plan: "[[../writer/plan|plan]]"
test-plan: "[[test-plan|test-plan]]"
tags:
  - spec
  - test-report
---

# 测试报告

## 测试概况

- 本轮目标：R-001 复测，验证创建争议权限收敛、非活跃状态拒绝和运营详情字段断言补齐。
- Run ID：`20260510-1353-run-retest-r001`
- 测试用例总数：后端目标命令 16 个测试、后端全量 64 个测试、前端 build 1 项、diff 检查 1 项。
- 通过：全部通过。
- 失败：0。
- 代码覆盖率：未单独采集；本次以 API 回归、资金状态断言、前端 production build 和 diff check 为验收证据。

## 测试过程中的修改记录

| 修改类型 | 描述 | 关联文档 |
|---------|------|---------|
| Bug 修复 | R-001 创建争议权限收敛为付款单学员本人；教师发起改为 `403`；补齐非活跃状态和运营详情字段测试 | [[../debugger/debug-001-fix|debug-001-fix]] |

## 执行命令结果

| 命令 | 结果 | 证据 |
|------|------|------|
| `cd backend; pytest tests/api/v1/test_disputes.py tests/api/v1/test_payment_settlement.py -q` | exit code `0`；`16 passed, 4 warnings in 17.02s` | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-targeted.stdout.log`, `pytest-targeted.stderr.log`, `pytest-targeted.exitcode.txt` |
| `cd backend; pytest -q` | exit code `0`；`64 passed, 4 warnings in 63.15s` | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-full.stdout.log`, `pytest-full.stderr.log`, `pytest-full.exitcode.txt` |
| `cd frontend; pnpm run build` | exit code `0`；Vite build 通过，`1627 modules transformed`，`built in 1.72s` | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/frontend-build.stdout.log`, `frontend-build.stderr.log`, `frontend-build.exitcode.txt` |
| `git diff --check` | exit code `0`；文档回写后再次复跑仍无 whitespace error，stderr 仅有既有 LF/CRLF warning | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/git-diff-check-post-docs.stdout.log`, `git-diff-check-post-docs.stderr.log`, `git-diff-check-post-docs.exitcode.txt` |

## 日志与审计证据

### 测试运行

- Run ID: `20260510-1353-run-retest-r001`
- 审计日志目录: `tester/artifacts/test-logs/20260510-1353-run-retest-r001/`
- 自动采集文件: `audit.log`、`command-summary.json`、各命令 `stdout/stderr/exitcode` 文件。
- 测试账号/角色: 后端 pytest 自动生成测试用户；无真实账号。
- 设备/浏览器/App 版本: 本轮未执行独立浏览器 smoke；前端以 production build 作为端侧构建验收。

### 关键路径日志验证

| 关键路径 | 关联用例 | 证据类型 | 证据位置 | 结果 |
|---------|---------|---------|----------|------|
| 创建争议权限收敛为付款单学员本人；教师与无关用户发起返回 `403`，且不创建争议、不改变订单状态 | AC-P0-01 / T-BE-02 | pytest API + DB 状态断言 | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-targeted.stdout.log` | 通过 |
| `released/refunded/pending/paid` 订单发起争议被拒绝 | AC-P0-02 / T-BE-03 | pytest 参数化状态断言 | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-targeted.stdout.log` | 通过 |
| 运营详情返回课程、付款单、学员、教师、金额、`held_until` 和事件历史 | AC-P0-06 / T-BE-06 | pytest 详情字段断言 | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-targeted.stdout.log` | 通过 |
| 运营接单、人工退款、人工释放、重复资金动作拒绝、watcher skip 回归 | T-BE-07 至 T-BE-12 | pytest API + 资金/结算状态断言 | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-targeted.stdout.log` | 通过 |
| 全量后端回归 | 回归测试 | pytest 日志 | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/pytest-full.stdout.log` | 通过 |
| 前端争议入口、运营页、类型和路由参与构建 | TC-FE-001 | Vite build 日志 | `tester/artifacts/test-logs/20260510-1353-run-retest-r001/frontend-build.stdout.log` | 通过 |

### 端侧审计留存

- 控制台日志: 未生成；本轮复测范围不含浏览器自动化。
- 网络摘要: 未生成；对应 API 行为由后端目标 pytest 覆盖。
- 截图: 目录已自动创建 `tester/artifacts/test-logs/20260510-1353-run-retest-r001/screenshots/`，本轮未生成截图。
- 录屏/trace: 目录已自动创建 `recordings/` / `traces/`，本轮未生成录屏或 trace。
- 脱敏检查: 已检查本次生成证据，未保存 token、密码、密钥或真实用户隐私。

## 发现的 Bug（如有）

- [[../debugger/debug-001|R-001 争议创建权限偏差]] - 已复测验证通过。
- 本轮未发现新的业务缺陷。

## 最终测试结果

结论：R-001 复测通过。

已验证 AC-P0-01、AC-P0-02、AC-P0-06 修复点和相关回归路径全部通过；`debugger/debug-001-fix.md` 中要求复测的权限边界、非活跃状态拒绝和运营详情字段断言均已由自动化测试覆盖并通过。

剩余风险：独立浏览器 smoke 仍未纳入本轮复测范围；该风险不阻塞 R-001 关闭，后续继续由 `spec/05-验证工程/20260501-1126-场景级回归验证体系` 规划覆盖。

## 测试策略沉淀判断

- 结论：无需新增或更新通用测试策略。
- 原因：本次为项目内定向复测，未形成新的跨项目测试方法；浏览器 smoke 标准化仍由后续验证工程 Spec 统一处理。

## 文档关联

- 设计文档: [[../writer/plan|设计方案]]
- 测试计划: [[test-plan|测试计划]]
- 执行汇总: [[../executor/summary|执行汇总]]
- 调试修复: [[../debugger/debug-001-fix|修复总结]]
- 审查报告: [[../reviewer/review|审查报告]]
