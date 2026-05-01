---
title: 审查报告
type: review
status: done
created: 2026-05-01
updated: 2026-05-01
git_branch: fix/spec-20260501-1124-payment-consistency
result: 通过
plan: "[[../writer/plan|plan]]"
summary: "[[../executor/summary|summary]]"
test-report: "[[../tester/test-report|test-report]]"
tags:
  - spec
  - review
---

# 审查报告：支付托管退款结算一致性

## Findings

> [!success]
> 未发现必须交给 spec-debugger 的阻断问题。

### 无阻断发现

1. P0 范围控制符合计划，没有发现 P1/P2 能力混入。
   - Spec 要求：P0 仅处理 `<24h` 取消写 `held_until`、佣金有效完课统计和对应 pytest；不做 mock 生产门禁、DB 约束、真实渠道、运营后台、前端大改。见 [[../writer/plan|plan]] `需求边界` / `本 Spec 不做`。
   - 实现位置：`backend/app/services/lesson_service.py:291`-`300` 只读取活跃订单并在取消分支写 `held_until`；`backend/app/services/payment_service.py:66`-`84` 只调整佣金统计查询；未看到支付 API、DB migration、前端或渠道扩展。
   - 测试位置：`backend/tests/api/v1/test_payment_settlement.py:162`-`342` 只覆盖本轮支付一致性专项。

2. `<24h` 取消的 `held_until` 逻辑符合计划，时区处理没有发现当前阻断风险。
   - Spec 要求：`held_until = scheduled_at + duration + DISPUTE_WINDOW_HOURS`，订单保持 `held`，不退款、不 release。见 [[../writer/plan|plan]] `P0 范围` 和 `实现步骤`。
   - 实现位置：`backend/app/services/lesson_service.py:23`-`24` 通过 `ensure_utc(lesson.scheduled_at)` 计算课程结束时间；`backend/app/services/lesson_service.py:261`-`263` 用 UTC now 判断取消窗口；`backend/app/services/lesson_service.py:292`-`300` 明确 `>=24h` 退款，`<24h` 写 `held_until`。
   - 状态边界：`hours_until >= 24.0` 走退款，严格 `<24h` 才保留 held，符合计划描述；`order.status in ("held", "disputed")` 才写入，避免已退款订单被重写。
   - 测试位置：`backend/tests/api/v1/test_payment_settlement.py:162`-`193` 断言 `<24h` 后 `PaymentOrder.status == "held"` 且 `held_until` 与预期时间误差小于 1 秒；`backend/tests/api/v1/test_payment_settlement.py:196`-`222` 覆盖 `>=24h` 仍退款。

3. 佣金统计口径符合计划，不会把计划明确排除的课程计入。
   - Spec 要求：以有效完课为口径，排除 `cancelled`、`expired`，要求 `actual_end_at` 落在统计月份内，`reviewed` 且有 `actual_end_at` 必须参与统计。见 [[../writer/plan|plan]] `P0 范围` 和 `实现步骤`。
   - 实现位置：`backend/app/services/payment_service.py:66`-`73` 使用 `Lesson.status.notin_(("cancelled", "expired"))`、`Lesson.actual_end_at.is_not(None)` 和 `actual_end_at` 月份边界过滤。
   - 测试位置：`backend/tests/api/v1/test_payment_settlement.py:225`-`253` 覆盖 `reviewed`；`backend/tests/api/v1/test_payment_settlement.py:256`-`284` 覆盖按 `actual_end_at` 归属月份；`backend/tests/api/v1/test_payment_settlement.py:287`-`342` 覆盖 `cancelled`、`expired`、无 `actual_end_at` 不计入。

4. 测试夹具补 ledger seed 合理，属于测试环境初始化补齐，不是生产逻辑替代。
   - 背景：测试报告说明 `Base.metadata.create_all` 不跑 Alembic seed，run-002 与 run-004 因缺少固定 `ledger_accounts` 失败，补齐相关测试夹具后 run-003 专项和 run-005 组合回归均通过。见 [[../tester/test-report|test-report]] `测试过程中的修改记录` / `是否需要 debugger`。
   - 测试位置：`backend/tests/api/v1/test_payment_settlement.py:66`-`78` 只在专项测试内确保 `SYSTEM_ACCOUNT_CODES` 对应账户存在；`backend/tests/api/v1/test_payment_settlement.py:81`-`82` 在创建支付课程前调用。
   - 后补证位置：`backend/tests/api/v1/test_lessons.py:57`-`69` 同样只在课程 API 测试内初始化固定 ledger accounts；`backend/tests/api/v1/test_lessons.py:154` 和 `backend/tests/api/v1/test_lessons.py:274` 在会创建付款课程的用例前调用。
   - 该夹具没有修改生产 seed、模型或服务；符合本轮测试环境差异修正的边界。

5. reviewer 后补证组合回归已通过，原测试完整性风险解除。
   - 测试计划要求：补跑 `test_lessons.py + test_payment_settlement.py` 组合回归，覆盖课程预约/取消主路径与支付一致性专项共同运行。
   - 测试报告证据：[[../tester/test-report|test-report]] `测试概况` 和 `测试命令与结果` 记录最终 Run ID `20260501-1137-run-005`，命令为 `python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q`，结果 `9 passed, 4 warnings`。
   - 覆盖位置：`backend/tests/api/v1/test_lessons.py:117`-`185` 覆盖预约、确认、`>=24h` 取消退款主路径；`backend/tests/api/v1/test_lessons.py:242`-`284` 覆盖课程开始与结束；`backend/tests/api/v1/test_payment_settlement.py:163`-`342` 覆盖本 Spec 的支付托管、退款与佣金统计口径。

### 非阻断残余风险

1. 最终测试环境使用 Python 3.13.11，而项目规范为 Python 3.11。
   - 证据：`tester/artifacts/test-logs/20260501-1132-run-003/environment.txt` 记录 `python=Python 3.13.11`；[[../tester/test-report|test-report]] 已标记为残余风险。
   - 影响判断：专项测试与 reviewer 后补证组合回归均已通过，不构成本轮 debugger 阻断；后续全量或归档前用 Python 3.11 复核更稳妥。

## Open Questions

- `<24h` 取消对 `pending_confirmation` 与 `confirmed` 课程采用同一违约结算策略，当前实现沿用计划和支付规则；如果产品希望未确认课程不同处理，需要后续独立 Spec 明确。

## 结论

> [!success]
> 审查结论：通过。当前实现严格落在 P0 范围内，`<24h` 取消 held_until、佣金统计口径和专项 pytest 均符合 [[../writer/plan|plan]]。

- 完成度：已完成 P0 两个生产逻辑修复、5 个专项测试和 reviewer 后补证组合回归。
- 一致性：实现与计划一致；未发现时区或状态边界的阻断风险。
- 额外实现：未发现超出本 Spec 的生产能力扩展。
- 测试：`python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q` 已通过，结果 `9 passed, 4 warnings`；Python 3.11 复核仍是非阻断残余风险。
- 是否需要 debugger：不需要。
