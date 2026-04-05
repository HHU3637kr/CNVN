---
title: 教师模块 - 实现总结
type: summary
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - backend
  - teacher
  - spec/已完成
related:
  - "[[plan|实现计划]]"
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 实现总结：教师模块

> [!success] 状态
> 已按 `plan.md` 实现 6 个教师端点；`pytest tests/` **22** 条通过（含 `test_teachers.py` 5 条）。**未归档**（按用户要求保留在 `03-功能实现`）。

## 产出文件

| 路径 | 说明 |
|------|------|
| `app/services/teacher_service.py` | `search_teachers`、`get_teacher_profile`、`create_teacher_profile`、`update_teacher_profile` |
| `app/services/availability_service.py` | 新增 `get_teacher_availability`（公开按 `teacher_id` 列出时段） |
| `app/api/v1/teachers.py` | 六端点接入 Service；评价列表在路由内联查询 `Review`+`User` |
| `tests/api/v1/test_teachers.py` | 搜索/详情/公开时段/空评价/重复创建档案 |

## 设计对齐说明

- **搜索**：`is_active=true`；`q` 覆盖 `title`、`about`、`array_to_string(specialties)`；`specialties` 参数使用 PostgreSQL `ARRAY.contains`（`@>`）；`recommended` 排序使用 `avg_rating*0.5 + (total_lessons/nullif(max_total,0))*0.3 + response_rate*0.2`，`max_total` 为全库活跃教师 `max(total_lessons)` 子查询。
- **详情/评价/时段**：仅当教师 `is_active` 时返回，否则 404。
- **路由顺序**：`POST/PUT /profile` 与 `/{id}/reviews`、`/{id}/availability` 置于 `GET /{id}` 之前，避免与 UUID 路径混淆。
- **POST /teachers/profile**：与 `auth/become-teacher` 一致校验「已有档案则拒绝」；未拥有 `teacher` 角色时追加 `roles`，**不**自动改 `active_role`。

## 遇到的问题与处理

| 问题 | 处理 |
|------|------|
| `recommended` 需归一化 `total_lessons` | 使用 `max(total_lessons)` 子查询 + `nullif` 避免除零 |
| 评价列表未抽 Service | 按 plan 在路由层联表查询，保持实现范围最小 |

## 文档关联

- 设计方案：[[plan|实现计划]]
- 架构：[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
