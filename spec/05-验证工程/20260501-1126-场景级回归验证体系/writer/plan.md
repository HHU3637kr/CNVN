---
type: spec-plan
status: active
created: 2026-05-01
updated: 2026-05-10
spec_dir: spec/05-验证工程/20260501-1126-场景级回归验证体系
git_branch: test/spec-20260501-1126-scenario-regression
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
pr_url:
execution_mode: single-agent
gate_mode: skipped_by_user
---

# 场景级回归验证体系

## 1. 概述

本 Spec 将 CNVN 的验证方式从“分散模块测试”提升为“用户场景级回归验证”。目标不是新增业务功能，而是把 MVP 产品化阶段已经补齐的学员、教师、课堂、支付、争议和运营能力纳入统一、可重复、可 CI 执行的验证入口。

本轮采用单 Agent 串行执行；用户已明确不设置门禁，因此 `writer/plan.md` 与 `tester/test-plan.md` 落盘后直接进入实现。

## 2. 需求分析

### 2.1 P0 范围

| 编号 | 需求 | 验收方式 |
|---|---|---|
| FR-001 | 建立场景回归矩阵，覆盖访客/学员/教师/运营/财务关键路径 | `tester/scenario-regression-matrix.md` 映射场景、优先级、自动化证据和缺口 |
| FR-002 | 将支付 E2E 链路纳入 pytest | 新增 `backend/tests/scenarios/test_payment_release_scenario.py`，覆盖充值、预约、确认、开始、结束、争议期释放、结算快照、出款、资金守恒 |
| FR-003 | Alembic 空库升级自动验证 | 新增 `backend/tests/integration/test_alembic_migrations.py`，临时数据库执行 `alembic upgrade head` 并断言核心表、seed 和函数 |
| FR-004 | 前端 build smoke 纳入标准验证 | 统一命令执行 `pnpm run build` |
| FR-005 | 提供统一本地验证命令 | 新增 `scripts/verify.py --suite smoke/full` |

### 2.2 P1 范围

| 编号 | 需求 | 验收方式 |
|---|---|---|
| FR-006 | GitHub Actions 自动执行验证 | 新增 `.github/workflows/verification.yml`，启动 PostgreSQL 16，安装后端/前端依赖，运行统一验证命令 |
| FR-007 | 为 Playwright/Web E2E 预留矩阵入口 | 在场景矩阵和测试计划标记浏览器 E2E 后续项，不在本轮强引新依赖 |

### 2.3 非目标

- 不引入真实支付网关、真实视频课堂或新业务页面。
- 不把所有前端交互一次性改造成 Playwright；当前缺少稳定 E2E 基础设施，本轮先建立 CI 骨架和 build smoke。
- 不修改支付/课程业务逻辑，除非测试暴露阻塞性 bug。

## 3. 设计方案

### 3.1 场景矩阵

新增 `tester/scenario-regression-matrix.md`，以用户场景地图为输入，把场景映射到自动化层级：

- API pytest：认证、教师、可用时段、课程、课堂消息、评价、争议。
- Scenario pytest：跨模块支付释放链路。
- Migration pytest：空库迁移链。
- Frontend smoke：Vite build。
- CI：PostgreSQL + 后端 + 前端 + whitespace check。

### 3.2 支付场景 pytest 化

新增 `backend/tests/scenarios/test_payment_release_scenario.py`：

1. 注册学员与教师。
2. 教师开通档案并设置当天可用时段。
3. 学员充值并预约课程。
4. 教师确认、开始、结束课程。
5. 将 `PaymentOrder.held_until` 调整到过去，调用 `dispute_watcher.run_once`。
6. 断言 `PaymentOrder` released、`SettlementSnapshot` 守恒、`PayoutOrder` paid、教师钱包到账、账本账户余额正确、全局资金守恒。

该测试复用现有 FastAPI ASGI client 和 PostgreSQL 测试库，不依赖已启动的外部 API 服务。

### 3.3 Alembic 空库升级验证

新增 `backend/tests/integration/test_alembic_migrations.py`：

1. 使用 `CNVN_TEST_ADMIN_DATABASE_URL` 连接 `postgres` 管理库。
2. 创建唯一临时数据库。
3. 子进程执行 `python -m alembic upgrade head`，通过 `DATABASE_URL` 指向临时库。
4. 断言 `alembic_version` 为 `006_add_dispute_cases`。
5. 断言核心表、`ledger_accounts` seed 和 `lesson_time_range` 函数存在。
6. 使用 `DROP DATABASE ... WITH (FORCE)` 清理临时库。

### 3.4 统一验证命令

新增根目录脚本 `scripts/verify.py`：

```bash
python scripts/verify.py --suite smoke
python scripts/verify.py --suite full
```

- `smoke`：运行 scenario pytest、migration pytest、前端 build、`git diff --check`。
- `full`：运行完整后端 pytest、前端 build、`git diff --check`。
- 支持 `--backend-only`、`--frontend-only`、`--skip-git-diff` 便于 CI 和本地定位。

### 3.5 CI

新增 `.github/workflows/verification.yml`：

- 触发：push、pull_request。
- PostgreSQL：`postgres:16-alpine`，默认测试库 `cnvn_test`。
- Python：3.11，`pip install -e "backend[dev]"`。
- Node：20，pnpm 9，`pnpm install --frozen-lockfile`。
- 执行：`python scripts/verify.py --suite full`。

## 4. 执行模式

`execution_mode: single-agent`。当前 Agent 串行扮演 TeamLead、explorer、writer、tester、executor、reviewer、ender，不再创建子 Agent。所有关键产物仍按 R&K Flow 角色目录落盘。

## 5. 实现步骤

1. 补齐 `lead/team-context.md`、`explorer/exploration-report.md`。
2. 更新本 `writer/plan.md` 的分支元数据和可执行方案。
3. 创建 `tester/test-plan.md` 和 `tester/scenario-regression-matrix.md`。
4. 新增支付场景 pytest。
5. 新增 Alembic 空库升级 pytest。
6. 新增统一验证脚本。
7. 新增 GitHub Actions workflow。
8. 执行 targeted、full、frontend build、统一命令和 diff check。
9. 产出 `executor/summary.md`、`tester/test-report.md`、`reviewer/review.md`、`ender/end-report.md`。
10. 提交、推送、创建 PR 并合并回 `feat/spec-20260501-1058-mvp-to-product-ready`。

## 6. 风险和依赖

| 风险 | 处理 |
|---|---|
| 本地未启动 PostgreSQL 或缺少 `cnvn_test` | 统一命令文档化依赖；CI 使用 service postgres 保证环境 |
| Alembic 迁移需要 `CREATE EXTENSION btree_gist` 权限 | CI 使用 `POSTGRES_USER=cnvn`，本地 docker compose 默认用户具备权限 |
| Playwright 引入会扩大依赖和耗时 | 本轮只预留矩阵入口，后续独立 Spec 补浏览器 E2E |
| 测试日志可能被 `.gitignore` 忽略 | Spec 证据目录使用 `git add -f` 收尾 |

## 7. 文档关联

- `[[../lead/team-context|Team Context]]`
- `[[../explorer/exploration-report|探索报告]]`
- `[[../tester/test-plan|测试计划]]`
- `[[../tester/scenario-regression-matrix|场景回归矩阵]]`
- `[[../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|CNVN 用户场景地图]]`
- `[[../../04-系统改进/20260501-1058-MVP到完善优化/writer/plan|MVP 到产品化完善总控规划]]`
