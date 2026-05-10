from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dispute import ACTIVE_DISPUTE_STATUSES, DisputeCase, DisputeEvent
from app.models.lesson import Lesson
from app.models.payment_order import PaymentOrder, SettlementSnapshot
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.lesson import LessonOut
from app.schemas.payment import PaymentOrderDetail, SettlementSnapshotOut
from app.services import payment_service


class DisputeConflictError(ValueError):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lesson_out(lesson: Lesson) -> LessonOut:
    ends_at = lesson.scheduled_at + timedelta(minutes=lesson.duration_minutes)
    return LessonOut.model_validate(
        {
            "id": lesson.id,
            "student_id": lesson.student_id,
            "teacher_id": lesson.teacher_id,
            "scheduled_at": lesson.scheduled_at,
            "ends_at": ends_at,
            "duration_minutes": lesson.duration_minutes,
            "topic": lesson.topic,
            "status": lesson.status,
            "price": lesson.price,
            "can_enter_classroom": False,
            "classroom_unavailable_reason": None,
            "cancel_reason": lesson.cancel_reason,
            "actual_start_at": lesson.actual_start_at,
            "actual_end_at": lesson.actual_end_at,
            "created_at": lesson.created_at,
        }
    )


async def _payment_detail(db: AsyncSession, order: PaymentOrder) -> PaymentOrderDetail:
    detail = PaymentOrderDetail.model_validate(
        {
            "id": order.id,
            "lesson_id": order.lesson_id,
            "student_id": order.student_id,
            "gross_amount": order.gross_amount,
            "channel": order.channel,
            "channel_txn_id": order.channel_txn_id,
            "status": order.status,
            "held_until": order.held_until,
            "paid_at": order.paid_at,
            "released_at": order.released_at,
            "refunded_at": order.refunded_at,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
            "settlement_snapshot": None,
        }
    )
    r = await db.execute(
        select(SettlementSnapshot).where(SettlementSnapshot.payment_order_id == order.id)
    )
    snapshot = r.scalars().first()
    if snapshot is not None:
        detail.settlement_snapshot = SettlementSnapshotOut.model_validate(snapshot)
    return detail


async def _active_dispute_for_order(
    db: AsyncSession, payment_order_id: uuid.UUID
) -> DisputeCase | None:
    r = await db.execute(
        select(DisputeCase).where(
            DisputeCase.payment_order_id == payment_order_id,
            DisputeCase.status.in_(ACTIVE_DISPUTE_STATUSES),
        )
    )
    return r.scalars().first()


async def create_dispute(
    db: AsyncSession,
    current_user: User,
    *,
    lesson_id: uuid.UUID | None,
    payment_order_id: uuid.UUID | None,
    reason_code: str,
    description: str,
) -> DisputeCase:
    if payment_order_id is not None:
        r = await db.execute(
            select(PaymentOrder)
            .where(PaymentOrder.id == payment_order_id)
            .with_for_update()
        )
        order = r.scalars().first()
        if order is None:
            raise LookupError("付款单不存在")
        if lesson_id is not None and order.lesson_id != lesson_id:
            raise ValueError("lesson_id 与 payment_order_id 不匹配")
    else:
        r = await db.execute(
            select(PaymentOrder)
            .where(
                PaymentOrder.lesson_id == lesson_id,
                PaymentOrder.status != "refunded",
            )
            .with_for_update()
        )
        order = r.scalars().first()
        if order is None:
            raise LookupError("付款单不存在")

    r_lesson = await db.execute(select(Lesson).where(Lesson.id == order.lesson_id))
    lesson = r_lesson.scalars().first()
    if lesson is None:
        raise LookupError("课程不存在")
    # Fix: debugger/debug-001.md - only the payment-order student may open disputes.
    if current_user.id != order.student_id:
        raise PermissionError("无权对该课程发起争议")

    if order.status not in ("held", "disputed"):
        raise ValueError("当前付款单状态不可发起争议")

    existing = await _active_dispute_for_order(db, order.id)
    if existing is not None:
        raise DisputeConflictError("已有处理中争议")

    dispute = DisputeCase(
        lesson_id=lesson.id,
        payment_order_id=order.id,
        student_id=order.student_id,
        teacher_id=lesson.teacher_id,
        status="open",
        reason_code=reason_code,
        description=description,
    )
    db.add(dispute)
    order.status = "disputed"
    order.updated_at = _now()
    await db.flush()

    db.add(
        DisputeEvent(
            dispute_id=dispute.id,
            type="opened",
            actor_id=current_user.id,
            note=description,
            to_status="open",
        )
    )
    await db.flush()
    return dispute


async def list_my_disputes(db: AsyncSession, current_user: User) -> Sequence[DisputeCase]:
    if current_user.teacher_profile is not None:
        predicate = (DisputeCase.student_id == current_user.id) | (
            DisputeCase.teacher_id == current_user.teacher_profile.id
        )
    else:
        predicate = DisputeCase.student_id == current_user.id
    r = await db.execute(
        select(DisputeCase).where(predicate).order_by(DisputeCase.created_at.desc())
    )
    return list(r.scalars().all())


async def list_disputes(
    db: AsyncSession,
    *,
    status: str | None,
    page: int,
    page_size: int,
) -> tuple[Sequence[DisputeCase], int]:
    base = select(DisputeCase)
    if status:
        base = base.where(DisputeCase.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    r = await db.execute(
        base.order_by(DisputeCase.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(r.scalars().all()), int(total)


async def get_dispute(db: AsyncSession, dispute_id: uuid.UUID) -> DisputeCase | None:
    r = await db.execute(
        select(DisputeCase)
        .where(DisputeCase.id == dispute_id)
        .options(
            selectinload(DisputeCase.events),
            selectinload(DisputeCase.payment_order),
            selectinload(DisputeCase.lesson),
        )
    )
    return r.scalars().first()


def can_view_dispute(user: User, dispute: DisputeCase) -> bool:
    if user.id == dispute.student_id:
        return True
    if user.teacher_profile is not None and user.teacher_profile.id == dispute.teacher_id:
        return True
    roles = user.roles or []
    return "operator" in roles or "admin" in roles


async def detail_payload(db: AsyncSession, dispute: DisputeCase) -> dict:
    lesson = dispute.lesson
    order = dispute.payment_order
    if lesson is None:
        lesson = (await db.execute(select(Lesson).where(Lesson.id == dispute.lesson_id))).scalars().one()
    if order is None:
        order = (
            await db.execute(select(PaymentOrder).where(PaymentOrder.id == dispute.payment_order_id))
        ).scalars().one()

    r_student = await db.execute(select(User.full_name).where(User.id == dispute.student_id))
    student_name = r_student.scalar_one_or_none()
    r_teacher = await db.execute(
        select(User.full_name)
        .join(TeacherProfile, TeacherProfile.user_id == User.id)
        .where(TeacherProfile.id == dispute.teacher_id)
    )
    teacher_name = r_teacher.scalar_one_or_none()
    return {
        "id": dispute.id,
        "status": dispute.status,
        "reason_code": dispute.reason_code,
        "description": dispute.description,
        "lesson_id": dispute.lesson_id,
        "payment_order_id": dispute.payment_order_id,
        "student_id": dispute.student_id,
        "teacher_id": dispute.teacher_id,
        "operator_id": dispute.operator_id,
        "resolution": dispute.resolution,
        "created_at": dispute.created_at,
        "updated_at": dispute.updated_at,
        "resolved_at": dispute.resolved_at,
        "payment_order": await _payment_detail(db, order),
        "lesson": _lesson_out(lesson),
        "student_name": student_name,
        "teacher_name": teacher_name,
        "events": list(dispute.events),
    }


async def handle_dispute(
    db: AsyncSession,
    dispute_id: uuid.UUID,
    *,
    action: str,
    reason: str,
    operator: User,
) -> DisputeCase:
    r = await db.execute(
        select(DisputeCase)
        .where(DisputeCase.id == dispute_id)
        .with_for_update()
    )
    dispute = r.scalars().first()
    if dispute is None:
        raise LookupError("争议不存在")
    if dispute.status not in ACTIVE_DISPUTE_STATUSES:
        raise DisputeConflictError("争议已终态，不能重复处理")

    r_order = await db.execute(
        select(PaymentOrder)
        .where(PaymentOrder.id == dispute.payment_order_id)
        .with_for_update()
    )
    order = r_order.scalars().first()
    if order is None:
        raise LookupError("付款单不存在")

    before = dispute.status
    now = _now()
    event_type = action
    to_status = before

    if action == "assign":
        dispute.status = "processing"
        dispute.operator_id = operator.id
        to_status = dispute.status
        event_type = "assigned"
    elif action == "add_note":
        dispute.operator_id = operator.id
        event_type = "note_added"
    elif action == "refund":
        if order.status != "disputed":
            raise DisputeConflictError("当前付款单状态不可退款处理")
        await payment_service.refund_payment_order(db, order, reason)
        dispute.status = "resolved_refunded"
        dispute.operator_id = operator.id
        dispute.resolution = reason
        dispute.resolved_at = now
        to_status = dispute.status
        event_type = "refunded"
    elif action == "release":
        if order.status != "disputed":
            raise DisputeConflictError("当前付款单状态不可释放处理")
        order.status = "held"
        order.updated_at = now
        await db.flush()
        await payment_service.release_payment_order(db, order)
        dispute.status = "resolved_released"
        dispute.operator_id = operator.id
        dispute.resolution = reason
        dispute.resolved_at = now
        to_status = dispute.status
        event_type = "released"
    elif action == "close_no_action":
        if order.status != "disputed":
            raise DisputeConflictError("当前付款单状态不可关闭处理")
        order.status = "held"
        order.updated_at = now
        dispute.status = "closed_no_action"
        dispute.operator_id = operator.id
        dispute.resolution = reason
        dispute.resolved_at = now
        to_status = dispute.status
    else:
        raise ValueError("不支持的处理动作")

    dispute.updated_at = now
    db.add(
        DisputeEvent(
            dispute_id=dispute.id,
            type=event_type,
            actor_id=operator.id,
            note=reason,
            from_status=before,
            to_status=to_status,
        )
    )
    await db.flush()
    return dispute


def has_active_dispute_exists_clause():
    return exists().where(
        DisputeCase.payment_order_id == PaymentOrder.id,
        DisputeCase.status.in_(ACTIVE_DISPUTE_STATUSES),
    )
