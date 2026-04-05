from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.payment import WalletOut, TransactionOut, TopupRequest
from app.services import wallet_service

router = APIRouter(prefix="/wallet", tags=["Payments"])


@router.get("", response_model=WalletOut)
async def get_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取钱包余额"""
    w = await wallet_service.ensure_wallet(db, current_user.id)
    return WalletOut.model_validate(w)


@router.get("/transactions", response_model=PaginatedResponse[TransactionOut])
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """交易流水"""
    w = await wallet_service.ensure_wallet(db, current_user.id)
    items, total = await wallet_service.list_transactions(
        db, w.id, page=page, page_size=page_size
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[TransactionOut.model_validate(t) for t in items],
    )


@router.post("/topup", response_model=WalletOut)
async def topup(
    data: TopupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """充值（MVP: 模拟）"""
    try:
        return await wallet_service.topup(db, current_user.id, data.amount)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
