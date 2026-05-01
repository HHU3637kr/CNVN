import asyncio
import os
import sys
import uuid

from sqlalchemy import select

sys.path.insert(0, os.getcwd())

from app.database import async_session
from app.models.payment_order import PaymentOrder
from app.services.payment_service import release_payment_order


async def main(lesson_id: str) -> None:
    parsed_lesson_id = uuid.UUID(lesson_id)
    async with async_session() as db:
        result = await db.execute(
            select(PaymentOrder).where(
                PaymentOrder.lesson_id == parsed_lesson_id,
                PaymentOrder.status == "held",
            )
        )
        order = result.scalars().first()
        if order is None:
            raise RuntimeError(f"held payment order not found for lesson={lesson_id}")
        payout = await release_payment_order(db, order)
        await db.commit()
        print(f"released payment_order={order.id} payout_order={payout.id}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: release_payment.py <lesson_id>")
    asyncio.run(main(sys.argv[1]))
