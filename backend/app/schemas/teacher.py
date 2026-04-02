import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class TeacherProfileCreate(BaseModel):
    title: str = Field(..., max_length=200)
    about: str | None = None
    video_url: str | None = None
    hourly_rate: int = Field(..., gt=0)
    currency: str = Field(default="VND", max_length=3)
    teacher_type: str = Field(..., max_length=50)
    specialties: list[str] | None = None


class TeacherProfileUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    about: str | None = None
    video_url: str | None = None
    hourly_rate: int | None = Field(None, gt=0)
    currency: str | None = Field(None, max_length=3)
    teacher_type: str | None = Field(None, max_length=50)
    specialties: list[str] | None = None


class TeacherProfileOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    about: str | None
    video_url: str | None
    hourly_rate: int
    currency: str
    teacher_type: str
    specialties: list[str] | None
    is_verified: bool
    total_lessons: int
    avg_rating: Decimal
    total_reviews: int
    response_rate: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TeacherListItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    avatar_url: str | None
    title: str
    hourly_rate: int
    currency: str
    teacher_type: str
    specialties: list[str] | None
    is_verified: bool
    total_lessons: int
    avg_rating: Decimal
    total_reviews: int

    model_config = {"from_attributes": True}


class TeacherSearchParams(BaseModel):
    q: str | None = None
    teacher_type: str | None = None
    specialties: list[str] | None = None
    min_price: int | None = None
    max_price: int | None = None
    min_rating: float | None = None
    sort_by: str = Field(default="recommended", pattern="^(recommended|rating|price_asc|price_desc)$")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
