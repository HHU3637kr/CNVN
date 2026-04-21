---
title: 支付前端与 VietQR 验证 — 测试报告
type: test-report
status: 部分执行
created: 2026-04-21
test-plan: "[[test-plan|测试计划]]"
summary: "[[summary|实现总结]]"
tags:
  - spec
  - test-report
---

# 支付前端与 VietQR 验证 — 测试报告

## 环境

| 项 | 值 |
|----|-----|
| API | Docker `cnvn-api`，宿主机 `http://localhost:8001` |
| Web | Docker `cnvn-web`，`http://localhost:5173` |
| 浏览器 | Cursor IDE Browser（自动化） |

## 结果矩阵（首轮）

| 用例 | 结果 | 说明 |
|------|------|------|
| TC-W-001 钱包页加载 | **通过** | 登录后 `/wallet` 展示标题、余额区、各区块 |
| TC-W-002 Mock 充值 | **通过** | 默认 500000 VND 提交后余额变为 ₫500.000，流水出现 `topup` |
| TC-W-003 流水列表 | **通过** | 与充值后接口一致（至少 1 条 topup） |
| TC-VQ-001 VietQR 展示 | **部分** | 文案与章节存在；无障碍快照未包含 `<img>` 节点，需在浏览器目视确认 `/payment/vietqr.png` |
| TC-PO-001 / TC-PY-001 | **未执行** | 本轮未带入真实 `payment_order_id` / 教师 payout 数据 |
| TC-C-001 / TC-C-002 | **未执行** | 可后续手测「待核对」与 dev 按钮 |

## 阻塞与备注

- 无 CORS 报错（本轮未拉 Network，控制台未查）。
- 注册→登录→钱包路径在浏览器工具下跑通。

## 建议后续

- 目视确认 VietQR 图片加载。
- 跑通一次 `e2e_payment_test` 后，用返回的 `payment_order_id` 填 TC-PO-001。
- 教师账号登录后验证 `/payouts`。
