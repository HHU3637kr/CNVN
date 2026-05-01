---
title: 教师入驻排课授课收款闭环实现总结
type: summary
category: 03-能力交付
status: 未确认
created: 2026-05-01
git_branch: feat/spec-20260501-1248-teacher-supply-flow
plan: "[[../writer/plan|plan]]"
test_plan: "[[../tester/test-plan|test-plan]]"
tags:
  - spec
  - summary
  - executor
  - teacher-supply-flow
---

# 教师入驻排课授课收款闭环实现总结

> [!success]
> 后端与前端 P0 范围已分别完成并通过各自验证。本文汇总 `[[backend-summary|backend-summary]]` 与 `[[frontend-summary|frontend-summary]]` 的执行结果。

## 1. 后端完成项

- [x] 排课可用时间：
  - `AvailabilityUpdate` 保留显式 `null`，支持前端清理 weekly/date 互斥字段。
  - `create_availability` 与 `update_availability` 统一校验最终态，覆盖 day/date 互斥、至少一种模式、时间顺序和 `is_recurring` 语义。
  - `Availability` 模型与 Alembic migration 新增数据库层 CHECK 约束。
- [x] 教师档案：
  - 新增 `GET /api/v1/teachers/me/profile`，并放置在动态 `/{teacher_id}` 路由之前。
  - 新增按当前用户读取教师档案的 service 能力。
- [x] 课程动作：
  - `PATCH /lessons/{id}/start`、`PATCH /lessons/{id}/end` 改为教师权限入口。
  - `confirm/start/end` 均校验课程所属教师，非本人返回 403。
  - `start` 复用课堂进入窗口校验；`end` 继续触发 `payment_service.mark_lesson_completed` 写入争议期。
- [x] 教师统计：
  - 新增教师交付统计同步服务，在 confirm、pending 过期、end、review 后同步 `total_lessons` 与 `response_rate`。
- [x] 出款：
  - `/payouts/me` 改为教师权限接口。
  - `PayoutOrderOut` 扩展收入、佣金、税费、到账净额、争议期和释放时间等解释字段。
  - 出款列表预加载结算快照和支付订单，避免 N+1 查询。

## 2. 前端完成项

- [x] 类型与格式化：
  - 补充教师档案、税务档案、排课创建/更新类型。
  - 扩展 `PayoutOrderOut` 类型并新增百分比、越南时间、出款状态格式化函数。
- [x] 教师工作台：
  - 接入 `/auth/me`、`/teachers/me/profile`、`/teachers/me/tax-profile`、`/availability`、`/lessons?role=teacher&page_size=100`、`/wallet`、`/payouts/me?page=1&page_size=10`。
  - 实现教师身份处理、入驻状态、档案编辑、税务资料最小编辑、排课创建/编辑/删除。
  - 排课 weekly/date 模式提交时显式发送 `day_of_week` 或 `specific_date` 的 `null`，配合后端最终态校验。
  - 按课程状态展示待确认、待上课、进行中、已完成、已取消/已过期，并接入 confirm/start/end 动作。
  - 增加钱包与最近出款摘要。
- [x] 出款页：
  - 改为教师可读的出款明细，展示课程收入、平台费、税费、实际到账、状态、争议期截止、释放时间和到账时间。
- [x] 课堂页：
  - 教师身份下校验当前教师是否为课程教师。
  - 教师主按钮改为结束课程，调用 `PATCH /lessons/{id}/end` 后返回教师中心。
  - 学生/非教师离开不调用 end API。
- [x] 注册页：
  - 教师入驻提交补 `currency: "VND"` 并过滤空专长项。
  - 入驻成功后显式调用 `/auth/switch-role` 切换到教师身份，再进入教师中心。

## 3. 关键文件

### 后端

- `backend/app/models/availability.py`
- `backend/app/services/availability_service.py`
- `backend/app/services/teacher_service.py`
- `backend/app/services/teacher_stats_service.py`
- `backend/app/services/lesson_service.py`
- `backend/app/services/review_service.py`
- `backend/app/services/payment_service.py`
- `backend/app/api/v1/teachers.py`
- `backend/app/api/v1/lessons.py`
- `backend/app/api/v1/payouts.py`
- `backend/app/schemas/payment.py`
- `backend/alembic/versions/005_availability_final_state_checks.py`
- `backend/tests/api/v1/test_availability.py`
- `backend/tests/api/v1/test_teachers.py`
- `backend/tests/api/v1/test_lessons.py`
- `backend/tests/api/v1/test_payment_settlement.py`
- `backend/tests/api/v1/test_reviews.py`

### 前端

- `frontend/src/app/types/api.ts`
- `frontend/src/app/lib/format.ts`
- `frontend/src/app/pages/TeacherDashboard.tsx`
- `frontend/src/app/pages/Payouts.tsx`
- `frontend/src/app/pages/Classroom.tsx`
- `frontend/src/app/pages/Register.tsx`

## 4. API 契约变化

- `GET /api/v1/teachers/me/profile`
  - 新增当前教师档案读取接口。
  - 前端教师工作台与课堂教师身份校验依赖该接口。
- `POST/PATCH /availability`
  - weekly/date 模式必须保持字段互斥。
  - 更新请求支持显式 `null` 清理旧字段。
  - `is_recurring` 必须与 weekly/date 模式一致。
- `PATCH /lessons/{id}/confirm`
  - 校验课程所属教师，非本人返回 403。
  - confirm 后同步教师统计。
- `PATCH /lessons/{id}/start`
  - 改为教师权限入口。
  - 校验课程所属教师与课堂进入窗口；不满足时返回中文原因。
- `PATCH /lessons/{id}/end`
  - 改为教师权限入口。
  - 校验课程所属教师；成功后触发课程完成与争议期写入。
- `GET /payouts/me`
  - 改为教师权限接口。
  - 返回 DTO 扩展 gross、commission、VAT、PIT、tax、net、tax_scenario、held_until、released_at 等解释字段。
- 教师注册入驻提交
  - 前端补充 `currency: "VND"`。
  - 入驻成功后前端显式调用 `/auth/switch-role` 切换到教师身份。

## 5. 测试结果摘要

### 后端专项回归

```powershell
cd backend
python -m pytest tests/api/v1/test_availability.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_payment_settlement.py -q
```

结果：`28 passed, 4 warnings in 21.90s`

### 后端组合回归

```powershell
cd backend
python -m pytest tests/api/v1/test_auth.py tests/api/v1/test_teachers.py tests/api/v1/test_lessons.py tests/api/v1/test_lesson_messages.py tests/api/v1/test_payment_settlement.py tests/api/v1/test_reviews.py -q
```

结果：`47 passed, 4 warnings in 42.89s`

### 前端构建验证

```powershell
cd frontend
pnpm run build
```

结果：通过。关键输出：

```text
vite v6.3.5 building for production...
✓ 1626 modules transformed.
✓ built in 1.75s
```

## 6. 残留风险

> [!warning]
> 当前总结基于后端与前端 executor 分项摘要；本文档收口未重新运行测试，也未修改业务代码。

- Alembic migration 会对 `availabilities` 增加更严格 CHECK；若历史数据存在 day/date 混合或 `is_recurring` 与模式不一致，正式迁移前需要先清理数据。
- `/payouts/me` 仍只返回已生成的 `PayoutOrder`；未过争议期的 held 付款单不会进入出款列表，符合当前 Spec 边界，但需要产品侧理解该展示口径。
- 后端 pytest warning 为 FastAPI `on_event` deprecation，与本 Spec 行为无关。
- 前端只执行了 Vite build，未执行浏览器端手工 smoke；教师/学生课堂进入、教师结束课程、出款字段展示仍建议在联调环境覆盖。
- 当前仓库没有独立 `tsc` 脚本，`pnpm run build` 不等同于完整 TypeScript 类型门禁。
- 前端依赖后端新增 `GET /teachers/me/profile` 与扩展后的 `/payouts/me` DTO；若后续字段名调整，需要同步更新 `frontend/src/app/types/api.ts` 与对应页面展示。

## 7. 文档关联

- 设计文档：`[[../writer/plan|plan]]`
- 测试计划：`[[../tester/test-plan|test-plan]]`
- 后端总结：`[[backend-summary|backend-summary]]`
- 前端总结：`[[frontend-summary|frontend-summary]]`
