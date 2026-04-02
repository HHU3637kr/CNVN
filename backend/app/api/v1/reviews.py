import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_student
from app.schemas.review import ReviewCreate, ReviewOut

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreate,
    current_user: dict = Depends(get_current_student),
):
    """提交评价"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{review_id}", response_model=ReviewOut)
async def get_review(review_id: uuid.UUID):
    """评价详情"""
    raise HTTPException(status_code=501, detail="Not implemented")
