"""课时 WebSocket 房间：内存连接表，单进程内广播。多机部署需 Redis 等（见课堂 Spec）。"""
from __future__ import annotations

import uuid
from typing import Any

from starlette.websockets import WebSocket


class LessonRoomManager:
    def __init__(self) -> None:
        self._rooms: dict[uuid.UUID, set[WebSocket]] = {}

    def connect(self, lesson_id: uuid.UUID, websocket: WebSocket) -> None:
        if lesson_id not in self._rooms:
            self._rooms[lesson_id] = set()
        self._rooms[lesson_id].add(websocket)

    def disconnect(self, lesson_id: uuid.UUID, websocket: WebSocket) -> None:
        if lesson_id not in self._rooms:
            return
        self._rooms[lesson_id].discard(websocket)
        if not self._rooms[lesson_id]:
            del self._rooms[lesson_id]

    async def broadcast_json(
        self,
        lesson_id: uuid.UUID,
        payload: dict[str, Any],
    ) -> None:
        conns = list(self._rooms.get(lesson_id, ()))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(lesson_id, ws)


lesson_room_manager = LessonRoomManager()
