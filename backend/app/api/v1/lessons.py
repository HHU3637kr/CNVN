import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user, get_current_student, get_current_teacher
from app.schemas.common import PaginatedResponse
from app.schemas.lesson import LessonCreate, LessonOut, LessonListItem, LessonCancel

router = APIRouter(prefix="/lessons", tags=["Lessons"])


@router.post("", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    data: LessonCreate,
    current_user: dict = Depends(get_current_student),
):
    """学生预约课程"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("", response_model=PaginatedResponse[LessonListItem])
async def list_lessons(
    status_filter: str | None = Query(None, alias="status"),
    role: str = Query("student", pattern="^(student|teacher)$"),
    upcoming: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """获取我的课程列表"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{lesson_id}", response_model=LessonOut)
async def get_lesson(
    lesson_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
):
    """课程详情"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{lesson_id}/confirm", response_model=LessonOut)
async def confirm_lesson(
    lesson_id: uuid.UUID,
    current_user: dict = Depends(get_current_teacher),
):
    """老师确认课程"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{lesson_id}/cancel", response_model=LessonOut)
async def cancel_lesson(
    lesson_id: uuid.UUID,
    data: LessonCancel | None = None,
    current_user: dict = Depends(get_current_user),
):
    """取消课程"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{lesson_id}/start", response_model=LessonOut)
async def start_lesson(
    lesson_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
):
    """开始上课"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{lesson_id}/end", response_model=LessonOut)
async def end_lesson(
    lesson_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
):
    """结束课程"""
    raise HTTPException(status_code=501, detail="Not implemented")
