import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    lesson_id: uuid.UUID
    rating_overall: int = Field(..., ge=1, le=5)
    rating_teaching: int | None = Field(None, ge=1, le=5)
    rating_punctuality: int | None = Field(None, ge=1, le=5)
    rating_communication: int | None = Field(None, ge=1, le=5)
    content: str | None = None


class ReviewOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    reviewer_id: uuid.UUID
    teacher_id: uuid.UUID
    rating_overall: int
    rating_teaching: int | None
    rating_punctuality: int | None
    rating_communication: int | None
    content: str | None
    created_at: datetime

    # Populated from joins
    reviewer_name: str | None = None

    model_config = {"from_attributes": True}
