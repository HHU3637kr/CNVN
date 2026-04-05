---
id: EXP-001
title: FastAPI 教师路由顺序与 PostgreSQL 教师搜索实现
keywords: [FastAPI, 路由顺序, PostgreSQL, ARRAY, SQLAlchemy, 推荐排序]
scenario: 实现公开教师 API（列表/详情/评价/时段）与多条件搜索时
created: 2026-04-03
---

# FastAPI 教师路由顺序与 PostgreSQL 教师搜索实现

## 困境

1. `GET /teachers/{teacher_id}` 若先于更具体路径注册，可能误匹配或增加调试成本；公开「评价」「时段」需依赖教师存在性校验。
2. `specialties` 为 PostgreSQL `ARRAY`，需「包含所选标签」的筛选，手写 `@>` 易与 SQLAlchemy 类型不匹配。
3. 「推荐」排序需综合评分、课时量、响应率，且课时量需相对全库最大值归一化，避免表达式除零。

## 策略

1. **路由注册顺序**：先静态与子路径——`POST/PUT /profile` → `GET /{id}/reviews` → `GET /{id}/availability` → 最后 `GET /{id}`；避免与 UUID 段歧义（`profile` 非 UUID 会 422，仍建议顺序清晰）。
2. **数组包含**：使用 ORM 列的 `.contains(列表)`（PostgreSQL 方言对应 `@>`），避免手写 `.op("@>")` 与 cast 不一致。
3. **推荐排序**：`max(total_lessons)` 用 `scalar_subquery()` 在全表 `is_active` 教师上取最大值；`total_lessons / nullif(max_total, 0)` 再 `coalesce` 为 0，再与 `avg_rating`、`response_rate` 加权。

## 理由

顺序与校验减少边界问题；`contains` 与引擎语义一致；子查询归一化满足 plan 中的「综合排名」定义并避免除零。

## 相关文件

- `backend/app/api/v1/teachers.py`
- `backend/app/services/teacher_service.py`

## 参考

- [[../../03-功能实现/20260403-教师模块实现/plan|教师模块 plan]]
