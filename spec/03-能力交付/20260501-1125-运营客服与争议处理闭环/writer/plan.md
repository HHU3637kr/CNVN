---
type: spec-plan
status: draft
created: 2026-05-01
git_branch: pending-spec-start
base_branch: pending-spec-start
execution_mode: single-agent
---

# 运营客服与争议处理闭环

## 概述

本 Spec 面向真实交易异常：学员或教师发起争议，运营查看课程/订单上下文，执行人工退款、释放或关闭争议，并留下审计记录。

## 现有能力

- 页面：学员中心有“联系平台客服”占位，付款单和出款页可查看部分交易信息。
- 后端：`PaymentOrder` 有 `disputed` 状态，`dispute_watcher` 可自动释放到期 held 订单。
- 服务：`payment_service.refund_payment_order`、`release_payment_order`、`lesson_service.cancel_lesson`。

## 缺口

- 无争议模型、客服 API、后台页面和处理记录。
- 用户不能正式发起争议。
- 运营不能按课程/订单查询上下文并执行受控资金动作。
- 人工资金动作缺权限和审计边界。

## 需求边界

### P0

- 用户能从课程或付款单发起争议。
- 运营能检索争议上下文。
- 运营能受控执行人工退款或人工释放。
- open 争议阻止自动 watcher 提前 release。

### P1

- 最小运营后台页面、处理历史、状态筛选和处理人字段。

### P2

- 附件、通知、审批、风险标签和对账工作台。

## 设计方案

### 后端

- 新增 `DisputeCase` 和可选 `DisputeEvent`。
- 争议打开时关联 `Lesson` / `PaymentOrder` 并暂停自动 release。
- 人工处理调用既有 `payment_service`，记录 operator 和 reason。

### 前端

- 在学员中心、教师中心、付款单详情增加争议入口。
- 运营端先 API-first，后续再补后台页面。

## 实现步骤

1. 为本 Spec 单独执行 `$spec-start`，创建独立实现分支。
2. 定义争议模型、状态和迁移。
3. 增加用户发起争议 API。
4. 增加运营检索和人工处理 API。
5. 调整 watcher 跳过 open/disputed 订单。
6. 补争议处理测试。

## 风险和依赖

- 人工资金动作依赖支付托管一致性 Spec 的幂等保障。
- 当前管理员角色模型不足，P0 必须明确临时运营权限方案。

## 文档关联

- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`

