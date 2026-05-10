from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import func, select

from app.models.ledger import LedgerAccount, SYSTEM_ACCOUNT_CODES
from app.models.payment import Transaction, Wallet
from app.models.payment_order import PaymentOrder, PayoutOrder, SettlementSnapshot
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.services import dispute_watcher


TEACHER_PROFILE_DATA = {
    "title": "Scenario Chinese Tutor",
    "about": "Scenario regression teacher profile",
    "hourly_rate": 60000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["HSK", "Speaking"],
}

LEDGER_ACCOUNT_NAMES = {
    "escrow": "Escrow",
    "platform_revenue": "Platform revenue",
    "tax_payable": "Tax payable",
    "teacher_payable": "Teacher payable",
}


def _register_payload(prefix: str) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"{prefix}_{suffix}@scenario.test",
        "password": "testpassword123",
        "full_name": f"{prefix} user",
        "phone": f"097{suffix}",
    }


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _register_and_login(client, prefix: str) -> tuple[dict[str, str], dict[str, str]]:
    payload = _register_payload(prefix)
    registered = await client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code in (200, 201), registered.text

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200, login.text
    return payload, _auth(login.json()["access_token"])


async def _login(client, email: str, password: str) -> dict[str, str]:
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return _auth(login.json()["access_token"])


async def _teacher_profile_id(db_session, email: str):
    result = await db_session.execute(
        select(TeacherProfile.id)
        .join(User, User.id == TeacherProfile.user_id)
        .where(User.email == email)
    )
    return result.scalar_one()


async def _teacher_user_id(db_session, teacher_profile_id):
    result = await db_session.execute(
        select(TeacherProfile.user_id).where(TeacherProfile.id == teacher_profile_id)
    )
    return result.scalar_one()


async def _ensure_ledger_accounts(db_session) -> None:
    for code in SYSTEM_ACCOUNT_CODES:
        existing = await db_session.execute(
            select(LedgerAccount).where(LedgerAccount.code == code)
        )
        if existing.scalars().first() is None:
            db_session.add(
                LedgerAccount(code=code, name=LEDGER_ACCOUNT_NAMES[code])
            )
    await db_session.flush()


async def _assert_fund_conservation(db_session, note: str) -> None:
    ledger_total = (
        await db_session.execute(
            select(func.coalesce(func.sum(LedgerAccount.balance), 0))
        )
    ).scalar_one()
    wallet_total = (
        await db_session.execute(select(func.coalesce(func.sum(Wallet.balance), 0)))
    ).scalar_one()
    topup_total = (
        await db_session.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.type == "topup"
            )
        )
    ).scalar_one()

    assert int(ledger_total) + int(wallet_total) == int(topup_total), note


@pytest.mark.asyncio
async def test_student_teacher_payment_release_scenario(client, db_session):
    await _ensure_ledger_accounts(db_session)
    baseline_accounts = {
        account.code: account.balance
        for account in (await db_session.execute(select(LedgerAccount))).scalars().all()
    }

    student, student_headers = await _register_and_login(client, "student")
    teacher, teacher_headers = await _register_and_login(client, "teacher")

    become_teacher = await client.post(
        "/api/v1/auth/become-teacher",
        json=TEACHER_PROFILE_DATA,
        headers=teacher_headers,
    )
    assert become_teacher.status_code in (200, 201), become_teacher.text
    teacher_headers = await _login(client, teacher["email"], teacher["password"])
    teacher_profile_id = await _teacher_profile_id(db_session, teacher["email"])

    local_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    local_start = datetime.now(local_tz).replace(microsecond=0) + timedelta(minutes=5)
    availability = await client.post(
        "/api/v1/availability",
        json={
            "specific_date": local_start.date().isoformat(),
            "start_time": "00:00:00",
            "end_time": "23:59:00",
            "is_recurring": False,
        },
        headers=teacher_headers,
    )
    assert availability.status_code in (200, 201), availability.text

    topup = await client.post(
        "/api/v1/wallet/topup",
        json={"amount": 500_000},
        headers=student_headers,
    )
    assert topup.status_code == 200, topup.text
    await _assert_fund_conservation(db_session, "after topup")

    create_lesson = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(teacher_profile_id),
            "scheduled_at": local_start.astimezone(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "duration_minutes": 60,
            "topic": "Scenario regression lesson",
        },
        headers=student_headers,
    )
    assert create_lesson.status_code == 201, create_lesson.text
    lesson_id = create_lesson.json()["id"]
    assert create_lesson.json()["status"] == "pending_confirmation"
    assert create_lesson.json()["price"] == 60_000
    await _assert_fund_conservation(db_session, "after lesson creation")

    order = (
        await db_session.execute(
            select(PaymentOrder).where(PaymentOrder.lesson_id == uuid.UUID(lesson_id))
        )
    ).scalars().first()
    assert order is not None
    assert order.status == "held"
    assert order.held_until is None

    confirmed = await client.patch(
        f"/api/v1/lessons/{lesson_id}/confirm",
        headers=teacher_headers,
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"

    started = await client.patch(
        f"/api/v1/lessons/{lesson_id}/start",
        headers=teacher_headers,
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"

    ended = await client.patch(
        f"/api/v1/lessons/{lesson_id}/end",
        headers=teacher_headers,
    )
    assert ended.status_code == 200, ended.text
    assert ended.json()["status"] == "completed"

    order = (
        await db_session.execute(
            select(PaymentOrder).where(PaymentOrder.lesson_id == uuid.UUID(lesson_id))
        )
    ).scalars().first()
    assert order is not None
    assert order.status == "held"
    assert order.held_until is not None

    order.held_until = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.flush()

    processed = await dispute_watcher.run_once(db_session, batch_size=10)
    assert processed == 1

    released_order = (
        await db_session.execute(select(PaymentOrder).where(PaymentOrder.id == order.id))
    ).scalars().first()
    assert released_order is not None
    assert released_order.status == "released"

    snapshot = (
        await db_session.execute(
            select(SettlementSnapshot).where(
                SettlementSnapshot.payment_order_id == order.id
            )
        )
    ).scalars().first()
    assert snapshot is not None
    assert (
        snapshot.commission_amount
        + snapshot.vat_amount
        + snapshot.pit_amount
        + snapshot.net_amount
        == snapshot.gross_amount
    )

    payout = (
        await db_session.execute(
            select(PayoutOrder).where(PayoutOrder.payment_order_id == order.id)
        )
    ).scalars().first()
    assert payout is not None
    assert payout.status == "paid"
    assert payout.net_amount == snapshot.net_amount

    teacher_user_id = await _teacher_user_id(db_session, teacher_profile_id)
    teacher_wallet = (
        await db_session.execute(select(Wallet).where(Wallet.user_id == teacher_user_id))
    ).scalars().first()
    assert teacher_wallet is not None
    assert teacher_wallet.balance == snapshot.net_amount

    accounts = {
        account.code: account.balance
        for account in (await db_session.execute(select(LedgerAccount))).scalars().all()
    }
    assert accounts["escrow"] == baseline_accounts["escrow"]
    assert (
        accounts["platform_revenue"]
        == baseline_accounts["platform_revenue"] + snapshot.commission_amount
    )
    assert (
        accounts["tax_payable"]
        == baseline_accounts["tax_payable"] + snapshot.vat_amount + snapshot.pit_amount
    )
    assert accounts["teacher_payable"] == baseline_accounts["teacher_payable"]

    await _assert_fund_conservation(db_session, "after release")
