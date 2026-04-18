"""
争议期看门狗（plan.md §3.3.5 / FR-007）。

周期性扫描 `PaymentOrder.status='held' AND held_until < now()` 的订单，
使用 `FOR UPDATE SKIP LOCKED` 并发幂等地触发 `release_payment_order`。

调度：FastAPI 启动时创建一个 asyncio.create_task 的周期协程（间隔
`settings.DISPUTE_WATCHER_INTERVAL_SECONDS`）。生产环境后续可替换为
Celery / APScheduler，本次不引入新依赖。
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models.payment_order import PaymentOrder
from app.services import payment_service

logger = logging.getLogger(__name__)

_MAX_RETRY = 3


async def _release_one(db: AsyncSession, order: PaymentOrder) -> None:
    try:
        await payment_service.release_payment_order(db, order)
        await db.commit()
    except Exception as e:  # noqa: BLE001
        await db.rollback()
        # 重新 lock 以记录错误（避免因 rollback 丢失状态）
        r = await db.execute(
            select(PaymentOrder).where(PaymentOrder.id == order.id).with_for_update()
        )
        fresh = r.scalars().first()
        if fresh is None:
            return
        fresh.retry_count = (fresh.retry_count or 0) + 1
        fresh.last_error = f"{type(e).__name__}: {e}"[:1000]
        fresh.updated_at = datetime.now(timezone.utc)
        # 超过重试次数保持 held 状态，转人工处理（plan.md §6.1 dispute_watcher 重试规则）
        if fresh.retry_count >= _MAX_RETRY:
            logger.error(
                "dispute_watcher: order %s 已达最大重试次数，转人工处理", fresh.id
            )
        await db.commit()


async def run_once(
    db: AsyncSession, *, batch_size: int | None = None
) -> int:
    """
    扫描过期的 held 订单并触发 release，返回处理条数。

    使用 `FOR UPDATE SKIP LOCKED` 保证多实例并发幂等。
    """
    limit = batch_size or settings.DISPUTE_WATCHER_BATCH_SIZE
    now = datetime.now(timezone.utc)

    r = await db.execute(
        select(PaymentOrder)
        .where(
            PaymentOrder.status == "held",
            PaymentOrder.held_until.is_not(None),
            PaymentOrder.held_until < now,
            PaymentOrder.retry_count < _MAX_RETRY,
        )
        .order_by(PaymentOrder.held_until.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    orders = list(r.scalars().all())
    if not orders:
        return 0

    count = 0
    for order in orders:
        await _release_one(db, order)
        count += 1

    return count


async def _run_forever() -> None:
    interval = settings.DISPUTE_WATCHER_INTERVAL_SECONDS
    logger.info("dispute_watcher 启动，间隔 %ds", interval)
    while True:
        try:
            async with async_session() as db:
                processed = await run_once(db)
            if processed:
                logger.info("dispute_watcher: 本轮处理 %d 单", processed)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("dispute_watcher 异常，下一轮继续")
        await asyncio.sleep(interval)


_task: asyncio.Task | None = None


def start_background_task() -> None:
    """FastAPI 启动时调用。"""
    global _task
    if _task is not None and not _task.done():
        return
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_run_forever(), name="dispute_watcher")


async def stop_background_task() -> None:
    global _task
    if _task is None:
        return
    _task.cancel()
    try:
        await _task
    except (asyncio.CancelledError, Exception):
        pass
    _task = None
