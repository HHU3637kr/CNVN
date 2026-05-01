---
title: 后端执行总结
type: executor-summary
status: done
created: 2026-05-01
spec_dir: spec/03-能力交付/20260501-1123-课堂互动与课后评价闭环
git_branch: feat/spec-20260501-1339-classroom-review-flow
owner: backend spec-executor
tags:
  - spec
  - executor
  - backend
  - classroom
  - review
---

# 后端执行总结

## 实现范围

- 在 `backend/app/services/lesson_service.py` 新增 `require_lesson_classroom_access()`，复用现有参与者校验与 `_classroom_entry_state()`，对不可进入课堂状态抛出中文原因。
- 在 `backend/app/services/message_service.py` 将消息历史读取和聊天消息写入切换到课堂互动专用校验。
- 在 `backend/app/api/v1/lessons.py` 中：
  - `GET /lessons/{id}/messages` 对不可进入课堂返回 `400` 和对应原因。
  - WebSocket 鉴权、账号状态、参与者校验后，对不可进入课堂返回 `{type:error, code:classroom_unavailable, message:<reason>}` 并使用 `1008` 关闭。
  - 保留 `unauthorized`、`forbidden`、`not_found`、`invalid_json`、`unsupported`、`validation` 语义。
- 未修改 `GET /lessons/{id}` 详情接口语义，参与者仍可查看已完成、已取消等课程详情。
- 未修改支付核心状态机、钱包、结算快照、出款逻辑。

## 测试覆盖

- `backend/tests/api/v1/test_lesson_messages.py`
  - 调整 WS happy path 测试课程到可进入窗口内。
  - 补充消息历史对 `pending_confirmation`、过早 `confirmed`、窗口已过 `confirmed`、`cancelled`、`completed`、`reviewed` 的拒绝断言。
  - 补充 WebSocket 对不可进入课堂返回 `classroom_unavailable` 的断言。
  - 补充 WebSocket 空消息、超长消息返回 `validation` 且不落库的断言。
- `backend/tests/api/v1/test_reviews.py`
  - 补充评价成功后 `PaymentOrder.status` 与 `held_until` 不被改写的回归断言。
- 既有 `test_lessons.py`、`test_payment_settlement.py` 覆盖教师 start/end、`held_until`、`reviewed` 佣金阶梯统计等回归。

## 验证结果

执行命令：

```powershell
cd backend
python -m pytest tests/api/v1/test_lesson_messages.py tests/api/v1/test_lessons.py tests/api/v1/test_reviews.py tests/api/v1/test_payment_settlement.py -q
```

结果：

```text
31 passed, 4 warnings in 42.10s
```

说明：4 个 warnings 均为 FastAPI `on_event` 既有弃用警告，本次未处理。

## 剩余风险

- 本次按 P0 约束收紧互动课堂入口，课后聊天记录只读回放仍未开放；如产品需要 completed/reviewed 后可查看消息，需要另开只读学习记录 Spec。
- WebSocket 仍使用 query string JWT，短期 ticket 鉴权属于后续 P1。
- 房间广播仍为单进程内存实现，多实例实时互通不在本次范围。
