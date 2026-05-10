from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_operator, get_current_user
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.dispute import (
    DisputeCreate,
    DisputeDetailOut,
    DisputeHandleRequest,
    DisputeOut,
)
from app.services import dispute_service

router = APIRouter(prefix="/disputes", tags=["Disputes"])
ops_router = APIRouter(prefix="/ops/disputes", tags=["Ops Disputes"])


def _raise_api_error(exc: Exception) -> None:
    if isinstance(exc, dispute_service.DisputeConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    raise exc


@router.post("", response_model=DisputeOut, status_code=status.HTTP_201_CREATED)
async def create_dispute(
    data: DisputeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        dispute = await dispute_service.create_dispute(
            db,
            current_user,
            lesson_id=data.lesson_id,
            payment_order_id=data.payment_order_id,
            reason_code=data.reason_code,
            description=data.description,
        )
        await db.commit()
        await db.refresh(dispute)
        return DisputeOut.model_validate(dispute)
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        _raise_api_error(exc)


@router.get("/my", response_model=list[DisputeOut])
async def list_my_disputes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    disputes = await dispute_service.list_my_disputes(db, current_user)
    return [DisputeOut.model_validate(dispute) for dispute in disputes]


@router.get("/{dispute_id}", response_model=DisputeDetailOut)
async def get_my_dispute(
    dispute_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dispute = await dispute_service.get_dispute(db, dispute_id)
    if dispute is None:
        raise HTTPException(status_code=404, detail="争议不存在")
    if not dispute_service.can_view_dispute(current_user, dispute):
        raise HTTPException(status_code=403, detail="无权查看该争议")
    return DisputeDetailOut.model_validate(
        await dispute_service.detail_payload(db, dispute)
    )


@ops_router.get("", response_model=PaginatedResponse[DisputeOut])
async def ops_list_disputes(
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _operator: User = Depends(get_current_operator),
    db: AsyncSession = Depends(get_db),
):
    items, total = await dispute_service.list_disputes(
        db, status=status_filter, page=page, page_size=page_size
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[DisputeOut.model_validate(item) for item in items],
    )


@ops_router.get("/{dispute_id}", response_model=DisputeDetailOut)
async def ops_get_dispute(
    dispute_id: uuid.UUID,
    _operator: User = Depends(get_current_operator),
    db: AsyncSession = Depends(get_db),
):
    dispute = await dispute_service.get_dispute(db, dispute_id)
    if dispute is None:
        raise HTTPException(status_code=404, detail="争议不存在")
    return DisputeDetailOut.model_validate(
        await dispute_service.detail_payload(db, dispute)
    )


@ops_router.post("/{dispute_id}/actions", response_model=DisputeDetailOut)
async def ops_handle_dispute(
    dispute_id: uuid.UUID,
    data: DisputeHandleRequest,
    operator: User = Depends(get_current_operator),
    db: AsyncSession = Depends(get_db),
):
    try:
        dispute = await dispute_service.handle_dispute(
            db,
            dispute_id,
            action=data.action,
            reason=data.reason,
            operator=operator,
        )
        await db.commit()
        dispute = await dispute_service.get_dispute(db, dispute.id)
        assert dispute is not None
        return DisputeDetailOut.model_validate(
            await dispute_service.detail_payload(db, dispute)
        )
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        _raise_api_error(exc)
