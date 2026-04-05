---
title: 测试报告 - 课堂实时通信（WebSocket）
type: test-report
category: 03-功能实现
status: 已完成
created: 2026-04-03
plan: "[[plan]]"
test-plan: "[[test-plan]]"
tags:
  - spec
  - test-report
---

# 测试报告：课堂实时通信（WebSocket）

## 执行摘要

- **执行日期**: 2026-04-03
- **后端**：`tests/api/v1/test_lesson_messages.py` **7** 用例全部通过（含 TC-WS-001～003、005 与 `LessonRoomManager` 广播单元测试）。
- **TC-WS-004（双浏览器/双客户端端到端）**：Starlette `TestClient` 多线程与异步 `get_db` 同库会话 **跨事件循环**，未采用双进程 E2E；以 **`test_lesson_room_broadcasts_to_all_sockets`**（`AsyncMock` 双连接）验证 **broadcast 向房间内全部连接发送**，与 [[test-plan|test-plan.md]]「可人工或集成」一致。

## 用例对照

| 编号 | 结果 | 说明 |
|------|------|------|
| TC-HTTP-001 | ✅ | `test_ws_chat_roundtrip` + GET messages |
| TC-HTTP-002 | ✅ | `test_list_messages_forbidden_for_stranger` |
| TC-WS-001 | ✅ | `test_ws_rejects_without_token` |
| TC-WS-002 | ✅ | `test_ws_rejects_invalid_token` |
| TC-WS-003 | ✅ | `test_ws_rejects_non_member` |
| TC-WS-004 | ✅（单元） | `test_lesson_room_broadcasts_to_all_sockets`；双人实时 E2E 见上 |
| TC-WS-005 | ✅ | `test_ws_invalid_json_returns_error` |

## 备注

- 全仓库 `pytest tests/` 若存在 **其他模块** 失败（如 `test_teachers` 数据顺序），与本 Spec 无直接关系；本 Spec 相关文件见上。
