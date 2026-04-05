---
title: 预约模块 - 测试报告
type: test-report
category: 03-功能实现
status: 已完成
created: 2026-04-03
tags:
  - test
  - lessons
related:
  - "[[test-plan|测试计划]]"
  - "[[summary|实现总结]]"
---

# 测试报告：预约模块

## 执行环境

- 命令：`python -m pytest tests/ -q`
- 工作目录：`backend/`
- 数据库：测试库 `cnvn_test`（见 `tests/conftest.py`）

## 结果摘要

| 指标 | 值 |
|------|-----|
| 通过 | 17 |
| 失败 | 0 |
| 跳过 | 0 |

## 覆盖范围

| 文件 | 用例数 | 说明 |
|------|--------|------|
| `tests/api/v1/test_auth.py` | 12 | 注册/登录/刷新/角色/开通教师（回归） |
| `tests/api/v1/test_lessons.py` | 5 | 无时段拒绝、成功流+取消退款、余额不足、24h 内取消拒绝、开始/结束 |

## 与 test-plan 对照

| test-plan ID | 结果 |
|--------------|------|
| L1 无时段预约 | 通过（`test_lesson_rejects_without_availability`） |
| L2 有时段+余额 | 通过（`test_lesson_happy_path_and_cancel`） |
| L3 余额不足 | 通过（`test_lesson_insufficient_balance`） |
| L4 教师确认 | 通过（同上 happy path） |
| L5 取消+退款 | 通过（happy path 中 cancel） |
| L6 24h 内取消 | 通过（`test_cancel_within_24h_rejected`） |
| L7 开始/结束 | 通过（`test_start_end_lesson`） |
| L8 列表 student | 未单独断言（可在后续迭代补 `GET /lessons` 断言） |

## 结论

当前后端测试套件全部通过，预约模块与钱包/时段依赖行为与 `plan.md` 一致，**建议**进入 Spec 收尾（归档与 git 由用户确认后执行）。
