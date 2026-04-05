import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketDisconnect

from app.database import get_db
from app.dependencies import (
    fetch_user_by_access_token,
    get_current_user,
    get_current_student,
    get_current_teacher,
)
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.lesson import LessonCancel, LessonCreate, LessonListItem, LessonOut
from app.schemas.message import MessageOut
from app.services import lesson_service, message_service
from app.services.lesson_room import lesson_room_manager

router = APIRouter(prefix="/lessons", tags=["Lessons"])


def _http(e: Exception) -> HTTPException:
    if isinstance(e, LookupError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    if isinstance(e, PermissionError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    data: LessonCreate,
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """学生预约课程"""
    try:
        return await lesson_service.create_lesson(db, current_user, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{lesson_id}/messages", response_model=PaginatedResponse[MessageOut])
async def list_lesson_messages(
    lesson_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """课堂消息历史（分页）"""
    try:
        return await message_service.list_messages(
            db, current_user, lesson_id, page=page, page_size=page_size
        )
    except LookupError as e:
        raise _http(e)
    except PermissionError as e:
        raise _http(e)


@router.websocket("/{lesson_id}/ws")
async def lesson_websocket(
    websocket: WebSocket,
    lesson_id: uuid.UUID,
    access_token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """课堂实时聊天 WebSocket；仅 WS 写入，query: access_token=JWT。"""
    await websocket.accept()
    if not access_token:
        await websocket.send_json(
            {
                "type": "error",
                "code": "unauthorized",
                "message": "缺少 access_token 查询参数",
            }
        )
        await websocket.close(code=1008)
        return
    user = await fetch_user_by_access_token(db, access_token)
    if user is None:
        await websocket.send_json(
            {
                "type": "error",
                "code": "unauthorized",
                "message": "无法验证凭据",
            }
        )
        await websocket.close(code=1008)
        return
    if not user.is_active:
        await websocket.send_json(
            {
                "type": "error",
                "code": "forbidden",
                "message": "账号已被禁用",
            }
        )
        await websocket.close(code=1008)
        return
    try:
        await lesson_service.require_lesson_participant(db, user, lesson_id)
    except LookupError as e:
        await websocket.send_json(
            {"type": "error", "code": "not_found", "message": str(e)}
        )
        await websocket.close(code=1008)
        return
    except PermissionError as e:
        await websocket.send_json(
            {"type": "error", "code": "forbidden", "message": str(e)}
        )
        await websocket.close(code=1008)
        return

    lesson_room_manager.connect(lesson_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "invalid_json",
                        "message": "无效 JSON",
                    }
                )
                continue
            if data.get("type") != "chat":
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "unsupported",
                        "message": "仅支持 type=chat",
                    }
                )
                continue
            content = (data.get("content") or "").strip()
            if not content:
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "validation",
                        "message": "内容不能为空",
                    }
                )
                continue
            try:
                msg = await message_service.create_chat_message(
                    db, user, lesson_id, content
                )
            except ValueError as e:
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "validation",
                        "message": str(e),
                    }
                )
                continue
            payload = {
                "type": "chat",
                "id": str(msg.id),
                "lesson_id": str(msg.lesson_id),
                "sender_id": str(msg.sender_id),
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            }
            await lesson_room_manager.broadcast_json(lesson_id, payload)
    except WebSocketDisconnect:
        pass
    finally:
        lesson_room_manager.disconnect(lesson_id, websocket)


@router.get("", response_model=PaginatedResponse[LessonListItem])
async def list_lessons(
    status_filter: str | None = Query(None, alias="status"),
    role: str = Query("student", pattern="^(student|teacher)$"),
    upcoming: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取我的课程列表"""
    try:
        return await lesson_service.list_lessons(
            db,
            current_user,
            status_filter=status_filter,
            role=role,
            upcoming=upcoming,
            page=page,
            page_size=page_size,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{lesson_id}", response_model=LessonOut)
async def get_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """课程详情"""
    try:
        return await lesson_service.get_lesson(db, current_user, lesson_id)
    except LookupError as e:
        raise _http(e)
    except PermissionError as e:
        raise _http(e)


@router.patch("/{lesson_id}/confirm", response_model=LessonOut)
async def confirm_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """老师确认课程"""
    try:
        return await lesson_service.confirm_lesson(db, current_user, lesson_id)
    except LookupError as e:
        raise _http(e)
    except PermissionError as e:
        raise _http(e)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{lesson_id}/cancel", response_model=LessonOut)
async def cancel_lesson(
    lesson_id: uuid.UUID,
    data: LessonCancel | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消课程"""
    try:
        return await lesson_service.cancel_lesson(
            db,
            current_user,
            lesson_id,
            data.reason if data else None,
        )
    except LookupError as e:
        raise _http(e)
    except PermissionError as e:
        raise _http(e)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{lesson_id}/start", response_model=LessonOut)
async def start_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """开始上课"""
    try:
        return await lesson_service.start_lesson(db, current_user, lesson_id)
    except LookupError as e:
        raise _http(e)
    except PermissionError as e:
        raise _http(e)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{lesson_id}/end", response_model=LessonOut)
async def end_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """结束课程"""
    try:
        return await lesson_service.end_lesson(db, current_user, lesson_id)
    except LookupError as e:
        raise _http(e)
    except PermissionError as e:
        raise _http(e)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
