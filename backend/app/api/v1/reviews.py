import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_student
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewOut
from app.services import review_service

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreate,
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """提交评价"""
    try:
        return await review_service.create_review(db, current_user.id, data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{review_id}", response_model=ReviewOut)
async def get_review(
    review_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """评价详情"""
    try:
        return await review_service.get_review(db, review_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
