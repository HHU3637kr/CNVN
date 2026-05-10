from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


ACTIVE_DISPUTE_STATUSES = ("open", "processing")
DISPUTE_TERMINAL_STATUSES = (
    "resolved_refunded",
    "resolved_released",
    "closed_no_action",
)


class DisputeCase(Base):
    __tablename__ = "dispute_cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False
    )
    payment_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_orders.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_profiles.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")
    reason_code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    lesson = relationship("Lesson")
    payment_order = relationship("PaymentOrder")
    student = relationship("User", foreign_keys=[student_id])
    teacher = relationship("TeacherProfile")
    operator = relationship("User", foreign_keys=[operator_id])
    events = relationship(
        "DisputeEvent",
        back_populates="dispute",
        order_by="DisputeEvent.created_at",
    )

    __table_args__ = (
        Index("ix_dispute_cases_status_created_at", "status", "created_at"),
        Index("ix_dispute_cases_payment_order_id", "payment_order_id"),
        Index(
            "uq_dispute_cases_payment_order_active",
            "payment_order_id",
            unique=True,
            postgresql_where=text("status IN ('open', 'processing')"),
        ),
    )


class DisputeEvent(Base):
    __tablename__ = "dispute_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dispute_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dispute_cases.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    dispute = relationship("DisputeCase", back_populates="events")
    actor = relationship("User")

    __table_args__ = (
        Index("ix_dispute_events_dispute_created_at", "dispute_id", "created_at"),
    )
