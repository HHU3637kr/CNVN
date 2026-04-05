---
title: 课堂实时通信（WebSocket）- 实现总结
type: summary
category: 03-功能实现
status: 已完成
created: 2026-04-03
plan: "[[plan]]"
tags:
  - spec
  - summary
  - websocket
---

# 实现总结：课堂实时通信（WebSocket）

## 1. 完成的功能

- [x] 后端：`GET /api/v1/lessons/{lesson_id}/messages` 分页历史，师生鉴权与 `get_lesson` 一致（`lesson_service.require_lesson_participant`）。
- [x] 后端：`WebSocket /api/v1/lessons/{lesson_id}/ws?access_token=...`，仅 `type=chat` 写入 `messages` 并广播 JSON（含 `id`、`created_at`）。
- [x] 后端：内存房间 `LessonRoomManager`（单进程；多机需 Redis，见 plan 风险）。
- [x] 前端：课堂页拉历史、`WebSocket` 长连接收消息、同连接发送；无 token 时提示登录与 `localStorage` 键说明。
- [x] 测试：`tests/conftest.py` 增加 `sync_client`（TestClient）；`test_lesson_messages.py` 覆盖 REST 403、WS 无 token、WS 收发与落库。

## 2. 实现的文件

```
backend/app/
├── dependencies.py              # fetch_user_by_access_token；get_current_user 复用
├── api/v1/lessons.py          # GET .../messages、WebSocket .../ws
├── services/lesson_service.py # require_lesson_participant
├── services/message_service.py
├── services/lesson_room.py
└── schemas/message.py

backend/tests/
├── conftest.py                  # sync_client
└── api/v1/test_lesson_messages.py

frontend/src/app/
├── lib/api.ts                   # API_BASE_URL、getAccessToken、wsUrlForLesson
└── pages/Classroom.tsx          # 历史 + WS 聊天
```

## 3. 测试结果

- **本 Spec 后端用例**：`tests/api/v1/test_lesson_messages.py` **7** 项全部通过（含 TC-WS-001～005 与 `LessonRoomManager` 广播单元测试）。
- **全仓库**：以当前环境执行 `pytest tests/` 为准；若其他模块单测失败，请单独排查（与本 Spec 文件列表无必然关系）。
- **前端**：`Classroom.tsx` / `api.ts` 无 linter 报错；完整 `vite build` 依赖本地 Node 环境。
- **书面报告**：[[test-report|test-report.md]]

## 4. 遇到的问题

> [!warning] TestClient 与 AsyncClient 跨事件循环
> **解决方案**：对 WebSocket 使用 **仅 `Starlette TestClient` 的 `sync_client` fixture**（独立 engine + `get_db` override），与 `AsyncClient` 的 `db_session` 分离；辅助查询 `teacher_id` 使用独立 `asyncio.run` 读库。

## 5. 与 plan.md 的差异

> [!note] 无实质偏离
> - 鉴权采用 **先 `accept` 再 JSON 错误 + `close(1008)`**，便于客户端统一解析（与 plan 中「可先 accept」一致）。

### 未实现的功能

- 多实例 WebSocket 广播（Redis）：按 plan 列为后续。
- Agora：按 plan 暂缓。

## 6. 后续建议

1. 登录流程统一写入 `localStorage` 键名（建议 `cnvn_access_token`），与 `getAccessToken()` 对齐。
2. 生产环境避免长期把 JWT 放在 WebSocket query（可改为连接后首包 `auth`）。
3. 水平扩展前为 `LessonRoomManager` 增加 Redis Pub/Sub。

## 7. 文档关联

- 设计文档: [[plan|设计方案]]
- 测试计划: [[test-plan|测试计划]]
- 探索报告: [[exploration-report|探索报告]]

---

## 归档说明

按 `spec-execute` 流程，**将本目录移至 `spec/06-已归档/` 需你确认后再执行**；当前仍保留在 `03-功能实现/`。
