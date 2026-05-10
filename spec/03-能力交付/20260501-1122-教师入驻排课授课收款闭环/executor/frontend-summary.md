---
title: 前端执行总结
type: executor-summary
role: frontend
status: completed
created: 2026-05-01
git_branch: feat/spec-20260501-1248-teacher-supply-flow
plan: "[[../writer/plan|plan]]"
test_plan: "[[../tester/test-plan|test-plan]]"
tags:
  - spec
  - executor
  - frontend
  - teacher-supply-flow
---

# 前端执行总结

> [!success]
> 前端按 `[[../writer/plan|plan]]` 的教师供给侧 P0 工作台范围完成实现，并通过 `pnpm run build`。

## 改动文件

- `frontend/src/app/types/api.ts`
  - 补充 `TeacherProfileUpdate`、`TeacherTaxProfileOut`、`TeacherTaxProfileUpdate`、`AvailabilityCreate`、`AvailabilityUpdate`。
  - 扩展 `PayoutOrderOut`，支持 gross、平台费、VAT、PIT、税费、net、争议期和释放/到账时间字段。
- `frontend/src/app/lib/format.ts`
  - 新增 `formatPercentDecimal`、`formatDateTimeVN`、`formatPayoutStatus`。
- `frontend/src/app/pages/TeacherDashboard.tsx`
  - 加载 `/auth/me`、`/teachers/me/profile`、`/teachers/me/tax-profile`、`/availability`、`/lessons?role=teacher&page_size=100`、`/wallet`、`/payouts/me?page=1&page_size=10`。
  - 实现教师身份/active role 处理、入驻状态、档案编辑、税务资料最小编辑、排课创建/编辑/删除。
  - 排课 weekly/date 模式提交时显式发送 `day_of_week` 或 `specific_date` 的 `null` 清理旧字段。
  - 按课程状态分组展示待确认、待上课、进行中、已完成、已取消/已过期，并接入 confirm/start/end 动作。
  - 增加钱包和最近出款摘要。
- `frontend/src/app/pages/Payouts.tsx`
  - 改为教师可读的出款明细页，展示课程收入、平台费、税费、实际到账、状态、争议期截止、释放时间、到账时间。
  - 删除面向用户的 API 技术文案。
- `frontend/src/app/pages/Classroom.tsx`
  - 预检同时读取 lesson 和 `/auth/me`；教师身份下读取 `/teachers/me/profile` 判断是否为本课程教师。
  - 教师主按钮为“结束课程”，调用 `PATCH /lessons/{id}/end` 后返回教师中心。
  - 教师保留“普通离开”，学生/非教师离开不调用 end API，并返回学习中心。
- `frontend/src/app/pages/Register.tsx`
  - 教师注册入驻提交补 `currency: "VND"`，过滤空专长项。
  - 入驻成功后显式调用 `/auth/switch-role` 切换到教师身份，再进入教师中心。

## 验证结果

```powershell
cd frontend
pnpm run build
```

结果：通过。

关键输出：

```text
vite v6.3.5 building for production...
✓ 1626 modules transformed.
✓ built in 1.75s
```

## 未完成风险

> [!warning]
> 本次只负责前端范围，未运行后端 pytest，也未执行浏览器端手工 smoke。

- `TeacherDashboard` 依赖后端并行交付的 `GET /teachers/me/profile` 和扩展后的 `/payouts/me` DTO；如果后端字段名与 `plan.md` 不一致，页面会显示 `-` 或返回接口错误。
- Vite build 不等同于完整 TypeScript 类型门禁；当前仓库没有独立 `tsc` 脚本。
- 课堂教师结束课程的真实成功路径需要后端 start/end 权限收紧完成后，通过浏览器 smoke 覆盖教师/学生两类身份。

## 文档关联

- 设计文档：`[[../writer/plan|plan]]`
- 测试计划：`[[../tester/test-plan|test-plan]]`
