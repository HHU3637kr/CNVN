---
title: 测试计划
type: test-plan
status: draft
created: 2026-05-01
git_branch: fix/spec-20260501-1124-payment-consistency
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - test-plan
---

# 测试计划：支付托管退款结算一致性

## 验收标准

- P0 资金状态机回归均可由 pytest 自动验证，且不需要真实支付渠道。
- `<24h` 取消课程后，活跃 `PaymentOrder` 保持 `held`，并写入 `held_until = scheduled_at + duration_minutes + DISPUTE_WINDOW_HOURS`。
- `>=24h` 取消课程后，订单仍走立即退款路径，学员钱包余额回补，不能被 `<24h` 修复误改为 held。
- 佣金阶梯统计使用有效完课口径：`reviewed` 课程、或具备 `actual_end_at` 的有效课程应参与教师月完课时长统计。
- 非有效课程不计入佣金阶梯：`cancelled`、`expired`、无 `actual_end_at` 的未完成课程不得影响费率。
- release/refund 相关路径保持幂等，不重复生成钱包流水、结算快照或出款单；如本轮实现未覆盖，执行阶段需标记为未测风险。

## P0 必测用例

| 用例编号 | 优先级 | 描述 | 输入/准备 | 关键断言 | 证据 |
|---|---|---|---|---|---|
| TC-P0-001 | P0 | `<24h` 取消写 `held_until` | 创建已确认课程，手动将 `scheduled_at` 调整为当前 UTC 后 2 小时，学生取消 | `Lesson.status = cancelled`；`PaymentOrder.status = held`；`held_until` 非空且与计划结束时间 + 争议窗口误差小于 1 秒 | pytest 输出；DB 查询断言 |
| TC-P0-002 | P0 | `>=24h` 取消仍立即退款 | 创建未来 7 天已确认课程，学生取消 | `Lesson.status = cancelled`；`PaymentOrder.status = refunded`；学生钱包余额恢复到取消前扣款前金额；不写入需要争议释放的 held 状态 | pytest 输出；钱包接口响应 |
| TC-P0-003 | P0 | `reviewed` 课程参与佣金阶梯 | 为同一教师构造当月 21 小时 `reviewed` 完课记录 | `payment_service.resolve_commission_rate(...) == Decimal("0.15")`，不能回落到低时长阶梯 | pytest 输出；服务函数断言 |
| TC-P0-004 | P0 | `actual_end_at` 参与佣金阶梯 | 为同一教师构造具备 `actual_end_at` 的有效完课记录，状态覆盖 `completed` / `reviewed` | 统计月份按 `actual_end_at` 归属；达到阶梯阈值后费率正确 | pytest 输出；服务函数断言 |
| TC-P0-005 | P0 | 非有效课程不计入佣金阶梯 | 混入 `cancelled`、`expired`、无 `actual_end_at` 的课程记录 | 无效课程不增加教师月完课时长；费率不因这些记录被抬高 | pytest 输出；服务函数断言 |

## 回归范围

| 范围 | 文件 | 目的 |
|---|---|---|
| 支付结算专项 | `backend/tests/api/v1/test_payment_settlement.py` | 覆盖本 Spec 新增的 `<24h` held、佣金阶梯口径和无效课程排除 |
| 课程主路径回归 | `backend/tests/api/v1/test_lessons.py` | 确认预约、确认、`>=24h` 取消退款、上下课状态流转没有回归 |

## 测试命令

后端专项命令：

```powershell
cd backend
python -m pytest tests/api/v1/test_payment_settlement.py -q
```

后端课程+支付回归命令：

```powershell
cd backend
python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q
```

若本机已安装并启用 `uv`，可使用等价命令：

```powershell
cd backend
uv run pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q
```

## 测试环境要求

- Python 3.11 依赖已安装，且 `pytest`、`pytest-asyncio`、`asyncpg`、FastAPI 测试依赖可用。
- PostgreSQL 16 本机服务可连接。
- 测试库连接串来自 `backend/tests/conftest.py`：`postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/cnvn_test`。
- `cnvn_test` 数据库、`cnvn` 用户和密码 `cnvn_secret` 已创建，并允许本机 `localhost:5432` 连接。
- 当前 fixture 使用 `Base.metadata.create_all/drop_all` 建表和清表；执行前需确认测试库不承载真实数据。
- 测试使用 mock topup/mock payment 路径，不依赖真实 VietQR/VNPay/MoMo 渠道。

## 当前已知环境阻塞

| 阻塞编号 | 现象 | 影响 | 后续处理 |
|---|---|---|---|
| BLK-001 | 本机 `uv` 不存在 | 不能使用 `uv run pytest ...` 命令 | 执行阶段优先使用 `python -m pytest ...`，或由环境维护者安装 `uv` 后再执行等价命令 |
| BLK-002 | PostgreSQL 测试库 `cnvn_test` 连接被拒绝 | pytest 在 session fixture 建库阶段失败，无法进入用例断言 | 执行阶段需先启动 PostgreSQL，并确认 `cnvn_test` / `cnvn` / `cnvn_secret` 可连接 |

## 日志与审计要求

### 关键路径可观测性

- `<24h` 取消：保留 pytest 命令输出，并通过 DB 断言证明 `PaymentOrder.status` 与 `held_until`。
- `>=24h` 退款：保留 pytest 命令输出，并通过钱包余额或交易流水断言证明退款发生且没有进入永久 held。
- 佣金阶梯：保留 pytest 命令输出，并通过服务函数返回值断言证明 `reviewed` / `actual_end_at` 口径生效。
- 非有效课程排除：保留 pytest 命令输出，并通过费率或统计结果断言证明无效状态未被计入。

### 执行阶段测试证据目录规划

执行阶段每次测试运行创建独立目录：

```text
spec/04-系统改进/20260501-1124-支付托管退款结算一致性/tester/artifacts/test-logs/YYYYMMDD-HHMM-run-XXX/
├── pytest-payment-settlement.log
├── pytest-lessons-payment.log
├── environment.txt
└── failure-trace.txt
```

- `pytest-payment-settlement.log`：保存 `python -m pytest tests/api/v1/test_payment_settlement.py -q` 的原始输出。
- `pytest-lessons-payment.log`：保存 `python -m pytest tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q` 的原始输出。
- `environment.txt`：保存 Python、pytest、数据库连接可达性、当前分支和提交信息；不得包含 token、密码或真实用户隐私。
- `failure-trace.txt`：仅在失败时保存 pytest traceback、连接错误或环境错误摘要。

证据文件必须由测试命令或环境检查命令自动生成；不得在测试结束后手写或补造测试日志内容。

## 本阶段边界

- 本阶段只校准 `tester/test-plan.md`，不运行测试。
- 不修改业务代码、测试代码或 TeamLead / writer / explorer 产物。
- TeamLead 已知的试跑失败属于环境阻塞；执行阶段在 `tester/test-report.md` 中正式记录测试结果和阻塞证据。
