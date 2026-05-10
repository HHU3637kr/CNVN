---
type: plan
spec: 20260510-1508-ABTI双语人格测试集成
status: approved
execution_mode: single-agent
git_branch: feat/spec-20260510-1508-abti-bilingual-test
base_branch: master
pr_url:
created_at: 2026-05-10T15:08:00+08:00
updated_at: 2026-05-10T15:08:00+08:00
tags:
  - spec/plan
  - frontend
  - abti
---

# Plan

## 目标

将 `ABTI.zip` 中的人格测试能力集成到 CNVN 前端站内，形成一个独立的 `/abti` 页面，支持越南语与闽南语两种语言。

## 范围

本次包含：

- 新增 ABTI 测试页面。
- 新增 ABTI 题库、维度、结果名、结果摘要与建议文案。
- 新增越南语与闽南语语言切换。
- 新增 32 张结果图片静态资产。
- 在桌面端、移动端导航和页脚加入 ABTI 入口。
- 将原始 `ABTI/` 与 `ABTI.zip` 作为本地导入素材忽略，不提交原始大包。

本次不包含：

- 后端 API、数据库、用户结果保存。
- 登录态绑定、排行榜、社交裂变追踪。
- 闽南语母语审校。

## 实现方案

1. 在 `frontend/src/app/pages/` 新增 `AbtiTest.tsx`。
2. 在 `frontend/src/app/features/abti/` 新增测试数据与计算逻辑。
3. 在 `frontend/src/app/routes.tsx` 注册 `/abti`。
4. 在 `frontend/src/app/Layout.tsx` 加入导航入口。
5. 将结果图从 `ABTI/abti_chinese_website/images/results/*.png` 转换到 `frontend/public/assets/abti/results/*.jpg`。
6. 更新 `.gitignore`，忽略原始 `ABTI/` 和 `ABTI.zip`。

## 验收标准

- 用户可以从站内导航进入 `/abti`。
- 页面默认展示越南语，且可切换到闽南语。
- 30 题完整可答，进度、上一题、重测可用。
- 完成后生成 5 位 ABTI 代码、结果名、维度强度、摘要、建议与对应结果图。
- 构建命令 `pnpm build` 通过。
