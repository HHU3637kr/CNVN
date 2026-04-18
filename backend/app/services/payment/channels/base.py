"""支付渠道 Protocol 定义（plan.md §3.3.3 / FR-008）。"""
from __future__ import annotations

from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_order import PaymentOrder


class PaymentChannelAdapter(Protocol):
    """
    支付渠道统一接口。

    Mock 阶段：create_charge 同步置为 paid；handle_callback 幂等；refund 幂等。
    未来真实渠道接入时仅需实现本 Protocol，业务层（payment_service）无需改动。
    """

    channel: str

    async def create_charge(
        self, db: AsyncSession, order: PaymentOrder
    ) -> PaymentOrder:
        """对外部渠道发起扣款；成功后写 `paid_at`、`channel_txn_id` 并置 status='paid'。"""
        ...

    async def handle_callback(
        self, db: AsyncSession, payload: dict
    ) -> PaymentOrder:
        """渠道 webhook 回调入口；必须对重复 payload 幂等。"""
        ...

    async def refund(
        self, db: AsyncSession, order: PaymentOrder, amount: int
    ) -> PaymentOrder:
        """对外部渠道发起退款；Mock 阶段直接置 refunded。"""
        ...
