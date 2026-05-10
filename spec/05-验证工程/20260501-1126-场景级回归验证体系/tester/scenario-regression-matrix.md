---
title: CNVN 场景级回归矩阵
type: regression-matrix
status: active
created: 2026-05-10
updated: 2026-05-10
owner: spec-tester
spec_dir: spec/05-验证工程/20260501-1126-场景级回归验证体系
git_branch: test/spec-20260501-1126-scenario-regression
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
tags:
  - spec
  - regression
  - matrix
related:
  - "[[test-plan|测试计划]]"
  - "[[../../01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan|用户场景地图]]"
---

# CNVN 场景级回归矩阵

| 场景 | 角色 | 优先级 | 用户目标 | 自动化证据 | 当前状态 |
|---|---|---|---|---|---|
| REG-001 注册登录与角色切换 | 访客/学员/教师 | P0 | 创建账号、登录、教师开通身份 | `backend/tests/api/v1/test_auth.py` | 已覆盖 |
| REG-002 找老师与教师详情 | 学员 | P0 | 浏览教师、查看详情、可用时段 | `backend/tests/api/v1/test_teachers.py`, `test_availability.py`; frontend build smoke | 已覆盖 API/build |
| REG-003 单课预约下单 | 学员 | P0 | 有余额和可用时段时成功预约 | `backend/tests/api/v1/test_lessons.py` | 已覆盖 |
| REG-004 教师确认与课堂入口 | 教师/学员 | P0 | 教师确认，师生按时间进入课堂 | `backend/tests/api/v1/test_lessons.py`, `test_lesson_messages.py` | 已覆盖 API/WebSocket |
| REG-005 支付托管到结算释放 | 学员/教师/财务 | P0 | 充值、付款、完课、争议期结束、教师到账 | `backend/tests/scenarios/test_payment_release_scenario.py` | 本 Spec 新增 |
| REG-006 课后评价与教师评分 | 学员/教师 | P0 | 完课后评价并更新教师展示 | `backend/tests/api/v1/test_reviews.py` | 已覆盖 |
| REG-007 争议创建与运营处理 | 学员/运营 | P0 | 学员发起争议，运营退款/放款并留事件 | `backend/tests/api/v1/test_disputes.py` | 已覆盖 |
| REG-008 Alembic 空库升级 | 工程团队 | P0 | 新环境从空库升级到 head | `backend/tests/integration/test_alembic_migrations.py` | 本 Spec 新增 |
| REG-009 前端构建烟测 | 工程团队 | P0 | 所有页面可被 Vite 编译打包 | `pnpm run build` via `scripts/verify.py` | 本 Spec 纳入统一命令 |
| REG-010 PR 自动验证 | 工程团队 | P1 | PR 自动跑后端、迁移、前端 build | `.github/workflows/verification.yml` | 本 Spec 新增 |
| REG-011 浏览器点击 E2E | 学员/教师/运营 | P1 | 用真实浏览器走登录、教师列表、钱包、订单、争议 | 后续 Playwright suite | 预留，未实现 |

## 统一命令映射

| 命令 | 覆盖 |
|---|---|
| `python scripts/verify.py --suite smoke` | REG-005、REG-008、REG-009、whitespace check |
| `python scripts/verify.py --suite full` | 全部后端 pytest（含 REG-001 至 REG-008）、REG-009、whitespace check |

## 缺口登记

| 缺口 | 原因 | 后续处理 |
|---|---|---|
| Playwright 浏览器 E2E 未落地 | 当前项目无 Playwright 依赖和稳定服务编排 | 后续独立验证 Spec 引入 |
| 前端 typecheck/lint 未落地 | 当前无 tsconfig、eslint 和 TypeScript devDependency | 后续前端工程化 Spec 引入 |
