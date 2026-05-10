---
title: 场景级回归验证体系-测试计划
type: test-plan
status: active
created: 2026-05-10
updated: 2026-05-10
plan: "[[../writer/plan|plan]]"
owner: spec-tester
spec_dir: spec/05-验证工程/20260501-1126-场景级回归验证体系
git_branch: test/spec-20260501-1126-scenario-regression
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
tags:
  - spec
  - test-plan
  - regression
related:
  - "[[scenario-regression-matrix|场景回归矩阵]]"
  - "[[../explorer/exploration-report|探索报告]]"
---

# 场景级回归验证体系测试计划

## 1. 验收标准

| 编号 | 标准 | 通过条件 |
|---|---|---|
| AC-001 | 场景矩阵可追溯 | `tester/scenario-regression-matrix.md` 覆盖 P0 用户场景并映射到自动化证据 |
| AC-002 | 支付 E2E pytest 化 | `backend/tests/scenarios/test_payment_release_scenario.py` 通过，且断言资金守恒、结算快照、出款、账本 |
| AC-003 | Alembic 空库升级验证 | `backend/tests/integration/test_alembic_migrations.py` 通过，临时库升级到 head |
| AC-004 | 统一命令可用 | `python scripts/verify.py --suite smoke` 和 `--suite full` 路径明确，至少 full 在本轮执行通过 |
| AC-005 | 前端 build smoke | `pnpm run build` 通过 |
| AC-006 | CI 已配置 | `.github/workflows/verification.yml` 包含 PostgreSQL、后端、前端和统一命令 |
| AC-007 | 无敏感证据提交 | 测试日志不包含 token、Authorization、password、secret |

## 2. 测试用例

| 用例编号 | 描述 | 输入 | 预期输出 | 边界条件 |
|---|---|---|---|---|
| TC-BE-001 | 支付释放场景 pytest | 学员/教师注册、充值、预约、完课、过争议期 | order released、snapshot 守恒、payout paid、教师钱包到账、资金守恒 | 课程时间在可进入窗口内 |
| TC-BE-002 | Alembic 临时空库升级 | 唯一临时数据库名 | `alembic_version=006_add_dispute_cases`，核心表/seed/function 存在 | 测试结束必须 drop 临时库 |
| TC-BE-003 | 后端完整回归 | `python -m pytest -q` | 全部 backend pytest 通过 | 依赖本地 PostgreSQL `cnvn_test` |
| TC-FE-001 | 前端构建烟测 | `pnpm run build` | Vite build 成功 | 不检查浏览器点击 |
| TC-QA-001 | 统一 full 命令 | `python scripts/verify.py --suite full` | 后端 pytest、前端 build、diff check 通过 | 本地需已安装依赖 |
| TC-QA-002 | CI workflow 静态检查 | workflow 文件 | 包含 checkout、Python、Postgres、Node/pnpm、verify 命令 | PR 分支自动触发 |

## 3. 用户使用场景

| 场景编号 | 用户角色 | 业务目标 | 操作路径 | 关键断言 | 证据 |
|---|---|---|---|---|---|
| US-001 | 学员/教师 | 完成一次付费单课并结算 | 注册 → 教师开通 → 可用时段 → 学员充值 → 预约 → 确认 → 开始 → 结束 → watcher release | 资金守恒；订单 released；教师钱包到账 | `backend/tests/scenarios/test_payment_release_scenario.py` |
| US-002 | 运营/工程 | 新环境可以从空库初始化 | 创建临时 DB → `alembic upgrade head` → 查询 schema | 迁移 head、核心表、seed、函数存在 | `backend/tests/integration/test_alembic_migrations.py` |
| US-003 | 工程团队 | PR 具备基础回归门 | push/PR → GitHub Actions | PostgreSQL service、backend pytest、frontend build 执行 | `.github/workflows/verification.yml` |

## 4. 覆盖率要求

- 功能覆盖：P0 场景矩阵中 REG-001 至 REG-009 必须至少有 API/scenario/migration/build 证据。
- 代码覆盖率：本轮不引入覆盖率阈值，避免因历史代码无 coverage 配置阻塞；后续独立 Spec 可引入 `pytest-cov`。
- CI 覆盖：PR 与 push 至 `feat/**`、`fix/**`、`test/**`、`main/master` 执行。

## 5. 日志与审计要求

### 5.1 关键路径可观测性

- 支付释放场景必须断言 `PaymentOrder`、`SettlementSnapshot`、`PayoutOrder`、`LedgerAccount`、`Wallet`。
- Alembic 场景必须断言 `alembic_version` 和核心 schema 对象。
- 统一命令执行结果必须保存到 `tester/artifacts/test-logs/<run-id>/`，由命令重定向自动生成。

### 5.2 脱敏要求

- 不保存 Authorization、Cookie、JWT、密码、密钥。
- 允许保存测试库连接串中的本地 docker 默认密码 `cnvn_secret`，但不作为真实凭据使用。
- 运行后使用检索确认测试证据不含 `Bearer `、`access_token`、`Authorization`。

## 6. 测试环境要求

- Python 3.11。
- 后端依赖已安装：`python -m pip install -e "backend[dev]"` 或现有本地等价环境。
- PostgreSQL 16，存在 `cnvn_test`，用户可创建临时数据库与 extension。
- 前端依赖已安装：`cd frontend && pnpm install --frozen-lockfile`。
- 本地 smoke/full 命令从仓库根目录执行。
