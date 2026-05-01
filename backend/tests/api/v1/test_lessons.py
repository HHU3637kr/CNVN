"""预约模块 API 测试"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.ledger import LedgerAccount, SYSTEM_ACCOUNT_CODES
from app.models.lesson import Lesson
from app.models.payment import Wallet
from app.models.payment_order import PaymentOrder
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.lesson import LessonCreate
from app.services import lesson_service
from tests.conftest import TEST_DATABASE_URL

TEACHER_PROFILE_DATA = {
    "title": "专业中文教师",
    "about": "5年中文教学经验",
    "hourly_rate": 60000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语", "HSK备考"],
}

LEDGER_ACCOUNT_NAMES = {
    "escrow": "托管账户",
    "platform_revenue": "平台收入账户",
    "tax_payable": "税费应付账户",
    "teacher_payable": "教师应付账户",
}


def make_register_data():
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"lesson_{suffix}@example.com",
        "password": "testpassword123",
        "full_name": "测试用户",
        "phone": f"090{suffix}",
    }


async def get_teacher_profile_id(db_session, email: str):
    r = await db_session.execute(
        select(TeacherProfile.id)
        .join(User, User.id == TeacherProfile.user_id)
        .where(User.email == email)
    )
    return r.scalar_one()


async def get_user_id(db_session, email: str):
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


async def register_and_login(client):
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    return data, {"Authorization": f"Bearer {login.json()['access_token']}"}


async def create_teacher(client, db_session):
    teacher_data, headers = await register_and_login(client)
    await client.post(
        "/api/v1/auth/become-teacher",
        json=TEACHER_PROFILE_DATA,
        headers=headers,
    )
    teacher_id = await get_teacher_profile_id(db_session, teacher_data["email"])
    return teacher_data, headers, teacher_id


async def create_day_availability(client, teacher_headers, day):
    return await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "21:00:00",
            "is_recurring": False,
        },
        headers=teacher_headers,
    )


async def wallet_balance(db_session, user_id):
    r = await db_session.execute(select(Wallet.balance).where(Wallet.user_id == user_id))
    return r.scalar_one()


@pytest.mark.asyncio
async def test_lesson_rejects_without_availability(client, db_session):
    """无可用时段时无法预约"""
    st = make_register_data()
    await client.post("/api/v1/auth/register", json=st)
    login_st = await client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    tok_st = login_st.json()["access_token"]
    h_st = {"Authorization": f"Bearer {tok_st}"}

    te = make_register_data()
    await client.post("/api/v1/auth/register", json=te)
    login_te = await client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    tok_te = login_te.json()["access_token"]
    h_te = {"Authorization": f"Bearer {tok_te}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te)

    tid = await get_teacher_profile_id(db_session, te["email"])

    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_st)

    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=10)).date()
    sched = vn_dt_local(day, 14, 0).astimezone(ZoneInfo("UTC"))

    resp = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(tid),
            "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
            "topic": "试听课",
        },
        headers=h_st,
    )
    assert resp.status_code == 400
    assert "可授课" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_lesson_happy_path_and_cancel(client, db_session):
    """有时段、有余额：预约 → 确认 → 取消（≥24h）"""
    st = make_register_data()
    await client.post("/api/v1/auth/register", json=st)
    login_st = await client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    tok_st = login_st.json()["access_token"]
    h_st = {"Authorization": f"Bearer {tok_st}"}

    te = make_register_data()
    await client.post("/api/v1/auth/register", json=te)
    login_te = await client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    tok_te = login_te.json()["access_token"]
    h_te = {"Authorization": f"Bearer {tok_te}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te)

    tid = await get_teacher_profile_id(db_session, te["email"])

    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=7)).date()
    await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "21:00:00",
            "is_recurring": False,
        },
        headers=h_te,
    )

    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_st)
    await ensure_ledger_accounts(db_session)

    sched = vn_dt_local(day, 15, 0).astimezone(ZoneInfo("UTC"))
    cr = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(tid),
            "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
            "topic": "试听课",
        },
        headers=h_st,
    )
    assert cr.status_code == 201, cr.text
    lesson_id = cr.json()["id"]
    assert cr.json()["status"] == "pending_confirmation"
    assert cr.json()["price"] == 60_000

    w = await client.get("/api/v1/wallet", headers=h_st)
    assert w.json()["balance"] == 500_000 - 60_000

    conf = await client.patch(
        f"/api/v1/lessons/{lesson_id}/confirm",
        headers=h_te,
    )
    assert conf.status_code == 200
    assert conf.json()["status"] == "confirmed"

    can = await client.patch(
        f"/api/v1/lessons/{lesson_id}/cancel",
        json={"reason": "改期"},
        headers=h_st,
    )
    assert can.status_code == 200
    assert can.json()["status"] == "cancelled"

    w2 = await client.get("/api/v1/wallet", headers=h_st)
    assert w2.json()["balance"] == 500_000


@pytest.mark.asyncio
async def test_lesson_insufficient_balance(client, db_session):
    st = make_register_data()
    await client.post("/api/v1/auth/register", json=st)
    login_st = await client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    h_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    te = make_register_data()
    await client.post("/api/v1/auth/register", json=te)
    login_te = await client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    h_te = {"Authorization": f"Bearer {login_te.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te)

    tid = await get_teacher_profile_id(db_session, te["email"])
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=7)).date()
    await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "21:00:00",
            "is_recurring": False,
        },
        headers=h_te,
    )

    sched = vn_dt_local(day, 15, 0).astimezone(ZoneInfo("UTC"))
    cr = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(tid),
            "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
        },
        headers=h_st,
    )
    assert cr.status_code == 400
    assert "余额" in cr.json()["detail"]


@pytest.mark.asyncio
async def test_start_end_lesson(client, db_session):
    st = make_register_data()
    await client.post("/api/v1/auth/register", json=st)
    login_st = await client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    h_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    te = make_register_data()
    await client.post("/api/v1/auth/register", json=te)
    login_te = await client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    h_te = {"Authorization": f"Bearer {login_te.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te)

    tid = await get_teacher_profile_id(db_session, te["email"])
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=7)).date()
    await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "21:00:00",
            "is_recurring": False,
        },
        headers=h_te,
    )
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_st)
    await ensure_ledger_accounts(db_session)

    sched = vn_dt_local(day, 10, 0).astimezone(ZoneInfo("UTC"))
    cr = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(tid),
            "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
        },
        headers=h_st,
    )
    lesson_id = cr.json()["id"]
    await client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)

    st_r = await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
    assert st_r.status_code == 200
    assert st_r.json()["status"] == "in_progress"

    en = await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)
    assert en.status_code == 200
    assert en.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_lesson_rejects_teacher_overlap_with_409_and_no_second_charge(
    client, db_session
):
    student_a, h_a = await register_and_login(client)
    student_b, h_b = await register_and_login(client)
    _, h_te, teacher_id = await create_teacher(client, db_session)

    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=8)).date()
    await create_day_availability(client, h_te, day)
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_a)
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_b)
    await ensure_ledger_accounts(db_session)

    first_start = vn_dt_local(day, 15, 0).astimezone(ZoneInfo("UTC"))
    first = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(teacher_id),
            "scheduled_at": first_start.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
        },
        headers=h_a,
    )
    assert first.status_code == 201, first.text

    overlap_start = vn_dt_local(day, 15, 30).astimezone(ZoneInfo("UTC"))
    second = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(teacher_id),
            "scheduled_at": overlap_start.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
        },
        headers=h_b,
    )
    assert second.status_code == 409
    assert second.json()["detail"] == "该时段与已有课程冲突"

    student_b_id = await get_user_id(db_session, student_b["email"])
    assert await wallet_balance(db_session, student_b_id) == 500_000

    lessons = (
        await db_session.execute(select(Lesson).where(Lesson.teacher_id == teacher_id))
    ).scalars().all()
    assert len(lessons) == 1

    student_b_orders = (
        await db_session.execute(
            select(PaymentOrder).where(PaymentOrder.student_id == student_b_id)
        )
    ).scalars().all()
    assert student_b_orders == []


@pytest.mark.asyncio
async def test_lesson_rejects_student_overlap_with_409_and_single_charge(
    client, db_session
):
    student, h_st = await register_and_login(client)
    _, h_t1, teacher_1_id = await create_teacher(client, db_session)
    _, h_t2, teacher_2_id = await create_teacher(client, db_session)

    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=9)).date()
    await create_day_availability(client, h_t1, day)
    await create_day_availability(client, h_t2, day)
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_st)
    await ensure_ledger_accounts(db_session)

    first_start = vn_dt_local(day, 16, 0).astimezone(ZoneInfo("UTC"))
    first = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(teacher_1_id),
            "scheduled_at": first_start.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
        },
        headers=h_st,
    )
    assert first.status_code == 201, first.text

    overlap_start = vn_dt_local(day, 16, 30).astimezone(ZoneInfo("UTC"))
    second = await client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(teacher_2_id),
            "scheduled_at": overlap_start.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
        },
        headers=h_st,
    )
    assert second.status_code == 409
    assert second.json()["detail"] == "该时段与已有课程冲突"

    student_id = await get_user_id(db_session, student["email"])
    assert await wallet_balance(db_session, student_id) == 440_000

    lessons = (
        await db_session.execute(select(Lesson).where(Lesson.student_id == student_id))
    ).scalars().all()
    assert len(lessons) == 1


@pytest.mark.asyncio
async def test_concurrent_overlap_uses_exclusion_constraint_without_double_charge(
    client, db_session, monkeypatch
):
    student_a, h_a = await register_and_login(client)
    student_b, h_b = await register_and_login(client)
    _, h_te, teacher_id = await create_teacher(client, db_session)

    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=10)).date()
    await create_day_availability(client, h_te, day)
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_a)
    await client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_b)
    await ensure_ledger_accounts(db_session)
    await db_session.commit()

    student_a_id = await get_user_id(db_session, student_a["email"])
    student_b_id = await get_user_id(db_session, student_b["email"])
    scheduled_at = vn_dt_local(day, 11, 0).astimezone(ZoneInfo("UTC"))
    payload = LessonCreate(
        teacher_id=teacher_id,
        scheduled_at=scheduled_at,
        duration_minutes=60,
    )

    async def no_preflight_overlap(*args, **kwargs):
        return False

    monkeypatch.setattr(lesson_service, "_has_overlap", no_preflight_overlap)

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def book(student_id):
        async with session_factory() as session:
            try:
                lesson = await lesson_service.create_lesson(
                    session,
                    SimpleNamespace(id=student_id, teacher_profile=None),
                    payload,
                )
                return "success", lesson.student_id
            except lesson_service.LessonBookingConflict as e:
                return "conflict", str(e)

    try:
        results = await asyncio.gather(book(student_a_id), book(student_b_id))
    finally:
        await engine.dispose()

    assert [result[0] for result in results].count("success") == 1
    assert [result[0] for result in results].count("conflict") == 1
    assert any(result == ("conflict", "该时段与已有课程冲突") for result in results)

    success_student_id = next(result[1] for result in results if result[0] == "success")
    failed_student_id = (
        student_b_id if success_student_id == student_a_id else student_a_id
    )

    assert await wallet_balance(db_session, success_student_id) == 440_000
    assert await wallet_balance(db_session, failed_student_id) == 500_000

    created = (
        await db_session.execute(
            select(Lesson).where(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at == scheduled_at,
            )
        )
    ).scalars().all()
    assert len(created) == 1


@pytest.mark.asyncio
async def test_lesson_list_and_detail_include_classroom_entry_fields(
    client, db_session
):
    student, h_st = await register_and_login(client)
    _, _, teacher_id = await create_teacher(client, db_session)
    student_id = await get_user_id(db_session, student["email"])

    now = datetime.now(timezone.utc).replace(microsecond=0)
    rows = [
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now + timedelta(days=2),
            duration_minutes=30,
            status="pending_confirmation",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now + timedelta(days=3),
            duration_minutes=30,
            status="confirmed",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now + timedelta(minutes=5),
            duration_minutes=30,
            status="confirmed",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now - timedelta(hours=2),
            duration_minutes=30,
            status="confirmed",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now - timedelta(hours=5),
            duration_minutes=30,
            status="in_progress",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now - timedelta(hours=8),
            duration_minutes=30,
            status="completed",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now - timedelta(hours=11),
            duration_minutes=30,
            status="reviewed",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now + timedelta(hours=1),
            duration_minutes=30,
            status="cancelled",
            price=30_000,
        ),
        Lesson(
            student_id=student_id,
            teacher_id=teacher_id,
            scheduled_at=now + timedelta(hours=1),
            duration_minutes=30,
            status="expired",
            price=30_000,
        ),
    ]
    db_session.add_all(rows)
    await db_session.commit()

    listed = await client.get(
        "/api/v1/lessons?role=student&page_size=100",
        headers=h_st,
    )
    assert listed.status_code == 200, listed.text
    by_id = {item["id"]: item for item in listed.json()["items"]}

    pending = by_id[str(rows[0].id)]
    assert pending["can_enter_classroom"] is False
    assert pending["classroom_unavailable_reason"] == "等待老师确认"

    confirmed_before_window = by_id[str(rows[1].id)]
    assert confirmed_before_window["can_enter_classroom"] is False
    assert confirmed_before_window["classroom_unavailable_reason"] == "未到可进入时间"

    confirmed_in_window = by_id[str(rows[2].id)]
    assert confirmed_in_window["can_enter_classroom"] is True
    assert confirmed_in_window["classroom_unavailable_reason"] is None

    confirmed_after_window = by_id[str(rows[3].id)]
    assert confirmed_after_window["can_enter_classroom"] is False
    assert confirmed_after_window["classroom_unavailable_reason"] == "课堂进入时间已过"

    in_progress = by_id[str(rows[4].id)]
    assert in_progress["can_enter_classroom"] is True
    assert in_progress["classroom_unavailable_reason"] is None

    completed = by_id[str(rows[5].id)]
    reviewed = by_id[str(rows[6].id)]
    assert completed["classroom_unavailable_reason"] == "课程已完成"
    assert reviewed["classroom_unavailable_reason"] == "课程已完成"

    cancelled = by_id[str(rows[7].id)]
    expired = by_id[str(rows[8].id)]
    assert cancelled["classroom_unavailable_reason"] == "课程已取消"
    assert expired["classroom_unavailable_reason"] == "课程已过期"

    expected_ends_at = rows[2].scheduled_at + timedelta(minutes=30)
    actual_ends_at = datetime.fromisoformat(
        confirmed_in_window["ends_at"].replace("Z", "+00:00")
    )
    assert actual_ends_at == expected_ends_at

    detail = await client.get(f"/api/v1/lessons/{rows[2].id}", headers=h_st)
    assert detail.status_code == 200
    assert detail.json()["ends_at"] == confirmed_in_window["ends_at"]
    assert detail.json()["can_enter_classroom"] is True
