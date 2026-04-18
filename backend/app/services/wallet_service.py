"""
钱包操作原语（plan.md §1.4 保留）。

本模块仅保留"用户可提现余额"相关的基础操作：
  - ensure_wallet / get_wallet_by_user_id
  - topup（MVP 模拟充值，留作当前学员充值入口）
  - list_transactions / count_transactions（前端钱包流水查询）

MVP 时期的课程扣款/退款/结算入账接口已删除（plan.md §5.5 S5.2）；
课程相关的所有资金动作统一由 `app.services.payment_service` 接管。
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Transaction, Wallet


async def get_wallet_by_user_id(
    db: AsyncSession, user_id: uuid.UUID, *, lock: bool = False
) -> Wallet | None:
    q = select(Wallet).where(Wallet.user_id == user_id)
    if lock:
        q = q.with_for_update()
    r = await db.execute(q)
    return r.scalars().first()


async def ensure_wallet(db: AsyncSession, user_id: uuid.UUID) -> Wallet:
    w = await get_wallet_by_user_id(db, user_id)
    if w:
        return w
    w = Wallet(user_id=user_id, balance=0)
    db.add(w)
    await db.flush()
    return w


async def topup(db: AsyncSession, user_id: uuid.UUID, amount: int) -> Wallet:
    """MVP 模拟充值（正整数）。本次不替换，保留作为学员充值入口。"""
    if amount <= 0:
        raise ValueError("充值金额必须为正数")
    await ensure_wallet(db, user_id)
    w = await get_wallet_by_user_id(db, user_id, lock=True)
    assert w is not None
    w.balance += amount
    w.updated_at = datetime.now(timezone.utc)
    db.add(
        Transaction(
            wallet_id=w.id,
            lesson_id=None,
            type="topup",
            amount=amount,
            description="模拟充值",
        )
    )
    await db.commit()
    await db.refresh(w)
    return w


async def count_transactions(db: AsyncSession, wallet_id: uuid.UUID) -> int:
    r = await db.execute(
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.wallet_id == wallet_id)
    )
    return int(r.scalar_one())


async def list_transactions(
    db: AsyncSession,
    wallet_id: uuid.UUID,
    *,
    page: int,
    page_size: int,
) -> tuple[list[Transaction], int]:
    total = await count_transactions(db, wallet_id)
    offset = (page - 1) * page_size
    r = await db.execute(
        select(Transaction)
        .where(Transaction.wallet_id == wallet_id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return list(r.scalars().all()), total
