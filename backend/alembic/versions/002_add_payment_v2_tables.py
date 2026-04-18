"""add payment v2 tables: payment_orders, payout_orders, settlement_snapshots, ledger, tax_profile

Revision ID: 002_add_payment_v2_tables
Revises: 001_add_settlement_fields
Create Date: 2026-04-18

参见 spec/03-功能实现/20260418-1810-支付系统合规改造/plan.md §3.2
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_add_payment_v2_tables"
down_revision: Union[str, None] = "001_add_settlement_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ledger_accounts (plan.md §3.2.4) ---
    op.create_table(
        "ledger_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("balance", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    # Seed 4 条固定系统户
    op.execute(
        """
        INSERT INTO ledger_accounts (id, code, name, balance, created_at) VALUES
          (gen_random_uuid(), 'escrow',            '代收托管户',   0, now()),
          (gen_random_uuid(), 'platform_revenue',  '平台营收户',   0, now()),
          (gen_random_uuid(), 'tax_payable',       '应缴税金户',   0, now()),
          (gen_random_uuid(), 'teacher_payable',   '教师应付户',   0, now())
        """
    )

    # --- ledger_entries (plan.md §3.2.5) ---
    op.create_table(
        "ledger_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("txn_group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("ref_type", sa.String(length=30), nullable=False),
        sa.Column("ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["ledger_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ledger_entries_txn_group", "ledger_entries", ["txn_group_id"]
    )
    op.create_index(
        "ix_ledger_entries_account_time",
        "ledger_entries",
        ["account_id", "created_at"],
    )
    op.create_index(
        "ix_ledger_entries_ref", "ledger_entries", ["ref_type", "ref_id"]
    )

    # --- payment_orders (plan.md §3.2.1) ---
    op.create_table(
        "payment_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gross_amount", sa.BigInteger(), nullable=False),
        sa.Column("channel", sa.String(length=20), server_default="mock", nullable=False),
        sa.Column("channel_txn_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("held_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    # 部分唯一索引：同一课程只允许一条非 refunded 的活跃订单
    op.create_index(
        "uq_payment_orders_lesson_active",
        "payment_orders",
        ["lesson_id"],
        unique=True,
        postgresql_where=sa.text("status <> 'refunded'"),
    )
    op.create_index(
        "ix_payment_orders_status_held_until",
        "payment_orders",
        ["status", "held_until"],
    )
    op.create_index(
        "ix_payment_orders_student", "payment_orders", ["student_id"]
    )

    # --- settlement_snapshots (plan.md §3.2.3) ---
    op.create_table(
        "settlement_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tax_scenario", sa.String(length=30), nullable=False),
        sa.Column("gross_amount", sa.BigInteger(), nullable=False),
        sa.Column("commission_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("commission_amount", sa.BigInteger(), nullable=False),
        sa.Column("tax_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("vat_amount", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("pit_amount", sa.BigInteger(), nullable=False),
        sa.Column("net_amount", sa.BigInteger(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["payment_order_id"], ["payment_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id"),
        sa.UniqueConstraint("payment_order_id"),
    )

    # SettlementSnapshot 不可变 trigger：DB 层拒绝 UPDATE（plan.md §3.2.3）
    op.execute(
        """
        CREATE OR REPLACE FUNCTION reject_settlement_snapshot_update()
        RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'settlement_snapshots 是不可变快照，不允许 UPDATE';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_settlement_snapshots_no_update
        BEFORE UPDATE ON settlement_snapshots
        FOR EACH ROW EXECUTE FUNCTION reject_settlement_snapshot_update();
        """
    )

    # --- payout_orders (plan.md §3.2.2) ---
    op.create_table(
        "payout_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("settlement_snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("net_amount", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("channel", sa.String(length=20), server_default="mock", nullable=False),
        sa.Column("channel_txn_id", sa.String(length=128), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["payment_order_id"], ["payment_orders.id"]),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["teacher_profiles.id"]),
        sa.ForeignKeyConstraint(
            ["settlement_snapshot_id"], ["settlement_snapshots.id"]
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_order_id"),
    )
    op.create_index("ix_payout_orders_teacher", "payout_orders", ["teacher_id"])
    op.create_index("ix_payout_orders_status", "payout_orders", ["status"])

    # --- teacher_tax_profiles (plan.md §3.2.6) ---
    op.create_table(
        "teacher_tax_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "tax_scenario",
            sa.String(length=30),
            server_default="vn_resident",
            nullable=False,
        ),
        sa.Column("id_doc_type", sa.String(length=20), nullable=True),
        sa.Column("id_doc_no", sa.String(length=40), nullable=True),
        sa.Column("vn_tax_code", sa.String(length=20), nullable=True),
        sa.Column(
            "vn_residency_days_ytd",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("kyc_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teacher_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id"),
    )

    # 回填：为所有现有 TeacherProfile 生成默认 TaxProfile（plan.md §6.1 R6）
    op.execute(
        """
        INSERT INTO teacher_tax_profiles (
          id, teacher_id, tax_scenario, vn_residency_days_ytd, created_at, updated_at
        )
        SELECT gen_random_uuid(), tp.id, 'vn_resident', 0, now(), now()
        FROM teacher_profiles tp
        """
    )


def downgrade() -> None:
    op.drop_table("teacher_tax_profiles")

    op.drop_index("ix_payout_orders_status", table_name="payout_orders")
    op.drop_index("ix_payout_orders_teacher", table_name="payout_orders")
    op.drop_table("payout_orders")

    op.execute("DROP TRIGGER IF EXISTS trg_settlement_snapshots_no_update ON settlement_snapshots")
    op.execute("DROP FUNCTION IF EXISTS reject_settlement_snapshot_update()")
    op.drop_table("settlement_snapshots")

    op.drop_index("ix_payment_orders_student", table_name="payment_orders")
    op.drop_index(
        "ix_payment_orders_status_held_until", table_name="payment_orders"
    )
    op.drop_index("uq_payment_orders_lesson_active", table_name="payment_orders")
    op.drop_table("payment_orders")

    op.drop_index("ix_ledger_entries_ref", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_account_time", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_txn_group", table_name="ledger_entries")
    op.drop_table("ledger_entries")

    op.drop_table("ledger_accounts")
