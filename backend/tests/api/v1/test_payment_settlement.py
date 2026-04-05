"""支付模块测试 - 课程结算与阶梯抽成"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.models.lesson import Lesson
from app.models.payment import Transaction
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.services import settlement_service, wallet_service

TEACHER_PROFILE_DATA = {
    "title": "专业中文教师",
    "about": "5年中文教学经验",
    "hourly_rate": 500_000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语", "HSK备考"],
}


def make_register_data():
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"payment_{suffix}@example.com",
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


async def get_teacher_user_id(db_session, teacher_profile_id: uuid.UUID) -> uuid.UUID:
    r = await db_session.execute(
        select(TeacherProfile.user_id).where(TeacherProfile.id == teacher_profile_id)
    )
    return r.scalar_one()


# ========================================
# TC-SETTLE-001 ~ TC-SETTLE-008: 阶梯费率计算测试
# ========================================


@pytest.mark.asyncio
async def test_settlement_tier1_0hours(client, db_session):
    """TC-SETTLE-001: 正常结算 - 0小时（20%费率）"""
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

    # 设置可用时间
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

    await client.post("/api/v1/wallet/topup", json={"amount": 1_000_000}, headers=h_st)
    sched = vn_dt_local(day, 10, 0).astimezone(ZoneInfo("UTC"))

    # 创建课程
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
    assert cr.status_code == 201
    lesson_id = cr.json()["id"]

    await client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)
    await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
    en = await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)
    assert en.status_code == 200
    assert en.json()["status"] == "completed"

    # 验证结算
    r = await db_session.execute(select(Lesson).where(Lesson.id == uuid.UUID(lesson_id)))
    lesson = r.scalar_one()
    assert lesson.settled_at is not None
    assert lesson.teacher_amount == 400_000  # 500k * 0.8
    assert float(lesson.platform_fee_rate) == 0.20

    # 验证钱包余额
    teacher_user_id = await get_teacher_user_id(db_session, tid)
    w = await client.get("/api/v1/wallet", headers=h_te)
    assert w.json()["balance"] == 400_000


@pytest.mark.asyncio
async def test_settlement_tier1_boundary_20h(client, db_session):
    """TC-SETTLE-005: 费率边界 - 20小时（20%费率）"""
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
    teacher_user_id = await get_teacher_user_id(db_session, tid)

    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.now(tz)
    # 使用未来的日期，确保所有课程都在当前时间之后
    start_day = (now + timedelta(days=2)).date()

    # 创建 20 小时的已完成课程（20 节 60 分钟课）
    await client.post("/api/v1/wallet/topup", json={"amount": 20_000_000}, headers=h_st)

    for i in range(20):
        day = start_day + timedelta(days=i // 5)  # 每天 5 节课，需要 4 天
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

        # 每天的第 i 节课
        hour = 9 + (i % 5) * 2
        sched = vn_dt_local(day, hour, 0).astimezone(ZoneInfo("UTC"))
        cr = await client.post(
            "/api/v1/lessons",
            json={
                "teacher_id": str(tid),
                "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
                "duration_minutes": 60,
                "topic": f"课程 {i+1}",
            },
            headers=h_st,
        )
        assert cr.status_code == 201, f"课程创建失败 (i={i}): {cr.text}"
        lesson_id = cr.json()["id"]
        await client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)
        await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
        await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)

    # 验证费率（使用最后一节课的日期）
    rate = await settlement_service.calculate_platform_fee_rate(
        db_session, tid, start_day + timedelta(days=3)
    )
    assert rate == 0.20


@pytest.mark.asyncio
async def test_settlement_tier2_boundary_21h(client, db_session):
    """TC-SETTLE-006: 费率边界 - 21小时（15%费率）"""
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
    now = datetime.now(tz)
    start_day = (now + timedelta(days=2)).date()

    await client.post("/api/v1/wallet/topup", json={"amount": 30_000_000}, headers=h_st)

    # 创建 21 小时的已完成课程（每天 5 节课，需要 5 天）
    for i in range(21):
        day = start_day + timedelta(days=i // 5)
        await client.post(
            "/api/v1/availability",
            json={
                "specific_date": day.isoformat(),
                "start_time": "08:00:00",
                "end_time": "22:00:00",
                "is_recurring": False,
            },
            headers=h_te,
        )

        hour = 8 + (i % 5) * 2
        sched = vn_dt_local(day, hour, 0).astimezone(ZoneInfo("UTC"))
        cr = await client.post(
            "/api/v1/lessons",
            json={
                "teacher_id": str(tid),
                "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
                "duration_minutes": 60,
                "topic": f"课程 {i+1}",
            },
            headers=h_st,
        )
        assert cr.status_code == 201, f"课程创建失败 (i={i}): {cr.text}"
        lesson_id = cr.json()["id"]
        await client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)
        await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
        await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)

    # 验证费率
    rate = await settlement_service.calculate_platform_fee_rate(
        db_session, tid, start_day + timedelta(days=4)
    )
    assert rate == 0.15


@pytest.mark.asyncio
async def test_settlement_tier3_boundary_51h(client, db_session):
    """TC-SETTLE-008: 费率边界 - 51小时（10%费率）"""
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
    now = datetime.now(tz)
    start_day = (now + timedelta(days=2)).date()

    await client.post("/api/v1/wallet/topup", json={"amount": 100_000_000}, headers=h_st)

    # 创建 51 小时的已完成课程（每天 6 节课，需要 9 天）
    lessons_per_day = 6

    for i in range(51):
        day = start_day + timedelta(days=i // lessons_per_day)
        await client.post(
            "/api/v1/availability",
            json={
                "specific_date": day.isoformat(),
                "start_time": "08:00:00",
                "end_time": "23:00:00",
                "is_recurring": False,
            },
            headers=h_te,
        )

        hour = 8 + (i % lessons_per_day) * 2
        sched = vn_dt_local(day, hour, 0).astimezone(ZoneInfo("UTC"))
        cr = await client.post(
            "/api/v1/lessons",
            json={
                "teacher_id": str(tid),
                "scheduled_at": sched.isoformat().replace("+00:00", "Z"),
                "duration_minutes": 60,
                "topic": f"课程 {i+1}",
            },
            headers=h_st,
        )
        assert cr.status_code == 201, f"课程创建失败 (i={i}): {cr.text}"
        lesson_id = cr.json()["id"]
        await client.patch(f"/api/v1/lessons/{lesson_id}/confirm", headers=h_te)
        await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
        await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)

    # 验证费率
    rate = await settlement_service.calculate_platform_fee_rate(
        db_session, tid, start_day + timedelta(days=8)
    )
    assert rate == 0.10


# ========================================
# TC-SETTLE-009: 防重复结算测试
# ========================================


@pytest.mark.asyncio
async def test_settlement_idempotent(client, db_session):
    """TC-SETTLE-009: 防重复结算 - 幂等性"""
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

    await client.post("/api/v1/wallet/topup", json={"amount": 1_000_000}, headers=h_st)
    sched = vn_dt_local(day, 10, 0).astimezone(ZoneInfo("UTC"))

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
    await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
    await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)

    # 获取课程并手动结算
    r = await db_session.execute(select(Lesson).where(Lesson.id == uuid.UUID(lesson_id)))
    lesson = r.scalar_one()

    # 第一次结算
    initial_settled_at = lesson.settled_at
    teacher_user_id = await get_teacher_user_id(db_session, tid)
    initial_balance = (await wallet_service.get_wallet_by_user_id(db_session, teacher_user_id)).balance

    # 第二次结算（幂等）
    await settlement_service.settle_teacher_lesson(db_session, lesson)

    # 验证余额不变
    final_balance = (await wallet_service.get_wallet_by_user_id(db_session, teacher_user_id)).balance
    assert initial_balance == final_balance

    # 验证交易记录只有一条
    r = await db_session.execute(
        select(Transaction).where(
            Transaction.lesson_id == uuid.UUID(lesson_id),
            Transaction.type == "settlement",
        )
    )
    settlement_txs = r.scalars().all()
    assert len(settlement_txs) == 1


# ========================================
# TC-LESSON-002 & TC-LESSON-003: 24h 取消规则
# ========================================


@pytest.mark.asyncio
async def test_cancel_before_24h_full_refund(client, db_session):
    """TC-LESSON-002: 24h 外取消 - 全额退款"""
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
    day = (datetime.now(tz) + timedelta(days=3)).date()
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

    await client.post("/api/v1/wallet/topup", json={"amount": 1_000_000}, headers=h_st)
    sched = vn_dt_local(day, 10, 0).astimezone(ZoneInfo("UTC"))

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

    initial_balance = (await client.get("/api/v1/wallet", headers=h_st)).json()["balance"]

    # 取消（>24h）
    can = await client.patch(
        f"/api/v1/lessons/{lesson_id}/cancel",
        json={"reason": "改期"},
        headers=h_st,
    )
    assert can.status_code == 200
    assert can.json()["status"] == "cancelled"

    final_balance = (await client.get("/api/v1/wallet", headers=h_st)).json()["balance"]
    assert final_balance == initial_balance + 500_000  # 全额退款


@pytest.mark.asyncio
async def test_cancel_within_24h_no_refund(client, db_session):
    """TC-LESSON-003: 24h 内取消 - 不退款（允许取消但不退款）"""
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
    now_vn = datetime.now(tz)
    day = now_vn.date()
    await client.post(
        "/api/v1/availability",
        json={
            "specific_date": day.isoformat(),
            "start_time": "00:00:00",
            "end_time": "23:59:00",
            "is_recurring": False,
        },
        headers=h_te,
    )

    sched_vn = now_vn + timedelta(hours=2)
    if sched_vn.date() != day:
        pytest.skip("跨日边界，跳过本用例")

    sched = sched_vn.astimezone(ZoneInfo("UTC"))
    await client.post("/api/v1/wallet/topup", json={"amount": 1_000_000}, headers=h_st)

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

    initial_balance = (await client.get("/api/v1/wallet", headers=h_st)).json()["balance"]

    # 取消（<24h）
    can = await client.patch(
        f"/api/v1/lessons/{lesson_id}/cancel",
        json={"reason": "临时有事"},
        headers=h_st,
    )
    assert can.status_code == 200
    assert can.json()["status"] == "cancelled"

    final_balance = (await client.get("/api/v1/wallet", headers=h_st)).json()["balance"]
    assert final_balance == initial_balance  # 不退款


# ========================================
# TC-EDGE-002: 交易记录完整性
# ========================================


@pytest.mark.asyncio
async def test_transaction_record_completeness(client, db_session):
    """TC-EDGE-002: 交易记录完整性验证"""
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

    await client.post("/api/v1/wallet/topup", json={"amount": 1_000_000}, headers=h_st)
    sched = vn_dt_local(day, 10, 0).astimezone(ZoneInfo("UTC"))

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
    await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=h_st)
    await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=h_te)

    # 验证交易记录
    r = await db_session.execute(
        select(Transaction).where(
            Transaction.lesson_id == uuid.UUID(lesson_id),
            Transaction.type == "settlement",
        )
    )
    tx = r.scalar_one()

    assert tx.type == "settlement"
    assert tx.amount == 400_000
    assert tx.lesson_id == uuid.UUID(lesson_id)
    assert tx.description is not None
    assert "课程结算" in tx.description
    assert tx.created_at is not None
