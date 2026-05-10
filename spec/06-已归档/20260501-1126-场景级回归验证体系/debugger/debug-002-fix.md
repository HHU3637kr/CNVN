---
title: 修复总结-场景测试账本基线断言
type: debug-fix
category: 05-验证工程
status: fixed_pending_verification
created: 2026-05-10
updated: 2026-05-10
plan: "[[../writer/plan|plan]]"
debug: "[[debug-002|debug-002]]"
tags:
  - spec
  - debug-fix
  - regression
---

# 修复总结：场景测试账本基线断言

## 修改文件

| 文件 | 修改 |
|---|---|
| `backend/tests/scenarios/test_payment_release_scenario.py` | 增加 `baseline_accounts`，最终按账本增量断言 |

## 重新验证请求

请重新执行：

```bash
python scripts/verify.py --suite full
```
