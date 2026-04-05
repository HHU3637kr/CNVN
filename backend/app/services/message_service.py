from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.message import MessageOut
from app.services import lesson_service


MAX_CHAT_LENGTH = 2000


async def list_messages(
    db: AsyncSession,
    user: User,
    lesson_id: uuid.UUID,
    *,
    page: int,
    page_size: int,
) -> PaginatedResponse[MessageOut]:
    await lesson_service.require_lesson_participant(db, user, lesson_id)

    total = (
        await db.execute(
            select(func.count()).select_from(Message).where(Message.lesson_id == lesson_id)
        )
    ).scalar_one()

    offset = (page - 1) * page_size
    r = await db.execute(
        select(Message)
        .where(Message.lesson_id == lesson_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    rows = r.scalars().all()
    items = [MessageOut.model_validate(m) for m in rows]
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


async def create_chat_message(
    db: AsyncSession,
    user: User,
    lesson_id: uuid.UUID,
    content: str,
) -> Message:
    await lesson_service.require_lesson_participant(db, user, lesson_id)
    text = content.strip()
    if not text:
        raise ValueError("消息内容不能为空")
    if len(text) > MAX_CHAT_LENGTH:
        raise ValueError(f"消息长度不能超过 {MAX_CHAT_LENGTH} 字符")

    msg = Message(
        lesson_id=lesson_id,
        sender_id=user.id,
        content=text,
        message_type="text",
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg
