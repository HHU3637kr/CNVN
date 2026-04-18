"""drop Lesson settlement fields (settled_at, teacher_amount, platform_fee_rate)

Revision ID: 003_drop_settlement
Revises: 002_add_payment_v2_tables
Create Date: 2026-04-18

参见 spec/03-功能实现/20260418-1810-支付系统合规改造/plan.md §1.4
结算数据统一查 SettlementSnapshot，Lesson 不再冗余结算字段。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_drop_settlement"
down_revision: Union[str, None] = "002_add_payment_v2_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("lessons", "settled_at")
    op.drop_column("lessons", "teacher_amount")
    op.drop_column("lessons", "platform_fee_rate")


def downgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column(
            "platform_fee_rate", sa.Numeric(precision=3, scale=2), nullable=True
        ),
    )
    op.add_column(
        "lessons", sa.Column("teacher_amount", sa.Integer(), nullable=True)
    )
    op.add_column(
        "lessons",
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
    )
