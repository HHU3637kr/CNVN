---
title: 经验记忆索引
type: index
updated: 2026-04-03
---

# 经验记忆索引

> 使用 `/exp-search <关键词>` 检索相关经验。

## 索引表

| ID | 标题 | 关键词 | 适用场景 | 一句话策略 |
|----|------|--------|----------|-----------|
| EXP-001 | FastAPI 教师路由与 PG 数组搜索 | FastAPI, 路由, PostgreSQL, ARRAY, 推荐排序 | 实现教师公开 API 与多条件搜索 | 先注册子路径与 profile；`specialties` 用 `contains`；推荐排序用 max 子查询归一化 |
| EXP-002 | 支付模块结算防重与数据模型关联 | CNVN, 支付, 结算, 防重, 数据模型, 关联查询 | 涉及资金操作的防重机制；通过 TeacherProfile 获取 User | 数据库状态检查（settled_at）+ 事务保证幂等；Lesson.teacher_id 引用 Profile.id 需中转 |

## 分类索引

### 后端相关

- [EXP-001] FastAPI 教师路由与 PG 数组搜索
- [EXP-002] 支付模块结算防重与数据模型关联
