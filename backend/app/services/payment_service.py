"""
支付服务核心流程（plan.md §3.3.4）。

编排学员付款单 → 托管 → 争议期 → 结算释放 → 教师出款的完整生命周期。
事务边界：每个 public 入口自行 begin/commit；调用 ledger_service、税务策略、
支付渠道 adapter 以及直接操作 Wallet/Transaction，保证资金守恒。

- resolve_commission_rate：阶梯费率计算（MVP 逻辑迁移保留）
- create_order_for_lesson：学员下单付款（学员钱包 → 托管户）
- mark_lesson_completed：课程完成，写入争议期 deadline
- release_payment_order：争议期过后结算释放（托管 → 营收/税金/教师应付/教师钱包）
- refund_payment_order：退款（托管 → 学员钱包）
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ledger import (
    ACCOUNT_ESCROW,
    ACCOUNT_PLATFORM_REVENUE,
    ACCOUNT_TAX_PAYABLE,
    ACCOUNT_TEACHER_PAYABLE,
)
from app.models.lesson import Lesson
from app.models.payment import Transaction, Wallet
from app.models.payment_order import PaymentOrder, PayoutOrder, SettlementSnapshot
from app.models.teacher_profile import TeacherProfile
from app.models.teacher_tax_profile import (
    DEFAULT_TAX_SCENARIO,
    TeacherTaxProfile,
)
from app.services import ledger_service, wallet_service
from app.services.payment.channels import get_channel
from app.services.tax import get_strategy


# --------------------------- 阶梯费率 ---------------------------


async def resolve_commission_rate(
    db: AsyncSession,
    teacher_id: uuid.UUID,
    month: date,
) -> Decimal:
    """
    计算教师当月平台抽成费率（MVP 阶梯费率逻辑的迁移实现）。

    规则（plan.md §3.6 保留 MVP）：
      月完课 ≤ 20h → 20%
      月完课 21-50h → 15%
      月完课 > 50h → 10%
    """
    month_start = datetime(month.year, month.month, 1, tzinfo=timezone.utc)
    if month.month == 12:
        month_end = datetime(month.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(month.year, month.month + 1, 1, tzinfo=timezone.utc)

    r = await db.execute(
        select(Lesson).where(
            Lesson.teacher_id == teacher_id,
            Lesson.status == "completed",
            Lesson.actual_end_at >= month_start,
            Lesson.actual_end_at < month_end,
        )
    )
    completed_lessons = r.scalars().all()

    total_minutes = sum(l.duration_minutes for l in completed_lessons)
    total_hours = total_minutes / 60.0

    if total_hours <= settings.COMMISSION_TIER_1_HOURS:
        return Decimal(str(settings.COMMISSION_TIER_1_RATE))
    if total_hours <= settings.COMMISSION_TIER_2_HOURS:
        return Decimal(str(settings.COMMISSION_TIER_2_RATE))
    return Decimal(str(settings.COMMISSION_TIER_3_RATE))


# --------------------------- 学员下单付款 ---------------------------


async def create_order_for_lesson(
    db: AsyncSession,
    lesson: Lesson,
    *,
    channel: str | None = None,
) -> PaymentOrder:
    """
    学员下单扣款并进入托管（plan.md §3.4 第 1 行）。

    原子性操作（单事务）：
      1. 创建 PaymentOrder(status=pending)
      2. 调用 ChannelAdapter.create_charge → status=paid
      3. 学员 Wallet -= gross（含流水）
      4. 记账本：escrow += gross（单边 entry）
      5. 订单转 held（等待课程完成写 held_until）
    """
    ch_name = channel or settings.DEFAULT_PAYMENT_CHANNEL
    adapter = get_channel(ch_name)

    # 1. 创建订单
    order = PaymentOrder(
        lesson_id=lesson.id,
        student_id=lesson.student_id,
        gross_amount=lesson.price,
        channel=ch_name,
        status="pending",
    )
    db.add(order)
    await db.flush()

    # 2. 渠道扣款（Mock 同步置 paid）
    await adapter.create_charge(db, order)

    # 3. 学员钱包扣款
    wallet = await wallet_service.get_wallet_by_user_id(
        db, lesson.student_id, lock=True
    )
    if wallet is None:
        raise ValueError("学员钱包不存在")
    if wallet.balance < order.gross_amount:
        raise ValueError("余额不足")
    wallet.balance -= order.gross_amount
    wallet.updated_at = datetime.now(timezone.utc)
    db.add(
        Transaction(
            wallet_id=wallet.id,
            lesson_id=lesson.id,
            type="payment",
            amount=-order.gross_amount,
            description="课程预约扣款",
        )
    )

    # 4. 账本：escrow += gross
    await ledger_service.post_single_entry(
        db,
        account_code=ACCOUNT_ESCROW,
        amount=order.gross_amount,
        direction="debit",
        ref_type="payment_order",
        ref_id=order.id,
        description=f"学员付款入托管 lesson={lesson.id}",
    )

    # 5. 转为 held（资金锁定在托管户，等待课程完成与争议期）
    order.status = "held"
    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return order


# --------------------------- 课程完成（写争议期） ---------------------------


async def mark_lesson_completed(
    db: AsyncSession, lesson: Lesson
) -> PaymentOrder:
    """
    lesson_service.end_lesson 在事务末尾调用，写入 held_until 争议期 deadline。
    """
    r = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.lesson_id == lesson.id,
            PaymentOrder.status != "refunded",
        )
    )
    order = r.scalars().first()
    if order is None:
        raise LookupError(f"未找到 lesson={lesson.id} 的活跃 PaymentOrder")

    if order.status != "held":
        # 幂等：已经 released/refunded 的订单不重写
        return order

    base = lesson.actual_end_at or datetime.now(timezone.utc)
    order.held_until = base + timedelta(hours=settings.DISPUTE_WINDOW_HOURS)
    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return order


# --------------------------- 结算释放 ---------------------------


async def _get_or_default_tax_profile(
    db: AsyncSession, teacher_id: uuid.UUID
) -> TeacherTaxProfile:
    r = await db.execute(
        select(TeacherTaxProfile).where(TeacherTaxProfile.teacher_id == teacher_id)
    )
    profile = r.scalars().first()
    if profile is not None:
        return profile

    # 惰性生成默认 TaxProfile（plan.md R6）
    profile = TeacherTaxProfile(
        teacher_id=teacher_id,
        tax_scenario=DEFAULT_TAX_SCENARIO,
    )
    db.add(profile)
    await db.flush()
    return profile


async def release_payment_order(
    db: AsyncSession, order: PaymentOrder
) -> PayoutOrder:
    """
    争议期过期或手动触发时的释放流程（plan.md §3.4 release）：

      1. 二次校验 status='held'（幂等）
      2. 定位教师档案 + 税务档案（缺失时生成默认）
      3. 跑阶梯费率 → 跑税务策略 → 落 SettlementSnapshot
      4. 账本：escrow -= gross；platform_revenue += commission；
               tax_payable += (vat+pit)；teacher_payable += net  (sum=0)
      5. 创建 PayoutOrder → Mock 立即 paid
      6. 教师 Wallet += net；teacher_payable -= net（单边）
      7. 订单转 released
    """
    # 1. 幂等
    if order.status == "released":
        existing = await db.execute(
            select(PayoutOrder).where(PayoutOrder.payment_order_id == order.id)
        )
        existing_payout = existing.scalars().first()
        if existing_payout is not None:
            return existing_payout
        raise RuntimeError(
            f"order {order.id} 状态为 released 但没有对应 PayoutOrder，数据异常"
        )
    if order.status != "held":
        raise ValueError(
            f"release 仅接受 held 订单，当前 status={order.status}"
        )

    # 2. 教师档案
    r = await db.execute(
        select(Lesson).where(Lesson.id == order.lesson_id)
    )
    lesson = r.scalars().first()
    if lesson is None:
        raise LookupError(f"lesson 不存在: {order.lesson_id}")

    r = await db.execute(
        select(TeacherProfile).where(TeacherProfile.id == lesson.teacher_id)
    )
    teacher = r.scalars().first()
    if teacher is None:
        raise LookupError(f"教师档案不存在: {lesson.teacher_id}")

    tax_profile = await _get_or_default_tax_profile(db, teacher.id)

    # 3. 阶梯费率 + 税务策略
    month = (lesson.actual_end_at or datetime.now(timezone.utc)).date()
    commission_rate = await resolve_commission_rate(db, teacher.id, month)
    strategy = get_strategy(tax_profile.tax_scenario)
    calc = strategy.calculate(order.gross_amount, commission_rate, tax_profile)

    # 落快照
    snapshot = SettlementSnapshot(
        lesson_id=order.lesson_id,
        payment_order_id=order.id,
        tax_scenario=calc.tax_scenario,
        gross_amount=calc.gross_amount,
        commission_rate=calc.commission_rate,
        commission_amount=calc.commission_amount,
        tax_rate=calc.tax_rate,
        vat_amount=calc.vat_amount,
        pit_amount=calc.pit_amount,
        net_amount=calc.net_amount,
    )
    db.add(snapshot)
    await db.flush()

    # 4. 账本四条（平衡）
    tax_total = calc.vat_amount + calc.pit_amount
    entries: list[tuple[str, int, str]] = [
        (ACCOUNT_ESCROW, -calc.gross_amount, "credit"),
        (ACCOUNT_PLATFORM_REVENUE, calc.commission_amount, "debit"),
        (ACCOUNT_TEACHER_PAYABLE, calc.net_amount, "debit"),
    ]
    if tax_total != 0:
        entries.append((ACCOUNT_TAX_PAYABLE, tax_total, "debit"))
    await ledger_service.post_entries(
        db,
        entries=entries,
        ref_type="payment_order",
        ref_id=order.id,
        description=f"结算释放 lesson={order.lesson_id}",
    )

    # 5. 创建 PayoutOrder
    payout = PayoutOrder(
        payment_order_id=order.id,
        lesson_id=order.lesson_id,
        teacher_id=teacher.id,
        settlement_snapshot_id=snapshot.id,
        net_amount=calc.net_amount,
        status="pending",
        channel="mock",
    )
    db.add(payout)
    await db.flush()

    # 6. Mock 出款：教师钱包入账 + teacher_payable 减
    teacher_wallet = await wallet_service.ensure_wallet(db, teacher.user_id)
    teacher_wallet = await wallet_service.get_wallet_by_user_id(
        db, teacher.user_id, lock=True
    )
    assert teacher_wallet is not None
    teacher_wallet.balance += calc.net_amount
    teacher_wallet.updated_at = datetime.now(timezone.utc)
    db.add(
        Transaction(
            wallet_id=teacher_wallet.id,
            lesson_id=order.lesson_id,
            type="settlement",
            amount=calc.net_amount,
            description=f"课程结算 (费率: {calc.commission_rate:.0%})",
        )
    )
    await ledger_service.post_single_entry(
        db,
        account_code=ACCOUNT_TEACHER_PAYABLE,
        amount=-calc.net_amount,
        direction="credit",
        ref_type="payout_order",
        ref_id=payout.id,
        description=f"教师出款 lesson={order.lesson_id}",
    )

    payout.status = "paid"
    payout.paid_at = datetime.now(timezone.utc)
    payout.channel_txn_id = f"mock-payout-{uuid.uuid4().hex[:12]}"
    payout.updated_at = datetime.now(timezone.utc)

    # 7. 订单转 released
    order.status = "released"
    order.released_at = datetime.now(timezone.utc)
    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return payout


# --------------------------- 退款 ---------------------------


async def refund_payment_order(
    db: AsyncSession, order: PaymentOrder, reason: str
) -> PaymentOrder:
    """
    退款（plan.md §3.4 退款事件）：

      - 允许从 `held` 或 `disputed` 状态流转
      - 账本：escrow -= gross（单边）
      - 学员 Wallet += gross
      - 订单转 refunded
    """
    if order.status == "refunded":
        return order
    if order.status not in ("held", "disputed"):
        raise ValueError(
            f"refund 仅接受 held/disputed 订单，当前 status={order.status}"
        )

    # 学员钱包退款
    wallet = await wallet_service.get_wallet_by_user_id(
        db, order.student_id, lock=True
    )
    if wallet is None:
        raise ValueError("学员钱包不存在")
    wallet.balance += order.gross_amount
    wallet.updated_at = datetime.now(timezone.utc)
    db.add(
        Transaction(
            wallet_id=wallet.id,
            lesson_id=order.lesson_id,
            type="refund",
            amount=order.gross_amount,
            description=reason or "课程取消退款",
        )
    )

    # 账本 escrow 反向
    await ledger_service.post_single_entry(
        db,
        account_code=ACCOUNT_ESCROW,
        amount=-order.gross_amount,
        direction="credit",
        ref_type="refund",
        ref_id=order.id,
        description=reason or f"退款 lesson={order.lesson_id}",
    )

    order.status = "refunded"
    order.refunded_at = datetime.now(timezone.utc)
    order.last_error = None
    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return order


# --------------------------- 查询辅助 ---------------------------


async def get_active_order_by_lesson(
    db: AsyncSession, lesson_id: uuid.UUID
) -> PaymentOrder | None:
    r = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.lesson_id == lesson_id,
            PaymentOrder.status != "refunded",
        )
    )
    return r.scalars().first()


async def list_payouts_by_teacher(
    db: AsyncSession,
    teacher_id: uuid.UUID,
    *,
    status: str | None,
    page: int,
    page_size: int,
) -> tuple[Sequence[PayoutOrder], int]:
    from sqlalchemy import func

    base = select(PayoutOrder).where(PayoutOrder.teacher_id == teacher_id)
    if status:
        base = base.where(PayoutOrder.status == status)

    total = (
        await db.execute(
            select(func.count()).select_from(base.subquery())
        )
    ).scalar_one()

    offset = (page - 1) * page_size
    r = await db.execute(
        base.order_by(PayoutOrder.created_at.desc()).offset(offset).limit(page_size)
    )
    return list(r.scalars().all()), int(total)
