# 开发原则

- 当前阶段为 v0.2+，前后端均已落地，不再 Mock 优先
- 新功能必须按 Spec 驱动流程开发
- 支付相关改动遵循 payment-system.md
- 重构遵循 refactor-principle.md，彻底替换旧实现
- MVP 阶段的 Mock 优先原则只作为历史记录，不作为当前默认策略
- Alembic `revision` / `down_revision` 必须不超过 32 字符；新增或修改迁移后必须通过空库 `alembic upgrade head` 验证
- 本地回归优先使用统一命令：`python scripts/verify.py --suite smoke` 或 `python scripts/verify.py --suite full`

