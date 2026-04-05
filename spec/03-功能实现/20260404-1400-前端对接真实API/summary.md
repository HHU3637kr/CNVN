---
title: 前端对接真实 API — 实现总结
type: summary
category: 03-功能实现
status: 待确认
created: 2026-04-04
tags:
  - spec/已完成
  - summary
---

# 前端对接真实 API — 实现总结

> [!success] 完成情况
> 已按 [[plan|设计方案]] 完成：`lib/http` 封装、`Teachers` / `TeacherProfile` / `Home` 推荐区、`StudentDashboard` / `TeacherDashboard`、`/login` / `/register`、Layout 登录态与退出；`Classroom.tsx` 未改动。

## 实现范围

| 项 | 说明 |
|----|------|
| 请求封装 | 沿用 `apiFetchJson` + `ApiError`；公开教师接口 `auth: false` |
| 教师列表 | `GET /teachers`，`q`、`sort_by`、分页 |
| 教师详情 | 并行 `GET /teachers/{id}`、`.../reviews`、`.../availability`；详情无 `name`/`avatar` 时用标题片段 + 首字母占位 |
| 首页推荐 | `sort_by=recommended&page_size=4` |
| 仪表盘 | 未登录跳转 `/login`；`GET /lessons`（student/teacher + `upcoming` / `status=completed`）、`GET /wallet`、`GET /auth/me` |
| 认证 | `POST /auth/register`（返回 `UserOut`，注册后跳转登录）、`POST /auth/login` + `setAuthTokens` |

## 遇到的问题

- 后端 `GET /teachers/{id}` 为 `TeacherProfileOut`，与列表项字段不完全一致，详情页展示与列表区分处理。
- `register` 返回 201 + `UserOut`，无 token，需单独登录。

## 文档关联

- 设计文档: [[plan|设计方案]]

## 后续（非本 Spec）

- 预约下单页、`POST /lessons` 完整表单。
- spec-tester 自动化测试；spec-debugger 修缺陷。

---

#spec/已完成 #summary
