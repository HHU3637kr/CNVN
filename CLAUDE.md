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
