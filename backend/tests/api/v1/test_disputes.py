from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models.dispute import DisputeCase, DisputeEvent
from app.models.payment import Transaction, Wallet
from app.models.payment_order import PaymentOrder, PayoutOrder, SettlementSnapshot
from app.models.user import User
from app.services import dispute_watcher
from tests.api.v1.test_payment_settlement import (
    create_confirmed_lesson_with_teacher,
    make_register,
)


async def _order_for_lesson(db_session, lesson_id):
    r = await db_session.execute(
        select(PaymentOrder).where(PaymentOrder.lesson_id == lesson_id)
    )
    return r.scalars().one()


async def _count_disputes_for_order(db_session, order_id):
    return (
        await db_session.execute(
            select(func.count()).select_from(DisputeCase).where(
                DisputeCase.payment_order_id == order_id
            )
        )
    ).scalar_one()


async def _complete_lesson(client, lesson_id, teacher_headers):
    started = await client.patch(f"/api/v1/lessons/{lesson_id}/start", headers=teacher_headers)
    assert started.status_code == 200, started.text
    ended = await client.patch(f"/api/v1/lessons/{lesson_id}/end", headers=teacher_headers)
    assert ended.status_code == 200, ended.text


async def _register_login(client, prefix: str):
    data = make_register(prefix)
    created = await client.post("/api/v1/auth/register", json=data)
    assert created.status_code in (200, 201), created.text
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    assert login.status_code == 200, login.text
    return data, {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _grant_roles(db_session, email: str, roles: list[str]):
    r = await db_session.execute(select(User).where(User.email == email))
    user = r.scalars().one()
    user.roles = roles
    await db_session.commit()
    return user


async def _create_open_dispute(client, db_session):
    lesson_id, h_student, h_teacher, teacher_id = await create_confirmed_lesson_with_teacher(
        client, db_session
    )
    await _complete_lesson(client, lesson_id, h_teacher)
    order = await _order_for_lesson(db_session, lesson_id)
    resp = await client.post(
        "/api/v1/disputes",
        json={
            "payment_order_id": str(order.id),
            "reason_code": "quality_issue",
            "description": "课程质量争议",
        },
        headers=h_student,
    )
    assert resp.status_code == 201, resp.text
    return lesson_id, order.id, resp.json()["id"], h_student, h_teacher, teacher_id


@pytest.mark.asyncio
async def test_student_creates_dispute_and_duplicate_is_rejected(client, db_session):
    lesson_id, h_student, h_teacher, _teacher_id = await create_confirmed_lesson_with_teacher(
        client, db_session
    )
    await _complete_lesson(client, lesson_id, h_teacher)
    order = await _order_for_lesson(db_session, lesson_id)
    order_id = order.id

    created = await client.post(
        "/api/v1/disputes",
        json={
            "lesson_id": str(lesson_id),
            "reason_code": "teacher_no_show",
            "description": "老师迟到且课程未完整履约",
        },
        headers=h_student,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "open"
    assert body["payment_order_id"] == str(order.id)

    await db_session.refresh(order)
    assert order.status == "disputed"
    assert (
        await db_session.execute(
            select(func.count()).select_from(DisputeEvent).where(
                DisputeEvent.dispute_id == uuid.UUID(body["id"]),
                DisputeEvent.type == "opened",
            )
        )
    ).scalar_one() == 1

    duplicate = await client.post(
        "/api/v1/disputes",
        json={
            "payment_order_id": str(order.id),
            "reason_code": "quality_issue",
            "description": "重复提交",
        },
        headers=h_student,
    )
    assert duplicate.status_code == 409
    assert (
        await db_session.execute(
            select(func.count()).select_from(DisputeCase).where(
                DisputeCase.payment_order_id == order_id,
                DisputeCase.status.in_(("open", "processing")),
            )
        )
    ).scalar_one() == 1


@pytest.mark.asyncio
async def test_teacher_and_unrelated_user_cannot_create_dispute(
    client, db_session
):
    lesson_id, _h_student, h_teacher, _teacher_id = await create_confirmed_lesson_with_teacher(
        client, db_session
    )
    await _complete_lesson(client, lesson_id, h_teacher)
    order = await _order_for_lesson(db_session, lesson_id)
    order_id = order.id

    _other, h_other = await _register_login(client, "dispute_other")
    forbidden = await client.post(
        "/api/v1/disputes",
        json={
            "payment_order_id": str(order.id),
            "reason_code": "other",
            "description": "非参与者提交",
        },
        headers=h_other,
    )
    assert forbidden.status_code == 403
    assert await _count_disputes_for_order(db_session, order_id) == 0
    await db_session.refresh(order)
    assert order.status == "held"

    teacher_created = await client.post(
        "/api/v1/disputes",
        json={
            "lesson_id": str(lesson_id),
            "reason_code": "student_no_show",
            "description": "学生未按约上课",
        },
        headers=h_teacher,
    )
    assert teacher_created.status_code == 403
    assert await _count_disputes_for_order(db_session, order_id) == 0
    await db_session.refresh(order)
    assert order.status == "held"


@pytest.mark.asyncio
@pytest.mark.parametrize("order_status", ["released", "refunded", "pending", "paid"])
async def test_create_dispute_rejects_non_active_payment_order_statuses(
    client, db_session, order_status
):
    lesson_id, h_student, h_teacher, _teacher_id = await create_confirmed_lesson_with_teacher(
        client, db_session
    )
    await _complete_lesson(client, lesson_id, h_teacher)
    order = await _order_for_lesson(db_session, lesson_id)
    order_id = order.id
    order.status = order_status
    await db_session.commit()

    rejected = await client.post(
        "/api/v1/disputes",
        json={
            "payment_order_id": str(order_id),
            "reason_code": "payment_issue",
            "description": f"{order_status} 状态不能发起争议",
        },
        headers=h_student,
    )
    assert rejected.status_code == 400, rejected.text
    assert await _count_disputes_for_order(db_session, order_id) == 0
    await db_session.refresh(order)
    assert order.status == order_status


@pytest.mark.asyncio
async def test_ops_requires_operator_and_can_assign_then_refund(client, db_session):
    lesson_id, order_id, dispute_id, h_student, _h_teacher, _teacher_id = (
        await _create_open_dispute(client, db_session)
    )
    student_wallet_before = (
        await db_session.execute(
            select(Wallet.balance).join(User, User.id == Wallet.user_id).where(
                User.id == (await _order_for_lesson(db_session, lesson_id)).student_id
            )
        )
    ).scalar_one()

    forbidden = await client.get("/api/v1/ops/disputes", headers=h_student)
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "需要运营权限"

    operator_data, h_operator = await _register_login(client, "dispute_operator")
    operator = await _grant_roles(db_session, operator_data["email"], ["student", "operator"])

    listed = await client.get("/api/v1/ops/disputes?status=open", headers=h_operator)
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] >= 1

    assigned = await client.post(
        f"/api/v1/ops/disputes/{dispute_id}/actions",
        json={"action": "assign", "reason": "客服接单"},
        headers=h_operator,
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["status"] == "processing"

    refunded = await client.post(
        f"/api/v1/ops/disputes/{dispute_id}/actions",
        json={"action": "refund", "reason": "裁定退款"},
        headers=h_operator,
    )
    assert refunded.status_code == 200, refunded.text
    assert refunded.json()["status"] == "resolved_refunded"
    assert refunded.json()["operator_id"] == str(operator.id)

    order = await _order_for_lesson(db_session, lesson_id)
    assert order.id == order_id
    assert order.status == "refunded"
    student_wallet_after = (
        await db_session.execute(
            select(Wallet.balance).where(Wallet.user_id == order.student_id)
        )
    ).scalar_one()
    assert student_wallet_after == student_wallet_before + order.gross_amount

    repeat = await client.post(
        f"/api/v1/ops/disputes/{dispute_id}/actions",
        json={"action": "refund", "reason": "重复退款"},
        headers=h_operator,
    )
    assert repeat.status_code == 409
    refund_transactions = (
        await db_session.execute(
            select(func.count()).select_from(Transaction).where(
                Transaction.lesson_id == lesson_id,
                Transaction.type == "refund",
            )
        )
    ).scalar_one()
    assert refund_transactions == 1


@pytest.mark.asyncio
async def test_ops_dispute_detail_returns_context_fields(client, db_session):
    lesson_id, order_id, dispute_id, _h_student, _h_teacher, teacher_id = (
        await _create_open_dispute(client, db_session)
    )
    operator_data, h_operator = await _register_login(client, "dispute_detail_operator")
    await _grant_roles(db_session, operator_data["email"], ["student", "operator"])
    order = await _order_for_lesson(db_session, lesson_id)

    detail = await client.get(f"/api/v1/ops/disputes/{dispute_id}", headers=h_operator)
    assert detail.status_code == 200, detail.text

    body = detail.json()
    assert body["id"] == dispute_id
    assert body["status"] == "open"
    assert body["lesson_id"] == str(lesson_id)
    assert body["payment_order_id"] == str(order_id)
    assert body["student_id"] == str(order.student_id)
    assert body["teacher_id"] == str(teacher_id)
    assert body["student_name"] == "测试用户"
    assert body["teacher_name"] == "测试用户"

    lesson = body["lesson"]
    assert lesson["id"] == str(lesson_id)
    assert lesson["student_id"] == str(order.student_id)
    assert lesson["teacher_id"] == str(teacher_id)
    assert lesson["topic"] == "出款明细测试"

    payment_order = body["payment_order"]
    assert payment_order["id"] == str(order_id)
    assert payment_order["lesson_id"] == str(lesson_id)
    assert payment_order["student_id"] == str(order.student_id)
    assert payment_order["gross_amount"] == order.gross_amount
    assert payment_order["status"] == "disputed"
    assert payment_order["held_until"] is not None

    assert len(body["events"]) == 1
    opened = body["events"][0]
    assert opened["type"] == "opened"
    assert opened["actor_id"] == str(order.student_id)
    assert opened["note"] == "课程质量争议"
    assert opened["from_status"] is None
    assert opened["to_status"] == "open"


@pytest.mark.asyncio
async def test_ops_release_uses_payment_service_and_rejects_repeat(client, db_session):
    lesson_id, _order_id, dispute_id, _h_student, _h_teacher, teacher_id = (
        await _create_open_dispute(client, db_session)
    )
    operator_data, h_operator = await _register_login(client, "dispute_release_operator")
    await _grant_roles(db_session, operator_data["email"], ["student", "admin"])

    released = await client.post(
        f"/api/v1/ops/disputes/{dispute_id}/actions",
        json={"action": "release", "reason": "裁定释放给教师"},
        headers=h_operator,
    )
    assert released.status_code == 200, released.text
    assert released.json()["status"] == "resolved_released"

    order = await _order_for_lesson(db_session, lesson_id)
    payment_order_id = order.id
    assert order.status == "released"
    assert (
        await db_session.execute(
            select(func.count()).select_from(SettlementSnapshot).where(
                SettlementSnapshot.payment_order_id == order.id
            )
        )
    ).scalar_one() == 1
    assert (
        await db_session.execute(
            select(func.count()).select_from(PayoutOrder).where(
                PayoutOrder.payment_order_id == order.id,
                PayoutOrder.teacher_id == teacher_id,
            )
        )
    ).scalar_one() == 1

    repeat = await client.post(
        f"/api/v1/ops/disputes/{dispute_id}/actions",
        json={"action": "release", "reason": "重复释放"},
        headers=h_operator,
    )
    assert repeat.status_code == 409
    assert (
        await db_session.execute(
            select(func.count()).select_from(PayoutOrder).where(
                PayoutOrder.payment_order_id == payment_order_id
            )
        )
    ).scalar_one() == 1


@pytest.mark.asyncio
async def test_watcher_skips_disputed_and_open_held_orders(client, db_session):
    lesson_id, order_id, _dispute_id, _h_student, _h_teacher, _teacher_id = (
        await _create_open_dispute(client, db_session)
    )
    order = await _order_for_lesson(db_session, lesson_id)
    order.held_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()

    processed = await dispute_watcher.run_once(db_session, batch_size=10)
    assert processed == 0
    await db_session.refresh(order)
    assert order.status == "disputed"

    order.status = "held"
    order.held_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()

    processed = await dispute_watcher.run_once(db_session, batch_size=10)
    assert processed == 0
    await db_session.refresh(order)
    assert order.id == order_id
    assert order.status == "held"
    assert (
        await db_session.execute(
            select(func.count()).select_from(PayoutOrder).where(
                PayoutOrder.payment_order_id == order.id
            )
        )
    ).scalar_one() == 0
