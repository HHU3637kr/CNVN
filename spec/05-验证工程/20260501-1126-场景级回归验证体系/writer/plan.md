---
type: spec-plan
status: draft
created: 2026-05-01
git_branch: pending-spec-start
base_branch: pending-spec-start
execution_mode: single-agent
---

# 场景级回归验证体系

## 概述

本 Spec 把测试从模块级提升到用户场景级，覆盖学员、教师、课堂、支付、争议和部署质量。

## 现有能力

- 后端 pytest 覆盖认证、教师、预约、评价、课堂消息部分用例。
- 支付 E2E 脚本存在，但未纳入标准 pytest/CI。
- 前端只有 `pnpm build`，没有 typecheck/lint/test/e2e。
- 暂无 CI workflow。

## 缺口

- 支付 v2、账本、结算、争议期释放缺 pytest。
- Alembic 迁移链没有自动验证。
- 没有前端 E2E smoke。
- 没有按“学员找老师到上课”“教师入驻到收款”等场景组织回归矩阵。

## 需求边界

### P0

- 建立场景回归矩阵。
- 支付 E2E pytest 化或纳入标准命令。
- Alembic 空库升级验证。
- 前端 build smoke。
- 统一本地验证命令。

### P1

- GitHub Actions：PostgreSQL、后端测试、迁移测试、前端 build/typecheck、场景 smoke。
- Playwright 覆盖登录、教师列表/详情、钱包、课堂入口。

### P2

- 覆盖率、性能基线、依赖安全扫描、部署 smoke。

## 设计方案

### 后端

- 保留快速 API pytest，新增 payment/migration 集成套件。
- 资金守恒作为共享 helper。

### 前端

- 先保证 build 必跑，再引入 Playwright。

## 实现步骤

1. 为本 Spec 单独执行 `$spec-start`，创建独立实现分支。
2. 编写场景回归矩阵。
3. 将支付 E2E 迁移为 pytest。
4. 增加 Alembic 空库升级验证。
5. 增加前端 build/typecheck/smoke 命令。
6. 增加 CI 或本地统一命令。

## 风险和依赖

- 支付测试依赖支付托管一致性 Spec 先修复。
- Playwright 需要稳定服务启动和测试数据。

## 文档关联

- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`

