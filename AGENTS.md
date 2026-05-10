# CNVN（中越通）

面向越南市场的中文学习双边撮合平台，连接想学中文的越南人与兼职中文老师。

## 技术栈

- **语言**: TypeScript、Python 3.11
- **框架**: React + Vite + TailwindCSS；FastAPI + SQLAlchemy 2.0 async
- **数据库**: PostgreSQL 16
- **部署**: Docker + Docker Compose
- **类型**: Web 应用

## 项目规范

### 开发方法论

本项目采用 **Spec 驱动式开发**，所有功能开发遵循以下流程：
1. 先设计（writer/plan.md），后实现
2. 严格遵循 Spec，不添加额外功能
3. 每个实现都可追溯到 Spec 文档
4. 完整的开发过程记录在 Obsidian 中

### 当前阶段

- 前后端均已落地，不再采用 Mock 优先作为默认开发策略
- 新功能按 Spec 驱动流程推进
- 支付相关改动遵循 `.agents/rules/payment-system.md`
- 重构遵循 `.agents/rules/refactor-principle.md`

### 编码规范

@import .agents/rules/

> AGENTS.md 与 .agents/rules/ 是活文档。每个 Spec 收尾时由 spec-end 审查是否需要维护项目规范。

### 文档规范

- 所有 Spec 文档使用 Obsidian Flavored Markdown
- 命名规范：`YYYYMMDD-HHMM-任务描述`（任务描述必须中文）
- 使用 `[[wikilink]]` 建立文档关联
- 每个文档包含完整的 YAML frontmatter
- 所有 Spec 目录统一使用当前 R&K Flow 分类结构

### 开发流程

- 新功能开发：`/spec-start` -> 5 阶段流程
- 功能更新：`/spec-update`
- 问题修复：`/spec-debug`
- 执行审查：`/spec-review`
- 经验检索：`/exp-search`
- 经验沉淀：`/exp-reflect`

### 记忆系统

- 自动层：Auto Memory（Agent 自主管理）
- 显式层：`spec/context/experience/` + `spec/context/knowledge/`
- 索引文件始终加载，详情按需检索
