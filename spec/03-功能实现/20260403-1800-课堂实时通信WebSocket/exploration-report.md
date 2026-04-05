---
title: 探索报告 - 课堂实时通信（WebSocket）
type: exploration-report
category: 03-功能实现
status: 已完成
created: 2026-04-03
updated: 2026-04-03
plan: "[[plan]]"
tags:
  - spec
  - exploration
  - websocket
---

# 探索报告：课堂实时通信（WebSocket）

## 检索到的历史经验

- [[EXP-001|FastAPI 教师路由与 PG 数组搜索]]：**API 薄层 + Service + ORM**，JWT 鉴权与角色校验沿用 `dependencies.py`。
- 本任务以 **Starlette/FastAPI 原生 WebSocket** 为主，不引入 Agora（已暂缓）。

## 项目现状分析

### 课程与聊天数据模型

- `Lesson`：师生授权仍以 `lesson_id` 为边界。
- `Message`：已建模，**发送经 WebSocket 时仍应落库**，便于历史与审计；也可保留 **GET 分页** 作为进房首屏与断线补偿。

### 前端

- 课堂页需 **浏览器 WebSocket 客户端**（原生 `WebSocket` 或封装）；**不安装 Agora SDK**（当前阶段）。

### 架构对齐

- 与后端全局架构一致；WebSocket 升级请求需携带 **与 REST 等效的鉴权**（见 plan）。

## 外部知识（WebSocket）

- FastAPI：`APIRouter` + `@router.websocket`，在 `accept` 前校验 JWT（常见：`query` 参数 `access_token` 或子协议，与现有 JWT 格式一致）。
- MVP 可 **单进程内存** 维护 `lesson_id → 连接集合`；多实例部署时需 **Redis Pub/Sub** 等，列为后续，本 Spec 不强制。

## 对 Spec 创建的建议

| 维度 | 建议 |
|------|------|
| 绑定关系 | 仅该课时的学生与教师可连接对应 WS。 |
| 实时通道 | **WebSocket** 推送聊天与其它课堂信令（MVP 以文本聊天为主）。 |
| 持久化 | 聊天消息写入 `Message` 表；WS 广播 payload 可与 REST 返回结构对齐。 |
| Agora | **暂不接入**；后续独立迭代再增加 RTC Token 与前端 SDK。 |

## 风险与假设

- 单实例外扩时广播不完整 → 文档注明 MVP 假设；上线前加消息队列/Redis。
