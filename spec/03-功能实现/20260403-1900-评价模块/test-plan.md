---
title: 评价模块 - 测试计划
type: test-plan
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - test
  - review
related:
  - "[[plan|实现计划]]"
---

# 测试计划：评价模块

## 验收标准

| 项 | 通过条件 |
|----|----------|
| 功能 | `pytest tests/api/v1/test_reviews.py` 全部通过 |
| 回归 | `pytest tests/` 全量通过，无新增失败 |
| 数据 | 首评后 `teacher_profiles.avg_rating` / `total_reviews` 与 `reviews` 表一致；`lessons.status` 可为 `reviewed` |

## 1. 范围

`backend/tests/api/v1/test_reviews.py`：HTTP 集成测试。

## 2. 前置数据

- 注册学生 A、教师 B，`become-teacher`，学生充值，配置 `availability`，创建课程并完成至 `completed`（调用现有 `PATCH .../end` 或等价路径）。

## 3. 用例矩阵

| ID | 场景 | 预期 |
|----|------|------|
| R1 | 学生对已完成课程提交首条评价 | 201，`teacher_profiles.avg_rating`/`total_reviews` 更新，`lesson.status=reviewed` |
| R2 | 同一课再次评价 | 400 |
| R3 | 非该课学生提交 | 403 |
| R4 | 未完成课提交 | 400 |
| R5 | `GET /reviews/{id}` | 200，含字段 |

## 4. 完成标准

`pytest tests/api/v1/test_reviews.py` 全部通过，且全量 `pytest tests/` 回归通过。
