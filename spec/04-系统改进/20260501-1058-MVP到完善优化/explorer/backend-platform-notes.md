---
title: 后端平台探索笔记
type: exploration-notes
owner: backend_platform_explorer
created: 2026-05-01
spec_dir: spec/04-系统改进/20260501-1058-MVP到完善优化
status: done
---

# 后端平台探索笔记

## 0. 范围与依据

本轮只审视后端从 MVP 到产品化完善的缺口，重点阅读：

- `backend/app/api/v1`
- `backend/app/models`
- `backend/app/schemas`
- `backend/app/services`
- `backend/alembic`
- `backend/tests`
- `.agents/rules/payment-system.md`
- 历史 Spec：后端全局架构、认证、教师、预约、评价、课堂 WebSocket、支付模块、支付系统合规改造、支付前端与 VietQR spike

本轮未运行测试，避免产生除本 notes 之外的工作区写入。只执行了只读检查，包括 `rg`、`Get-Content`、`alembic heads`。`alembic heads` 当前返回单一 head：`003_drop_settlement`。

## 1. 已实现后端能力

### 1.1 API 能力

当前 v1 API 已覆盖 MVP 主链路：

| 模块 | 已实现端点 | 说明 |
|---|---|---|
| 认证 | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/switch-role`, `/auth/become-teacher` | 注册自动创建钱包；单账号多角色；JWT Bearer 鉴权 |
| 用户 | `/users/me` GET/PUT | 仍是 `501 Not implemented`，与 `/auth/me` 重叠但未落地 |
| 教师 | `/teachers`, `/teachers/{id}`, `/teachers/{id}/reviews`, `/teachers/{id}/availability`, `/teachers/profile` | 公开搜索/详情/评价/时段；本人档案创建和更新 |
| 税务档案 | `/teachers/me/tax-profile` GET/PATCH | 教师税务档案惰性创建，默认 `vn_resident` |
| 可用时段 | `/availability` GET/POST/PUT/DELETE | 教师本人时段 CRUD，预约时按越南本地时区校验 |
| 课程 | `/lessons` CRUD-ish 状态流；`/lessons/{id}/messages`; `/lessons/{id}/ws` | 预约、确认、取消、开始、结束、消息历史、WebSocket 聊天 |
| 评价 | `/reviews`, `/reviews/{id}` | 学员对 completed 课程评价，更新教师平均分和评价数 |
| 钱包 | `/wallet`, `/wallet/transactions`, `/wallet/topup` | MVP 模拟充值、余额、流水 |
| 支付/出款 | `/payments/orders`, `/payments/webhook/mock`, `/payments/orders/{id}`, `/payouts/me` | v0.2 支付订单、Mock webhook、付款详情含结算快照、教师出款查询 |

### 1.2 数据模型能力

核心数据模型已比较完整：

- `User`：邮箱/手机号、角色数组、活跃角色、禁用状态。
- `TeacherProfile`：教师公开档案、费率、类型、专长、评分与排序冗余字段。
- `Availability`：周期或指定日期的教师可授课时段。
- `Lesson`：学员、教师档案、排课时间、时长、状态、价格、取消原因、实际起止时间。
- `Review`：一课一评、评分维度、评价内容。
- `Message`：课堂文本消息。
- `Wallet` / `Transaction`：用户侧可用余额与流水。
- `PaymentOrder` / `PayoutOrder` / `SettlementSnapshot`：支付订单、教师出款单、不可变结算快照。
- `LedgerAccount` / `LedgerEntry`：系统户账本，含 escrow、platform_revenue、tax_payable、teacher_payable 四类账户。
- `TeacherTaxProfile`：教师税务场景、证件、越南税号、居住天数字段。

### 1.3 服务层能力

后端已形成 `api -> services -> models` 的基本分层：

- `auth_service`：注册、登录、刷新 token、切换角色、开通教师。
- `teacher_service`：教师搜索、详情、档案创建/更新。
- `availability_service`：时段 CRUD、越南本地时区课时覆盖校验。
- `lesson_service`：预约状态机、冲突检测、过期 pending 课自动退款、创建支付订单、完课写争议期。
- `payment_service`：订单创建、托管、退款、释放、结算快照、出款、阶梯佣金。
- `ledger_service`：平衡分录与跨 Wallet 边界单边分录。
- `tax/base.py`：三税务场景策略注册，当前共享固定 10% 税率骨架。
- `dispute_watcher`：周期扫描 `held_until < now` 的 held 订单，用 `FOR UPDATE SKIP LOCKED` release。
- `message_service` / `lesson_room`：课堂消息持久化和单进程内 WebSocket 广播。
- `review_service`：评价写入、重复评价保护、教师评分聚合。

### 1.4 迁移与支付合规能力

支付合规改造已按历史 Spec 基本落地：

- `002_add_payment_v2_tables.py` 新增支付 v2 表、seed 四个 ledger accounts、回填默认 tax profile。
- `003_drop_settlement.py` 删除 `Lesson.settled_at / teacher_amount / platform_fee_rate`，结算数据统一查 `SettlementSnapshot`。
- `SettlementSnapshot` 有 `BEFORE UPDATE` trigger，拒绝 UPDATE。
- `payment_orders` 有 `UNIQUE (lesson_id) WHERE status <> 'refunded'`，避免同一课程多条活跃订单。
- 历史 E2E 脚本 `backend/scripts/e2e_payment_test.py` 覆盖过：下单扣款、托管、完课写 `held_until`、手动 release、资金守恒。

## 2. API / 数据模型 / 事务 / 安全 / 支付风险

### 2.1 API 风险

1. **用户资料端点仍是 501**
   - `backend/app/api/v1/users.py:12`、`:21` 仍直接抛 `501 Not implemented`。
   - 产品化后 `/users/me` 是前端个人中心自然入口，当前只能绕到 `/auth/me`，更新资料也不可用。

2. **Mock 支付 webhook 无鉴权且未按环境关闭**
   - `POST /api/v1/payments/webhook/mock` 无 `get_current_user`、无签名校验、无 `APP_ENV` 限制。
   - 当前 Mock 只影响 pending 订单，但生产暴露该端点会给后续真实支付接入留下高风险口子。

3. **`/wallet/topup` 仍是无限额模拟充值**
   - 当前产品若进入真实用户阶段，模拟充值必须隐藏、限环境或替换为真实充值流程。
   - 否则用户可以无成本增加 Wallet.balance。

4. **WebSocket token 放 query string**
   - `/lessons/{lesson_id}/ws?access_token=...` 容易进入日志、浏览器历史或代理追踪。
   - MVP 可接受；产品化建议改为子协议、短期一次性 ticket 或握手后认证消息。

5. **缺少管理/运营 API**
   - 目前没有 dispute 创建/处理、人工退款、人工 release、账本对账、订单检索、教师 KYC 审核等后台 API。
   - 支付合规骨架有数据模型，但运营闭环不足。

### 2.2 数据模型风险

1. **状态字段大量使用裸字符串，DB 层未约束**
   - `Lesson.status`、`PaymentOrder.status`、`PayoutOrder.status`、`Transaction.type`、`TeacherTaxProfile.tax_scenario` 都主要靠应用层约束。
   - `PAYMENT_ORDER_STATUSES` / `PAYOUT_ORDER_STATUSES` 常量存在，但没有 `CHECK` 约束或 Enum 映射。

2. **账本 append-only 不完整**
   - 规范要求 `LedgerEntry append-only`，当前只有代码注释和服务层约定，DB 没有阻止 UPDATE/DELETE。
   - `SettlementSnapshot` 只拒绝 UPDATE，不拒绝 DELETE；规范写的是只允许 INSERT/SELECT。

3. **Availability 更新可破坏创建时语义**
   - `AvailabilityCreate` 禁止同时传 `day_of_week` 与 `specific_date`，但 `AvailabilityUpdate` 和 DB 约束只保证至少一个不为空，未禁止两者同时存在。
   - 这会让一次性时段/周期时段语义变模糊。

4. **教师排序冗余字段未系统同步**
   - `avg_rating` / `total_reviews` 在评价写入后同步。
   - `total_lessons` 和 `response_rate` 没看到完课或确认链路同步，教师推荐排序依赖这些字段，会长期失真。

5. **评价状态与结算状态耦合过紧**
   - `review_service.create_review` 会把 `Lesson.status` 从 `completed` 改为 `reviewed`。
   - `payment_service.resolve_commission_rate` 只统计 `Lesson.status == "completed"` 的课程，若学员在争议期 release 前先评价，本课和历史 reviewed 课都可能不计入阶梯费率。

### 2.3 事务与并发风险

1. **24h 内取消资金可能永久 held**
   - 支付 Spec B1 明确要求：`<24h` 取消时 `held_until = scheduled_at + duration + 24h`，之后 release 给教师。
   - 当前 `lesson_service.cancel_lesson` 在 `<24h` 分支只设置 `lesson.status = "cancelled"`，没有写 `PaymentOrder.held_until`。
   - `dispute_watcher` 只扫描 `held_until is not null AND held_until < now`，所以这笔订单不会被自动 release。

2. **创建预约的冲突检测无锁或排他约束**
   - `_has_overlap` 先查已有课程再插入；没有 PostgreSQL exclusion constraint，也没有教师/学员时间窗锁。
   - 并发下同一教师或同一学员可被重复预约同一时段。

3. **release 幂等主要依赖调用方锁**
   - `dispute_watcher.run_once` 有 `FOR UPDATE SKIP LOCKED`。
   - 但 `payment_service.release_payment_order` 本身接收未必加锁的 `PaymentOrder` ORM；未来新增手动 release API 时若不先锁订单，可能触发重复快照唯一约束或非幂等异常。

4. **外部渠道语义与 Wallet 扣款顺序未产品化**
   - `create_order_for_lesson` 先 `adapter.create_charge`，再检查和扣 Wallet。
   - Mock 下可回滚；真实外部渠道下如果已扣第三方资金但 Wallet 余额不足，会出现渠道资金与平台账不一致。

### 2.4 安全风险

1. **默认 JWT secret 是开发占位**
   - `JWT_SECRET_KEY = "your-super-secret-key-change-in-production"`。
   - 部署前必须强制从环境变量注入，并在启动时拒绝默认值。

2. **Refresh token 无撤销与轮换落库**
   - 当前 refresh token 是纯 JWT，无黑名单、无设备会话、无重放检测。
   - 账号退出、密码变更、疑似泄露后无法服务端失效。

3. **缺少认证限流与审计**
   - 登录、注册、充值、支付、webhook 都没有速率限制、IP 风控、审计日志。

4. **税务/KYC 字段未加密或脱敏策略**
   - `id_doc_no`、`vn_tax_code` 直接普通字段存储并直接返回给教师本人。
   - 后续如果有后台或日志输出，需要字段级脱敏与访问审计。

### 2.5 支付风险

1. **资金核心规则与代码存在关键不一致**
   - `<24h` 取消缺 `held_until` 是当前最高优先级支付缺陷。
   - 直接影响托管资金释放，属于资金滞留风险。

2. **税务策略是占位骨架**
   - 三场景当前共享固定 10%、VAT=0。
   - 与越南居民累进 PIT、VAT 门槛、跨境/中越税务合规仍有距离，不能当真实税务结论使用。

3. **支付通道仍是 Mock**
   - `DEFAULT_PAYMENT_CHANNEL = "mock"`。
   - 尚无 VietQR/VNPay/MoMo 的创建、回调签名、幂等事件 ID、退款闭环。

4. **历史测试未覆盖支付边界**
   - 支付合规测试报告明确未覆盖 I-006~I-011、I-016~I-019、A-002~A-008、D-001。
   - 当前 pytest 目录也没有支付 v2 专项测试文件，只有历史 E2E 脚本。

## 3. P0 / P1 / P2 后端优化建议

### P0：先保住资金正确性和生产开关

1. **修复 `<24h` 取消资金滞留**
   - 在 `<24h` 取消时查活跃 `PaymentOrder`，保持 `held`，写 `held_until = scheduled_at + duration + DISPUTE_WINDOW_HOURS`。
   - 增加回归测试：取消后 watcher 到期 release，教师到账，资金守恒。

2. **修复评价与佣金阶梯统计冲突**
   - 短期：`resolve_commission_rate` 统计 `completed` + `reviewed`，或按 `actual_end_at is not null` 统计有效完课。
   - 中期：拆开 Lesson 生命周期、Review 状态、PaymentOrder 状态，不再用一个 `Lesson.status` 承载所有业务维度。

3. **禁用生产 Mock 资金入口**
   - `/wallet/topup`、`/payments/webhook/mock`、`DEFAULT_PAYMENT_CHANNEL=mock` 需要环境门禁。
   - `APP_ENV=production` 时拒绝启动默认 secret、mock channel、mock topup。

4. **补支付 v2 自动化测试**
   - 把 `backend/scripts/e2e_payment_test.py` 中的核心断言迁移为 pytest 集成测试。
   - 优先覆盖：资金守恒、`<24h` 取消、`>=24h` 取消、release 幂等、snapshot 不可变、ledger append-only。

5. **给预约冲突加并发保护**
   - 最稳妥方案：PostgreSQL range + exclusion constraint，按 teacher/student 分别约束非终态课时区间不重叠。
   - 次优方案：事务内对教师/学员未来课行加锁，但不如 DB 排他约束可靠。

### P1：补产品化后端闭环

1. **完成 `/users/me` GET/PUT**
   - 避免前端个人资料绕 `/auth/me`，并补手机号唯一冲突处理。

2. **落 DB 级状态和审计约束**
   - 给 `Lesson.status`、`PaymentOrder.status`、`PayoutOrder.status`、`Transaction.type`、`tax_scenario` 增加 CHECK。
   - 给 `ledger_entries` 加 UPDATE/DELETE 拒绝 trigger；给 `settlement_snapshots` 加 DELETE 拒绝 trigger。

3. **强化支付订单幂等**
   - 支付下单支持 idempotency key。
   - webhook 支持事件 ID、签名校验、重放保护。
   - `release_payment_order` 内部先锁订单并重新读状态，降低误用风险。

4. **实现真实支付/充值适配器**
   - VietQR/VNPay/MoMo 至少需要：创建支付意图、回调验签、异步确认、超时关闭、退款/冲正、渠道流水落库。

5. **建设运营后台 API**
   - 订单检索、账本账户余额、账本 entries、异常订单、重试、人工退款、争议处理、KYC 审核、税务资料审核。

6. **同步教师统计指标**
   - 完课/release 后更新或定期重算 `TeacherProfile.total_lessons`。
   - 根据确认及时率或消息响应更新 `response_rate`，否则 recommended 排序不可信。

7. **完善可用时段更新校验**
   - `AvailabilityUpdate` 应与创建一致：不能同时设置 `day_of_week` 和 `specific_date`，也不能全部为空。
   - 是否 recurring 与字段组合需要明确。

### P2：提高工程质量和演进性

1. **统一错误响应格式**
   - 现在多为 `detail: str`，建议建立错误 code、message、field 结构，便于前端和测试稳定匹配。

2. **减少路由内联查询**
   - 教师评价列表、税务档案 get-or-create 等可逐步下沉到 service，保持 API 薄层一致。

3. **补 OpenAPI 与前后端契约**
   - 生成/校验 API schema，避免前端对 `TeacherProfileOut` / `TeacherListItem` 字段差异做临时适配。

4. **WebSocket 多实例改造**
   - 当前 `lesson_room` 是单进程内存广播；多实例部署要上 Redis Pub/Sub 或消息总线。

5. **迁移目录清理**
   - `backend/alembic/versions/versions/e87ee08f5642_initial_schema.py` 是重复嵌套副本；虽然 `alembic heads` 当前正常，建议清理或确认不会干扰脚本发现。

## 4. 需要优先修复的缺陷或一致性问题

按优先级排序：

| 优先级 | 问题 | 影响 | 证据 |
|---|---|---|---|
| P0 | `<24h` 取消未写 `PaymentOrder.held_until` | 资金永久 held，教师无法结算，资金守恒表面成立但业务不可完成 | Spec 要求见 `支付系统合规改造/plan.md:172`；代码只退款 `>=24h`，随后 `lesson.status = "cancelled"` |
| P0 | 评价会把 `completed` 改成 `reviewed`，佣金统计只查 `completed` | 争议期内先评价会影响阶梯费率与教师到账金额 | `review_service.py` 设置 `reviewed`；`payment_service.resolve_commission_rate` 只筛 `Lesson.status == "completed"` |
| P0 | Mock topup/webhook/default channel 未生产禁用 | 真实用户阶段可被滥用或误接入假资金 | `wallet_service.topup`、`payments.mock_webhook`、`DEFAULT_PAYMENT_CHANNEL=mock` |
| P1 | 预约冲突检测无并发约束 | 双订同一教师/学员时间段 | `_has_overlap` 是普通查询，无 exclusion constraint |
| P1 | LedgerEntry / SettlementSnapshot 审计不可变性不足 | 账本可被 DB 直接 UPDATE/DELETE，审计不完整 | migration 只给 settlement_snapshots 加 UPDATE trigger |
| P1 | `/users/me` 未实现 | 用户资料更新闭环缺失 | `backend/app/api/v1/users.py` 两个 501 |
| P1 | 支付 v2 pytest 缺失 | 核心资金边界无法在常规 CI 中回归 | `backend/tests/api/v1` 无 payment v2 专项；历史报告也列未覆盖项 |
| P1 | DB 缺状态 CHECK | 非法状态可被写入，排查困难 | 状态常量存在但未入 DB 约束 |
| P2 | 教师排序指标不完整 | 搜索排序和推荐质量低 | `total_lessons` / `response_rate` 没看到同步逻辑 |

## 5. 建议测试重点

### 5.1 支付资金链路

必须补成 pytest 集成测试，并纳入 CI：

1. 学员 topup 后：`sum(ledger_accounts.balance) + sum(wallets.balance) == sum(topup transactions)`。
2. 预约成功：Wallet(student) 扣款、PaymentOrder held、escrow 增加、资金守恒。
3. `>=24h` 取消：PaymentOrder refunded、Wallet(student) 回款、escrow 减少、资金守恒。
4. `<24h` 取消：PaymentOrder held、`held_until = scheduled_at + duration + 24h`、watcher 到期 release、教师到账、资金守恒。
5. 完课：`held_until = actual_end_at + 24h`，未到期 watcher 不处理，到期 watcher 处理。
6. release：生成 SettlementSnapshot、PayoutOrder paid、教师 Wallet settlement transaction、账本四户余额正确。
7. 重复 release / 并发 release：不重复生成 snapshot、payout、wallet transaction。
8. refund after released：拒绝。
9. disputed 路径：目前模型有状态但 API 缺失，至少先测服务层拒绝/允许边界。

### 5.2 支付审计与约束

1. `SettlementSnapshot` UPDATE/DELETE 被 DB 拒绝。
2. `LedgerEntry` UPDATE/DELETE 被 DB 拒绝。
3. PaymentOrder 同一 lesson 活跃唯一索引。
4. `post_entries` 非平衡 entries 抛错。
5. 账本 `balance` 与 entries sum 一致。
6. 税务快照：`commission + vat + pit + net == gross`。
7. 阶梯费率边界：20h、20h+1min、50h、50h+1min。
8. `reviewed` 课程仍参与佣金阶梯统计。

### 5.3 预约与时段

1. 同一教师并发创建重叠课。
2. 同一学员并发创建重叠课。
3. 时段跨日拒绝。
4. `AvailabilityUpdate` 不能制造 `day_of_week` + `specific_date` 同时存在。
5. 取消/过期与 PaymentOrder 状态一致。
6. 开始/结束是否允许早于排课时间，需要产品决定后测试。

### 5.4 安全与 API

1. 默认 JWT secret 在 production 拒绝启动。
2. mock topup/mock webhook 在 production 返回 404/403。
3. WebSocket 无 token、伪 token、非参与者、禁用用户。
4. 登录/注册/refresh 异常路径与限流。
5. `/payments/orders/{id}` 只能学员本人或对应教师查看。
6. `/payouts/me` 只能教师本人查看。
7. `/teachers/me/tax-profile` 不泄漏其他教师税务信息。

### 5.5 回归测试整理

当前 pytest 覆盖认证、教师、预约、评价、课堂消息，但支付 v2 主要依赖历史 E2E 脚本。建议：

- 把 `backend/scripts/e2e_payment_test.py` 拆成可复用 fixture + pytest cases。
- 新增 `backend/tests/api/v1/test_payments.py` 和 `backend/tests/services/test_payment_service.py`。
- 测试报告里明确列过但未覆盖的 I-006~I-011、I-016~I-019、A-002~A-008、D-001 应优先补齐。

## 6. 给 writer / tester 的交接建议

- writer 不宜先做大规模重构，先把 P0 三件事写入第一阶段：`<24h` 取消释放、reviewed 参与结算统计、mock/secret 生产禁用。
- tester 的第一份测试计划应围绕资金守恒和状态机边界，而不是只跑 happy path。
- 支付相关实现必须继续遵守 `.agents/rules/payment-system.md`：资金动作走 `payment_service` 或用户充值端 `wallet_service`；课程相关不要新增 wallet_service 函数；结算数据查 `SettlementSnapshot`。
