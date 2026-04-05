---
title: 评价模块 - 实现总结
type: summary
category: 03-功能实现
status: 已完成
tags:
  - backend
  - review
  - spec/已完成
  - summary
related:
  - "[[plan|设计方案]]"
  - "[[test-plan|测试计划]]"
  - "[[test-report|测试报告]]"
  - "[[exploration-report|探索报告]]"
---

# 实现总结：评价模块

> [!success] 验收
> `pytest tests/` **26** 条通过（含 `test_reviews.py` 4 条）。**未归档**（按 spec-execute 需用户确认后再移 `06-已归档`）。

## 产出

| 路径 | 说明 |
|------|------|
| `app/services/review_service.py` | `create_review`、`get_review`、`_sync_teacher_review_stats`（`COUNT` + `AVG` 重算 `avg_rating`/`total_reviews`） |
| `app/api/v1/reviews.py` | `User` + `AsyncSession`；HTTP 映射 404/403/400 |
| `tests/api/v1/test_reviews.py` | 成功流、重复评价、非学生、非完成课 |

## 与 plan 对齐

- 一课一条；`teacher_id` 来自 `Lesson`；事务内写 `Review`、将 `lesson.status` 置为 `reviewed`、同步教师聚合字段。
- **校验顺序**：先查是否已有评价，再校验 `completed`，避免首评后状态变为 `reviewed` 导致重复提交误判为「仅已完成课程可评价」。

## 遇到的问题

| 问题 | 处理 |
|------|------|
| 重复评价用例失败 | 调整为先检测 `Review` 存在性，再校验 `lesson.status == completed` |

## 文档关联

- 设计：[[plan|设计方案]]
- 探索：[[exploration-report|探索报告]]
