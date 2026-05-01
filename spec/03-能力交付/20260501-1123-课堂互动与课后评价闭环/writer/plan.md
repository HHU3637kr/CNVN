---
type: spec-plan
status: draft
created: 2026-05-01
git_branch: pending-spec-start
base_branch: pending-spec-start
execution_mode: single-agent
---

# 课堂互动与课后评价闭环

## 概述

本 Spec 面向课堂履约与课后信任沉淀：师生进入课堂、读取历史消息、通过 WebSocket 文本互动、结束课程，并由学员评价老师。

## 现有能力

- 页面：`/classroom/:id`、学员/教师中心课堂入口、教师详情评价列表。
- API：`GET /lessons/{id}/messages`、`WS /lessons/{id}/ws`、`PATCH /lessons/{id}/start`、`PATCH /lessons/{id}/end`、`POST /reviews`、`GET /reviews/{id}`、`GET /teachers/{id}/reviews`。
- 服务：`lesson_room`、`message_service`、`lesson_service`、`review_service`。

## 缺口

- 课堂音视频、资料和笔记仍是占位。
- WebSocket token 放 query string，多实例广播暂不支持。
- 课堂连接失败、非参与者、已取消课程、未到时间等状态缺少清晰前端恢复。
- 学员中心“去评价”尚未接入提交表单。
- 评价会把课程状态改为 `reviewed`，需确保不影响结算统计。

## 需求边界

### P0

- 参与者能进入课堂，读取历史消息并发送/接收文本消息。
- 课堂状态流转清晰：confirmed -> in_progress -> completed。
- 完课后学员能提交评价。
- 评价不破坏佣金统计和结算。

### P1

- 更安全的 WebSocket ticket 鉴权。
- 课堂结束页和学员中心都展示评价入口。

### P2

- Redis Pub/Sub、多媒体消息、课件和课堂记录导出。

## 设计方案

### 前端

- 课堂页先拉课程权限和历史消息，再建立 WebSocket。
- 展示连接中、已连接、重连中、失败状态。
- 完课后展示评价表单或跳转学员中心评价。

### 后端

- 继续以参与者校验作为课堂权限入口。
- 修复评价与结算统计的状态耦合。
- 稳定返回课堂权限和状态错误。

## 实现步骤

1. 为本 Spec 单独执行 `$spec-start`，创建独立实现分支。
2. 统一课堂入口权限和状态判断。
3. 优化课堂连接状态和消息失败提示。
4. 接入评价表单。
5. 补课堂和评价场景测试。

## 风险和依赖

- 评价和结算口径依赖支付托管一致性 Spec。
- 多实例课堂不是 P0。

## 文档关联

- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`

