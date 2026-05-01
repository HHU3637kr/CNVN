---
title: 教师中心访问控制
status: pending
created: 2026-04-06
assignee: single-agent
execution_mode: single-agent
---

# 教师中心访问控制

## 概述

**背景**：当前 Layout 导航栏中「教师中心」链接对所有用户可见，TeacherDashboard 页面仅检查登录状态（token），未校验用户是否已开通教师身份。未开通教师身份的用户可以访问教师中心页面，导致体验混乱。

**目标**：未开通教师身份的用户不能看到教师中心导航入口和页面，引导其申请成为教师。

**范围**：仅前端修改，不涉及后端变更。

## 需求分析

### 现状问题

| 位置 | 问题 |
|------|------|
| `Layout.tsx` 桌面导航（L68-73） | 「教师中心」链接对所有用户可见 |
| `Layout.tsx` 移动端导航（L147-151） | 同上 |
| `Layout.tsx` 页脚（L233-235） | 「注册教师」链接指向 `/dashboard/teacher` |
| `TeacherDashboard.tsx`（L59-61） | 仅检查 token，未检查 roles |

### 期望行为

1. **主导航栏**：
   - 未登录 → 不显示「教师中心」
   - 已登录但无教师角色 → 不显示「教师中心」
   - 已登录且有教师角色 → 显示「教师中心」→ `/dashboard/teacher`

2. **用户头像下拉菜单**（个人区域）：
   - 点击头像/用户名弹出下拉菜单
   - 菜单项：「我的学习」「教师中心」（仅教师）、「成为教师」（仅非教师）、「退出登录」
   - 「成为教师」点击后打开开通教师身份的表单弹窗

3. **TeacherDashboard 页面**：
   - 非教师访问 → 重定向到 `/dashboard/student`

4. **页脚**：
   - 「成为老师」区域保留，链接指向 `/dashboard/student`（学生在学生中心可看到开通入口）

## 设计方案

### 判断依据

Layout 已通过 `apiFetchJson<UserOut>("/auth/me")` 获取当前用户信息存储在 `me` 状态中，`UserOut.roles` 是 `string[]`。通过 `me?.roles?.includes("teacher")` 即可判断。

### 修改清单

#### 1. `Layout.tsx` — 导航栏 + 用户下拉菜单

**桌面端主导航**（仅保留 2 个通用项）：
- 「找老师」始终显示
- 「我的学习」已登录时显示
- 「教师中心」仅教师可见

**用户头像区域**改造为下拉菜单：
- 点击头像展开下拉
- 菜单项：
  - 「我的学习」→ `/dashboard/student`
  - 「教师中心」→ `/dashboard/teacher`（仅 `roles.includes("teacher")` 时显示）
  - 分隔线
  - 「成为教师」→ 打开开通教师弹窗（仅非教师时显示）
  - 分隔线
  - 「退出登录」

**移动端导航**：同样逻辑——主导航仅教师显示「教师中心」，底部增加「成为教师」入口。

**开通教师弹窗**：
- 表单字段：title、about、hourly_rate、teacher_type、specialties（复用 `TeacherProfileCreate` schema）
- 提交调用 `POST /auth/become-teacher`
- 成功后刷新 `me` 状态，弹窗关闭

#### 2. `TeacherDashboard.tsx` — 角色校验

在现有 token 检查之后，增加角色检查：

```
if (!token) → 重定向到 /login
if (me && !me.roles.includes("teacher")) → 重定向到 /dashboard/student
正常展示教师控制台
```

#### 3. `routes.tsx` — 无需修改

路由守卫在 TeacherDashboard 组件内部处理即可，无需新增路由守卫组件。

#### 3. `Register.tsx` — 注册页面教师通道

在注册表单中增加角色选择：
- 表单顶部增加身份切换：「我是学生」/「我是教师」
- 选择「我是教师」后，展开教师档案字段：title、about、hourly_rate、teacher_type、specialties
- 提交流程：先调用 `/auth/register` 注册，成功后若选择了教师身份则自动调用 `/auth/become-teacher`
- 注册成功后直接跳转登录页（或自动登录进入对应 Dashboard）

## 实现步骤

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `Layout.tsx` | 修改 | 导航栏条件渲染 + 用户下拉菜单（含开通教师弹窗） |
| 2 | `TeacherDashboard.tsx` | 修改 | 增加角色检查，非教师重定向到学生中心 |
| 3 | `Register.tsx` | 修改 | 增加「我是教师」身份选择及教师档案字段，注册后自动开通 |

## 风险和依赖

| 风险 | 应对 |
|------|------|
| `me` 加载完成前导航闪烁 | 已登录用户先隐藏教师相关项，加载完再显示 |
| 下拉菜单点击外部关闭 | 使用 `useRef` + `mousedown` 事件监听 |
| 开通教师表单提交后需刷新 `me` | 成功后重新调用 `/auth/me` 更新 Layout 的 `me` 状态 |
| 注册+开通两步操作可能部分失败 | 先注册，再开通；开通失败提示用户登录后再申请 |

## 文档关联

- [[20260403-1430-用户认证模块/plan]] — 注册与角色系统
- [[20260403-教师模块实现/plan]] — 教师档案创建
- [[20260404-1400-前端对接真实API/plan]] — 前端 API 对接
