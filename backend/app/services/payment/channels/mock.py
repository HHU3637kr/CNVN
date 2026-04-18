"""
Mock 支付渠道实现（plan.md §3.3.3）。

- create_charge：同步置为 paid，不经过异步 webhook
- handle_callback：幂等回调入口（测试工具与未来真实渠道共用）
- refund：立即置 refunded

职责边界：Mock 只管理 PaymentOrder 状态与 channel 字段；账本 entries 与
Wallet 变动由 payment_service 层负责。
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_order import PaymentOrder


class MockChannel:
    channel = "mock"

    async def create_charge(
        self, db: AsyncSession, order: PaymentOrder
    ) -> PaymentOrder:
        # 幂等：已经是 paid / held / released 的订单不再改写
        if order.status in ("paid", "held", "released"):
            return order
        if order.status != "pending":
            raise ValueError(
                f"mock.create_charge 仅接受 pending 订单，当前 status={order.status}"
            )
        order.status = "paid"
        order.paid_at = datetime.now(timezone.utc)
        if not order.channel_txn_id:
            order.channel_txn_id = f"mock-{uuid.uuid4().hex[:16]}"
        order.channel = self.channel
        await db.flush()
        return order

    async def handle_callback(
        self, db: AsyncSession, payload: dict
    ) -> PaymentOrder:
        """
        payload: {"order_id": "<uuid>", "event": "paid" | "failed"}
        """
        from sqlalchemy import select

        order_id_str = payload.get("order_id")
        if not order_id_str:
            raise ValueError("callback payload 缺少 order_id")
        try:
            order_id = uuid.UUID(str(order_id_str))
        except (TypeError, ValueError) as e:
            raise ValueError(f"非法 order_id: {order_id_str}") from e

        r = await db.execute(
            select(PaymentOrder).where(PaymentOrder.id == order_id).with_for_update()
        )
        order = r.scalars().first()
        if order is None:
            raise LookupError(f"order 不存在: {order_id}")

        event = payload.get("event", "paid")
        if event == "paid":
            # 幂等
            if order.status == "pending":
                order.status = "paid"
                order.paid_at = datetime.now(timezone.utc)
                if not order.channel_txn_id:
                    order.channel_txn_id = f"mock-cb-{uuid.uuid4().hex[:12]}"
        elif event == "failed":
            if order.status == "pending":
                order.status = "refunded"
                order.refunded_at = datetime.now(timezone.utc)
                order.last_error = "mock callback: failed"
        else:
            raise ValueError(f"未知 event: {event}")

        await db.flush()
        return order

    async def refund(
        self, db: AsyncSession, order: PaymentOrder, amount: int
    ) -> PaymentOrder:
        if order.status == "refunded":
            return order
        if order.gross_amount != amount:
            # Mock 阶段仅支持全额退款
            raise ValueError(
                f"mock 渠道仅支持全额退款：gross={order.gross_amount} 请求={amount}"
            )
        order.status = "refunded"
        order.refunded_at = datetime.now(timezone.utc)
        await db.flush()
        return order
