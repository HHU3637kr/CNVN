import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user, get_current_teacher
from app.schemas.common import PaginatedResponse
from app.schemas.teacher import (
    TeacherListItem,
    TeacherProfileCreate,
    TeacherProfileOut,
    TeacherProfileUpdate,
)
from app.schemas.review import ReviewOut
from app.schemas.availability import AvailabilityOut

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("", response_model=PaginatedResponse[TeacherListItem])
async def search_teachers(
    q: str | None = None,
    teacher_type: str | None = None,
    specialties: list[str] | None = Query(None),
    min_price: int | None = None,
    max_price: int | None = None,
    min_rating: float | None = None,
    sort_by: str = "recommended",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """搜索/筛选老师列表"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{teacher_id}", response_model=TeacherProfileOut)
async def get_teacher(teacher_id: uuid.UUID):
    """老师详情"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/profile", response_model=TeacherProfileOut, status_code=status.HTTP_201_CREATED)
async def create_teacher_profile(
    data: TeacherProfileCreate,
    current_user: dict = Depends(get_current_user),
):
    """创建教师档案"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/profile", response_model=TeacherProfileOut)
async def update_teacher_profile(
    data: TeacherProfileUpdate,
    current_user: dict = Depends(get_current_teacher),
):
    """更新教师档案"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{teacher_id}/reviews", response_model=PaginatedResponse[ReviewOut])
async def get_teacher_reviews(
    teacher_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """老师的评价列表"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{teacher_id}/availability", response_model=list[AvailabilityOut])
async def get_teacher_availability(teacher_id: uuid.UUID):
    """老师的可用时间"""
    raise HTTPException(status_code=501, detail="Not implemented")
