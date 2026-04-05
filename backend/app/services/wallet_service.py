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
    """MVP 模拟充值（正整数）。"""
    w = await ensure_wallet(db, user_id)
    w = await get_wallet_by_user_id(db, user_id, lock=True)
    assert w is not None
    w.balance += amount
    w.updated_at = datetime.now(timezone.utc)
    tx = Transaction(
        wallet_id=w.id,
        lesson_id=None,
        type="topup",
        amount=amount,
        description="模拟充值",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(w)
    return w


async def debit_for_lesson(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    lesson_id: uuid.UUID,
    description: str,
) -> Wallet:
    if amount <= 0:
        raise ValueError("扣款金额必须为正数")
    w = await get_wallet_by_user_id(db, user_id, lock=True)
    if w is None:
        raise ValueError("钱包不存在")
    if w.balance < amount:
        raise ValueError("余额不足")
    w.balance -= amount
    w.updated_at = datetime.now(timezone.utc)
    db.add(
        Transaction(
            wallet_id=w.id,
            lesson_id=lesson_id,
            type="payment",
            amount=-amount,
            description=description,
        )
    )
    return w


async def credit_refund(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    lesson_id: uuid.UUID,
    description: str,
) -> Wallet:
    if amount <= 0:
        raise ValueError("退款金额必须为正数")
    w = await get_wallet_by_user_id(db, user_id, lock=True)
    if w is None:
        raise ValueError("钱包不存在")
    w.balance += amount
    w.updated_at = datetime.now(timezone.utc)
    db.add(
        Transaction(
            wallet_id=w.id,
            lesson_id=lesson_id,
            type="refund",
            amount=amount,
            description=description,
        )
    )
    return w


async def count_transactions(db: AsyncSession, wallet_id: uuid.UUID) -> int:
    r = await db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.wallet_id == wallet_id)
    )
    return int(r.scalar_one())


async def credit_settlement(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    lesson_id: uuid.UUID,
    description: str,
) -> Transaction:
    """
    教师结算入账

    Args:
        db: 数据库会话
        user_id: 用户（教师）ID
        amount: 入账金额（正数）
        lesson_id: 关联课程ID
        description: 交易描述

    Returns:
        交易记录
    """
    if amount <= 0:
        raise ValueError("入账金额必须为正数")
    w = await get_wallet_by_user_id(db, user_id, lock=True)
    if w is None:
        raise ValueError("钱包不存在")
    w.balance += amount
    w.updated_at = datetime.now(timezone.utc)
    tx = Transaction(
        wallet_id=w.id,
        lesson_id=lesson_id,
        type="settlement",
        amount=amount,
        description=description,
    )
    db.add(tx)
    await db.flush()
    return tx


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
