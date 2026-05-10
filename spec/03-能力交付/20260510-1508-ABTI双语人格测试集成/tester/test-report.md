---
type: test-report
spec: 20260510-1508-ABTI双语人格测试集成
status: passed
created_at: 2026-05-10T15:18:00+08:00
updated_at: 2026-05-10T15:18:00+08:00
tags:
  - spec/test-report
  - frontend
---

# Test Report

## 自动验证

| command | result | artifact |
|---------|--------|----------|
| `pnpm build` | passed | `tester/artifacts/test-logs/20260510-1518-build/pnpm-build.log` |
| `git diff --check` | passed | terminal |

## 构建摘要

- Vite 成功构建。
- 转换模块数：1630。
- 输出 JS：约 431.61 kB，gzip 约 128.00 kB。
- 输出 CSS：约 115.74 kB，gzip 约 18.76 kB。

## 资产检查

- 结果图数量：32。
- 结果图总大小：约 7.1MB。
- 未提交原始 `ABTI/` 与 `ABTI.zip`。

## 残余风险

- 闽南语文案为站内初版，尚未做母语者审校。
