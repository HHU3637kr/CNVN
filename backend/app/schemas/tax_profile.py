"""TeacherTaxProfile schemas（plan.md §3.2.6 / S8）。"""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TaxScenarioLiteral = Literal["cn_resident", "vn_passport_in_cn", "vn_resident"]


class TeacherTaxProfileOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    tax_scenario: str
    id_doc_type: str | None
    id_doc_no: str | None
    vn_tax_code: str | None
    vn_residency_days_ytd: int
    kyc_verified_at: datetime | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeacherTaxProfileUpdate(BaseModel):
    tax_scenario: TaxScenarioLiteral | None = None
    id_doc_type: str | None = Field(default=None, max_length=20)
    id_doc_no: str | None = Field(default=None, max_length=40)
    vn_tax_code: str | None = Field(default=None, max_length=20)
    vn_residency_days_ytd: int | None = Field(default=None, ge=0, le=400)
