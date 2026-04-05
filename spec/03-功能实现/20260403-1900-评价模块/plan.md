---
title: 评价模块实现
type: plan
category: 03-功能实现
status: 已完成
priority: 高
created: 2026-04-03
execution_mode: single-agent
tags:
  - spec
  - plan
  - review
  - rating
related:
  - "[[exploration-report|探索报告]]"
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
---

# 评价模块实现

## 1. 概述

### 1.1 背景

`reviews` 路由仍为 501；教师档案上 `avg_rating`、`total_reviews` 为冗余统计字段，需在评价写入后更新。全局架构课程状态机包含 `reviewed`。

### 1.2 目标

1. 实现 `POST /reviews`（学生提交评价）、`GET /reviews/{review_id}`（评价详情）。
2. 提交成功后：更新 `teacher_profiles` 聚合指标；将对应 `lessons.status` 置为 `reviewed`。
3. **评分聚合算法**（排名数据基础）：对每位教师，以该教师下全部评价的 `rating_overall` **算术平均**为 `avg_rating`（`Numeric(2,1)` 四舍五入保留一位小数），`total_reviews` 为评价条数。

### 1.3 范围

**包含**：
- `services/review_service.py`
- 路由层接入 `User` 依赖（与项目其余模块一致）
- 评价创建与教师统计、课程状态在同一数据库事务内提交

**不包含**：
- 删除/修改评价（后续迭代）
- 独立「排行榜」HTTP 端点（MVP；排序复用已有 `GET /teachers` 的 `sort_by`）
- 教师子维度（教学/准时/沟通）在 `teacher_profiles` 上拆列存储（表结构无字段；子评分仅存在 `reviews` 行内）

---

## 2. 需求分析

### 2.1 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/reviews` | 提交评价 | Bearer，学生活跃角色 |
| GET | `/reviews/{review_id}` | 评价详情 | 无（公开） |

### 2.2 业务规则

1. **谁可评**：当前用户为课程 `student_id`，且课程 `status == completed`。
2. **一课一条**：数据库 `lesson_id` UNIQUE；若已存在评价则 400。
3. **写入内容**：持久化 `ReviewCreate` 全部字段；`teacher_id` 从课程行读取（与 `lesson.teacher_id` 一致）。
4. **聚合重算**：插入后对该 `teacher_id` 执行：
   - `total_reviews = COUNT(*)`
   - `avg_rating = ROUND(AVG(rating_overall)::numeric, 1)`，无评价时保持 0。
5. **课程状态**：同一事务内 `lesson.status = 'reviewed'`。

### 2.3 异常

| 场景 | HTTP | 说明 |
|------|------|------|
| 课程不存在 | 404 | — |
| 非该课学生 | 403 | — |
| 课程非 completed | 400 | 例如仍为 in_progress |
| 重复评价 | 400 | UNIQUE 冲突或预查 |

---

## 3. 设计方案

### 3.1 分层

```
api/v1/reviews.py → review_service.py → Review / Lesson / TeacherProfile
```

### 3.2 `review_service.py`

| 函数 | 说明 |
|------|------|
| `create_review(db, user_id, data: ReviewCreate) -> ReviewOut` | 校验 + 插入 Review + 更新 Teacher + Lesson |
| `get_review(db, review_id) -> ReviewOut` | 按 ID 查询；可联表 `User.full_name` 填 `reviewer_name` |

### 3.3 聚合算法说明（排名数据源）

- **教师维度排序**（与教师模块搜索一致）：列表侧已使用 `avg_rating`、`total_lessons`、`response_rate` 等；本模块通过 **重算 avg_rating 与 total_reviews** 保证与评价表一致，从而使 `sort_by=rating` / `recommended` 反映真实评价。
- **不做**：单独维护「排名分」列或新表；若未来需要首页 Top N，可仅增加只读查询或物化视图。

---

## 4. 执行模式

`execution_mode: single-agent`

---

## 5. 实现步骤

1. 新增 `app/services/review_service.py`（创建、详情、`_sync_teacher_review_stats`）。
2. 更新 `app/api/v1/reviews.py`（`Depends(get_current_student)` 返回 `User`，注入 `get_db`）。
3. （可选）在 `lesson_service` 或文档中注明 `reviewed` 由评价模块写入，避免歧义。
4. 新增 `tests/api/v1/test_reviews.py`（由测试阶段执行；本 plan 不写用例细节）。

---

## 6. 风险与依赖

| 风险 | 缓解 |
|------|------|
| 并发双评同一课 | UNIQUE + 事务 |
| avg_rating 精度 | 使用 SQL `AVG` + `ROUND` 与 ORM `Numeric(2,1)` 对齐 |

**依赖**：预约/课程模块已能将课程置为 `completed`。

---

## 7. 文档关联

- [[exploration-report|探索报告]]
- [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
