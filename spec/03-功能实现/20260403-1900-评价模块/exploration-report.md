---
title: 评价模块 - 探索报告
type: exploration-report
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - backend
  - review
related:
  - "[[plan|实现计划]]"
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 探索报告：评价模块

## 1. 现状

| 组件 | 状态 |
|------|------|
| `models/review.py` | 已存在，`lesson_id` UNIQUE |
| `schemas/review.py` | `ReviewCreate` / `ReviewOut` 已定义 |
| `api/v1/reviews.py` | `POST /reviews`、`GET /reviews/{id}` 均为 501 |
| `GET /teachers/{id}/reviews` | 已实现列表（教师模块），依赖评价数据 |
| `teacher_profiles.avg_rating` / `total_reviews` | 冗余字段，需随评价写入同步 |
| `lessons.status` | 课程结束为 `completed`；架构状态机含 `reviewed`，当前 `lesson_service` 未写入 |

## 2. 需求对齐（阶段一）

**目标**：实现学生提交评价、查询评价详情；提交成功后 **同步教师聚合评分**（算术平均 + 条数），并将课程标为 **`reviewed`**（与全局架构一致）。

**排名/算法**：不新增独立「排行榜」端点（MVP）；**教师列表的排序与筛选**已依赖 `avg_rating`、`total_reviews`（见教师模块 `recommended`），本模块保证冗余字段与真实评价一致即构成可排序的「排名」数据源。

## 3. 结论

实现 `review_service.py`，替换 `reviews` 路由；与 `lesson`、`teacher_profile` 同事务更新；测试覆盖重复评价、非完成课、权限。
