---
title: 预约模块 - 测试计划
type: test-plan
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - test
  - lessons
related:
  - "[[plan|实现计划]]"
---

# 测试计划：预约模块

## 1. 范围

`backend/tests/api/v1/test_lessons.py`：HTTP 级集成测试（依赖 `conftest` 中测试库与 `httpx`）。

## 2. 前置数据构造

- 注册学生 A、教师 B（`become-teacher`）。
- 教师切换为学生不可预约（用学生 A 约教师 B）。
- `POST /wallet/topup` 给学生 A 足够余额（需先实现钱包）。

## 3. 用例矩阵

| ID | 场景 | 预期 |
|----|------|------|
| L1 | 无可用时段时创建预约 | 400 |
| L2 | 有匹配时段、余额充足时创建 | 201，`pending_confirmation`，余额减少 |
| L3 | 余额不足 | 400 |
| L4 | 教师确认 | `confirmed` |
| L5 | 学生/教师取消（距开课 ≥24h） | `cancelled`，余额恢复 |
| L6 | 距开课 <24h 取消 | 400 |
| L7 | 确认后开始、结束 | `in_progress` → `completed` |
| L8 | 列表 `role=student` 仅见本人作为学生的课 | 200 |

## 4. 完成标准

- `pytest backend/tests/api/v1/test_lessons.py` 全部通过。
