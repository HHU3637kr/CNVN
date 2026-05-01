import asyncio
import os
import sys
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, os.getcwd())

from app.config import settings
from app.database import Base
from app.models import *  # noqa: F401,F403


LEDGER_ACCOUNT_NAMES = {
    "escrow": "托管账户",
    "platform_revenue": "平台收入账户",
    "tax_payable": "税费应付账户",
    "teacher_payable": "教师应付账户",
}


async def main() -> None:
    engine = create_async_engine(settings.async_database_url, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        await conn.execute(
            text(
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
        )
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                """
                INSERT INTO ledger_accounts (id, code, name, balance, created_at)
                VALUES (:id, :code, :name, 0, now())
                ON CONFLICT (code) DO NOTHING
                """
            ),
            [
                {"id": uuid.uuid4(), "code": code, "name": name}
                for code, name in LEDGER_ACCOUNT_NAMES.items()
            ],
        )
    await engine.dispose()
    print("smoke database initialized")


if __name__ == "__main__":
    asyncio.run(main())
