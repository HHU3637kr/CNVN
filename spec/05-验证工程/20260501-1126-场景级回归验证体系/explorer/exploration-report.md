---
title: 场景级回归验证体系-探索报告
type: exploration-report
status: completed
created: 2026-05-10
updated: 2026-05-10
owner: spec-explorer
spec_dir: spec/05-验证工程/20260501-1126-场景级回归验证体系
git_branch: test/spec-20260501-1126-scenario-regression
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
tags:
  - spec
  - exploration
  - regression
related:
  - "[[../lead/team-context|Team Context]]"
  - "[[../writer/plan|设计方案]]"
  - "[[../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|用户场景地图]]"
---

# 场景级回归验证体系探索报告

## 1. 历史经验检索

通过 `exp-search` 检索到与本 Spec 直接相关的记忆：

| 记忆 | 关联点 | 对本 Spec 的影响 |
|---|---|---|
| `EXP-002` 支付模块结算防重与数据模型关联 | 资金操作需要防重复、通过 `TeacherProfile` 中转教师用户 | 场景测试必须覆盖重复释放风险、教师钱包归属和资金守恒。 |
| `KNOW-003` CNVN 支付模块结算实现详解 | 支付托管、争议期、结算快照、出款、账本流转 | 回归矩阵必须把支付 release、账本和出款列为 P0。 |

## 2. 项目现状

### 2.1 后端测试

- `backend/tests/api/v1/` 已有认证、教师、可用时段、课程、课堂消息、支付结算、评价、争议等 API 级 pytest。
- `backend/tests/conftest.py` 使用 PostgreSQL 测试库 `cnvn_test`，通过 `Base.metadata.create_all()` 建表，并补充 `btree_gist` 与 `lesson_time_range`。
- 支付完整链路仍存在旧脚本：`backend/scripts/e2e_payment_test.py`，需要运行已启动 API 服务，不属于标准 pytest 套件。
- 当前没有 Alembic 空库升级测试；API pytest 不能发现迁移链、种子数据和 extension/function 缺失。

### 2.2 前端验证

- `frontend/package.json` 只有 `pnpm run build` 和 `pnpm run dev`。
- 当前没有 Vitest/Playwright/test/typecheck/lint；因此本轮 P0 应先把 build smoke 纳入统一命令和 CI。
- Web E2E 策略需要真实浏览器、稳定服务启动和测试账号。考虑当前项目尚未有 Playwright 依赖，本轮不引入大规模浏览器自动化，先用场景矩阵和 CI 预留入口。

### 2.3 CI 与统一命令

- 仓库没有 `.github/workflows/`。
- 根目录没有 Makefile、npm workspace 或统一验证脚本。
- 本地命令分散：后端 pytest、前端 build、git diff check、迁移验证需要人工记忆。

## 3. 已识别缺口

| 缺口 | 风险 | 建议处理 |
|---|---|---|
| 支付 E2E 脚本未 pytest 化 | CI 不会覆盖完整支付释放链路 | 新增 `backend/tests/scenarios/test_payment_release_scenario.py`。 |
| Alembic 空库升级未验证 | 新迁移可能只在 metadata create_all 下通过 | 新增独立迁移测试，创建临时数据库执行 `alembic upgrade head`。 |
| 缺场景矩阵 | 回归测试与用户场景脱节 | 在 Spec tester 目录维护场景矩阵，映射到自动化命令。 |
| 缺统一命令 | 不同开发者验证口径不一致 | 新增 `scripts/verify.py --suite smoke/full`。 |
| 缺 CI | PR 不能自动发现回归 | 新增 GitHub Actions：PostgreSQL、后端 pytest、前端 build、diff check。 |

## 4. 对 writer/tester 的建议

- P0 不引入新业务能力，聚焦验证工程：场景矩阵、pytest 场景化、迁移验证、前端 build smoke、统一命令。
- P1 可落 GitHub Actions；Playwright 作为后续增强，不在本轮强行引入依赖。
- 测试证据需自动生成到 `tester/artifacts/test-logs/<run-id>/`，不要手写运行日志。
- 迁移测试要创建独立临时数据库，避免破坏 `cnvn_test` 中 API 测试夹具。
