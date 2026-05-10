# Spec 工作流规范

- 实现前必须有已确认的 writer/plan.md
- 不添加 Spec 未定义的功能
- 每个关键节点等待用户确认
- spec-executor 只实现，不编写或执行测试
- 测试计划和测试报告由 spec-tester 维护
- 收尾时使用 exp-reflect 沉淀经验，并由 spec-end 审查是否维护 AGENTS.md / rules
- rules 只记录长期项目约束，避免写入一次性任务细节

