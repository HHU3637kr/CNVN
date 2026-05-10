---
title: 问题诊断-场景测试账本全局余额假设错误
type: debug
category: 05-验证工程
status: confirmed
severity: 中
created: 2026-05-10
updated: 2026-05-10
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - debug
  - regression
---

# 问题诊断：场景测试账本全局余额假设错误

## 问题现象

`python scripts/verify.py --suite full` 中，完整后端套件跑到 `test_student_teacher_payment_release_scenario` 失败：

```text
assert accounts["escrow"] == 0
E assert 1500000 == 0
```

单独运行该场景测试通过。

## 根因分析

现有 API 测试会通过业务服务提交数据，`db_session.rollback()` 不能回滚已提交的历史账本余额。新增场景测试错误地假设自己是测试库中唯一资金流，断言全局账本账户绝对余额为 0 或本场景金额。

## 修复方案

在场景测试开始时记录 `ledger_accounts` 基线，最终断言本场景带来的增量：

- `escrow` 回到基线。
- `platform_revenue` 增加本单 commission。
- `tax_payable` 增加本单 vat + pit。
- `teacher_payable` 回到基线。

## 与 plan 的关系

该修复保持 `FR-002` 的资金守恒目标，但让场景测试适配完整回归套件。
