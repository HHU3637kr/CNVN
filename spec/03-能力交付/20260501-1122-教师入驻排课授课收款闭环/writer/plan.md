---
type: spec-plan
status: draft
created: 2026-05-01
git_branch: pending-spec-start
base_branch: pending-spec-start
execution_mode: single-agent
---

# 教师入驻排课授课收款闭环

## 概述

本 Spec 面向教师供给侧：教师开通身份、完善档案、维护可授课时段、确认课程、进入课堂、完成授课，并查看结算和出款。

## 现有能力

- 页面：`/register`、`/dashboard/teacher`、`/payouts`、`/classroom/:id`。
- API：`POST /auth/become-teacher`、`POST /teachers/profile`、`PUT /teachers/profile`、`GET/PATCH /teachers/me/tax-profile`、`/availability` CRUD、`PATCH /lessons/{id}/confirm`、`PATCH /lessons/{id}/start`、`PATCH /lessons/{id}/end`、`GET /payouts/me`。
- 数据：`TeacherProfile`、`TeacherTaxProfile`、`Availability`、`Lesson`、`PayoutOrder`、`SettlementSnapshot`。

## 缺口

- 教师中心尚未形成入驻清单、排课管理、待确认课程和收入解释的一体化工作台。
- 可用时段更新语义不够严格，周期时段和指定日期可能混用。
- `total_lessons`、`response_rate` 等供给质量指标未稳定同步。
- 出款页可查看结果，但教师看不懂平台费、税费、争议期和预计到账。

## 需求边界

### P0

- 教师能开通身份、维护档案、设置可授课时段。
- 教师能看到待确认/待上课/已完成课程，并执行确认、开始、结束。
- 教师能查看争议期释放后的出款记录。
- 修复可用时段更新语义，禁止周期与指定日期混填。

### P1

- 教师收入明细展示 gross、fee、tax、net、预计释放时间。
- 同步教师完课数和响应率。
- 税务/KYC 信息脱敏展示。

### P2

- 批量排课、休假、提现账户、真实出款渠道。

## 设计方案

### 前端

- 教师中心拆为入驻状态、课程待办、排课管理、收入摘要。
- 排课表单明确周期/指定日期两种模式。
- 出款页展示课程来源和结算快照。

### 后端

- 强化 `availability_service` 的创建/更新校验。
- 课程确认、完课、结算释放后同步教师统计指标。
- 出款查询只允许教师本人。

## 实现步骤

1. 为本 Spec 单独执行 `$spec-start`，创建独立实现分支。
2. 修复 Availability 更新校验。
3. 优化教师中心课程动作和排课入口。
4. 增强出款/收入展示。
5. 补教师供给闭环测试。

## 风险和依赖

- 收款展示依赖支付托管一致性 Spec。
- KYC/税务字段涉及隐私，后台扩展必须配权限和审计。

## 文档关联

- 场景地图：`spec/01-产品规划/20260501-1120-CNVN用户场景地图/writer/plan.md`
- 总控规划：`spec/04-系统改进/20260501-1058-MVP到完善优化/writer/plan.md`

