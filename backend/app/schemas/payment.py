import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class WalletOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    balance: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: uuid.UUID
    wallet_id: uuid.UUID
    lesson_id: uuid.UUID | None
    type: str
    amount: int
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TopupRequest(BaseModel):
    amount: int = Field(..., gt=0)


class TransactionListParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# --------------------------- v0.2 新增 ---------------------------


class SettlementSnapshotOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    payment_order_id: uuid.UUID
    tax_scenario: str
    gross_amount: int
    commission_rate: Decimal
    commission_amount: int
    tax_rate: Decimal
    vat_amount: int
    pit_amount: int
    net_amount: int
    calculated_at: datetime

    model_config = {"from_attributes": True}


class PaymentOrderOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    student_id: uuid.UUID
    gross_amount: int
    channel: str
    channel_txn_id: str | None
    status: str
    held_until: datetime | None
    paid_at: datetime | None
    released_at: datetime | None
    refunded_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentOrderDetail(PaymentOrderOut):
    settlement_snapshot: SettlementSnapshotOut | None = None


class PayoutOrderOut(BaseModel):
    id: uuid.UUID
    payment_order_id: uuid.UUID
    lesson_id: uuid.UUID
    teacher_id: uuid.UUID
    settlement_snapshot_id: uuid.UUID
    gross_amount: int
    commission_rate: Decimal
    commission_amount: int
    vat_amount: int
    pit_amount: int
    tax_amount: int
    net_amount: int
    tax_scenario: str
    status: str
    channel: str
    channel_txn_id: str | None
    held_until: datetime | None
    released_at: datetime | None
    paid_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if hasattr(obj, "settlement_snapshot") and hasattr(obj, "payment_order"):
            snapshot = obj.settlement_snapshot
            order = obj.payment_order
            data = {
                "id": obj.id,
                "payment_order_id": obj.payment_order_id,
                "lesson_id": obj.lesson_id,
                "teacher_id": obj.teacher_id,
                "settlement_snapshot_id": obj.settlement_snapshot_id,
                "gross_amount": snapshot.gross_amount,
                "commission_rate": snapshot.commission_rate,
                "commission_amount": snapshot.commission_amount,
                "vat_amount": snapshot.vat_amount,
                "pit_amount": snapshot.pit_amount,
                "tax_amount": snapshot.vat_amount + snapshot.pit_amount,
                "net_amount": obj.net_amount,
                "tax_scenario": snapshot.tax_scenario,
                "status": obj.status,
                "channel": obj.channel,
                "channel_txn_id": obj.channel_txn_id,
                "held_until": order.held_until,
                "released_at": order.released_at,
                "paid_at": obj.paid_at,
                "created_at": obj.created_at,
            }
            return super().model_validate(data, *args, **kwargs)
        return super().model_validate(obj, *args, **kwargs)


class CreatePaymentOrderRequest(BaseModel):
    lesson_id: uuid.UUID
    channel: str | None = None


class MockWebhookPayload(BaseModel):
    order_id: uuid.UUID
    event: str = Field(default="paid", pattern="^(paid|failed)$")
