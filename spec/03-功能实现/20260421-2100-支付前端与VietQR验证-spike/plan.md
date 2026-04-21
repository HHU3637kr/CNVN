---
title: 支付前端与 VietQR 验证 — Spike
type: plan
category: 03-功能实现
status: 已实现待测
priority: 高
created: 2026-04-21
execution_mode: single-agent
tags:
  - spike
  - payment
  - frontend
  - vietqr
  - mock
related:
  - "[[../../06-已归档/20260418-1810-支付系统合规改造/summary|支付合规改造总结]]"
  - "[[../../context/knowledge/know-002-CNVN支付模块现状与缺口分析|支付模块现状]]"
  - "[[test-plan|测试计划]]"
  - "[[summary|实现总结]]"
  - "[[test-report|测试报告]]"
---

# 支付前端与 VietQR 验证 — Spike

## 背景

- **路径 A**（纯 Mock 后端）：已通过 `backend/scripts/e2e_payment_test.py` 在干净库验证全链路。
- 本 Spike **合并路径 B + C**，在一次迭代内可演示、可逐步逼近真实收款。

| 路径 | 内容 | Spike 内交付物 |
|------|------|----------------|
| **B** | 前端 UI + Mock 打通 | 钱包/充值/付款单状态/教师出款列表等最小页面，全部走现有 Mock API |
| **C** | VietQR 半自动核验 | 展示 `docs/验证银行卡` 中账户与二维码；上传转账凭证 + 后台/运营对账占位（可先 Mock「确认到账」按钮） |

## 目标（Spike 结束时可演示）

1. 学员：登录 → 钱包余额 → Mock 充值 → 预约并支付（与现有 `POST /lessons` + `PaymentOrder` 生命周期一致）→ 查看付款单状态。
2. 教师：查看与课程关联的收款/出款信息（`GET /payments/orders/{id}` / `GET /payouts/me` 能对应 UI）。
3. 充值页展示 **VietQR + 账户信息**（静态资源或从只读配置读取路径，不接真实 napas）。
4. **C 最小切片**：用户上传凭证（文件或占位 URL）→ 列表展示「待核对」；运营侧可先用 **开发环境 Mock 按钮** 调用现有能力模拟「银行已到账」（不实现真实银行回调）。

## 非目标（本 Spike 不做）

- 不接 VNPay / MoMo / napas247 正式 API。
- 不做生产级对账引擎、反洗钱、自动 OCR 识别转账截图。

## MVP 决议（2026-04-21）

- **越南本地转账（VietQR / 网银转账）**：不依赖第三方支付商户；到账确认 **暂以人工对账为主**（运营核对网银/流水或凭证后，在系统内确认）。
- **后续可增强**（不在本 Spike 必做）：转账备注绑定订单号、导入对账单批量核销、或银行/Open API 自动对账。

## 技术要点

- **Mock 优先**：页面数据以现有 OpenAPI 为准；缺字段用最小 Mock 补全。
- **VietQR 素材**：`docs/验证银行卡/支付二维码.png`、`账户信息.txt`；前端通过 `public/` 或 Vite 静态导入引用。
- **端口**：本地 API 默认 `http://localhost:8001`（与根目录 `docker-compose.yml` 一致）；前端 `VITE_API_URL` 已对齐。

## 任务拆分（建议顺序）

1. **路由与壳**：学生端「钱包」、教师端「收入/出款」入口（`frontend/src/app` 现有路由风格）。
2. **钱包页**：调 `GET /wallet`、`POST /wallet/topup`、`GET /wallet/transactions`。
3. **VietQR 区**：展示二维码 + 文案（账户号、银行、提示「越南本地转账」）；可选复制账号。
4. **付款单**：预约成功后跳转或链接到 `GET /payments/orders/{id}` 详情（学员 token）。
5. **教师出款**：`GET /payouts/me` 列表页。
6. **C 占位**：充值流水或单独「线下转账记录」表单项：上传文件 → `POST` 新 Mock 端点或仅存前端 state（Spike 可先前端 state + TODO）；运营确认按钮仅 `dev` 显示。

## 验收

- [ ] 浏览器完成一次与 E2E 脚本等价的用户旅程（充值 → 下单 → 教师确认/开始/结束 → 等待或调试用 watcher 后看到 released / 教师余额变化）——**争议期 24h 在 Spike 可接受「文档说明 + 调 held_until 的 dev 工具」暂不强制 UI 等待**。
- [ ] VietQR 与账户信息在 UI 可见、可读。
- [ ] 凭证上传 + 待核对列表有可点击原型（逻辑可 Mock）。

## 风险与备忘

- E2E 脚本 `e2e_payment_test.py` 对**系统户账本余额**使用绝对值断言；多次跑单后**脏库**会误失败。Spike 或后续可改为「本单增量」或测试库隔离。
- `docker-compose down -v` 会清空 Postgres 卷，仅用于本地验证。
