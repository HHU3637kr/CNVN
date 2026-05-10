---
id: EXP-003
title: Alembic 迁移版本号长度与空库验证
type: 经验记忆
keywords: [CNVN, Alembic, migration, revision, 空库验证, PostgreSQL]
scenario: 新增或修改 Alembic migration，尤其是长英文 revision id 或 CI 迁移验证
created: 2026-05-10
related:
  - "[[../../05-验证工程/20260501-1126-场景级回归验证体系/debugger/debug-001|debug-001]]"
  - "[[../../05-验证工程/20260501-1126-场景级回归验证体系/writer/plan|场景级回归验证体系]]"
---

# Alembic 迁移版本号长度与空库验证

## 困境

CNVN 的 API pytest 主要通过 `Base.metadata.create_all()` 初始化测试表，无法发现 Alembic 迁移链自身的问题。场景级回归验证中新增空库 `alembic upgrade head` 后，发现 revision id `005_availability_final_state_checks` 超过 Alembic 默认 `alembic_version.version_num VARCHAR(32)` 长度，导致迁移中途失败。

## 策略

1. Alembic `revision` 和后续迁移的 `down_revision` 必须保持在 32 字符以内。
2. 新增迁移后必须用独立临时空库执行 `alembic upgrade head`，不能只依赖 ORM metadata create_all。
3. 空库验证至少断言 head revision、核心业务表、必要 seed 数据和 extension/function。
4. 若迁移测试要与 API pytest 同跑，必须使用独立临时数据库，避免破坏 `cnvn_test` 夹具。

## 理由

- Alembic 默认版本表字段长度是硬约束，长 revision id 会在真实升级时失败。
- `create_all()` 绕过 migration，不覆盖 revision 链、DDL 顺序、seed、trigger、extension 等问题。
- 独立临时库让 migration test 可被纳入 full pytest，不污染业务测试库。

## 相关文件

- `backend/tests/integration/test_alembic_migrations.py`
- `backend/alembic/versions/005_availability_final_state_checks.py`
- `backend/alembic/versions/006_add_dispute_cases.py`
- `scripts/verify.py`

## 参考

- `spec/05-验证工程/20260501-1126-场景级回归验证体系/debugger/debug-001.md`
