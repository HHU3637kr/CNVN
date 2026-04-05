from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.lesson import Lesson
from app.services import wallet_service


async def calculate_platform_fee_rate(
    db: AsyncSession,
    teacher_id: uuid.UUID,
    month: date,
) -> float:
    """
    计算教师当月平台抽成费率

    规则：
    - 月完课 ≤ 20h：20%
    - 月完课 21-50h：15%
    - 月完课 > 50h：10%

    Args:
        db: 数据库会话
        teacher_id: 教师ID
        month: 目标月份

    Returns:
        费率（0.20、0.15 或 0.10）
    """
    # 计算月份的开始和结束时间（UTC）
    month_start = datetime(month.year, month.month, 1, tzinfo=timezone.utc)
    if month.month == 12:
        month_end = datetime(month.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(month.year, month.month + 1, 1, tzinfo=timezone.utc)

    # 查询当月已完成的课程
    r = await db.execute(
        select(Lesson).where(
            Lesson.teacher_id == teacher_id,
            Lesson.status == "completed",
            Lesson.actual_end_at >= month_start,
            Lesson.actual_end_at < month_end,
        )
    )
    completed_lessons = r.scalars().all()

    # 计算总完课时长（分钟转小时）
    total_minutes = sum(lesson.duration_minutes for lesson in completed_lessons)
    total_hours = total_minutes / 60.0

    # 阶梯费率计算
    if total_hours <= settings.COMMISSION_TIER_1_HOURS:
        return float(settings.COMMISSION_TIER_1_RATE)
    elif total_hours <= settings.COMMISSION_TIER_2_HOURS:
        return float(settings.COMMISSION_TIER_2_RATE)
    else:
        return float(settings.COMMISSION_TIER_3_RATE)


async def settle_teacher_lesson(
    db: AsyncSession,
    lesson: Lesson,
) -> None:
    """
    课程完成时结算给教师

    流程：
    1. 检查是否已结算（防重复）
    2. 计算阶梯费率
    3. 计算教师入账金额
    4. 给教师钱包入账
    5. 创建结算交易记录
    6. 标记课程已结算

    Args:
        db: 数据库会话
        lesson: 课程记录
    """
    # 1. 防重复结算检查
    if lesson.settled_at is not None:
        return  # 已结算，直接返回

    # 2. 计算阶梯费率（使用课程完成时间的月份）
    completed_date = lesson.actual_end_at or datetime.now(timezone.utc)
    fee_rate = await calculate_platform_fee_rate(
        db, lesson.teacher_id, completed_date.date()
    )

    # 3. 计算教师入账金额
    teacher_amount = int(lesson.price * (1 - fee_rate))
    platform_amount = lesson.price - teacher_amount

    # 4. 获取教师用户ID
    from app.models.teacher_profile import TeacherProfile

    r = await db.execute(
        select(TeacherProfile).where(TeacherProfile.id == lesson.teacher_id)
    )
    teacher_profile = r.scalars().first()
    if not teacher_profile:
        raise ValueError(f"教师档案不存在: {lesson.teacher_id}")

    teacher_user_id = teacher_profile.user_id

    # 5. 给教师钱包入账
    await wallet_service.credit_settlement(
        db,
        teacher_user_id,
        teacher_amount,
        lesson.id,
        f"课程结算 (费率: {fee_rate:.0%})",
    )

    # 6. 标记课程已结算
    lesson.settled_at = datetime.now(timezone.utc)
    lesson.teacher_amount = teacher_amount
    lesson.platform_fee_rate = Decimal(str(fee_rate))

    await db.commit()
