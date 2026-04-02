---
title: 后端全局架构设计 - 探索报告
type: exploration-report
category: 02-架构设计
created: 2026-04-02
tags:
  - backend
  - architecture
  - FastAPI
  - PostgreSQL
---

# 探索报告：后端全局架构设计

## 1. 前端 Mock 数据分析

### 1.1 已识别的数据实体

从前端 6 个页面的 Mock 数据中，反向推导出以下核心实体：

#### User（用户）
前端 Layout 中硬编码了当前用户 `An Nguyen`，未区分注册/登录流程。
- 学生面板和教师面板是独立页面，暗示**同一用户可同时是学生和老师**（或严格区分角色）。


>user严格区分角色,学生和老师应该分成独立的界面,登录是不同的界面


#### Teacher（老师档案）
来源：`Teachers.tsx` + `TeacherProfile.tsx`

| 字段 | 类型 | 来源页面 | 说明 |
|------|------|---------|------|
| id | number | Teachers | 唯一标识 |
| name | string | Teachers | 显示名 |
| avatar | string(URL) | Teachers | 头像 |
| rating | number | Teachers | 综合评分 (1-5) |
| reviews | number | Teachers | 评价数量 |
| lessons | number | Teachers | 完课数 |
| price | number | Teachers | 小时单价 (VND) |
| title | string | Teachers | 一句话标题 |
| tags | string[] | Teachers | 擅长方向标签 |
| description | string | Teachers | 简短介绍（列表页） |
| available | string | Teachers | 可用时间描述 |
| about | string | TeacherProfile | 详细自我介绍 |
| videoUrl | string | TeacherProfile | 自我介绍视频 |

#### Lesson/Booking（课程/预约）
来源：`StudentDashboard.tsx` + `TeacherDashboard.tsx`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 课程 ID |
| teacherId / studentName | - | 关联的老师/学生 |
| date | string | 日期 |
| time | string | 时间段 (如 "20:00 - 21:00") |
| status | string | upcoming / completed |
| topic | string | 课程主题 |
| teacherAvatar | string | 老师头像（学生侧） |

#### Review（评价）
来源：`TeacherProfile.tsx`

| 字段 | 类型 | 说明 |
|------|------|------|
| reviewerName | string | 评价者名 |
| reviewerInitial | string | 头像首字母 |
| date | string | 评价日期 |
| lessonsCount | number | 已上课节数 |
| rating | number | 星级 (1-5) |
| content | string | 评价内容 |

#### TeacherStats（老师统计）
来源：`TeacherDashboard.tsx`

- 本月收入 (VND)
- 本月完课数
- 学生人数
- 综合评分
- 当前月完课时长（用于计算抽成比例）

#### Wallet/Balance（钱包）
来源：`StudentDashboard.tsx`

- 账户余额：₫500,000
- 操作：充值、查看明细

#### Availability（可用时间）
来源：`TeacherProfile.tsx`

- 日期选择器（今天、明天、周三、周四、周五）
- 时间段选项（19:00, 20:00, 21:00, 22:00）

#### ChatMessage（聊天消息）
来源：`Classroom.tsx`

- 系统消息 + 师生聊天
- 发送者、时间、内容

#### CourseMaterial（课件）
来源：`Classroom.tsx`

- 文件名、类型 (PDF)、大小、分享者

### 1.2 前端路由结构

| 路由 | 页面 | 需要的后端 API |
|------|------|--------------|
| `/` | Home | 推荐老师列表 |
| `/teachers` | Teachers | 老师搜索/筛选/分页 |
| `/teachers/:id` | TeacherProfile | 老师详情 + 评价列表 + 可用时间 |
| `/dashboard/student` | StudentDashboard | 我的课程 + 余额 |
| `/dashboard/teacher` | TeacherDashboard | 教师统计 + 排课 + 待办 |
| `/classroom/:id` | Classroom | 实时通话 + 聊天 + 课件 |

### 1.3 筛选与排序需求

来源：`Teachers.tsx` 侧边栏

- **老师类型**：在华越南留学生、越南本地中文导游、中文母语者、专业中文老师
- **价格区间**：最低 - 最高 (VND/时)
- **擅长方向**：HSK备考、零基础、实用口语、商务沟通、少儿中文
- **排序**：综合推荐、评分最高、价格最低

## 2. PRD 业务规则摘要

### 2.1 抽成规则
- 月完课 ≤ 20h：抽成 20%
- 月完课 21-50h：抽成 15%
- 月完课 > 50h：抽成 10%

### 2.2 取消规则
- 课前 24 小时可免费取消
- 否则不退款

### 2.3 老师排名
- 综合排名 = 评分 × 权重 + 完课数 × 权重 + 响应率 × 权重
- 评分 < 3.0 → 降低曝光
- 评分 < 2.5 → 暂停接单

### 2.4 课程类型
- 单次课
- 课时包（买 N 节享折扣）

## 3. 技术决策

- **后端框架**：FastAPI (Python)
- **数据库**：PostgreSQL
- **前后端分离**：前端保持 Vite + React，后端独立服务
- **API 风格**：RESTful

## 4. 待后续 Spec 解决的问题

- 视频通话集成（Agora SDK）的后端支持
- 支付网关集成细节
- 国际化方案（越南语/中文）
- 文件上传存储方案
- 部署方案（越南区域）
