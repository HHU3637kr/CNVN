"""预约模块 API 测试"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.models.teacher_profile import TeacherProfile
from app.models.user import User

TEACHER_PROFILE_DATA = {
    "title": "专业中文教师",
    "about": "5年中文教学经验",
    "hourly_rate": 60000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语", "HSK备考"],
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


def vn_dt_local(d, hour: int, minute: int = 0) -> datetime:
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=tz)


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
