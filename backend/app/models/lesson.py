import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_profiles.id"), nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, server_default="60")
    topic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending_confirmation"
    )
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    platform_fee_rate: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_start_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_end_at: Mapped[datetime | None] = mapped_column(
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

    # Relationships
    student = relationship("User", back_populates="student_lessons", foreign_keys=[student_id])
    teacher = relationship("TeacherProfile", back_populates="lessons", foreign_keys=[teacher_id])
    review = relationship("Review", back_populates="lesson", uselist=False)
    messages = relationship("Message", back_populates="lesson")

    __table_args__ = (
        Index("idx_lessons_student_id", "student_id"),
        Index("idx_lessons_teacher_id", "teacher_id"),
        Index("idx_lessons_status", "status"),
        Index("idx_lessons_scheduled_at", "scheduled_at"),
    )
