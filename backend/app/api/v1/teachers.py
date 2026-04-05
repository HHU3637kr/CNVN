import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_teacher, get_current_user
from app.models.review import Review
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.teacher import (
    TeacherListItem,
    TeacherProfileCreate,
    TeacherProfileOut,
    TeacherProfileUpdate,
)
from app.schemas.review import ReviewOut
from app.schemas.availability import AvailabilityOut
from app.services import availability_service, teacher_service

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("", response_model=PaginatedResponse[TeacherListItem])
async def search_teachers(
    q: str | None = None,
    teacher_type: str | None = None,
    specialties: list[str] | None = Query(None),
    min_price: int | None = None,
    max_price: int | None = None,
    min_rating: float | None = None,
    sort_by: str = Query(
        "recommended",
        pattern="^(recommended|rating|price_asc|price_desc)$",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """搜索/筛选老师列表"""
    items, total = await teacher_service.search_teachers(
        db,
        q=q,
        teacher_type=teacher_type,
        specialties=specialties,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.post("/profile", response_model=TeacherProfileOut, status_code=status.HTTP_201_CREATED)
async def create_teacher_profile(
    data: TeacherProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建教师档案"""
    try:
        return await teacher_service.create_teacher_profile(db, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/profile", response_model=TeacherProfileOut)
async def update_teacher_profile(
    data: TeacherProfileUpdate,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """更新教师档案"""
    try:
        return await teacher_service.update_teacher_profile(db, current_user.id, data)
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{teacher_id}/reviews", response_model=PaginatedResponse[ReviewOut])
async def get_teacher_reviews(
    teacher_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """老师的评价列表"""
    try:
        await teacher_service.get_teacher_profile(db, teacher_id, require_active=True)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="教师档案不存在")

    count_stmt = (
        select(func.count()).select_from(Review).where(Review.teacher_id == teacher_id)
    )
    total = (await db.execute(count_stmt)).scalar_one()

    offset = (page - 1) * page_size
    stmt = (
        select(Review, User.full_name)
        .join(User, Review.reviewer_id == User.id)
        .where(Review.teacher_id == teacher_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = await db.execute(stmt)
    items = []
    for rev, reviewer_name in rows.all():
        out = ReviewOut.model_validate(rev)
        out.reviewer_name = reviewer_name
        items.append(out)

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/{teacher_id}/availability", response_model=list[AvailabilityOut])
async def get_teacher_availability(
    teacher_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """老师的可用时间"""
    try:
        await teacher_service.get_teacher_profile(db, teacher_id, require_active=True)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="教师档案不存在")

    return await availability_service.get_teacher_availability(db, teacher_id)


@router.get("/{teacher_id}", response_model=TeacherProfileOut)
async def get_teacher(
    teacher_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """老师详情"""
    try:
        return await teacher_service.get_teacher_profile(db, teacher_id, require_active=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
