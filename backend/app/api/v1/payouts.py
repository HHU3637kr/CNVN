"""Tutor 出款单查询端点（plan.md §3.5）。"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.payment import PayoutOrderOut
from app.services import payment_service

router = APIRouter(prefix="/payouts", tags=["Payouts"])


@router.get("/me", response_model=PaginatedResponse[PayoutOrderOut])
async def list_my_payouts(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.teacher_profile is None:
        raise HTTPException(status_code=403, detail="需要教师身份")
    teacher_id = current_user.teacher_profile.id

    items, total = await payment_service.list_payouts_by_teacher(
        db, teacher_id, status=status, page=page, page_size=page_size
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[PayoutOrderOut.model_validate(p) for p in items],
    )
