import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, Field, model_validator


class AvailabilityCreate(BaseModel):
    day_of_week: int | None = Field(None, ge=0, le=6)
    specific_date: date | None = None
    start_time: time
    end_time: time
    is_recurring: bool = True

    @model_validator(mode="after")
    def day_or_date(self) -> "AvailabilityCreate":
        if self.day_of_week is not None and self.specific_date is not None:
            raise ValueError("不能同时指定 day_of_week 与 specific_date")
        if self.day_of_week is None and self.specific_date is None:
            raise ValueError("须指定 day_of_week 或 specific_date")
        return self


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
