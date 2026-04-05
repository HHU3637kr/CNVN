from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.config import settings
from app.core.datetime_utils import ensure_utc, intervals_overlap
from app.models.lesson import Lesson
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.lesson import LessonCreate, LessonListItem, LessonOut
from app.services import availability_service, wallet_service

TERMINAL_STATUSES = frozenset({"cancelled", "expired"})


def _lesson_end(lesson: Lesson) -> datetime:
    return lesson.scheduled_at + timedelta(minutes=lesson.duration_minutes)


def _price_vnd(hourly_rate: int, duration_minutes: int) -> int:
    return math.ceil(hourly_rate * duration_minutes / 60)


async def expire_stale_pending_lessons(db: AsyncSession) -> None:
    """pending_confirmation 超过 24h 未确认 → expired 并全额退款。"""
    deadline = datetime.now(timezone.utc) - timedelta(hours=24)
    r = await db.execute(
        select(Lesson).where(
            Lesson.status == "pending_confirmation",
            Lesson.created_at < deadline,
        )
    )
    for lesson in r.scalars().all():
        await wallet_service.credit_refund(
            db,
            lesson.student_id,
            lesson.price,
            lesson.id,
            "教师超时未确认，自动退款",
        )
        lesson.status = "expired"
    await db.commit()


async def _has_overlap(
    db: AsyncSession,
    *,
    teacher_id: uuid.UUID,
    student_id: uuid.UUID,
    scheduled_at: datetime,
    duration_minutes: int,
    exclude_lesson_id: uuid.UUID | None = None,
) -> bool:
    s = ensure_utc(scheduled_at)
    e = s + timedelta(minutes=duration_minutes)

    for fk_col, fk_val in [
        (Lesson.teacher_id, teacher_id),
        (Lesson.student_id, student_id),
    ]:
        r = await db.execute(
            select(Lesson).where(
                fk_col == fk_val,
                Lesson.status.notin_(TERMINAL_STATUSES),
            )
        )
        for o in r.scalars().all():
            if exclude_lesson_id and o.id == exclude_lesson_id:
                continue
            os = ensure_utc(o.scheduled_at)
            oe = os + timedelta(minutes=o.duration_minutes)
            if intervals_overlap(s, e, os, oe):
                return True
    return False


def _can_access_lesson(user: User, lesson: Lesson) -> bool:
    if user.id == lesson.student_id:
        return True
    tp = user.teacher_profile
    if tp is not None and tp.id == lesson.teacher_id:
        return True
    return False


async def create_lesson(
    db: AsyncSession, user: User, data: LessonCreate
) -> LessonOut:
    if user.teacher_profile and data.teacher_id == user.teacher_profile.id:
        raise ValueError("不能向自己预约")

    r = await db.execute(
        select(TeacherProfile).where(TeacherProfile.id == data.teacher_id)
    )
    teacher = r.scalars().first()
    if not teacher:
        raise ValueError("教师不存在")
    if not teacher.is_active:
        raise ValueError("该教师暂不可预约")

    scheduled_at = ensure_utc(data.scheduled_at)
    if scheduled_at <= datetime.now(timezone.utc):
        raise ValueError("开课时间须晚于当前时间")

    await availability_service.assert_slot_covered_by_availability(
        db, data.teacher_id, scheduled_at, data.duration_minutes
    )

    if await _has_overlap(
        db,
        teacher_id=data.teacher_id,
        student_id=user.id,
        scheduled_at=scheduled_at,
        duration_minutes=data.duration_minutes,
    ):
        raise ValueError("该时段与已有课程冲突")

    price = _price_vnd(teacher.hourly_rate, data.duration_minutes)
    platform_fee_rate: Decimal = settings.PLATFORM_FEE_RATE

    lesson = Lesson(
        student_id=user.id,
        teacher_id=data.teacher_id,
        scheduled_at=scheduled_at,
        duration_minutes=data.duration_minutes,
        topic=data.topic,
        status="pending_confirmation",
        price=price,
        platform_fee_rate=platform_fee_rate,
    )
    db.add(lesson)
    await db.flush()

    try:
        await wallet_service.debit_for_lesson(
            db,
            user.id,
            price,
            lesson.id,
            "课程预约扣款",
        )
    except ValueError as e:
        await db.rollback()
        raise e

    await db.commit()
    await db.refresh(lesson)
    return LessonOut.model_validate(lesson)


async def get_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if not _can_access_lesson(user, lesson):
        raise PermissionError("无权查看该课程")
    return LessonOut.model_validate(lesson)


async def require_lesson_participant(
    db: AsyncSession, user: User, lesson_id: uuid.UUID
) -> Lesson:
    """校验当前用户为该课时的学生或教师；返回 Lesson ORM。见课堂 WebSocket Spec。"""
    await expire_stale_pending_lessons(db)
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if not _can_access_lesson(user, lesson):
        raise PermissionError("无权参与该课程")
    return lesson


async def list_lessons(
    db: AsyncSession,
    user: User,
    *,
    status_filter: str | None,
    role: str,
    upcoming: bool,
    page: int,
    page_size: int,
) -> PaginatedResponse[LessonListItem]:
    await expire_stale_pending_lessons(db)

    now = datetime.now(timezone.utc)
    teacher_profile_id: uuid.UUID | None = None
    if role == "teacher":
        if user.teacher_profile is None:
            raise ValueError("未开通教师身份")
        teacher_profile_id = user.teacher_profile.id

    filtered = select(Lesson)
    if role == "student":
        filtered = filtered.where(Lesson.student_id == user.id)
    else:
        filtered = filtered.where(Lesson.teacher_id == teacher_profile_id)
    if status_filter:
        filtered = filtered.where(Lesson.status == status_filter)
    if upcoming:
        filtered = filtered.where(Lesson.scheduled_at >= now)

    subq = filtered.subquery()
    total = (await db.execute(select(func.count()).select_from(subq))).scalar_one()

    offset = (page - 1) * page_size

    StudentUser = aliased(User)
    TeacherUser = aliased(User)

    stmt = (
        select(Lesson, StudentUser.full_name, TeacherUser.full_name)
        .join(StudentUser, Lesson.student_id == StudentUser.id)
        .join(TeacherProfile, Lesson.teacher_id == TeacherProfile.id)
        .join(TeacherUser, TeacherProfile.user_id == TeacherUser.id)
    )
    if role == "student":
        stmt = stmt.where(Lesson.student_id == user.id)
    else:
        stmt = stmt.where(Lesson.teacher_id == teacher_profile_id)
    if status_filter:
        stmt = stmt.where(Lesson.status == status_filter)
    if upcoming:
        stmt = stmt.where(Lesson.scheduled_at >= now)

    stmt = stmt.order_by(Lesson.scheduled_at.asc()).offset(offset).limit(page_size)
    rows = await db.execute(stmt)
    items: list[LessonListItem] = []
    for lesson, student_name, teacher_name in rows.all():
        li = LessonListItem.model_validate(lesson)
        li.student_name = student_name
        li.teacher_name = teacher_name
        items.append(li)

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


async def confirm_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    if user.teacher_profile is None:
        raise PermissionError("需要教师身份")
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if lesson.teacher_id != user.teacher_profile.id:
        raise PermissionError("只能确认自己的课程")
    if lesson.status != "pending_confirmation":
        raise ValueError("当前状态不可确认")
    lesson.status = "confirmed"
    await db.commit()
    await db.refresh(lesson)
    return LessonOut.model_validate(lesson)


def _hours_until_lesson(scheduled_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    return (ensure_utc(scheduled_at) - now).total_seconds() / 3600.0


async def cancel_lesson(
    db: AsyncSession,
    user: User,
    lesson_id: uuid.UUID,
    reason: str | None,
) -> LessonOut:
    await expire_stale_pending_lessons(db)
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if not _can_access_lesson(user, lesson):
        raise PermissionError("无权操作该课程")
    if lesson.status not in ("pending_confirmation", "confirmed"):
        raise ValueError("当前状态不可取消")

    hours_until = _hours_until_lesson(lesson.scheduled_at)

    if reason:
        lesson.cancel_reason = reason

    # 24h 取消规则修改：允许取消，但 < 24h 不退款
    if hours_until < 24.0:
        # < 24h：允许取消，不退款
        lesson.status = "cancelled"
    else:
        # >= 24h：允许取消，全额退款
        await wallet_service.credit_refund(
            db,
            lesson.student_id,
            lesson.price,
            lesson.id,
            "课程取消退款",
        )
        lesson.status = "cancelled"

    await db.commit()
    await db.refresh(lesson)
    return LessonOut.model_validate(lesson)


async def start_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if not _can_access_lesson(user, lesson):
        raise PermissionError("无权操作该课程")
    if lesson.status != "confirmed":
        raise ValueError("只有已确认的课程可以开始")
    lesson.status = "in_progress"
    lesson.actual_start_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lesson)
    return LessonOut.model_validate(lesson)


async def end_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if not _can_access_lesson(user, lesson):
        raise PermissionError("无权操作该课程")
    if lesson.status != "in_progress":
        raise ValueError("只有进行中的课程可以结束")
    lesson.status = "completed"
    lesson.actual_end_at = datetime.now(timezone.utc)
    await db.commit()

    # 课程完成后自动结算给教师
    from app.services import settlement_service

    await settlement_service.settle_teacher_lesson(db, lesson)

    await db.refresh(lesson)
    return LessonOut.model_validate(lesson)
