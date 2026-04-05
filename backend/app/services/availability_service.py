from __future__ import annotations

import uuid
from datetime import datetime, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.datetime_utils import local_lesson_window
from app.models.availability import Availability
from app.schemas.availability import AvailabilityCreate, AvailabilityOut, AvailabilityUpdate


async def list_for_teacher(
    db: AsyncSession, teacher_profile_id: uuid.UUID
) -> list[Availability]:
    r = await db.execute(
        select(Availability)
        .where(Availability.teacher_id == teacher_profile_id)
        .order_by(Availability.created_at.asc())
    )
    return list(r.scalars().all())


async def get_owned(
    db: AsyncSession, availability_id: uuid.UUID, teacher_profile_id: uuid.UUID
) -> Availability | None:
    r = await db.execute(
        select(Availability).where(
            Availability.id == availability_id,
            Availability.teacher_id == teacher_profile_id,
        )
    )
    return r.scalars().first()


def _time_le(t1: time, t2: time) -> bool:
    return (t1.hour, t1.minute, t1.second) <= (t2.hour, t2.minute, t2.second)


def _covers_window(
    av: Availability,
    local_start: datetime,
    local_end: datetime,
) -> bool:
    """本地时间下整节课是否落在该 availability 的 [start_time, end_time] 内。"""
    ls, le = local_start.time(), local_end.time()
    return _time_le(av.start_time, ls) and _time_le(le, av.end_time)


async def assert_slot_covered_by_availability(
    db: AsyncSession,
    teacher_profile_id: uuid.UUID,
    scheduled_at_utc: datetime,
    duration_minutes: int,
) -> None:
    """若无可覆盖时段则抛出 ValueError。"""
    tz = settings.DEFAULT_TIMEZONE
    try:
        local_start, local_end = local_lesson_window(
            scheduled_at_utc, duration_minutes, tz
        )
    except ValueError as e:
        raise ValueError(str(e)) from e

    r = await db.execute(
        select(Availability).where(Availability.teacher_id == teacher_profile_id)
    )
    rows = list(r.scalars().all())
    if not rows:
        raise ValueError("教师尚未设置可授课时段")

    d = local_start.date()
    wd = local_start.weekday()

    for av in rows:
        if av.specific_date is not None:
            if av.specific_date != d:
                continue
        else:
            if av.day_of_week is None or av.day_of_week != wd:
                continue
        if _covers_window(av, local_start, local_end):
            return

    raise ValueError("所选时间不在教师可授课时段内")


async def create_availability(
    db: AsyncSession,
    teacher_profile_id: uuid.UUID,
    data: AvailabilityCreate,
) -> Availability:
    if data.start_time >= data.end_time:
        raise ValueError("结束时间须晚于开始时间")
    av = Availability(
        teacher_id=teacher_profile_id,
        day_of_week=data.day_of_week,
        specific_date=data.specific_date,
        start_time=data.start_time,
        end_time=data.end_time,
        is_recurring=data.is_recurring,
    )
    db.add(av)
    await db.commit()
    await db.refresh(av)
    return av


async def update_availability(
    db: AsyncSession,
    teacher_profile_id: uuid.UUID,
    availability_id: uuid.UUID,
    data: AvailabilityUpdate,
) -> Availability:
    av = await get_owned(db, availability_id, teacher_profile_id)
    if not av:
        raise LookupError("时段不存在")
    upd = data.model_dump(exclude_unset=True)
    if "start_time" in upd or "end_time" in upd:
        st = upd.get("start_time", av.start_time)
        et = upd.get("end_time", av.end_time)
        if st >= et:
            raise ValueError("结束时间须晚于开始时间")
    for k, v in upd.items():
        setattr(av, k, v)
    await db.commit()
    await db.refresh(av)
    return av


async def delete_availability(
    db: AsyncSession, teacher_profile_id: uuid.UUID, availability_id: uuid.UUID
) -> None:
    av = await get_owned(db, availability_id, teacher_profile_id)
    if not av:
        raise LookupError("时段不存在")
    db.delete(av)
    await db.commit()


async def get_teacher_availability(
    db: AsyncSession, teacher_profile_id: uuid.UUID
) -> list[AvailabilityOut]:
    """公开：按教师档案 ID 返回可用时段列表。"""
    rows = await list_for_teacher(db, teacher_profile_id)
    return [AvailabilityOut.model_validate(r) for r in rows]
