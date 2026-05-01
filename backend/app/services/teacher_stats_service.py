from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lesson import Lesson
from app.models.teacher_profile import TeacherProfile

DELIVERY_STATUSES = ("completed", "reviewed")
ACTIONABLE_RESPONSE_STATUSES = (
    "pending_confirmation",
    "confirmed",
    "in_progress",
    "completed",
    "reviewed",
    "expired",
)
CONFIRMED_OR_LATER_STATUSES = ("confirmed", "in_progress", "completed", "reviewed")


async def sync_teacher_delivery_stats(
    db: AsyncSession, teacher_id: uuid.UUID
) -> None:
    completed_count = (
        await db.execute(
            select(func.count(Lesson.id)).where(
                Lesson.teacher_id == teacher_id,
                Lesson.status.in_(DELIVERY_STATUSES),
                Lesson.actual_end_at.is_not(None),
            )
        )
    ).scalar_one()

    actionable_count = (
        await db.execute(
            select(func.count(Lesson.id)).where(
                Lesson.teacher_id == teacher_id,
                Lesson.status.in_(ACTIONABLE_RESPONSE_STATUSES),
            )
        )
    ).scalar_one()
    confirmed_count = (
        await db.execute(
            select(func.count(Lesson.id)).where(
                Lesson.teacher_id == teacher_id,
                Lesson.status.in_(CONFIRMED_OR_LATER_STATUSES),
            )
        )
    ).scalar_one()

    profile = (
        await db.execute(select(TeacherProfile).where(TeacherProfile.id == teacher_id))
    ).scalars().first()
    if profile is None:
        return

    profile.total_lessons = int(completed_count or 0)
    if not actionable_count:
        profile.response_rate = Decimal("0.00")
    else:
        rate = Decimal(int(confirmed_count or 0)) / Decimal(int(actionable_count))
        profile.response_rate = rate.quantize(Decimal("0.01"))
