import uuid
from datetime import date, datetime, time
from pydantic import BaseModel, Field


class AvailabilityCreate(BaseModel):
    day_of_week: int | None = Field(None, ge=0, le=6)
    specific_date: date | None = None
    start_time: time
    end_time: time
    is_recurring: bool = True


class AvailabilityUpdate(BaseModel):
    day_of_week: int | None = Field(None, ge=0, le=6)
    specific_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    is_recurring: bool | None = None


class AvailabilityOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    day_of_week: int | None
    specific_date: date | None
    start_time: time
    end_time: time
    is_recurring: bool
    created_at: datetime

    model_config = {"from_attributes": True}
