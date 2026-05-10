---
title: 问题诊断-Alembic revision 超过 version_num 长度
type: debug
category: 05-验证工程
status: confirmed
severity: 高
created: 2026-05-10
updated: 2026-05-10
plan: "[[../writer/plan|plan]]"
tags:
  - spec
  - debug
  - migration
---

# 问题诊断：Alembic revision 超过 version_num 长度

## 问题现象

执行 `python -m pytest tests/integration/test_alembic_migrations.py -q` 时，临时空库执行 `alembic upgrade head` 失败：

```text
StringDataRightTruncationError: value too long for type character varying(32)
UPDATE alembic_version SET version_num='005_availability_final_state_checks'
```

## 复现步骤

1. 创建临时 PostgreSQL 数据库。
2. 设置 `DATABASE_URL` 指向临时库。
3. 在 `backend/` 执行 `python -m alembic upgrade head`。

## 根因分析

Alembic 默认表 `alembic_version.version_num` 长度为 32。迁移 `005_availability_final_state_checks.py` 中的 revision id：

```python
revision = "005_availability_final_state_checks"
```

长度超过 32，导致 Alembic 在升级到 005 时更新版本号失败。该问题不会被 `Base.metadata.create_all()` 型 API pytest 发现，只有空库迁移测试能覆盖。

## 修复方案

- 将 005 的 revision id 缩短为 `005_availability_checks`。
- 将 006 的 `down_revision` 同步更新为 `005_availability_checks`。
- 不修改 migration 文件名，减少文件移动噪声；Alembic 以 `revision` 字段为准。

## 与 plan 的关系

本问题由 `FR-003 Alembic 空库升级自动验证` 暴露，属于本 Spec 的目标范围内缺陷修复。
