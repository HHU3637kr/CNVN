# CNVN（中越通）

面向越南市场的中文学习双边撮合平台——连接想学中文的越南人与兼职中文老师。

## 技术栈

- **前端**: TypeScript + React + Vite + TailwindCSS
- **后端**: Python + FastAPI + SQLAlchemy 2.0 (async)
- **数据库**: PostgreSQL 16
- **认证**: JWT (python-jose)
- **部署**: Docker + Docker Compose
- **类型**: Web 应用（MVP 阶段）

## 项目规范

### 开发方法论

本项目采用 **Spec 驱动式开发**，所有功能开发遵循以下流程：
1. 先设计（plan.md），后实现
2. 严格遵循 Spec，不添加额外功能
3. 每个实现都可追溯到 Spec 文档
4. 完整的开发过程记录在 Obsidian 中

### Mock 优先开发原则（重要）

> **前端原型优先，后端设计在后。**

1. 当前阶段全部使用 Mock 数据，不接真实后端
2. 前端原型验证通过（用户流程跑通、UI 交互确认）后，再设计数据库 Schema
3. 后端 API 设计以前端 Mock 数据结构为依据，反向推导
4. **禁止在前端原型未验证前提前设计后端**

### 编码规范

@import .claude/rules/

### 文档规范

- 所有 Spec 文档使用 Obsidian Flavored Markdown
- 命名规范：`YYYYMMDD-HHMM-任务描述`（任务描述必须中文）
- 使用 `[[wikilink]]` 建立文档关联
- 每个文档包含完整的 YAML frontmatter

### 开发流程

- 新功能开发：`/spec-start` → 5 阶段流程
- 功能更新：`/spec-update`
- 问题修复：`/spec-debug`
- 经验检索：`/exp-search`
- 经验沉淀：`/exp-reflect`

### 记忆系统

- 自动层：Auto Memory（Claude 自主管理）
- 显式层：`spec/context/experience/` + `spec/context/knowledge/`
- 索引文件始终加载，详情按需检索

---

## 项目目录结构

```
CNVN/
├── CLAUDE.md                          # 本项目指令文件（你正在读的）
├── docker-compose.yml                 # Docker 编排：api + web + db（镜像 cnvn-api / cnvn-web）
├── spec/                              # Spec 驱动开发文档
│   ├── 01-项目规划/                    # PRD、流程设计
│   ├── 02-架构设计/                    # 架构、数据模型设计
│   ├── 03-功能实现/                    # 功能实现 Spec
│   ├── 04-问题修复/                    # Bug 修复方案
│   ├── 05-测试文档/                    # 测试计划/报告
│   ├── 06-已归档/                      # 已完成的 Spec
│   └── context/                       # 经验/知识记忆索引
│       ├── experience/index.md
│       └── knowledge/index.md
├── backend/                           # Python 后端（FastAPI）
│   ├── app/
│   │   ├── main.py                    # FastAPI 入口 + CORS 配置
│   │   ├── config.py                  # Pydantic Settings 环境变量
│   │   ├── database.py                # SQLAlchemy async engine + session
│   │   ├── dependencies.py            # 通用依赖（get_db, get_current_user, 角色校验）
│   │   ├── core/                      # 核心工具层（无业务逻辑）
│   │   │   ├── security.py            # 密码哈希(bcrypt) + JWT 签发/验证
│   │   │   └── datetime_utils.py      # 时间工具
│   │   ├── models/                    # SQLAlchemy ORM 模型
│   │   │   ├── user.py                # User 表
│   │   │   ├── teacher_profile.py     # 教师档案表
│   │   │   ├── availability.py        # 可用时间表
│   │   │   ├── lesson.py              # 课程表
│   │   │   ├── review.py              # 评价表
│   │   │   ├── payment.py             # Wallet + Transaction 表
│   │   │   └── message.py             # 消息表
│   │   ├── schemas/                   # Pydantic 请求/响应模型
│   │   │   ├── user.py                # 用户相关 Schema
│   │   │   ├── teacher.py             # 教师相关 Schema
│   │   │   ├── lesson.py              # 课程相关 Schema
│   │   │   ├── review.py              # 评价相关 Schema
│   │   │   ├── availability.py        # 可用时间相关 Schema
│   │   │   ├── payment.py             # 支付相关 Schema
│   │   │   └── common.py              # 通用 Schema（分页、错误响应等）
│   │   ├── api/                       # API 路由层（薄层，只负责路由+异常转换）
│   │   │   └── v1/
│   │   │       ├── router.py          # 聚合所有 v1 路由
│   │   │       ├── auth.py            # 认证端点
│   │   │       ├── teachers.py        # 教师端点
│   │   │       ├── lessons.py         # 课程端点
│   │   │       ├── reviews.py         # 评价端点
│   │   │       ├── availability.py    # 可用时间端点
│   │   │       ├── payments.py        # 支付端点
│   │   │       └── users.py           # 用户端点
│   │   └── services/                  # 业务逻辑层（核心逻辑都在这里）
│   │       ├── auth_service.py        # 认证业务
│   │       ├── availability_service.py
│   │       ├── lesson_service.py
│   │       └── wallet_service.py
│   ├── alembic/                       # 数据库迁移
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/                  # 迁移脚本
│   ├── tests/                         # 测试
│   │   ├── conftest.py                # 测试 fixture（异步 DB + HTTP client）
│   │   └── api/v1/                    # API 层测试
│   ├── pyproject.toml                 # Python 依赖管理（uv）
│   ├── Dockerfile
│   └── .env.example
└── frontend/                          # React 前端（Vite + TypeScript）
    ├── Dockerfile                       # 前端镜像（开发：compose 内挂卷 + pnpm）
    ├── src/
    │   ├── main.tsx                   # 入口
    │   ├── app/
    │   │   ├── App.tsx                # 路由配置
    │   │   ├── Layout.tsx             # 布局组件
    │   │   ├── routes.tsx
    │   │   ├── pages/                 # 页面组件
    │   │   └── components/            # UI 组件
    │   │       ├── ui/                # shadcn/ui 组件库
    │   │       └── figma/             # Figma 导出组件
    │   └── styles/                    # 样式
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config
```

## 后端架构约定

### 分层架构

```
请求 → API Router（路由+参数校验+异常转换）
     → Service（业务逻辑+事务管理）
     → ORM Model（数据访问）
     → PostgreSQL
```

**各层职责**：
- **`api/`**：路由定义、请求参数校验（Pydantic）、调用 service、异常转换。**不包含业务逻辑**。
- **`services/`**：核心业务逻辑、数据库事务、跨模型操作。**不直接处理 HTTP 请求/响应**。
- **`models/`**：SQLAlchemy ORM 表定义、表间关系。
- **`schemas/`**：Pydantic 请求体/响应模型，用于 API 层的类型校验。
- **`core/`**：纯工具函数（密码哈希、JWT、时间处理），无业务逻辑。
- **`dependencies.py`**：FastAPI 依赖注入（数据库会话、当前用户、角色校验）。

### 关键约定

1. **密码哈希**：使用 `bcrypt` 直接调用（`bcrypt.hashpw` / `bcrypt.checkpw`），不使用 passlib
2. **JWT**：`python-jose`，access_token 30 分钟 + refresh_token 7 天
3. **主键**：UUID（避免自增 ID 暴露业务量）
4. **金额**：BIGINT 整数存储（VND），避免浮点精度
5. **数据库**：SQLAlchemy 2.0 async，统一通过 `AsyncSession` 操作
6. **注册时自动创建 Wallet**：每个用户都有钱包，后续支付无需额外判断
7. **单账号多角色**：`roles` 数组字段，`active_role` 控制当前界面
8. **API 路由前缀**：统一 `/api/v1`
9. **CORS**：允许 `http://localhost:5173`

### 测试约定

- 测试数据库与开发库分离（`cnvn_test`）
- 每个测试使用独立 engine + session，测试后 rollback + dispose
- 测试数据使用 `uuid.uuid4().hex[:8]` 生成唯一标识，避免冲突
- 使用 `pytest-asyncio` + `httpx.AsyncClient` 进行异步 API 测试

### Docker 约定

- 根目录 `docker-compose.yml` 编排 `api` + `web` + `db`；镜像名 `cnvn-api:latest`、`cnvn-web:latest`
- PostgreSQL 16-alpine，数据通过 volume 持久化
- 开发模式：`./backend/app` 挂入 api 容器热重载；`./frontend` 挂入 web 容器，`node_modules` 使用命名卷
