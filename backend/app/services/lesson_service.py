from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.config import settings
from app.core.datetime_utils import ensure_utc, intervals_overlap
from app.models.lesson import Lesson
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.lesson import LessonCreate, LessonListItem, LessonOut
from app.services import availability_service, payment_service, teacher_stats_service

TERMINAL_STATUSES = frozenset({"cancelled", "expired"})
LESSON_OVERLAP_CONSTRAINTS = frozenset(
    {
        "ex_lessons_teacher_no_overlap",
        "ex_lessons_student_no_overlap",
    }
)
CLASSROOM_ENTRY_EARLY_MINUTES = 15
CLASSROOM_ENTRY_LATE_MINUTES = 15


class LessonBookingConflict(ValueError):
    pass


def _lesson_end(lesson: Lesson) -> datetime:
    return ensure_utc(lesson.scheduled_at) + timedelta(minutes=lesson.duration_minutes)


def _classroom_entry_state(
    lesson: Lesson, *, now: datetime | None = None
) -> tuple[datetime, bool, str | None]:
    checked_at = ensure_utc(now or datetime.now(timezone.utc))
    starts_at = ensure_utc(lesson.scheduled_at)
    ends_at = _lesson_end(lesson)

    if lesson.status == "pending_confirmation":
        return ends_at, False, "等待老师确认"
    if lesson.status == "confirmed":
        opens_at = starts_at - timedelta(minutes=CLASSROOM_ENTRY_EARLY_MINUTES)
        closes_at = ends_at + timedelta(minutes=CLASSROOM_ENTRY_LATE_MINUTES)
        if checked_at < opens_at:
            return ends_at, False, "未到可进入时间"
        if checked_at > closes_at:
            return ends_at, False, "课堂进入时间已过"
        return ends_at, True, None
    if lesson.status == "in_progress":
        return ends_at, True, None
    if lesson.status in ("completed", "reviewed"):
        return ends_at, False, "课程已完成"
    if lesson.status == "cancelled":
        return ends_at, False, "课程已取消"
    if lesson.status == "expired":
        return ends_at, False, "课程已过期"
    return ends_at, False, "当前状态不可进入"


def _lesson_payload(lesson: Lesson, *, now: datetime | None = None) -> dict:
    ends_at, can_enter, reason = _classroom_entry_state(lesson, now=now)
    return {
        "id": lesson.id,
        "student_id": lesson.student_id,
        "teacher_id": lesson.teacher_id,
        "scheduled_at": lesson.scheduled_at,
        "ends_at": ends_at,
        "duration_minutes": lesson.duration_minutes,
        "topic": lesson.topic,
        "status": lesson.status,
        "price": lesson.price,
        "can_enter_classroom": can_enter,
        "classroom_unavailable_reason": reason,
        "cancel_reason": lesson.cancel_reason,
        "actual_start_at": lesson.actual_start_at,
        "actual_end_at": lesson.actual_end_at,
        "created_at": lesson.created_at,
    }


def _lesson_out(lesson: Lesson, *, now: datetime | None = None) -> LessonOut:
    return LessonOut.model_validate(_lesson_payload(lesson, now=now))


def _lesson_list_item(
    lesson: Lesson,
    *,
    student_name: str | None,
    teacher_name: str | None,
    now: datetime | None = None,
) -> LessonListItem:
    payload = _lesson_payload(lesson, now=now)
    payload["student_name"] = student_name
    payload["teacher_name"] = teacher_name
    payload.pop("student_id")
    payload.pop("teacher_id")
    payload.pop("cancel_reason")
    payload.pop("actual_start_at")
    payload.pop("actual_end_at")
    payload.pop("created_at")
    return LessonListItem.model_validate(payload)


def _constraint_name_from_integrity_error(exc: IntegrityError) -> str | None:
    seen: set[int] = set()
    current: BaseException | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        diag = getattr(current, "diag", None)
        constraint_name = getattr(diag, "constraint_name", None)
        if constraint_name:
            return constraint_name
        constraint_name = getattr(current, "constraint_name", None)
        if constraint_name:
            return constraint_name
        current = getattr(current, "__cause__", None) or getattr(
            current, "__context__", None
        )

    message = str(exc)
    for name in LESSON_OVERLAP_CONSTRAINTS:
        if name in message:
            return name
    return None


def _is_lesson_overlap_integrity_error(exc: IntegrityError) -> bool:
    return _constraint_name_from_integrity_error(exc) in LESSON_OVERLAP_CONSTRAINTS


def _price_vnd(hourly_rate: int, duration_minutes: int) -> int:
    return math.ceil(hourly_rate * duration_minutes / 60)


async def expire_stale_pending_lessons(db: AsyncSession) -> None:
    """pending_confirmation 超过 24h 未确认 → expired 并全额退款（走 payment_service）。"""
    deadline = datetime.now(timezone.utc) - timedelta(hours=24)
    r = await db.execute(
        select(Lesson).where(
            Lesson.status == "pending_confirmation",
            Lesson.created_at < deadline,
        )
    )
    expired_teacher_ids: set[uuid.UUID] = set()
    for lesson in r.scalars().all():
        order = await payment_service.get_active_order_by_lesson(db, lesson.id)
        if order is not None and order.status in ("held", "disputed"):
            await payment_service.refund_payment_order(
                db, order, "教师超时未确认，自动退款"
            )
        lesson.status = "expired"
        expired_teacher_ids.add(lesson.teacher_id)
    for teacher_id in expired_teacher_ids:
        await teacher_stats_service.sync_teacher_delivery_stats(db, teacher_id)
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
        raise LessonBookingConflict("该时段与已有课程冲突")

    price = _price_vnd(teacher.hourly_rate, data.duration_minutes)

    lesson = Lesson(
        student_id=user.id,
        teacher_id=data.teacher_id,
        scheduled_at=scheduled_at,
        duration_minutes=data.duration_minutes,
        topic=data.topic,
        status="pending_confirmation",
        price=price,
    )
    db.add(lesson)
    try:
        await db.flush()
    except IntegrityError as e:
        if _is_lesson_overlap_integrity_error(e):
            await db.rollback()
            raise LessonBookingConflict("该时段与已有课程冲突") from e
        raise

    try:
        # 学员付款 → 托管户（plan.md §3.4 第 1 行）
        await payment_service.create_order_for_lesson(db, lesson)
    except ValueError as e:
        await db.rollback()
        raise e

    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson)


async def get_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if not _can_access_lesson(user, lesson):
        raise PermissionError("无权查看该课程")
    return _lesson_out(lesson)


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
    response_now = datetime.now(timezone.utc)
    for lesson, student_name, teacher_name in rows.all():
        items.append(
            _lesson_list_item(
                lesson,
                student_name=student_name,
                teacher_name=teacher_name,
                now=response_now,
            )
        )

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
        raise PermissionError("只能操作自己的课程")
    if lesson.status != "pending_confirmation":
        raise ValueError("当前状态不可确认")
    lesson.status = "confirmed"
    await teacher_stats_service.sync_teacher_delivery_stats(db, lesson.teacher_id)
    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson)


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

    # 24h 取消规则（plan.md §2.1 FR-005 B1 决议）：
    #   ≥ 24h：退款 → PaymentOrder → refunded；学员 Wallet 回款
    #   < 24h：Lesson 置 cancelled，PaymentOrder 保持 held；争议期过后
    #          由 dispute_watcher 按常规 release 全额结算给教师（学员违约）
    order = await payment_service.get_active_order_by_lesson(db, lesson.id)
    if hours_until >= 24.0:
        if order is not None and order.status in ("held", "disputed"):
            await payment_service.refund_payment_order(
                db, order, "课程取消退款"
            )
    elif order is not None and order.status in ("held", "disputed"):
        order.held_until = _lesson_end(lesson) + timedelta(
            hours=settings.DISPUTE_WINDOW_HOURS
        )
    lesson.status = "cancelled"

    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson)


async def start_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    if user.teacher_profile is None:
        raise PermissionError("需要教师角色权限，请切换到教师身份")
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if lesson.teacher_id != user.teacher_profile.id:
        raise PermissionError("只能操作自己的课程")
    if lesson.status != "confirmed":
        raise ValueError("只有已确认的课程可以开始")
    _ends_at, can_enter, reason = _classroom_entry_state(lesson)
    if not can_enter:
        raise ValueError(reason or "当前状态不可进入")
    lesson.status = "in_progress"
    lesson.actual_start_at = datetime.now(timezone.utc)
    await teacher_stats_service.sync_teacher_delivery_stats(db, lesson.teacher_id)
    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson)


async def end_lesson(db: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonOut:
    await expire_stale_pending_lessons(db)
    if user.teacher_profile is None:
        raise PermissionError("需要教师角色权限，请切换到教师身份")
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalars().first()
    if not lesson:
        raise LookupError("课程不存在")
    if lesson.teacher_id != user.teacher_profile.id:
        raise PermissionError("只能操作自己的课程")
    if lesson.status != "in_progress":
        raise ValueError("只有进行中的课程可以结束")
    lesson.status = "completed"
    lesson.actual_end_at = datetime.now(timezone.utc)

    # 课程完成 → 写入争议期 deadline（plan.md §2.1 FR-005）
    # 真正结算由 dispute_watcher 在 held_until 到期后触发
    await payment_service.mark_lesson_completed(db, lesson)
    await teacher_stats_service.sync_teacher_delivery_stats(db, lesson.teacher_id)

    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson)
