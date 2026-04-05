"""课堂消息 REST + WebSocket（spec：20260403-1800-课堂实时通信WebSocket）"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.teacher_profile import TeacherProfile
from app.models.user import User

from .test_lessons import TEACHER_PROFILE_DATA, make_register_data, vn_dt_local
from tests.conftest import TEST_DATABASE_URL


async def get_teacher_profile_id(db_session, email: str):
    r = await db_session.execute(
        select(TeacherProfile.id)
        .join(User, User.id == TeacherProfile.user_id)
        .where(User.email == email)
    )
    return r.scalar_one()


def _setup_confirmed_lesson_sync(sync_client):
    """创建已确认课时，返回 lesson_id 与师生 token（与 test_ws_chat_roundtrip 同源）。"""
    st = make_register_data()
    sync_client.post("/api/v1/auth/register", json=st)
    login_st = sync_client.post(
        "/api/v1/auth/login",
        json={"email": st["email"], "password": st["password"]},
    )
    tok_st = login_st.json()["access_token"]
    h_st = {"Authorization": f"Bearer {tok_st}"}

    te = make_register_data()
    sync_client.post("/api/v1/auth/register", json=te)
    login_te = sync_client.post(
        "/api/v1/auth/login",
        json={"email": te["email"], "password": te["password"]},
    )
    tok_te = login_te.json()["access_token"]
    h_te = {"Authorization": f"Bearer {login_te.json()['access_token']}"}
    sync_client.post(
        "/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=h_te
    )

    tid = get_teacher_profile_id_sync(te["email"])
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    day = (datetime.now(tz) + timedelta(days=7)).date()
    sync_client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "21:00:00",
            "is_recurring": False,
        },
        headers=h_te,
    )
    sync_client.post("/api/v1/wallet/topup", json={"amount": 500_000}, headers=h_st)
    sched = vn_dt_local(day, 15, 0).astimezone(ZoneInfo("UTC"))
    cr = sync_client.post(
        "/api/v1/lessons",
        json={
            "teacher_id": str(tid),
            "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
            "duration_minutes": 60,
            "topic": "WS 测试",
        },
        headers=h_st,
    )
    lesson_id = cr.json()["id"]
    sync_client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)
    return {
        "lesson_id": lesson_id,
        "tok_st": tok_st,
        "tok_te": tok_te,
        "h_st": h_st,
        "h_te": h_te,
        "student_email": st["email"],
    }


def get_teacher_profile_id_sync(email: str):
    """独立 asyncio.run 查询，仅读库，不与 TestClient 共享 loop。"""

    async def _run():
        engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        try:
            async with async_sessionmaker(engine, class_=AsyncSession)() as session:
                r = await session.execute(
                    select(TeacherProfile.id)
                    .join(User, User.id == TeacherProfile.user_id)
                    .where(User.email == email)
                )
                return r.scalar_one()
        finally:
            await engine.dispose()

    return asyncio.run(_run())


@pytest.mark.asyncio
async def test_list_messages_forbidden_for_stranger(client, db_session):
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
    lesson_id = cr.json()["id"]
    await client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)

    other = make_register_data()
    await client.post("/api/v1/auth/register", json=other)
    login_o = await client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    )
    h_o = {"Authorization": f"Bearer {login_o.json()['access_token']}"}

    r = await client.get(
        f"/api/v1/lessons/{lesson_id}/messages",
        headers=h_o,
    )
    assert r.status_code == 403


def test_ws_chat_roundtrip(sync_client):
    s = _setup_confirmed_lesson_sync(sync_client)
    lesson_id = s["lesson_id"]
    tok = s["tok_st"]
    h_st = s["h_st"]

    hist = sync_client.get(
        f"/api/v1/lessons/{lesson_id}/messages",
        headers=h_st,
    )
    assert hist.status_code == 200
    assert hist.json()["total"] == 0

    with sync_client.websocket_connect(
        f"/api/v1/lessons/{lesson_id}/ws?access_token={tok}"
    ) as ws:
        ws.send_json({"type": "chat", "content": "  hello ws  "})
        data = ws.receive_json()

    assert data["type"] == "chat"
    assert data["content"] == "hello ws"
    uid = get_student_uid_sync(s["student_email"])
    assert data["sender_id"] == str(uid)

    hist2 = sync_client.get(
        f"/api/v1/lessons/{lesson_id}/messages",
        headers=h_st,
    )
    assert hist2.json()["total"] == 1
    assert hist2.json()["items"][0]["content"] == "hello ws"


def get_student_uid_sync(email: str):
    async def _run():
        engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        try:
            async with async_sessionmaker(engine, class_=AsyncSession)() as session:
                r = await session.execute(select(User.id).where(User.email == email))
                return r.scalar_one()
        finally:
            await engine.dispose()

    return asyncio.run(_run())


def test_ws_rejects_without_token(sync_client):
    lid = uuid.uuid4()
    with sync_client.websocket_connect(f"/api/v1/lessons/{lid}/ws") as ws:
        err = ws.receive_json()
    assert err["type"] == "error"
    assert err["code"] == "unauthorized"


def test_ws_rejects_invalid_token(sync_client):
    """TC-WS-002：伪造 JWT"""
    lid = uuid.uuid4()
    with sync_client.websocket_connect(
        f"/api/v1/lessons/{lid}/ws?access_token=not-a-valid-jwt"
    ) as ws:
        err = ws.receive_json()
    assert err["type"] == "error"
    assert err["code"] == "unauthorized"


def test_ws_rejects_non_member(sync_client):
    """TC-WS-003：非课时师生"""
    s = _setup_confirmed_lesson_sync(sync_client)
    other = make_register_data()
    sync_client.post("/api/v1/auth/register", json=other)
    login_o = sync_client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    )
    tok_o = login_o.json()["access_token"]
    with sync_client.websocket_connect(
        f"/api/v1/lessons/{s['lesson_id']}/ws?access_token={tok_o}"
    ) as ws:
        err = ws.receive_json()
    assert err["type"] == "error"
    assert err["code"] == "forbidden"


def test_ws_invalid_json_returns_error(sync_client):
    """TC-WS-005"""
    s = _setup_confirmed_lesson_sync(sync_client)
    with sync_client.websocket_connect(
        f"/api/v1/lessons/{s['lesson_id']}/ws?access_token={s['tok_st']}"
    ) as ws:
        ws.send_text("not-json{{{")
        err = ws.receive_json()
    assert err["type"] == "error"
    assert err["code"] == "invalid_json"


@pytest.mark.asyncio
async def test_lesson_room_broadcasts_to_all_sockets():
    """TC-WS-004（单元）：同课时多个连接均收到 broadcast_json（双进程 TestClient 与 async DB 跨 loop，不在这里做端到端双连接）。"""
    from unittest.mock import AsyncMock

    from app.services.lesson_room import LessonRoomManager

    room_id = uuid.uuid4()
    mgr = LessonRoomManager()
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    mgr.connect(room_id, ws1)
    mgr.connect(room_id, ws2)
    await mgr.broadcast_json(room_id, {"type": "chat", "content": "x"})
    ws1.send_json.assert_awaited_once()
    ws2.send_json.assert_awaited_once()
