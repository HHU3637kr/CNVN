# 支付系统核心约束

- 资金动作必须走 payment_service 或用户充值端 wallet_service
- 禁止在课程、钱包或其他业务服务中直接修改 Wallet.balance
- PaymentOrder 状态机：pending -> paid -> held -> released/refunded
- 课程完成后写 held_until = actual_end_at + 24h，争议期后释放
- 取消 >=24h 退款；取消 <24h 保持 held 并按应结束时间后结算给教师
- ledger_accounts 内部流转必须借贷平衡，跨 Wallet 边界用单边 entry
- 资金守恒：ledger_accounts 总额 + wallets 总额 == topup 交易总额
- SettlementSnapshot 只允许 INSERT / SELECT；LedgerEntry append-only
- 结算守恒：commission + vat + pit + net == gross
- 禁止绕过 TaxStrategy 直接计算税额
- 禁止新增课程相关 wallet_service 函数
- 禁止在 Lesson 上新增结算冗余字段，结算数据查 SettlementSnapshot
- 新支付渠道只新增 channel adapter 并注册到 payment channels registry
- 新税务场景只扩展 tax strategy 并同步 TeacherTaxProfile.tax_scenario

