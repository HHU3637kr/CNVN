---
title: 支付前端与 VietQR 验证 — 测试计划
type: test-plan
status: 未确认
created: 2026-04-21
plan: "[[plan|Spike 方案]]"
summary: "[[summary|实现总结]]"
tags:
  - spec
  - test-plan
  - spike
  - payment
  - frontend
  - e2e
---

# 支付前端与 VietQR 验证 — 测试计划

> 依据 `plan.md` 编写；本 Spike **无** `exploration-report.md`，范围以 plan 中路径 B+C 为准。

## 1. 验收标准（通过 / 不通过）

| 编号 | 标准 | 判定方式 |
|------|------|----------|
| AC-01 | 学员在已登录状态下可打开「钱包」页，展示 `GET /api/v1/wallet` 返回的余额 | 与 Network 面板或后端日志一致 |
| AC-02 | 学员可发起 Mock 充值（`POST /api/v1/wallet/topup`），余额与流水与接口一致 | 充值前后余额差 = 请求金额 |
| AC-03 | 充值相关页展示 VietQR 图与账户信息（与 `docs/验证银行卡` 或 `public` 同步文案一致） | 肉眼 + 可选复制账号 |
| AC-04 | 学员可查看至少一笔付款单详情（`GET /api/v1/payments/orders/{id}`），字段与后端一致 | 状态、gross 等可读 |
| AC-05 | 教师可查看出款列表（`GET /api/v1/payouts/me`），分页/空列表不白屏 | 401 时引导登录或切换角色 |
| AC-06 | 凭证「待核对」占位：用户可提交占位（文件或说明），列表可见；**不验证**真实银行到账 | 仅 UI/状态机占位 |
| AC-07 | 本地开发：`VITE_API_URL` 指向 `http://localhost:8001` 时全流程无 CORS 报错 | 浏览器控制台无 CORS 阻断 |

**不通过**：白屏、未处理 401/403、金额与接口明显不一致、核心路由 404。

## 2. 测试用例

| 用例编号 | 描述 | 前置 | 步骤 | 预期 | 边界 |
|----------|------|------|------|------|------|
| TC-W-001 | 钱包页加载 | 学员已登录，后端可用 | 打开 `/wallet`（或 plan 中最终路径） | 显示余额、加载失败有提示 | token 过期 → 跳转登录 |
| TC-W-002 | Mock 充值 | 同左 | 输入合法金额，提交 | `topup` 成功，余额增加，流水出现 `topup` | 负数/超大值被拒或提示 |
| TC-W-003 | 流水列表 | 有至少一笔 topup | 打开流水区/页 | 分页或列表与 `GET /wallet/transactions` 一致 | 空列表友好文案 |
| TC-VQ-001 | VietQR 展示 | 静态资源已部署到 `public` 或等价路径 | 打开含充值说明的区域 | 图片可加载、账户文案可读 | 图片 404 → 失败 |
| TC-PO-001 | 付款单详情 | 存在 `payment_order_id`（可由预约课产生或测试数据） | 学员打开详情页 | 与 `GET /payments/orders/{id}` 一致 | 非本人/非教师 → 403 有提示 |
| TC-PO-002 | 非法 ID | 已登录 | 访问伪造 UUID | 404/错误提示，不崩溃 | — |
| TC-PY-001 | 教师出款列表 | 教师已登录，有/无 payout | 打开出款页 | 与 `GET /payouts/me` 一致 | 空列表 OK |
| TC-C-001 | 凭证占位 | 按 plan 实现的入口 | 上传或提交占位 | 列表出现「待核对」 | 大文件可选仅前端校验 |
| TC-C-002 | 人工对账 MVP | 运营/开发可见 dev 按钮（若有） | 点击「确认到账」类 Mock | 仅验证不崩溃、状态符合 plan（若有后端再测） | 生产构建不应出现 |

## 3. 覆盖率要求（本 Spike）

- **单元测试**：对纯展示/格式化函数若有抽取，目标 **>60%**（可选）；**不强制**全项目 80%。
- **功能覆盖**：上表 **TC-W-001～003、TC-VQ-001** 为 **P0**；**TC-PO-001、TC-PY-001** 为 **P0**（若本 Spike 排期内实现）；其余为 **P1**。
- **回归**：合并前在 Chrome 跑通 **P0** 手动清单；后端回归仍可用 `docker exec cnvn-api uv run python -m scripts.e2e_payment_test`（干净库）。

## 4. 测试环境

| 项 | 说明 |
|----|------|
| API | `docker-compose up -d db api`，宿主机 `http://localhost:8001` |
| 前端 | `pnpm dev` 或 compose `web`，`VITE_API_URL=http://localhost:8001` |
| 数据 | 可用全新卷或开发库；注意 `e2e_payment_test` 账本断言在**脏库**可能失败 |
| 账号 | 自备测试学员/教师；或使用脚本注册逻辑自建 |

## 5. 执行阶段（由 spec-tester / 开发者）

实现完成后：按本表执行 → 产出同目录 `test-report.md`（用例结果矩阵 + 阻塞项）；失败走 `spec-debug` 流程（若启用团队角色）。

## 6. 与 plan 的追溯

- 验收清单见 `plan.md` §验收；本 `test-plan.md` 将各条拆解为可执行用例。
- 双链：[[plan|Spike 方案]]
