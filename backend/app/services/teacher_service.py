from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.teacher import TeacherListItem, TeacherProfileCreate, TeacherProfileOut, TeacherProfileUpdate


def _apply_search_filters(
    stmt,
    *,
    q: str | None,
    teacher_type: str | None,
    specialties: list[str] | None,
    min_price: int | None,
    max_price: int | None,
    min_rating: float | None,
):
    if q:
        qpat = f"%{q}%"
        spec_str = func.coalesce(
            func.array_to_string(TeacherProfile.specialties, " "),
            "",
        )
        stmt = stmt.where(
            or_(
                TeacherProfile.title.ilike(qpat),
                TeacherProfile.about.ilike(qpat),
                spec_str.ilike(qpat),
            )
        )
    if teacher_type:
        stmt = stmt.where(TeacherProfile.teacher_type == teacher_type)
    if specialties:
        stmt = stmt.where(TeacherProfile.specialties.contains(specialties))
    if min_price is not None:
        stmt = stmt.where(TeacherProfile.hourly_rate >= min_price)
    if max_price is not None:
        stmt = stmt.where(TeacherProfile.hourly_rate <= max_price)
    if min_rating is not None:
        stmt = stmt.where(TeacherProfile.avg_rating >= min_rating)
    return stmt


def _apply_sort(stmt, sort_by: str):
    max_lessons_sq = (
        select(func.max(TeacherProfile.total_lessons))
        .where(TeacherProfile.is_active.is_(True))
        .scalar_subquery()
    )
    ratio = TeacherProfile.total_lessons / func.nullif(max_lessons_sq, 0)
    ratio = func.coalesce(ratio, 0)
    if sort_by == "recommended":
        return stmt.order_by(
            (
                TeacherProfile.avg_rating * 0.5
                + ratio * 0.3
                + TeacherProfile.response_rate * 0.2
            ).desc()
        )
    if sort_by == "rating":
        return stmt.order_by(TeacherProfile.avg_rating.desc())
    if sort_by == "price_asc":
        return stmt.order_by(TeacherProfile.hourly_rate.asc())
    if sort_by == "price_desc":
        return stmt.order_by(TeacherProfile.hourly_rate.desc())
    return stmt.order_by(TeacherProfile.avg_rating.desc())


async def search_teachers(
    db: AsyncSession,
    *,
    q: str | None,
    teacher_type: str | None,
    specialties: list[str] | None,
    min_price: int | None,
    max_price: int | None,
    min_rating: float | None,
    sort_by: str,
    page: int,
    page_size: int,
) -> tuple[list[TeacherListItem], int]:
    filtered = (
        select(TeacherProfile, User.full_name, User.avatar_url)
        .join(User, TeacherProfile.user_id == User.id)
        .where(TeacherProfile.is_active.is_(True))
    )
    filtered = _apply_search_filters(
        filtered,
        q=q,
        teacher_type=teacher_type,
        specialties=specialties,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
    )
    subq = filtered.subquery()
    total = (await db.execute(select(func.count()).select_from(subq))).scalar_one()

    offset = (page - 1) * page_size
    data_stmt = (
        select(TeacherProfile, User.full_name, User.avatar_url)
        .join(User, TeacherProfile.user_id == User.id)
        .where(TeacherProfile.is_active.is_(True))
    )
    data_stmt = _apply_search_filters(
        data_stmt,
        q=q,
        teacher_type=teacher_type,
        specialties=specialties,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
    )
    data_stmt = _apply_sort(data_stmt, sort_by)
    data_stmt = data_stmt.offset(offset).limit(page_size)

    rows = await db.execute(data_stmt)
    items: list[TeacherListItem] = []
    for tp, full_name, avatar_url in rows.all():
        items.append(
            TeacherListItem(
                id=tp.id,
                user_id=tp.user_id,
                name=full_name,
                avatar_url=avatar_url,
                title=tp.title,
                hourly_rate=tp.hourly_rate,
                currency=tp.currency,
                teacher_type=tp.teacher_type,
                specialties=tp.specialties,
                is_verified=tp.is_verified,
                total_lessons=tp.total_lessons,
                avg_rating=tp.avg_rating,
                total_reviews=tp.total_reviews,
            )
        )
    return items, total


async def get_teacher_profile(
    db: AsyncSession, teacher_id: uuid.UUID, *, require_active: bool = True
) -> TeacherProfileOut:
    stmt = select(TeacherProfile).where(TeacherProfile.id == teacher_id)
    if require_active:
        stmt = stmt.where(TeacherProfile.is_active.is_(True))
    r = await db.execute(stmt)
    tp = r.scalars().first()
    if not tp:
        raise ValueError("教师档案不存在")
    return TeacherProfileOut.model_validate(tp)


async def create_teacher_profile(
    db: AsyncSession, user_id: uuid.UUID, data: TeacherProfileCreate
) -> TeacherProfileOut:
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalars().first()
    if not user:
        raise ValueError("用户不存在")

    r2 = await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == user_id))
    if r2.scalars().first():
        raise ValueError("您已拥有教师档案")

    profile = TeacherProfile(
        user_id=user.id,
        title=data.title,
        about=data.about,
        video_url=data.video_url,
        hourly_rate=data.hourly_rate,
        currency=data.currency,
        teacher_type=data.teacher_type,
        specialties=data.specialties,
    )
    db.add(profile)

    if "teacher" not in user.roles:
        user.roles = list(user.roles) + ["teacher"]

    await db.commit()
    await db.refresh(profile)
    return TeacherProfileOut.model_validate(profile)


async def update_teacher_profile(
    db: AsyncSession, user_id: uuid.UUID, data: TeacherProfileUpdate
) -> TeacherProfileOut:
    r = await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == user_id))
    profile = r.scalars().first()
    if not profile:
        raise ValueError("教师档案不存在")

    upd = data.model_dump(exclude_unset=True)
    for k, v in upd.items():
        setattr(profile, k, v)

    await db.commit()
    await db.refresh(profile)
    return TeacherProfileOut.model_validate(profile)
