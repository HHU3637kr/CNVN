"""add dispute cases

Revision ID: 006_add_dispute_cases
Revises: 005_availability_checks
Create Date: 2026-05-01
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_add_dispute_cases"
down_revision: Union[str, None] = "005_availability_checks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dispute_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("reason_code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("operator_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["operator_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["payment_order_id"], ["payment_orders.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["teacher_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_dispute_cases_payment_order_id",
        "dispute_cases",
        ["payment_order_id"],
    )
    op.create_index(
        "ix_dispute_cases_status_created_at",
        "dispute_cases",
        ["status", "created_at"],
    )
    op.create_index(
        "uq_dispute_cases_payment_order_active",
        "dispute_cases",
        ["payment_order_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('open', 'processing')"),
    )
    op.create_table(
        "dispute_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dispute_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("from_status", sa.String(length=30), nullable=True),
        sa.Column("to_status", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["dispute_id"], ["dispute_cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_dispute_events_dispute_created_at",
        "dispute_events",
        ["dispute_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_dispute_events_dispute_created_at", table_name="dispute_events")
    op.drop_table("dispute_events")
    op.drop_index("uq_dispute_cases_payment_order_active", table_name="dispute_cases")
    op.drop_index("ix_dispute_cases_status_created_at", table_name="dispute_cases")
    op.drop_index("ix_dispute_cases_payment_order_id", table_name="dispute_cases")
    op.drop_table("dispute_cases")
