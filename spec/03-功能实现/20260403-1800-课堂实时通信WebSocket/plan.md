---
title: 课堂实时通信（WebSocket + 后端）
type: plan
category: 03-功能实现
status: 已确认
priority: 高
created: 2026-04-03
updated: 2026-04-03
execution_mode: single-agent
tags:
  - spec
  - plan
  - websocket
related:
  - "[[exploration-report|探索报告]]"
  - "[[test-plan|测试计划]]"
---

# 课堂实时通信（WebSocket + 后端）

## 1. 概述

### 背景

在线课堂需要 **低延迟文字互动**。当前阶段 **不接入 Agora**（音视频/SDK 后续单独迭代），采用 **后端 WebSocket + 既有 `Message` 模型** 实现课堂内实时通信。

### 目标

- 提供 **按课时隔离的 WebSocket 连接**，仅该课时的学生与教师可接入。
- 客户端通过 WS **发送聊天消息**；服务端 **校验、落库 `Message`、并向同课时其他连接广播**。
- 可选保留 **REST：消息分页查询**（进房历史、断线重连后补偿）；若 MVP 仅 WS + 落库 + 内存回放，则至少在实现中明确 **首屏历史** 的获取方式（推荐保留 GET）。

### 范围

| 包含 | 不包含（后续迭代） |
|------|-------------------|
| WebSocket 端点 + 师生鉴权 | Agora RTC / RTM |
| 文本消息持久化与广播 | 已读回执、输入中状态（可后续加） |
| REST 消息列表（与探索报告一致，建议实现） | 多机房间同步（Redis） |
| 前端课堂页 WS + 聊天 UI | 音视频 |

### Agora

- **暂缓**：不在本 Spec 实现 Token、不增加 `agora-token-builder` / 前端 Agora 依赖。

## 2. 需求分析

### 功能需求

1. **FR-1**：用户携带有效 JWT 连接 `lesson_id` 对应 WebSocket；服务端验证其为该课时的学生或教师，否则关闭连接（可用 **4403** 关闭码或先 `accept` 再 `close` + 理由，实现时统一约定）。
2. **FR-2**：通过 WS 发送聊天 JSON（如 `{ "type": "chat", "content": "..." }`）；服务端校验 `content`、写入 `Message`、向同房间其他连接推送 **带 message id 与时间** 的广播。
3. **FR-3**（推荐）：`GET /api/v1/lessons/{lesson_id}/messages` 分页；`POST` 可 **可选**（若全走 WS 则 POST 可省略，但 plan 推荐 **WS 主写 + GET 只读** 或 **REST/WS 双写二选一**，实现时选一种避免重复）。
4. **FR-4**：前端课堂页：建立 WS → 收发明文聊天；失败时 **可读错误提示**。

**推荐一致性**：**仅 WS 写入聊天 + GET 拉历史**，避免 REST POST 与 WS 重复；若团队更熟 REST，也可 **POST 写库 + WS 仅广播**（需同一事务顺序）。实现步骤里择一并写死。

### 非功能需求

- 与现有 JWT、`/api/v1` 前缀、异步 SQLAlchemy 一致。
- 连接异常断开时客户端可重连；消息不保证 QoS（MVP），依赖客户端重试可选。

## 3. 设计方案

### 3.1 WebSocket 路径与鉴权

- 路径草案：`GET` 升级为 WS，例如 `/api/v1/lessons/{lesson_id}/ws`（或 `/api/v1/ws/lessons/{lesson_id}`，与路由组织一致即可）。
- **鉴权**：浏览器 `WebSocket` 无法自定义 Header，常用 **`access_token` 查询参数**（或连接后首条 `auth` 消息）。与现有 `decode_token` / `get_current_user` 逻辑复用。

### 3.2 房间模型

- **内存**：`dict[lesson_id, set[WebSocket]]`（或 UUID 键），由单例或 app.state 持有；断开时移除。
- **广播**：同 `lesson_id` 除发送者外全部推送（或含发送者，由产品定；一般全员含自己用于对齐 message id）。

### 3.3 消息协议（JSON 文本帧）

- 客户端 → 服务端示例：`{ "type": "chat", "content": "..." }`
- 服务端 → 客户端示例：`{ "type": "chat", "id": "...", "lesson_id": "...", "sender_id": "...", "content": "...", "created_at": "..." }`
- 错误：`{ "type": "error", "code": "...", "message": "..." }`

### 3.4 REST（若保留）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/lessons/{lesson_id}/messages` | 分页历史 |

鉴权同课时师生（与 `lesson_service` 已有权限逻辑对齐）。

### 3.5 前端

- 使用原生 `WebSocket` 或轻量封装；URL 带 token 查询参数（注意 **日志与 Referer 不泄露 token**，生产可改为首包鉴权）。
- 聊天列表组件订阅 WS 更新并追加消息。

### 3.6 错误与关闭

| 场景 | 行为 |
|------|------|
| JWT 无效/过期 | 拒绝连接或首包后关闭，原因可读（实现统一 `close(1008)` + JSON `error`） |
| 非本课时师生 | 403 等价关闭 |
| 非法 JSON / 超长 content | `type: error`，不广播 |

## 4. 执行模式

**推荐模式**：`single-agent`（前后端同一功能域，线性交付）。

## 5. 实现步骤

1. **后端**：`lesson` 权限复用函数（获取 lesson 并校验当前用户为师生）；实现 **连接管理器**（register/unregister/broadcast）。
2. **后端**：WebSocket 路由 + JWT 解析 + 消息处理与落库。
3. **后端**：`GET .../messages` + schema + service（若 plan 采纳）。
4. **前端**：课堂路由页、WS 连接、聊天列表与输入框。
5. **测试**：HTTP 测试 + WebSocket 测试（`httpx`/`websockets` 或 Starlette TestClient 支持 WS）。
6. **文档**：`summary.md`；注明 **Agora 未接入**、多机需 Redis。

## 6. 风险和依赖

| 风险 | 缓解 |
|------|------|
| 多进程广播不一致 | MVP 单实例；文档列后续 Redis |
| Token 在 Query 泄露 | 开发环境可接受；生产改首包鉴权或短期 ticket |

### 依赖

- 无新增商业 SDK；Python 标准 **Starlette WebSocket**。

## 7. 文档关联

- 探索报告: [[exploration-report|探索报告]]
- 测试计划: [[test-plan|测试计划]]
- 实现总结: [[summary|实现总结]]
- 审查报告: [[review|审查报告]]
