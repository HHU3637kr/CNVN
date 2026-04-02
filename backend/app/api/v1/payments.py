from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.schemas.common import PaginatedResponse
from app.schemas.payment import WalletOut, TransactionOut, TopupRequest

router = APIRouter(prefix="/wallet", tags=["Payments"])


@router.get("", response_model=WalletOut)
async def get_wallet(current_user: dict = Depends(get_current_user)):
    """获取钱包余额"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/transactions", response_model=PaginatedResponse[TransactionOut])
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """交易流水"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/topup", response_model=WalletOut)
async def topup(
    data: TopupRequest,
    current_user: dict = Depends(get_current_user),
):
    """充值（MVP: 模拟）"""
    raise HTTPException(status_code=501, detail="Not implemented")
