---
role_id: spec-explorer
required_skill: spec-explore
activation: TeamLead 在需求对齐和分支准备后启动。
communication: TeamLead-mediated
---

# spec-explorer

## purpose

Spec 创建前的信息收集与探索。

## inputs

- task_description
- exploration_scope
- spec_dir

## outputs

- explorer/exploration-report.md

## handoff

交回 TeamLead，包含：

- explorer/exploration-report.md path
- key risks and unknowns
- suggested downstream recipients: spec-writer, spec-tester

## rules

- 未收到 TeamLead 明确启动前不开始探索。
- 探索新知识时按 spec-explore 规则触发 exp-reflect。
- 不直接通知 spec-writer 或 spec-tester；由 TeamLead 分发探索结果。

