# 支付系统核心约束（v0.2+）

## 资金流状态机（不可绕过）

```
学员付款 → PaymentOrder: pending → paid → held
  课程完成 → 写 held_until = actual_end_at + 24h
  争议期过期 → dispute_watcher 释放 → released
                                       ↓
                                   PayoutOrder paid → 教师 Wallet 入账
取消 ≥24h → refunded（学员 Wallet 回款）
取消 <24h → Lesson=cancelled，PaymentOrder 保持 held（等课程应结束时间 + 24h 后自动结算给教师）
```

## 账本与钱包分工

- **系统户账本**（`ledger_accounts` 4 户：`escrow / platform_revenue / tax_payable / teacher_payable`）
  - 内部流转必须借贷平衡（`ledger_service.post_entries` sum=0）
  - 跨 Wallet 边界用 `post_single_entry`（单边 entry）
- **用户 Wallet**（`wallets`）= 学员可用余额 / 教师可提现余额
- **资金守恒不变量**：`Σ(ledger_accounts.balance) + Σ(wallets.balance) == Σ(Transaction[type='topup'].amount)`，任何业务事件后必须成立

## 不可变约束

- `SettlementSnapshot`：DB trigger 拒绝 UPDATE，只允许 INSERT / SELECT
- `LedgerEntry`：append-only，不允许 UPDATE / DELETE
- 单笔结算守恒（B2 决议）：`commission + vat + pit + net == gross`，由 `tax.base._compute_flat` 内置 `assert` 保证

## 禁止事项

- **禁止**在课程/钱包服务里直接调 `Wallet.balance +=/-=`，资金动作必须走 `payment_service` 或 `wallet_service`（用户充值端）
- **禁止**绕过 `TaxStrategy` 直接计算税额
- **禁止**新增"课程相关"的 wallet_service 函数（历史上的 `debit_for_lesson / credit_refund / credit_settlement` 已永久删除）
- **禁止**在 `Lesson` 上加结算相关冗余字段，结算数据一律查 `SettlementSnapshot`

## 新增支付渠道

1. `app/services/payment/channels/<name>.py` 实现 `PaymentChannelAdapter` Protocol
2. 在 `channels/__init__.py` 的 `_REGISTRY` 注册
3. 无需改动 `payment_service` 与业务层

## 新增税务场景

1. `app/services/tax/<scenario>.py` 或扩展 `_FlatRateStrategy` 子类
2. 在 `tax/base.py` 的 `_STRATEGY_REGISTRY` 注册
3. `TeacherTaxProfile.tax_scenario` 枚举同步扩展

来源：`@spec/03-功能实现/20260418-1810-支付系统合规改造/plan.md` §3、§6.1
