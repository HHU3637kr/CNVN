---
type: executor-summary
status: done
created: 2026-05-01
updated: 2026-05-01
git_branch: fix/spec-20260501-1124-payment-consistency
base_branch: feat/spec-20260501-1058-mvp-to-product-ready
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - executor-summary
---

# 执行总结：支付托管退款结算一致性

> [!success]
> 已按 [[../writer/plan|设计方案]] 完成 P0 服务端实现接管。本阶段未运行测试，测试文件由 spec-tester 后续接管。

## 变更文件

- `backend/app/services/lesson_service.py`
- `backend/app/services/payment_service.py`
- `spec/04-系统改进/20260501-1124-支付托管退款结算一致性/executor/summary.md`

## 接管的 WIP

- 接管并保留 TeamLead 在 `lesson_service.cancel_lesson` 中提前获取活跃 `PaymentOrder` 的改动。
- 接管并保留 TeamLead 在 `<24h` 取消分支写入 `order.held_until` 的改动。
- 接管并保留 TeamLead 在 `payment_service.resolve_commission_rate` 中将佣金统计从仅 `completed` 改为有效完课口径的改动。
- 未接管 `backend/tests/api/v1/test_payment_settlement.py` 的 WIP；该文件按用户要求不修改，后续交由 spec-tester 处理。

## 最终实现说明

### `<24h` 取消 held 订单到期释放

- `cancel_lesson` 现在会在判断取消窗口前获取课程的活跃订单。
- 当 `hours_until >= 24.0` 时，仍沿用原有全额退款路径，对 `held/disputed` 订单调用 `refund_payment_order`。
- 当 `hours_until < 24.0` 且活跃订单为 `held/disputed` 时，不退款、不 release，只写：
  - `held_until = lesson.scheduled_at + duration_minutes + settings.DISPUTE_WINDOW_HOURS`
- `_lesson_end` 已改为先对 `lesson.scheduled_at` 调用 `ensure_utc`，避免时区形态影响 `held_until` 与 `dispute_watcher` 的到期判断。
- 课程最终仍置为 `cancelled`，资金订单保持 `held/disputed`，由既有 `dispute_watcher.run_once` 在到期后释放 `held` 订单。

### 佣金统计有效完课口径

- `resolve_commission_rate` 不再只统计 `Lesson.status == "completed"`。
- 当前 P0 口径为：
  - `Lesson.teacher_id == teacher_id`
  - `Lesson.status NOT IN ("cancelled", "expired")`
  - `Lesson.actual_end_at IS NOT NULL`
  - `Lesson.actual_end_at` 落在目标月份内
- 因此 `reviewed` 且有 `actual_end_at` 的课程会进入月度小时统计。

## 未改内容

- 未修改 `review_service.py`；评价后将课程置为 `reviewed` 的既有行为保持不变。
- 未修改 `dispute_watcher.py`；本次依赖其既有 `status='held' AND held_until < now()` 扫描释放逻辑。
- 未修改任何测试文件；`backend/tests/api/v1/test_payment_settlement.py` 保持当前 WIP 状态。
- 未实现生产 mock 门禁、DB CHECK/trigger、真实支付渠道、运营后台、用户资料端点。
- 未做 release/refund 幂等性专项治理；现有服务内的幂等短路保持原样。

## 测试执行

> [!warning]
> 未运行测试。用户明确要求本阶段不要运行测试，后续由 spec-tester 执行并维护测试与运行账本。

## 给 tester 的验证建议

- 验证 `<24h` 学员取消后：
  - `Lesson.status == "cancelled"`
  - `PaymentOrder.status` 保持 `held`
  - `held_until` 等于课程计划结束时间加 `DISPUTE_WINDOW_HOURS`
- 验证 `>=24h` 取消仍走退款路径：
  - `PaymentOrder.status == "refunded"`
  - 学员钱包余额回补
  - 不遗留需要 watcher 释放的 held 状态
- 验证 `reviewed` 且有 `actual_end_at` 的历史课程参与 `resolve_commission_rate` 月度小时统计。
- 验证 `cancelled`、`expired`、无 `actual_end_at` 的课程不参与佣金阶梯统计。
- 建议补充自动释放链路：将 `<24h` 取消订单的 `held_until` 调整到过去，调用 `dispute_watcher.run_once`，断言仅释放一次且不重复生成 `SettlementSnapshot`、`PayoutOrder`、教师钱包流水。

## 文档关联

- 设计方案：[[../writer/plan|支付托管退款结算一致性]]
- 探索报告：[[../explorer/exploration-report|探索报告]]
- 测试计划：[[../tester/test-plan|测试计划]]
