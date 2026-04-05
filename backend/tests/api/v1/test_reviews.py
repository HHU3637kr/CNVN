"""评价模块 API 测试"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.models.lesson import Lesson
from app.models.teacher_profile import TeacherProfile
from app.models.user import User

TEACHER_PROFILE_DATA = {
    "title": "评价用教师",
    "about": "简介",
    "hourly_rate": 60000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语"],
}


def make_register(prefix: str = "rev"):
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"{prefix}_{suffix}@example.com",
        "password": "testpassword123",
        "full_name": "测试",
        "phone": f"092{suffix}",
    }


async def teacher_id_for_email(db_session, email: str):
    r = await db_session.execute(
        select(TeacherProfile.id)
        .join(User, User.id == TeacherProfile.user_id)
        .where(User.email == email)
    )
    return r.scalar_one()


def vn_dt_local(d, hour: int, minute: int = 0) -> datetime:
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=tz)


async def _completed_lesson_setup(client, db_session):
    """学生 + 教师 + 时段 + 预约 + 确认 + 开始 + 结束 → completed。返回 (h_st, h_te, lesson_id, tid)。"""
    st = make_register("stu")
    await client.post("/api/v1/auth/register", json=st)
    login_st = await client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    h_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    te = make_register("tch")
    await client.post("/api/v1/auth/register", json=te)
    login_te = await client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    h_te = {"Authorization": f"Bearer {login_te.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te)

    tid = await teacher_id_for_email(db_session, te["email"])
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
    await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
    en = await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)
    assert en.json()["status"] == "completed"
    return h_st, h_te, lesson_id, tid


@pytest.mark.asyncio
async def test_create_review_updates_teacher_and_lesson(client, db_session):
    h_st, _h_te, lesson_id, tid = await _completed_lesson_setup(client, db_session)

    resp = await client.post(
        "/api/v1/reviews",
        json={
            "lesson_id": lesson_id,
            "rating_overall": 5,
            "rating_teaching": 5,
            "rating_punctuality": 4,
            "rating_communication": 5,
            "content": "很好",
        },
        headers=h_st,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["rating_overall"] == 5
    rid = body["id"]

    g = await client.get(f"/api/v1/reviews/{rid}")
    assert g.status_code == 200
    assert g.json()["reviewer_name"] == "测试"

    t = await client.get(f"/api/v1/teachers/{tid}")
    assert float(t.json()["avg_rating"]) == 5.0
    assert t.json()["total_reviews"] == 1

    r_lesson = await db_session.execute(select(Lesson).where(Lesson.id == lesson_id))
    assert r_lesson.scalars().first().status == "reviewed"


@pytest.mark.asyncio
async def test_duplicate_review_rejected(client, db_session):
    h_st, _h_te, lesson_id, _tid = await _completed_lesson_setup(client, db_session)

    payload = {
        "lesson_id": lesson_id,
        "rating_overall": 4,
        "content": "第一次",
    }
    r1 = await client.post("/api/v1/reviews", json=payload, headers=h_st)
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/reviews", json=payload, headers=h_st)
    assert r2.status_code == 400
    assert "已评价" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_review_wrong_student_forbidden(client, db_session):
    h_st, _h_te, lesson_id, _tid = await _completed_lesson_setup(client, db_session)

    other = make_register("oth")
    await client.post("/api/v1/auth/register", json=other)
    login_o = await client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    )
    h_o = {"Authorization": f"Bearer {login_o.json()['access_token']}"}

    r = await client.post(
        "/api/v1/reviews",
        json={"lesson_id": lesson_id, "rating_overall": 3},
        headers=h_o,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_review_not_completed_rejected(client, db_session):
    st = make_register("nc")
    await client.post("/api/v1/auth/register", json=st)
    login_st = await client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    h_st = {"Authorization": f"Bearer {login_st.json()['access_token']}"}

    te = make_register("tnc")
    await client.post("/api/v1/auth/register", json=te)
    login_te = await client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    h_te = {"Authorization": f"Bearer {login_te.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te)
    tid = await teacher_id_for_email(db_session, te["email"])
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=8)).date()
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
    sched = vn_dt_local(day, 11, 0).astimezone(ZoneInfo("UTC"))
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

    r = await client.post(
        "/api/v1/reviews",
        json={"lesson_id": lesson_id, "rating_overall": 3},
        headers=h_st,
    )
    assert r.status_code == 400
    assert "已完成" in r.json()["detail"]
