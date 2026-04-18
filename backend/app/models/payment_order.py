"""支付订单与出款单（plan.md §3.2.1 / §3.2.2 / §3.2.3）。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# PaymentOrder 状态枚举（plan.md §3.2.1）
PAYMENT_ORDER_STATUSES = (
    "pending",
    "pending_3ds",  # 预留给真实渠道
    "paid",
    "held",
    "released",
    "refunded",
    "disputed",
)

# PayoutOrder 状态枚举（plan.md §3.2.2）
PAYOUT_ORDER_STATUSES = ("pending", "released", "paid", "failed")


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    gross_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, server_default="mock")
    channel_txn_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    held_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    refunded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    lesson = relationship("Lesson")
    student = relationship("User")
    payout_order = relationship(
        "PayoutOrder", back_populates="payment_order", uselist=False
    )
    settlement_snapshot = relationship(
        "SettlementSnapshot", back_populates="payment_order", uselist=False
    )

    __table_args__ = (
        # 部分唯一索引：同一课程只允许一条活跃订单（非 refunded）
        Index(
            "uq_payment_orders_lesson_active",
            "lesson_id",
            unique=True,
            postgresql_where=text("status <> 'refunded'"),
        ),
        Index("ix_payment_orders_status_held_until", "status", "held_until"),
        Index("ix_payment_orders_student", "student_id"),
    )


class PayoutOrder(Base):
    __tablename__ = "payout_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    payment_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_orders.id"),
        unique=True,
        nullable=False,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_profiles.id"), nullable=False
    )
    settlement_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("settlement_snapshots.id"), nullable=False
    )
    net_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    channel: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="mock"
    )
    channel_txn_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    payment_order = relationship("PaymentOrder", back_populates="payout_order")
    settlement_snapshot = relationship("SettlementSnapshot")

    __table_args__ = (
        Index("ix_payout_orders_teacher", "teacher_id"),
        Index("ix_payout_orders_status", "status"),
    )


class SettlementSnapshot(Base):
    """
    不可变结算快照（plan.md §3.2.3）。

    数据库层通过 trigger 禁止 UPDATE，只允许 INSERT / SELECT。
    """

    __tablename__ = "settlement_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id"), unique=True, nullable=False
    )
    payment_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_orders.id"),
        unique=True,
        nullable=False,
    )
    tax_scenario: Mapped[str] = mapped_column(String(30), nullable=False)
    gross_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    commission_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    vat_amount: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    pit_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    net_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    payment_order = relationship("PaymentOrder", back_populates="settlement_snapshot")
