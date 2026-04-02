import uuid
from datetime import datetime
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
