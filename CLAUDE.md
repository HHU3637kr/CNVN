# CNVN（中越通）

<!-- 项目简介：待补充 -->

## 技术栈

- **语言**: 待填写
- **框架**: 待填写
- **类型**: 待填写

## 项目规范

### 开发方法论

本项目采用 **Spec 驱动式开发**，所有功能开发遵循以下流程：
1. 先设计（plan.md），后实现
2. 严格遵循 Spec，不添加额外功能
3. 每个实现都可追溯到 Spec 文档
4. 完整的开发过程记录在 Obsidian 中

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
