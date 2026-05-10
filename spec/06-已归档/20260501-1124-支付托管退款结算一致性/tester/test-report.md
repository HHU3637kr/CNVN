---
title: 测试报告
type: test-report
status: passed
created: 2026-05-01
updated: 2026-05-01
git_branch: fix/spec-20260501-1124-payment-consistency
plan: "[[../writer/plan|plan]]"
test-plan: "[[test-plan|test-plan]]"
tags:
  - spec
  - test-report
---

# 测试报告：支付托管退款结算一致性

## 测试概况

- 最终 Run ID: `20260501-1137-run-005`
- 最终测试命令：`python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q`
- 执行目录：`backend`
- 组合回归用例总数：9
- 通过：9
- 失败：0
- 阻塞：0
- 结论：reviewer 后补证组合回归通过；支付托管退款结算一致性专项测试保持通过。

## 测试过程中的修改记录

| 修改类型 | 描述 | 关联文件/证据 |
|---|---|---|
| 测试接管 | 接管 TeamLead WIP 测试文件，保留 `<24h` 取消和 `reviewed` 佣金测试方向 | `backend/tests/api/v1/test_payment_settlement.py` |
| 测试补齐 | 新增 `>=24h` 取消仍退款、`actual_end_at` 月份口径、非有效课程不计入佣金阶梯用例 | `backend/tests/api/v1/test_payment_settlement.py` |
| 测试夹具修正 | 测试库由 `Base.metadata.create_all` 建表，不跑 Alembic seed；在专项测试文件内补充固定 `LedgerAccount` 测试数据初始化 | `backend/tests/api/v1/test_payment_settlement.py` |
| 编译检查 | `python -m py_compile tests/api/v1/test_payment_settlement.py` 退出码 0 | `tester/artifacts/test-logs/20260501-1132-run-003/py-compile-test-payment-settlement.log` |
| reviewer 后补证夹具修正 | 组合回归中 `test_lessons.py` 也会创建付款课程；同样补充固定 `LedgerAccount` 测试数据初始化 | `backend/tests/api/v1/test_lessons.py` |
| reviewer 后补证编译检查 | `python -m py_compile tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py` 退出码 0 | `tester/artifacts/test-logs/20260501-1137-run-005/py-compile-lessons-payment.log` |

## 测试命令与结果

| Run ID | 命令 | 结果 | 证据 |
|---|---|---|---|
| `20260501-1128-run-001` | `python -m pytest tests/api/v1/test_payment_settlement.py -q` | 阻塞：PostgreSQL `cnvn_test` 连接被拒绝，5 个用例未进入业务断言 | `tester/artifacts/test-logs/20260501-1128-run-001/pytest-payment-settlement.log` |
| `20260501-1131-run-002` | `python -m pytest tests/api/v1/test_payment_settlement.py -q` | 2 failed, 3 passed；失败原因为测试库缺少固定 ledger account seed | `tester/artifacts/test-logs/20260501-1131-run-002/pytest-payment-settlement.log` |
| `20260501-1132-run-003` | `python -m pytest tests/api/v1/test_payment_settlement.py -q` | 5 passed, 4 warnings | `tester/artifacts/test-logs/20260501-1132-run-003/pytest-payment-settlement.log` |
| `20260501-1136-run-004` | `python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q` | reviewer 后补证首次组合回归：2 failed, 7 passed；失败原因为 `test_lessons.py` 未初始化固定 ledger account seed | `tester/artifacts/test-logs/20260501-1136-run-004/pytest-lessons-payment.log` |
| `20260501-1137-run-005` | `python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q` | reviewer 后补证组合回归通过：9 passed, 4 warnings | `tester/artifacts/test-logs/20260501-1137-run-005/pytest-lessons-payment.log` |

## 环境与阻塞处理

| 编号 | 状态 | 说明 | 证据 |
|---|---|---|---|
| BLK-001 | 非阻塞 | 本机 `uv` 仍未发现；本轮按要求使用 `python -m pytest`，未再尝试 `uv run` | `tester/artifacts/test-logs/20260501-1132-run-003/environment.txt` |
| BLK-002 | 已解除 | TeamLead 恢复 PostgreSQL 并确认 `cnvn_test` 后，pytest 可连接测试库并执行用例 | `tester/artifacts/test-logs/20260501-1131-run-002/pytest-payment-settlement.log` |
| BLK-003 | 残余风险 | 当前命令环境为 Python 3.13.11，项目规范期望 Python 3.11；本轮专项通过，但后续全量测试建议使用 3.11 复核 | `tester/artifacts/test-logs/20260501-1132-run-003/environment.txt` |
| BLK-004 | 已解除 | reviewer 后补证组合回归首次失败为 `test_lessons.py` 测试夹具缺少 ledger seed；已仅修改测试文件补齐 | `tester/artifacts/test-logs/20260501-1136-run-004/failure-trace.txt` |

## 用例执行状态

| 用例编号 | 描述 | 最终状态 | 结果说明 |
|---|---|---|---|
| TC-P0-001 | `<24h` 取消写 `held_until` | 通过 | `Lesson.status = cancelled`；`PaymentOrder.status = held`；`held_until` 与课程结束时间 + 争议窗口匹配 |
| TC-P0-002 | `>=24h` 取消仍立即退款 | 通过 | `PaymentOrder.status = refunded`；学生钱包余额由 440000 回补到 500000；未进入 held 释放路径 |
| TC-P0-003 | `reviewed` 课程参与佣金阶梯 | 通过 | 21 小时 `reviewed` 完课参与统计，费率为 `Decimal("0.15")` |
| TC-P0-004 | `actual_end_at` 参与佣金阶梯并按结束月份归属 | 通过 | 课程 `scheduled_at` 不在目标月但 `actual_end_at` 在目标月时参与统计，费率为 `Decimal("0.15")` |
| TC-P0-005 | 非有效课程不计入佣金阶梯 | 通过 | `cancelled`、`expired`、无 `actual_end_at` 课程未抬高费率，20 小时有效完课保持 `Decimal("0.2")` |

## 日志与审计证据

| 证据类型 | 路径 |
|---|---|
| run-001 环境信息 | `tester/artifacts/test-logs/20260501-1128-run-001/environment.txt` |
| run-001 pytest 输出 | `tester/artifacts/test-logs/20260501-1128-run-001/pytest-payment-settlement.log` |
| run-001 失败 trace | `tester/artifacts/test-logs/20260501-1128-run-001/failure-trace.txt` |
| run-002 环境信息 | `tester/artifacts/test-logs/20260501-1131-run-002/environment.txt` |
| run-002 pytest 输出 | `tester/artifacts/test-logs/20260501-1131-run-002/pytest-payment-settlement.log` |
| run-002 失败 trace | `tester/artifacts/test-logs/20260501-1131-run-002/failure-trace.txt` |
| run-003 环境信息 | `tester/artifacts/test-logs/20260501-1132-run-003/environment.txt` |
| run-003 pytest 输出 | `tester/artifacts/test-logs/20260501-1132-run-003/pytest-payment-settlement.log` |
| run-003 编译检查 | `tester/artifacts/test-logs/20260501-1132-run-003/py-compile-test-payment-settlement.log` |
| run-004 reviewer 后补证环境信息 | `tester/artifacts/test-logs/20260501-1136-run-004/environment.txt` |
| run-004 reviewer 后补证 pytest 输出 | `tester/artifacts/test-logs/20260501-1136-run-004/pytest-lessons-payment.log` |
| run-004 reviewer 后补证失败 trace | `tester/artifacts/test-logs/20260501-1136-run-004/failure-trace.txt` |
| run-005 reviewer 后补证环境信息 | `tester/artifacts/test-logs/20260501-1137-run-005/environment.txt` |
| run-005 reviewer 后补证 pytest 输出 | `tester/artifacts/test-logs/20260501-1137-run-005/pytest-lessons-payment.log` |
| run-005 reviewer 后补证编译检查 | `tester/artifacts/test-logs/20260501-1137-run-005/py-compile-lessons-payment.log` |

## 是否需要 debugger

不需要启动 spec-debugger。

run-002 与 run-004 的失败都是测试库建表方式与生产迁移 seed 差异导致的测试夹具问题：`Base.metadata.create_all` 不会执行 Alembic 中对 `ledger_accounts` 的固定账户插入。已在相关测试文件内初始化 `SYSTEM_ACCOUNT_CODES` 对应的 `LedgerAccount`，run-003 专项测试与 run-005 reviewer 后补证组合回归均已通过；没有生产代码缺陷证据。

## 最终测试结果

本轮最终结论为 **passed**。支付一致性 P0 专项测试已覆盖 `<24h` held_until、`>=24h` 退款、`reviewed`/`actual_end_at` 佣金统计口径，以及非有效课程排除口径。按 reviewer 非阻断建议补跑的 `test_lessons.py + test_payment_settlement.py` 组合回归已通过。当前无需 debugger handoff。

## 文档关联

- 设计文档：[[../writer/plan|设计方案]]
- 探索报告：[[../explorer/exploration-report|探索报告]]
- 执行总结：[[../executor/summary|执行总结]]
- 测试计划：[[test-plan|测试计划]]
