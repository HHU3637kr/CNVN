---
title: 支付前端与 VietQR 验证 — 实现总结
type: summary
status: 待测试确认
created: 2026-04-21
execution_mode: single-agent
tags:
  - spike
  - payment
  - frontend
related:
  - "[[plan|Spike 方案]]"
  - "[[test-plan|测试计划]]"
---

# 支付前端与 VietQR 验证 — 实现总结

## 实现概述

按 [[plan|plan.md]] 完成 **路径 B 核心页** 与 **路径 C 最小占位**：学员钱包（真实 API）、VietQR 静态展示、Mock 充值、流水、线下转账「待核对」列表（`localStorage` + dev 模拟核对）、付款单 UUID 跳转详情、教师出款列表。

> [!note] 测试
> 已撰写 [[test-plan|test-plan.md]]；**test-report.md** 需在浏览器按用例执行后补全。

## 变更清单

| 区域 | 说明 |
|------|------|
| `frontend/public/payment/vietqr.png` | 从 `docs/验证银行卡/支付二维码.png` 复制，供静态展示 |
| `frontend/src/app/lib/api.ts` | 默认 `VITE_API_URL` 回退改为 `http://localhost:8001`（与 compose 一致） |
| `frontend/src/app/types/api.ts` | 新增 `TransactionOut`、`PaymentOrderDetail`、`SettlementSnapshotOut`、`PayoutOrderOut` |
| `frontend/src/app/pages/Wallet.tsx` | 钱包 / VietQR / Mock 充值 / 流水 / 线下占位 / 付款单入口 |
| `frontend/src/app/pages/PaymentOrderDetail.tsx` | `GET /payments/orders/:orderId` |
| `frontend/src/app/pages/Payouts.tsx` | `GET /payouts/me` |
| `frontend/src/app/routes.tsx` | 路由 `/wallet`、`/payments/orders/:orderId`、`/payouts` |
| `frontend/src/app/Layout.tsx` | 导航：钱包、出款单（教师下拉 + 移动菜单） |
| `frontend/src/app/pages/StudentDashboard.tsx` | 充值 / 明细 → `/wallet` |
| `frontend/src/app/pages/TeacherDashboard.tsx` | 出款单按钮 → `/payouts` |
| `docker-compose.yml` | API 宿主机端口 `8001:8000`；`VITE_API_URL` 注释对齐（此前会话已改） |
| `spec/.../test-plan.md` | 新增 |
| `spec/.../plan.md` | `related` 增加 test-plan；MVP 决议已存在 |

## 未实现 / 后续

- 预约成功后自动带出 `payment_order_id`（需 lesson 详情接口或扩展列表字段）。
- 线下转账与平台钱包入账的**后端**关联、运营后台正式流程。
- `test-report.md` 与归档到 `06-已归档`（待你确认测试通过）。

## 本地验证建议

1. `docker-compose up -d db api`，`docker exec cnvn-api uv run alembic upgrade head`（新库）。
2. `cd frontend && pnpm dev`，浏览器打开 `http://localhost:5173`，`VITE_API_URL=http://localhost:8001`。
3. 登录学员 → `/wallet`：Mock 充值、看流水、看 VietQR；dev 下登记线下待核对并点「模拟已核对」。
4. 教师账号 → `/payouts`（需已有 payout 数据方有列表，可先跑后端 `e2e_payment_test` 造数据）。
