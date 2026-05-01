"""Availability API tests for teacher supply flow."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.models.availability import Availability

TEACHER_PROFILE_DATA = {
    "title": "排课测试教师",
    "about": "5年中文教学经验",
    "hourly_rate": 60000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语"],
}


def make_register_data():
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"av_{suffix}@example.com",
        "password": "testpassword123",
        "full_name": "排课测试",
        "phone": f"094{suffix}",
    }


async def register_teacher(client):
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post(
        "/api/v1/auth/become-teacher",
        json=TEACHER_PROFILE_DATA,
        headers=headers,
    )
    return headers


def future_vn_date(days: int = 7):
    return (datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")) + timedelta(days=days)).date()


@pytest.mark.asyncio
async def test_update_recurring_rejects_specific_date_without_clearing_day(
    client, db_session
):
    headers = await register_teacher(client)
    created = await client.post(
        "/api/v1/availability",
        json={
            "day_of_week": 1,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    av_id = created.json()["id"]

    resp = await client.put(
        f"/api/v1/availability/{av_id}",
        json={"specific_date": future_vn_date().isoformat(), "is_recurring": False},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "不能同时指定 day_of_week 与 specific_date"

    row = (
        await db_session.execute(select(Availability).where(Availability.id == av_id))
    ).scalars().one()
    assert row.day_of_week == 1
    assert row.specific_date is None
    assert row.is_recurring is True


@pytest.mark.asyncio
async def test_update_specific_date_rejects_day_without_clearing_date(client):
    headers = await register_teacher(client)
    day = future_vn_date()
    created = await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "is_recurring": False,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    resp = await client.put(
        f"/api/v1/availability/{created.json()['id']}",
        json={"day_of_week": day.weekday(), "is_recurring": True},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "不能同时指定 day_of_week 与 specific_date"


@pytest.mark.asyncio
async def test_update_switches_modes_with_explicit_nulls_and_normalizes_recurring(
    client,
):
    headers = await register_teacher(client)
    first_day = future_vn_date(8)
    created = await client.post(
        "/api/v1/availability",
        json={
            "specific_date": first_day.isoformat(),
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "is_recurring": False,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    av_id = created.json()["id"]

    weekly = await client.put(
        f"/api/v1/availability/{av_id}",
        json={
            "day_of_week": 2,
            "specific_date": None,
            "start_time": "10:00:00",
            "end_time": "13:00:00",
        },
        headers=headers,
    )
    assert weekly.status_code == 200, weekly.text
    assert weekly.json()["day_of_week"] == 2
    assert weekly.json()["specific_date"] is None
    assert weekly.json()["is_recurring"] is True

    date_mode = await client.put(
        f"/api/v1/availability/{av_id}",
        json={
            "day_of_week": None,
            "specific_date": future_vn_date(9).isoformat(),
        },
        headers=headers,
    )
    assert date_mode.status_code == 200, date_mode.text
    assert date_mode.json()["day_of_week"] is None
    assert date_mode.json()["specific_date"] is not None
    assert date_mode.json()["is_recurring"] is False


@pytest.mark.asyncio
async def test_update_rejects_empty_mode_invalid_time_and_recurring_mismatch(client):
    headers = await register_teacher(client)
    created = await client.post(
        "/api/v1/availability",
        json={
            "day_of_week": 4,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "is_recurring": True,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    av_id = created.json()["id"]

    empty_mode = await client.put(
        f"/api/v1/availability/{av_id}",
        json={"day_of_week": None, "specific_date": None},
        headers=headers,
    )
    assert empty_mode.status_code == 400
    assert empty_mode.json()["detail"] == "须指定 day_of_week 或 specific_date"

    bad_time = await client.put(
        f"/api/v1/availability/{av_id}",
        json={"start_time": "13:00:00", "end_time": "12:00:00"},
        headers=headers,
    )
    assert bad_time.status_code == 400
    assert bad_time.json()["detail"] == "结束时间须晚于开始时间"

    mismatch = await client.put(
        f"/api/v1/availability/{av_id}",
        json={"is_recurring": False},
        headers=headers,
    )
    assert mismatch.status_code == 400
    assert mismatch.json()["detail"] == "周期时段 is_recurring 必须为 true"
