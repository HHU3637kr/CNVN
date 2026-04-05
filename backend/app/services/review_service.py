"""
评价业务：spec/03-功能实现/20260403-1900-评价模块/plan.md §3
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lesson import Lesson
from app.models.review import Review
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewOut


async def _sync_teacher_review_stats(db: AsyncSession, teacher_id: uuid.UUID) -> None:
    """按 plan：total_reviews = COUNT；avg_rating = ROUND(AVG(rating_overall), 1)。"""
    r = await db.execute(
        select(func.count(Review.id), func.avg(Review.rating_overall)).where(
            Review.teacher_id == teacher_id
        )
    )
    cnt, avg = r.one()
    tp_r = await db.execute(select(TeacherProfile).where(TeacherProfile.id == teacher_id))
    profile = tp_r.scalars().first()
    if not profile:
        return
    profile.total_reviews = int(cnt or 0)
    if cnt == 0 or avg is None:
        profile.avg_rating = Decimal("0.0")
    else:
        profile.avg_rating = Decimal(str(round(float(avg), 1)))


async def create_review(
    db: AsyncSession, user_id: uuid.UUID, data: ReviewCreate
) -> ReviewOut:
    r = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")

    if lesson.student_id != user_id:
        raise PermissionError("无权评价该课程")

    r2 = await db.execute(select(Review).where(Review.lesson_id == data.lesson_id))
    if r2.scalars().first():
        raise ValueError("该课程已评价")

    if lesson.status != "completed":
        raise ValueError("仅已完成课程可评价")

    review = Review(
        lesson_id=data.lesson_id,
        reviewer_id=user_id,
        teacher_id=lesson.teacher_id,
        rating_overall=data.rating_overall,
        rating_teaching=data.rating_teaching,
        rating_punctuality=data.rating_punctuality,
        rating_communication=data.rating_communication,
        content=data.content,
    )
    db.add(review)
    lesson.status = "reviewed"

    await db.flush()
    await _sync_teacher_review_stats(db, lesson.teacher_id)

    await db.commit()
    await db.refresh(review)
    return ReviewOut.model_validate(review)


async def get_review(db: AsyncSession, review_id: uuid.UUID) -> ReviewOut:
    stmt = (
        select(Review, User.full_name)
        .join(User, Review.reviewer_id == User.id)
        .where(Review.id == review_id)
    )
    row = await db.execute(stmt)
    one = row.first()
    if not one:
        raise LookupError("评价不存在")
    rev, reviewer_name = one
    out = ReviewOut.model_validate(rev)
    out.reviewer_name = reviewer_name
    return out
