"""add lesson overlap exclusion constraints

Revision ID: 004_lesson_overlap_constraints
Revises: 003_drop_settlement
Create Date: 2026-05-01

参见 spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan.md §3.2
"""
from typing import Sequence, Union

from alembic import op

revision: str = "004_lesson_overlap_constraints"
down_revision: Union[str, None] = "003_drop_settlement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION lesson_time_range(
          starts_at timestamptz,
          duration_minutes integer
        )
        RETURNS tstzrange
        LANGUAGE sql
        IMMUTABLE
        STRICT
        AS $$
          SELECT tstzrange(
            starts_at,
            starts_at + make_interval(mins => duration_minutes),
            '[)'
          )
        $$;
        """
    )
    op.execute(
        """
        ALTER TABLE lessons
        ADD CONSTRAINT ex_lessons_teacher_no_overlap
        EXCLUDE USING gist (
          teacher_id WITH =,
          lesson_time_range(scheduled_at, duration_minutes) WITH &&
        )
        WHERE (status NOT IN ('cancelled', 'expired'))
        """
    )
    op.execute(
        """
        ALTER TABLE lessons
        ADD CONSTRAINT ex_lessons_student_no_overlap
        EXCLUDE USING gist (
          student_id WITH =,
          lesson_time_range(scheduled_at, duration_minutes) WITH &&
        )
        WHERE (status NOT IN ('cancelled', 'expired'))
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE lessons DROP CONSTRAINT IF EXISTS ex_lessons_student_no_overlap"
    )
    op.execute(
        "ALTER TABLE lessons DROP CONSTRAINT IF EXISTS ex_lessons_teacher_no_overlap"
    )
    op.execute("DROP FUNCTION IF EXISTS lesson_time_range(timestamptz, integer)")
