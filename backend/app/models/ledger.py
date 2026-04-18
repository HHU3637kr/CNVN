"""系统户复式账本（plan.md §3.2.4 / §3.2.5）。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# 四个固定账户代码（plan.md §2.1 FR-002）
ACCOUNT_ESCROW = "escrow"
ACCOUNT_PLATFORM_REVENUE = "platform_revenue"
ACCOUNT_TAX_PAYABLE = "tax_payable"
ACCOUNT_TEACHER_PAYABLE = "teacher_payable"

SYSTEM_ACCOUNT_CODES = (
    ACCOUNT_ESCROW,
    ACCOUNT_PLATFORM_REVENUE,
    ACCOUNT_TAX_PAYABLE,
    ACCOUNT_TEACHER_PAYABLE,
)


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    balance: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    entries = relationship("LedgerEntry", back_populates="account")


class LedgerEntry(Base):
    """
    Append-only 账本分录（plan.md §3.2.5）。

    每次业务事件产生一批 entries 共享同一个 txn_group_id；
    同组 entries 的 amount 累加必须为 0（借贷平衡），由服务层校验。
    """

    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    txn_group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ledger_accounts.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    ref_type: Mapped[str] = mapped_column(String(30), nullable=False)
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    account = relationship("LedgerAccount", back_populates="entries")

    __table_args__ = (
        Index("ix_ledger_entries_txn_group", "txn_group_id"),
        Index("ix_ledger_entries_account_time", "account_id", "created_at"),
        Index("ix_ledger_entries_ref", "ref_type", "ref_id"),
    )
