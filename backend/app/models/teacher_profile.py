import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    about: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    hourly_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), server_default="VND")
    teacher_type: Mapped[str] = mapped_column(String(50), nullable=False)
    specialties: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=True
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    total_lessons: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    avg_rating: Mapped[Decimal] = mapped_column(
        Numeric(2, 1), default=0.0, server_default="0.0"
    )
    total_reviews: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    response_rate: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=0.0, server_default="0.00"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user = relationship("User", back_populates="teacher_profile")
    availabilities = relationship("Availability", back_populates="teacher")
    lessons = relationship("Lesson", back_populates="teacher", foreign_keys="Lesson.teacher_id")
    reviews = relationship("Review", back_populates="teacher", foreign_keys="Review.teacher_id")

    __table_args__ = (
        Index("idx_teacher_profiles_hourly_rate", "hourly_rate"),
        Index("idx_teacher_profiles_avg_rating", avg_rating.desc()),
        Index("idx_teacher_profiles_teacher_type", "teacher_type"),
    )
