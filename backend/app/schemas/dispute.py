from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.lesson import LessonOut
from app.schemas.payment import PaymentOrderDetail


DisputeReasonCode = Literal[
    "teacher_no_show",
    "student_no_show",
    "quality_issue",
    "technical_issue",
    "payment_issue",
    "other",
]
DisputeAction = Literal[
    "assign",
    "add_note",
    "refund",
    "release",
    "close_no_action",
]


class DisputeCreate(BaseModel):
    lesson_id: uuid.UUID | None = None
    payment_order_id: uuid.UUID | None = None
    reason_code: DisputeReasonCode
    description: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def require_lesson_or_order(self):
        if self.lesson_id is None and self.payment_order_id is None:
            raise ValueError("lesson_id 或 payment_order_id 至少提供一个")
        return self


class DisputeHandleRequest(BaseModel):
    action: DisputeAction
    reason: str = Field(min_length=1, max_length=1000)


class DisputeEventOut(BaseModel):
    id: uuid.UUID
    dispute_id: uuid.UUID
    type: str
    actor_id: uuid.UUID | None
    note: str | None
    from_status: str | None
    to_status: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DisputeOut(BaseModel):
    id: uuid.UUID
    status: str
    reason_code: str
    description: str | None
    lesson_id: uuid.UUID
    payment_order_id: uuid.UUID
    student_id: uuid.UUID
    teacher_id: uuid.UUID
    operator_id: uuid.UUID | None
    resolution: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class DisputeDetailOut(DisputeOut):
    payment_order: PaymentOrderDetail
    lesson: LessonOut
    student_name: str | None
    teacher_name: str | None
    events: list[DisputeEventOut]
