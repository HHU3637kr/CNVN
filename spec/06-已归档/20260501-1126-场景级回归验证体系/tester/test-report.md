---
title: 场景级回归验证体系-测试报告
type: test-report
status: passed
created: 2026-05-10
updated: 2026-05-10
plan: "[[../writer/plan|plan]]"
test-plan: "[[test-plan|test-plan]]"
owner: spec-tester
spec_dir: spec/05-验证工程/20260501-1126-场景级回归验证体系
git_branch: test/spec-20260501-1126-scenario-regression
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
run_id: 20260510-1428-run-001
tags:
  - spec
  - test-report
  - regression
related:
  - "[[scenario-regression-matrix|场景矩阵]]"
  - "[[../executor/summary|执行汇总]]"
---

# 场景级回归验证体系测试报告

> [!success]
> 测试结论：通过。`smoke` 与 `full` 统一验证命令均为 exit code 0。

## 1. 测试概况

| 项 | 结果 |
|---|---|
| Run ID | `20260510-1428-run-001` |
| 证据目录 | `tester/artifacts/test-logs/20260510-1428-run-001/` |
| Smoke | 通过，`2 passed` |
| Full | 通过，`66 passed` |
| 前端 build | 通过，`1627 modules transformed` |
| Whitespace check | 通过，仅 CRLF 提示 |

## 2. 用例结果

| 用例编号 | 结果 | 证据 |
|---|---|---|
| TC-BE-001 支付释放场景 pytest | 通过 | `verify-smoke.log`, `verify-full.log` |
| TC-BE-002 Alembic 临时空库升级 | 通过 | `verify-smoke.log`, `verify-full.log` |
| TC-BE-003 后端完整回归 | 通过，66 passed | `verify-full.log` |
| TC-FE-001 前端构建烟测 | 通过 | `verify-smoke.log`, `verify-full.log` |
| TC-QA-001 统一 full 命令 | 通过 | `verify-full.exitcode.txt=0` |
| TC-QA-002 CI workflow 静态检查 | 通过 | `.github/workflows/verification.yml` 已创建 |

## 3. Debug 复测

| 问题 | 修复 | 复测 |
|---|---|---|
| D-001 Alembic revision 超过 32 字符 | `005_availability_checks` | `verify-smoke.log` 与 `verify-full.log` 均通过迁移测试 |
| D-002 场景测试全局账本余额假设 | 改为账本基线增量断言 | `verify-full.log` 通过完整后端套件 |

## 4. 命令证据

| 文件 | 内容 |
|---|---|
| `verify-smoke.log` | `python scripts/verify.py --suite smoke` 输出 |
| `verify-smoke.exitcode.txt` | `0` |
| `verify-full.log` | `python scripts/verify.py --suite full` 输出 |
| `verify-full.exitcode.txt` | `0` |

## 5. 剩余风险

| 风险 | 状态 |
|---|---|
| Playwright 浏览器点击 E2E 未实现 | 非阻塞，已在矩阵标为 P1 后续 |
| 前端 typecheck/lint 未实现 | 非阻塞，需后续补 tsconfig/eslint/TypeScript devDependency |
| FastAPI `on_event` deprecation warnings | 既有非阻塞警告 |

## 6. 脱敏检查

测试日志只包含本地测试输出和本地 docker 默认连接信息；未记录 JWT、Authorization header、Cookie 或真实用户隐私。收尾前将再次执行敏感关键词检索。
