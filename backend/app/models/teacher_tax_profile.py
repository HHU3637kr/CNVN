"""教师税务档案（plan.md §3.2.6 / FR-003）。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# 税务场景枚举（plan.md §2.1 FR-003）
TAX_SCENARIO_CN_RESIDENT = "cn_resident"
TAX_SCENARIO_VN_PASSPORT_IN_CN = "vn_passport_in_cn"
TAX_SCENARIO_VN_RESIDENT = "vn_resident"

TAX_SCENARIOS = (
    TAX_SCENARIO_CN_RESIDENT,
    TAX_SCENARIO_VN_PASSPORT_IN_CN,
    TAX_SCENARIO_VN_RESIDENT,
)

DEFAULT_TAX_SCENARIO = TAX_SCENARIO_VN_RESIDENT


class TeacherTaxProfile(Base):
    __tablename__ = "teacher_tax_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.id"),
        unique=True,
        nullable=False,
    )
    tax_scenario: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=DEFAULT_TAX_SCENARIO
    )
    id_doc_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    id_doc_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    vn_tax_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vn_residency_days_ytd: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    kyc_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    teacher = relationship("TeacherProfile")
