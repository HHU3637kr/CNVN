---
title: 前端对接真实 API
type: plan
category: 03-功能实现
status: 未确认
priority: 高
created: 2026-04-04
execution_mode: single-agent
tags:
  - spec
  - plan
  - frontend
  - api
related:
  - "[[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]"
  - "[[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|PRD]]"
---

# 前端对接真实 API

## 1. 概述

### 1.1 背景

后端已实现认证、教师、预约、钱包、评价、课堂消息等模块（参见 [[../../02-架构设计/20260402-1616-后端全局架构设计/summary|架构设计总结]]）。前端 **`Classroom.tsx` 已对接** `GET /auth/me`、`GET /lessons/{id}/messages` 与 WebSocket；**首页、教师列表/详情、学生/教师仪表盘**仍以 **Mock 或静态 JSX** 为主，与 [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|全局架构]] 中「后续工作：前端对接」一致。

### 1.2 目标

1. 用 **`VITE_API_URL` / `API_BASE_URL`** 统一调用后端 `GET/POST/PATCH` 等 REST 接口，替换页面内 Mock 数据。
2. **鉴权**：登录/注册成功后写入 `localStorage`（与 `getAccessToken()` 约定键名一致），受保护页面在无 token 时引导登录或展示占位。
3. **数据模型**：以后端 Pydantic 响应为准，前端做轻量映射（含 UUID 字符串、时间 ISO、金额整数 VND）。

### 1.3 范围

**包含**：

| 页面/模块 | 对接内容（优先顺序） |
|-----------|----------------------|
| 教师列表 `Teachers` | `GET /api/v1/teachers`（查询参数与后端一致） |
| 教师详情 `TeacherProfile` | `GET /api/v1/teachers/{id}`、`GET .../reviews`、`GET .../availability`（按需并行或分步） |
| 首页推荐区 `Home` | 复用列表接口：`sort_by=recommended` 或 `rating`，`page_size=4` |
| 学生仪表盘 `StudentDashboard` | `GET /api/v1/lessons?role=student`（`upcoming`、状态筛选按产品定） |
| 教师仪表盘 `TeacherDashboard` | `GET /api/v1/lessons?role=teacher`；钱包摘要可选 `GET /api/v1/wallet` |
| 认证入口（若路由尚无） | `POST /auth/register`、`POST /auth/login`；可选 `GET /auth/me` 展示昵称 |

**不包含**（后续单独 Spec）：

- 完整「预约下单」表单页（若当前无独立路由，仅在 plan 中预留接口 `POST /lessons` 的对接点）。
- 支付网关真实对接（后端仍为模拟充值）。
- 国际化、PWA、骨架屏设计系统级改造。

> [!note] **已交付不重复实现**  
> `Classroom.tsx` 的消息历史与 WS 已通，本 Spec **不要求重写**，仅可抽公共 `fetch` 封装时顺带整理 import。

---

## 2. 需求分析

### 2.1 与 PRD / 架构对齐

| 能力 | 后端端点（基路径 `/api/v1`） | 前端现状 |
|------|------------------------------|----------|
| 教师搜索/列表 | `GET /teachers` | `mockTeachers` |
| 教师详情 | `GET /teachers/{id}` | 单条 Mock |
| 我的课程（学生） | `GET /lessons?role=student` | 静态数组 |
| 我的课程（教师） | `GET /lessons?role=teacher` | 静态数组 |
| 钱包余额（展示） | `GET /wallet` | Mock 文案/数字 |
| 登录注册 | `POST /auth/login` 等 | 可能缺失或仅占位 |

### 2.2 非功能需求

- **CORS**：开发环境后端已允许 `http://localhost:5173`；生产部署时 `VITE_API_URL` 指向实际域名。
- **错误处理**：HTTP 4xx/5xx 展示可读 `detail`（字符串或数组时做简单拼接）。
- **加载与空态**：列表/详情请求中显示 loading；无数据时展示空状态文案。

---

## 3. 设计方案

### 3.1 目录与模块

```
frontend/src/app/
├── lib/
│   ├── api.ts              # 已有：BASE_URL、getAccessToken、wsUrl；扩展 apiGet/apiPost 或 fetch 封装
│   └── authStorage.ts      # 可选：统一 set/clear token、键名
├── types/                  # 可选：与后端字段对齐的 TypeScript 类型（或内联在 hooks）
└── pages/                  # 各页改为 useEffect + 状态 或 小型数据 hooks
```

### 3.2 请求封装

- 统一 `headers`：`Authorization: Bearer ${token}`（除公开接口外）。
- **公开接口**：`GET /teachers`、`GET /teachers/{id}`、评价列表、可用时间等按后端定义可无 Bearer。
- **分页响应**：后端 `PaginatedResponse` → 前端使用 `items`、`total`、`page`、`page_size`。

### 3.3 路由与 ID

- 后端教师主键为 **UUID**；链接与 `useParams().id` 使用 **字符串 UUID**，移除现有数字 `1/2/3/4` 写死链接（首页卡片 `Link to` 改为接口返回的 `id`）。

### 3.4 UI 兼容

- 字段缺失时（如头像 URL 为空）使用占位图或首字母，避免白屏。
- 价格展示：后端为整数 VND，前端格式化为 `₫` + 千分位或简化 `k`（与现有风格一致即可）。

---

## 4. 执行模式

### 执行模式选择

**推荐模式**：`single-agent`

**选择理由**：

- 变更集中在 `frontend/src`，以页面为粒度串联接口，依赖关系线性。
- 与后端契约已在 OpenAPI/实现中存在，无需多角色并行分工。

---

## 5. 实现步骤

1. **封装**：扩展 `lib/api.ts`（或新增 `lib/http.ts`）：带 token 的 `apiFetch`、JSON 解析、错误抛出。
2. **教师**：实现 `Teachers` 列表请求与查询参数绑定（搜索框、筛选若 MVP 仅关键字可先接 `q`）。
3. **详情**：`TeacherProfile` 根据 `id` 拉取详情；评价与可用时间按需在首屏或 tab 请求。
4. **首页**：`Home` 推荐区改为接口拉取 4 条，替换静态四卡。
5. **仪表盘**：`StudentDashboard` / `TeacherDashboard` 对接 `GET /lessons`；可选展示 `GET /wallet` 余额。
6. **登录态**：若尚无登录页，增加最小 **`/login`**（或 Modal）调用 `POST /auth/login`，成功写入 token 并跳转；注册同理可选。
7. **回归**：手动验证 `Classroom` 仍可用；Docker 下 `VITE_API_URL` 指向宿主机 API。

---

## 6. 风险和依赖

| 风险 | 缓解 |
|------|------|
| 前后端字段命名不一致 | 以浏览器 Network / OpenAPI 为准，必要时在前端做一层 map |
| 未登录访问仪表盘 | 重定向登录或只读提示 |
| 开发环境混用 Mock | 本 Spec 完成后删除教师相关 Mock 常量，避免双源 |

**依赖**：本地或 Docker 启动后端（`cnvn-api`）与数据库；`VITE_API_URL` 配置正确。

---

## 7. 文档关联

- 架构设计: [[../../02-架构设计/20260402-1616-后端全局架构设计/plan|后端全局架构设计]]
- PRD: [[../../01-项目规划/20260330-1650-CNVN中越通项目PRD/plan|产品需求文档]]
- 实现总结: [[summary|实现总结]]（待创建）
- 测试计划: [[test-plan|测试计划]]（待创建，由 spec-tester 创建）
