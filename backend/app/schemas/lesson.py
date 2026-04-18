import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class LessonCreate(BaseModel):
    teacher_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=30, le=180)
    topic: str | None = Field(None, max_length=200)


class LessonOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    teacher_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    topic: str | None
    status: str
    price: int
    cancel_reason: str | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LessonListItem(BaseModel):
    id: uuid.UUID
    teacher_name: str | None = None
    student_name: str | None = None
    scheduled_at: datetime
    duration_minutes: int
    topic: str | None
    status: str
    price: int

    model_config = {"from_attributes": True}


class LessonCancel(BaseModel):
    reason: str | None = None


class LessonListParams(BaseModel):
    status: str | None = None
    role: str = Field(default="student", pattern="^(student|teacher)$")
    upcoming: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
