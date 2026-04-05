"""教师模块 API 测试"""

import uuid

import pytest
from sqlalchemy import select

from app.models.teacher_profile import TeacherProfile
from app.models.user import User

TEACHER_PROFILE_DATA = {
    "title": "专业中文教师",
    "about": "5年中文教学经验",
    "hourly_rate": 50000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语", "HSK备考"],
}


def make_register_data():
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"tch_{suffix}@example.com",
        "password": "testpassword123",
        "full_name": "教师测试",
        "phone": f"091{suffix}",
    }


async def teacher_id_for_email(db_session, email: str):
    r = await db_session.execute(
        select(TeacherProfile.id)
        .join(User, User.id == TeacherProfile.user_id)
        .where(User.email == email)
    )
    return r.scalar_one()


@pytest.mark.asyncio
async def test_search_teachers_includes_active(client, db_session):
    """开通教师后可在列表中搜到（用唯一关键词避免分页/排序导致不在第一页）"""
    data = make_register_data()
    uniq = uuid.uuid4().hex[:12]
    profile = {
        **TEACHER_PROFILE_DATA,
        "title": f"{TEACHER_PROFILE_DATA['title']}-{uniq}",
    }
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=profile, headers=headers)

    tid = await teacher_id_for_email(db_session, data["email"])

    resp = await client.get("/api/v1/teachers", params={"q": uniq})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    ids = [x["id"] for x in body["items"]]
    assert str(tid) in ids


@pytest.mark.asyncio
async def test_get_teacher_detail(client, db_session):
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)

    tid = await teacher_id_for_email(db_session, data["email"])

    r = await client.get(f"/api/v1/teachers/{tid}")
    assert r.status_code == 200
    assert r.json()["title"] == TEACHER_PROFILE_DATA["title"]


@pytest.mark.asyncio
async def test_get_teacher_availability_public(client, db_session):
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)

    tid = await teacher_id_for_email(db_session, data["email"])

    r = await client.get(f"/api/v1/teachers/{tid}/availability")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_get_teacher_reviews_empty(client, db_session):
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)

    tid = await teacher_id_for_email(db_session, data["email"])

    r = await client.get(f"/api/v1/teachers/{tid}/reviews")
    assert r.status_code == 200
    assert r.json()["total"] == 0
    assert r.json()["items"] == []


@pytest.mark.asyncio
async def test_create_profile_duplicate(client):
    """已开通教师后不能再 POST /teachers/profile"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)

    r = await client.post("/api/v1/teachers/profile", json=TEACHER_PROFILE_DATA, headers=headers)
    assert r.status_code == 400
    assert "已拥有" in r.json()["detail"]
