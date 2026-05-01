from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.config import settings
from app.models.ledger import LedgerAccount, SYSTEM_ACCOUNT_CODES
from app.models.lesson import Lesson
from app.models.payment_order import PaymentOrder
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.services import payment_service


TEACHER_PROFILE_DATA = {
    "title": "结算测试教师",
    "about": "用于支付一致性测试",
    "hourly_rate": 60000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语"],
}

LEDGER_ACCOUNT_NAMES = {
    "escrow": "托管账户",
    "platform_revenue": "平台收入账户",
    "tax_payable": "税费应付账户",
    "teacher_payable": "教师应付账户",
}


def make_register(prefix: str) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"{prefix}_{suffix}@example.com",
        "password": "testpassword123",
        "full_name": "测试用户",
        "phone": f"093{suffix}",
    }


async def teacher_id_for_email(db_session, email: str):
    r = await db_session.execute(
        select(TeacherProfile.id)
        .join(User, User.id == TeacherProfile.user_id)
        .where(User.email == email)
    )
    return r.scalar_one()


async def user_id_for_email(db_session, email: str):
    r = await db_session.execute(select(User.id).where(User.email == email))
    return r.scalar_one()


def vn_dt_local(d, hour: int, minute: int = 0) -> datetime:
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=tz)


async def ensure_ledger_accounts(db_session):
    for code in SYSTEM_ACCOUNT_CODES:
        existing = await db_session.execute(
            select(LedgerAccount).where(LedgerAccount.code == code)
        )
        if existing.scalars().first() is None:
            db_session.add(
                LedgerAccount(
                    code=code,
                    name=LEDGER_ACCOUNT_NAMES[code],
                )
            )
    await db_session.flush()


async def create_confirmed_lesson(client, db_session):
    await ensure_ledger_accounts(db_session)

    student = make_register("pay_stu")
    await client.post("/api/v1/auth/register", json=student)
    login_student = await client.post(
        "/api/v1/auth/login",
        json={"email": student["email"], "password": student["password"]},
    )
    h_student = {"Authorization": f"Bearer {login_student.json()['access_token']}"}

    teacher = make_register("pay_tch")
    await client.post("/api/v1/auth/register", json=teacher)
    login_teacher = await client.post(
        "/api/v1/auth/login",
        json={"email": teacher["email"], "password": teacher["password"]},
    )
    h_teacher = {"Authorization": f"Bearer {login_teacher.json()['access_token']}"}
    await client.post(
        "/api/v1/auth/become-teacher",
        json=TEACHER_PROFILE_DATA,
        headers=h_teacher,
    )

    teacher_id = await teacher_id_for_email(db_session, teacher["email"])
    day = (datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")) + timedelta(days=7)).date()
    await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "21:00:00",
            "is_recurring": False,
        },
        headers=h_teacher,
    )
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_student)

    scheduled_at = vn_dt_local(day, 10, 0).astimezone(timezone.utc)
    created = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(teacher_id),
            "scheduled_at": scheduled_at.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
            "topic": "支付一致性测试",
        },
        headers=h_student,
    )
    assert created.status_code == 201, created.text
    lesson_id = created.json()["id"]

    confirmed = await client.patch(
        f"/api/v1/lessons/{lesson_id}/confirm",
        headers=h_teacher,
    )
    assert confirmed.status_code == 200, confirmed.text
    return lesson_id, h_student


async def create_teacher_and_student(client, db_session, prefix: str):
    student = make_register(f"{prefix}_stu")
    await client.post("/api/v1/auth/register", json=student)
    student_id = await user_id_for_email(db_session, student["email"])

    teacher = make_register(f"{prefix}_tch")
    await client.post("/api/v1/auth/register", json=teacher)
    login_teacher = await client.post(
        "/api/v1/auth/login",
        json={"email": teacher["email"], "password": teacher["password"]},
    )
    h_teacher = {"Authorization": f"Bearer {login_teacher.json()['access_token']}"}
    await client.post(
        "/api/v1/auth/become-teacher",
        json=TEACHER_PROFILE_DATA,
        headers=h_teacher,
    )
    teacher_id = await teacher_id_for_email(db_session, teacher["email"])
    return student_id, teacher_id


@pytest.mark.asyncio
async def test_cancel_less_than_24h_sets_held_until(client, db_session):
    lesson_id, h_student = await create_confirmed_lesson(client, db_session)

    scheduled_at = datetime.now(timezone.utc) + timedelta(hours=2)
    r_lesson = await db_session.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r_lesson.scalars().first()
    assert lesson is not None
    lesson.scheduled_at = scheduled_at
    await db_session.commit()

    cancelled = await client.patch(
        f"/api/v1/lessons/{lesson_id}/cancel",
        json={"reason": "临时有事"},
        headers=h_student,
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    r_order = await db_session.execute(
        select(PaymentOrder).where(PaymentOrder.lesson_id == lesson_id)
    )
    order = r_order.scalars().first()
    assert order is not None
    assert order.status == "held"
    assert order.held_until is not None

    expected = scheduled_at + timedelta(
        minutes=lesson.duration_minutes,
        hours=settings.DISPUTE_WINDOW_HOURS,
    )
    assert abs((order.held_until - expected).total_seconds()) < 1


@pytest.mark.asyncio
async def test_cancel_at_least_24h_still_refunds_student(client, db_session):
    lesson_id, h_student = await create_confirmed_lesson(client, db_session)

    before_cancel = await client.get("/api/v1/wallet", headers=h_student)
    assert before_cancel.status_code == 200, before_cancel.text
    assert before_cancel.json()["balance"] == 440_000

    cancelled = await client.patch(
        f"/api/v1/lessons/{lesson_id}/cancel",
        json={"reason": "提前改期"},
        headers=h_student,
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    r_order = await db_session.execute(
        select(PaymentOrder).where(PaymentOrder.lesson_id == lesson_id)
    )
    order = r_order.scalars().first()
    assert order is not None
    assert order.status == "refunded"
    assert order.held_until is None

    after_cancel = await client.get("/api/v1/wallet", headers=h_student)
    assert after_cancel.status_code == 200, after_cancel.text
    assert after_cancel.json()["balance"] == 500_000


@pytest.mark.asyncio
async def test_commission_rate_counts_reviewed_lessons(client, db_session):
    student_id, teacher_id = await create_teacher_and_student(
        client, db_session, "tier_reviewed"
    )

    actual_end_at = datetime.now(timezone.utc).replace(
        day=15, hour=12, minute=0, second=0, microsecond=0
    )
    for i in range(21):
        lesson_end_at = actual_end_at - timedelta(hours=i)
        db_session.add(
            Lesson(
                student_id=student_id,
                teacher_id=teacher_id,
                scheduled_at=lesson_end_at - timedelta(hours=1),
                duration_minutes=60,
                status="reviewed",
                price=60_000,
                actual_start_at=lesson_end_at - timedelta(hours=1),
                actual_end_at=lesson_end_at,
            )
        )
    await db_session.commit()

    rate = await payment_service.resolve_commission_rate(
        db_session, teacher_id, actual_end_at.date()
    )
    assert rate == Decimal("0.15")


@pytest.mark.asyncio
async def test_commission_rate_uses_actual_end_at_month(client, db_session):
    student_id, teacher_id = await create_teacher_and_student(
        client, db_session, "tier_actual_end"
    )

    month = datetime.now(timezone.utc).replace(
        day=15, hour=12, minute=0, second=0, microsecond=0
    )
    for i in range(21):
        lesson_end_at = month - timedelta(hours=i)
        db_session.add(
            Lesson(
                student_id=student_id,
                teacher_id=teacher_id,
                scheduled_at=lesson_end_at.replace(day=1) - timedelta(days=1),
                duration_minutes=60,
                status="completed",
                price=60_000,
                actual_start_at=lesson_end_at - timedelta(hours=1),
                actual_end_at=lesson_end_at,
            )
        )
    await db_session.commit()

    rate = await payment_service.resolve_commission_rate(
        db_session, teacher_id, month.date()
    )
    assert rate == Decimal("0.15")


@pytest.mark.asyncio
async def test_commission_rate_excludes_invalid_lessons(client, db_session):
    student_id, teacher_id = await create_teacher_and_student(
        client, db_session, "tier_invalid"
    )

    actual_end_at = datetime.now(timezone.utc).replace(
        day=15, hour=12, minute=0, second=0, microsecond=0
    )
    for i in range(20):
        lesson_end_at = actual_end_at - timedelta(hours=i)
        db_session.add(
            Lesson(
                student_id=student_id,
                teacher_id=teacher_id,
                scheduled_at=lesson_end_at - timedelta(hours=1),
                duration_minutes=60,
                status="completed",
                price=60_000,
                actual_start_at=lesson_end_at - timedelta(hours=1),
                actual_end_at=lesson_end_at,
            )
        )

    invalid_statuses = ["cancelled", "expired"]
    for i, status in enumerate(invalid_statuses):
        db_session.add(
            Lesson(
                student_id=student_id,
                teacher_id=teacher_id,
                scheduled_at=actual_end_at - timedelta(days=i + 1),
                duration_minutes=60,
                status=status,
                price=60_000,
                actual_start_at=actual_end_at - timedelta(days=i + 1, hours=1),
                actual_end_at=actual_end_at - timedelta(days=i + 1),
            )
        )
    db_session.add(
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=actual_end_at - timedelta(days=3),
            duration_minutes=60,
            status="completed",
            price=60_000,
            actual_start_at=actual_end_at - timedelta(days=3, hours=1),
            actual_end_at=None,
        )
    )
    await db_session.commit()

    rate = await payment_service.resolve_commission_rate(
        db_session, teacher_id, actual_end_at.date()
    )
    assert rate == Decimal("0.2")
