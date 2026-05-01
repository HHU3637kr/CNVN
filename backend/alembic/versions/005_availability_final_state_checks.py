"""add availability final-state checks

Revision ID: 005_availability_final_state_checks
Revises: 004_lesson_overlap_constraints
Create Date: 2026-05-01
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005_availability_final_state_checks"
down_revision: Union[str, None] = "004_lesson_overlap_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE availabilities
        ADD CONSTRAINT ck_availability_day_date_mutually_exclusive
        CHECK (
            (day_of_week IS NOT NULL AND specific_date IS NULL)
            OR
            (day_of_week IS NULL AND specific_date IS NOT NULL)
        )
        """
    )
    op.execute(
        """
        ALTER TABLE availabilities
        ADD CONSTRAINT ck_availability_recurring_matches_mode
        CHECK (
            (day_of_week IS NOT NULL AND is_recurring IS TRUE)
            OR
            (specific_date IS NOT NULL AND is_recurring IS FALSE)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE availabilities DROP CONSTRAINT IF EXISTS ck_availability_recurring_matches_mode"
    )
    op.execute(
        "ALTER TABLE availabilities DROP CONSTRAINT IF EXISTS ck_availability_day_date_mutually_exclusive"
    )
