import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.lesson import Lesson
from app.models.payment_order import PaymentOrder, SettlementSnapshot
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.payment import (
    CreatePaymentOrderRequest,
    MockWebhookPayload,
    PaymentOrderDetail,
    PaymentOrderOut,
    SettlementSnapshotOut,
    TopupRequest,
    TransactionOut,
    WalletOut,
)
from app.services import payment_service, wallet_service
from app.services.payment.channels import get_channel

router = APIRouter(prefix="/wallet", tags=["Payments"])
payments_router = APIRouter(prefix="/payments", tags=["Payments"])


# --------------------------- Wallet（现有） ---------------------------


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


# --------------------------- v0.2 Payment Orders ---------------------------


@payments_router.post(
    "/orders",
    response_model=PaymentOrderOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_order(
    data: CreatePaymentOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    学员为某门课发起付款（plan.md §3.5）。

    当前外部入口尚未接管下单流程（由 lesson_service.create_lesson 内部调用），
    本端点预留给未来独立支付页面 / 补单场景。
    """
    r = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
    lesson = r.scalars().first()
    if lesson is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    if lesson.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权为该课程支付")

    existing = await payment_service.get_active_order_by_lesson(db, lesson.id)
    if existing is not None and existing.status != "pending":
        raise HTTPException(status_code=409, detail="课程已存在活跃付款单")

    try:
        order = await payment_service.create_order_for_lesson(
            db, lesson, channel=data.channel
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e

    await db.commit()
    await db.refresh(order)
    return PaymentOrderOut.model_validate(order)


@payments_router.post(
    "/webhook/mock",
    response_model=PaymentOrderOut,
)
async def mock_webhook(
    payload: MockWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Mock 渠道回调入口（plan.md §3.5）。仅供测试 / 开发环境使用。
    """
    adapter = get_channel("mock")
    try:
        order = await adapter.handle_callback(
            db, payload.model_dump(mode="json")
        )
    except LookupError as e:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e

    await db.commit()
    await db.refresh(order)
    return PaymentOrderOut.model_validate(order)


@payments_router.get("/orders/{order_id}", response_model=PaymentOrderDetail)
async def get_payment_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(PaymentOrder).where(PaymentOrder.id == order_id)
    )
    order = r.scalars().first()
    if order is None:
        raise HTTPException(status_code=404, detail="付款单不存在")

    # 权限：学员本人 / 课程对应的教师
    allowed = order.student_id == current_user.id
    if not allowed and current_user.teacher_profile is not None:
        rl = await db.execute(select(Lesson).where(Lesson.id == order.lesson_id))
        lesson = rl.scalars().first()
        if lesson is not None and lesson.teacher_id == current_user.teacher_profile.id:
            allowed = True
    if not allowed:
        raise HTTPException(status_code=403, detail="无权查看该付款单")

    # 附带 snapshot（如已生成）
    rs = await db.execute(
        select(SettlementSnapshot).where(SettlementSnapshot.payment_order_id == order.id)
    )
    snapshot = rs.scalars().first()

    detail = PaymentOrderDetail.model_validate(order)
    if snapshot is not None:
        detail.settlement_snapshot = SettlementSnapshotOut.model_validate(snapshot)
    return detail
