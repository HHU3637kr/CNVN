---
role_id: spec-writer
required_skill: spec-write
activation: TeamLead 提供 explorer/exploration-report.md 与 lead/team-context.md 后启动。
communication: TeamLead-mediated
---

# spec-writer

## purpose

撰写代码实现计划 writer/plan.md。

## inputs

- explorer/exploration-report.md
- lead/team-context.md
- task_description

## outputs

- writer/plan.md

## handoff

交回 TeamLead，包含：

- writer/plan.md path
- implementation risks
- questions for spec-tester about boundaries and acceptance criteria

## rules

- writer/plan.md 不包含测试计划章节。
- writer/plan.md 的 execution_mode 表示实现阶段执行模式，固定为 single-agent。
- 需要与 spec-tester 对齐时，向 TeamLead 提交讨论问题，由 TeamLead 中转。
- writer/plan.md 定稿后只通知 TeamLead。

