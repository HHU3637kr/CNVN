"""
系统户复式账本服务（plan.md §3.3.1）。

职责：
- 原子记账（借贷必须平衡）
- 查询账户余额
- 按业务引用查询 entries

只处理"系统户之间"的资金流转；用户 Wallet 的余额变动由 wallet_service 负责，
但两者通过业务层（payment_service）在同一事务中配对完成以保证资金守恒。
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import LedgerAccount, LedgerEntry


async def _get_account_by_code(
    db: AsyncSession, code: str, *, lock: bool = False
) -> LedgerAccount:
    q = select(LedgerAccount).where(LedgerAccount.code == code)
    if lock:
        q = q.with_for_update()
    r = await db.execute(q)
    account = r.scalars().first()
    if account is None:
        raise ValueError(f"ledger account 不存在: {code}")
    return account


async def post_entries(
    db: AsyncSession,
    *,
    entries: Sequence[tuple[str, int, str]],
    ref_type: str,
    ref_id: uuid.UUID | None,
    description: str,
) -> uuid.UUID:
    """
    原子记账。

    Args:
        entries: [(account_code, amount, direction), ...]
            amount 有符号（正=入账增加余额，负=出账减少余额），
            direction 仅为描述性冗余字段（'debit' / 'credit'）。
        ref_type: 业务引用类型（payment_order / payout_order / refund / manual / ...）
        ref_id: 业务对象 ID
        description: 人类可读描述

    Returns:
        txn_group_id（UUID）

    Raises:
        ValueError: 借贷不平衡（sum(amount) != 0）
    """
    if len(entries) == 0:
        raise ValueError("entries 不能为空")

    total = sum(amount for _, amount, _ in entries)
    if total != 0:
        raise ValueError(
            f"借贷不平衡：entries 累加 = {total}（必须为 0）"
        )

    txn_group_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    for code, amount, direction in entries:
        account = await _get_account_by_code(db, code, lock=True)
        account.balance += amount
        db.add(
            LedgerEntry(
                txn_group_id=txn_group_id,
                account_id=account.id,
                amount=amount,
                direction=direction,
                ref_type=ref_type,
                ref_id=ref_id,
                description=description,
                created_at=now,
            )
        )

    await db.flush()
    return txn_group_id


async def post_single_entry(
    db: AsyncSession,
    *,
    account_code: str,
    amount: int,
    direction: str,
    ref_type: str,
    ref_id: uuid.UUID | None,
    description: str,
    txn_group_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """
    记录单边 entry（plan.md §3.4）。

    用于跨"系统户 ↔ 用户 Wallet"边界的资金流转（学员付款入托管、
    退款出托管、教师 payout 出"教师应付户"）。此时账本本身不平衡，
    守恒不变量通过 "Σ(ledger) + Σ(wallet) = Σ(topup)" 在上层校验。
    """
    if amount == 0:
        raise ValueError("amount 不能为 0")

    account = await _get_account_by_code(db, account_code, lock=True)
    account.balance += amount

    tgid = txn_group_id or uuid.uuid4()
    db.add(
        LedgerEntry(
            txn_group_id=tgid,
            account_id=account.id,
            amount=amount,
            direction=direction,
            ref_type=ref_type,
            ref_id=ref_id,
            description=description,
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.flush()
    return tgid


async def get_balance(db: AsyncSession, code: str) -> int:
    """查询指定账户当前余额（从 balance 字段读）。"""
    account = await _get_account_by_code(db, code)
    return account.balance


async def sum_entries(db: AsyncSession, code: str) -> int:
    """按 entries 累加验证账户余额（用于一致性校验）。"""
    account = await _get_account_by_code(db, code)
    r = await db.execute(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.account_id == account.id
        )
    )
    return int(r.scalar_one())


async def list_entries_by_ref(
    db: AsyncSession, ref_type: str, ref_id: uuid.UUID
) -> list[LedgerEntry]:
    r = await db.execute(
        select(LedgerEntry)
        .where(LedgerEntry.ref_type == ref_type, LedgerEntry.ref_id == ref_id)
        .order_by(LedgerEntry.created_at.asc())
    )
    return list(r.scalars().all())


async def list_entries_by_group(
    db: AsyncSession, txn_group_id: uuid.UUID
) -> list[LedgerEntry]:
    r = await db.execute(
        select(LedgerEntry)
        .where(LedgerEntry.txn_group_id == txn_group_id)
        .order_by(LedgerEntry.created_at.asc())
    )
    return list(r.scalars().all())
