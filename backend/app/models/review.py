import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id"), unique=True, nullable=False
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teacher_profiles.id"), nullable=False
    )
    rating_overall: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rating_teaching: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    rating_punctuality: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    rating_communication: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    lesson = relationship("Lesson", back_populates="review")
    reviewer = relationship("User", back_populates="reviews", foreign_keys=[reviewer_id])
    teacher = relationship("TeacherProfile", back_populates="reviews", foreign_keys=[teacher_id])

    __table_args__ = (
        Index("idx_reviews_teacher_id", "teacher_id"),
    )
