from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


ADMIN_DATABASE_URL = os.getenv(
    "CNVN_TEST_ADMIN_DATABASE_URL",
    "postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/postgres",
)
DATABASE_URL_TEMPLATE = os.getenv(
    "CNVN_TEST_DATABASE_URL_TEMPLATE",
    "postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/{database}",
)
BACKEND_DIR = Path(__file__).resolve().parents[2]


def _quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _database_url(database: str) -> str:
    if "{database}" in DATABASE_URL_TEMPLATE:
        return DATABASE_URL_TEMPLATE.format(database=database)
    base, _sep, _name = DATABASE_URL_TEMPLATE.rpartition("/")
    return f"{base}/{database}"


async def _create_database(database: str) -> None:
    engine = create_async_engine(ADMIN_DATABASE_URL, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            await conn.execute(text(f"CREATE DATABASE {_quote_identifier(database)}"))
    finally:
        await engine.dispose()


async def _drop_database(database: str) -> None:
    engine = create_async_engine(ADMIN_DATABASE_URL, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            await conn.execute(
                text(f"DROP DATABASE IF EXISTS {_quote_identifier(database)} WITH (FORCE)")
            )
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_alembic_empty_database_upgrades_to_head():
    database = f"cnvn_migration_test_{uuid.uuid4().hex[:10]}"
    await _create_database(database)
    database_url = _database_url(database)

    try:
        env = os.environ.copy()
        env["DATABASE_URL"] = database_url
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_DIR,
            env=env,
            text=True,
            capture_output=True,
            timeout=120,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr

        engine = create_async_engine(database_url)
        try:
            async with engine.connect() as conn:
                version = (
                    await conn.execute(text("SELECT version_num FROM alembic_version"))
                ).scalar_one()
                assert version == "006_add_dispute_cases"

                tables = {
                    row[0]
                    for row in (
                        await conn.execute(
                            text(
                                """
                                SELECT table_name
                                FROM information_schema.tables
                                WHERE table_schema = 'public'
                                """
                            )
                        )
                    ).all()
                }
                required_tables = {
                    "users",
                    "teacher_profiles",
                    "availabilities",
                    "lessons",
                    "wallets",
                    "transactions",
                    "ledger_accounts",
                    "payment_orders",
                    "settlement_snapshots",
                    "payout_orders",
                    "dispute_cases",
                    "dispute_events",
                }
                assert not (required_tables - tables)

                ledger_count = (
                    await conn.execute(text("SELECT count(*) FROM ledger_accounts"))
                ).scalar_one()
                assert ledger_count == 4

                lesson_time_range = (
                    await conn.execute(
                        text(
                            """
                            SELECT count(*)
                            FROM pg_proc
                            WHERE proname = 'lesson_time_range'
                            """
                        )
                    )
                ).scalar_one()
                assert lesson_time_range >= 1
        finally:
            await engine.dispose()
    finally:
        await _drop_database(database)
