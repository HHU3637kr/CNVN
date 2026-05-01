---
type: spec-plan
status: draft
created: 2026-05-01
git_branch: pending-spec-start
base_branch: pending-spec-start
execution_mode: single-agent
---

# 学员找老师到预约上课闭环

## 概述

本 Spec 面向学员主链路：从首页/教师列表发现老师，进入详情页选择可用时段，完成预约与付款托管，在学员中心看到课程状态，并进入课堂完成上课。

产品化意义：把当前分散存在的教师、钱包、预约、课堂入口能力串成一个真实新用户可以走完的单课闭环。

## 现有能力

- 页面：`/`、`/teachers`、`/teachers/:id`、`/wallet`、`/dashboard/student`、`/classroom/:id`。
- API：`GET /teachers`、`GET /teachers/{id}`、`GET /teachers/{id}/availability`、`POST /lessons`、`PATCH /lessons/{id}/cancel`、`PATCH /lessons/{id}/start`、`PATCH /lessons/{id}/end`、`GET /wallet`、`POST /wallet/topup`。
- 服务：`teacher_service`、`availability_service`、`lesson_service`、`wallet_service`、`payment_service`。

## 缺口

- 教师详情页“预约试课”尚未创建课程。
- 余额不足、时段失效、课程冲突、教师不可预约等异常缺少可恢复路径。
- 学员中心对课程状态和课堂入口的启用规则不够完整。
- 预约冲突主要靠查询判断，真实并发下有双订风险。

## 需求边界

### P0

- 学员能在教师详情页选择可用时段并提交预约。
- 余额不足时明确引导到钱包，预约成功后回到学员中心。
- 学员中心按待确认、待上课、进行中、已完成、已取消展示课程。
- 课堂入口只在允许状态下展示。
- 后端防止同一教师或同一学员重叠预约。

### P1

- 补齐用户资料 `/users/me` GET/PUT。
- 教师列表增强筛选和空态。
- pending 超时、教师未确认、取消退款状态在学员端解释清楚。

### P2

- 收藏、再次预约、最近浏览、推荐排序和越南语提示。

## 设计方案

### 前端

- 教师详情页加载教师档案、可用时段、评价摘要和预约表单。
- 预约提交前校验登录态、时段选择、课题、时长和余额可见性。
- 预约成功后刷新课程列表并跳转学员中心。
- 错误提示按业务类型恢复：登录、充值、重新选时段、联系客服。

### 后端

- 保持 `lesson_service.create_lesson` 作为预约事务边界。
- 增加教师/学员时间窗重叠保护，优先 DB 约束，短期可先事务锁。
- 统一预约错误信息，便于前端映射。

### 数据/状态

- `Lesson.status` 负责履约状态。
- `PaymentOrder.status` 负责资金状态，不替代课程状态。
- 课程列表需要返回课堂入口所需字段。

## 实现步骤

1. 为本 Spec 单独执行 `$spec-start`，创建独立实现分支。
2. 完成教师详情页预约表单和提交流程。
3. 补后端并发预约保护。
4. 统一学员中心状态分组和课堂入口规则。
5. 补预约主链路测试。

## 风险和依赖

- 支付托管一致性依赖 `spec/04-系统改进/20260501-1124-支付托管退款结算一致性`。
- 课堂和评价体验依赖 `spec/03-能力交付/20260501-1123-课堂互动与课后评价闭环`。

## 文档关联

- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`

