---
type: executor-summary
role: backend spec-executor
status: completed
created: 2026-05-01
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - executor
  - backend
---

# 后端实现总结

## 实现范围

- 新增 `DisputeCase` / `DisputeEvent` 模型与 Alembic migration，包含活跃争议部分唯一索引。
- 新增争议 Schema、Service、API，并注册：
  - `POST /api/v1/disputes`
  - `GET /api/v1/disputes/my`
  - `GET /api/v1/disputes/{id}`
  - `GET /api/v1/ops/disputes`
  - `GET /api/v1/ops/disputes/{id}`
  - `POST /api/v1/ops/disputes/{id}/actions`
- 增加临时运营权限 `get_current_operator`：`roles` 含 `operator` 或 `admin` 即允许，不要求 `active_role`。
- 发起争议支持学生本人和课程教师；非参与者拒绝；重复 `open/processing` 争议返回 `409`。
- 发起争议时将 `PaymentOrder.status` 从 `held` 置为 `disputed`，并写入 `opened` 事件。
- 运营动作支持 `assign/add_note/refund/release/close_no_action`：
  - `refund` 只调用 `payment_service.refund_payment_order`。
  - `release` 在锁内将 `disputed` 受控恢复为 `held` 后调用 `payment_service.release_payment_order`。
  - `close_no_action` 只恢复 `held`，不释放资金。
- `dispute_watcher.run_once` 保持只扫 `held`，并显式排除存在 `open/processing` 争议的付款单。
- 新增 `backend/tests/api/v1/test_disputes.py` 覆盖发起、权限、重复、运营查询/处理、资金动作重复拒绝和 watcher skip。

## 修改文件

- `backend/app/models/dispute.py`
- `backend/app/models/__init__.py`
- `backend/alembic/versions/006_add_dispute_cases.py`
- `backend/app/schemas/dispute.py`
- `backend/app/dependencies.py`
- `backend/app/services/dispute_service.py`
- `backend/app/api/v1/disputes.py`
- `backend/app/api/v1/router.py`
- `backend/app/services/dispute_watcher.py`
- `backend/tests/api/v1/test_disputes.py`

## 测试结果

- `cd backend; pytest tests/api/v1/test_disputes.py -q`
  - 结果：`5 passed, 4 warnings`
- `cd backend; pytest tests/api/v1/test_disputes.py tests/api/v1/test_payment_settlement.py -q`
  - 结果：`11 passed, 4 warnings`
- `cd backend; pytest -q`
  - 结果：`59 passed, 4 warnings`

警告均为既有 FastAPI `on_event` deprecation warning，本次未处理。

## 剩余风险

- 运营权限仍是 Spec 要求的临时方案，未实现完整 RBAC、运营账号管理和审计策略。
- 人工 release 的 `disputed -> held -> release_payment_order` 过渡依赖当前事务锁和服务状态约束；后续若 payment service 改签名，需要同步回归。
- 本后端子任务未覆盖前端入口和 Chrome/CDP smoke，由前端/测试子 Agent 继续处理。
