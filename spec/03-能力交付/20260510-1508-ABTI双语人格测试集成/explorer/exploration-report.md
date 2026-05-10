---
type: exploration-report
spec: 20260510-1508-ABTI双语人格测试集成
status: done
created_at: 2026-05-10T15:08:00+08:00
updated_at: 2026-05-10T15:08:00+08:00
tags:
  - spec/exploration
  - frontend
  - abti
---

# Exploration Report

## 输入素材

- `ABTI.zip` 大小约 447MB，解压后 `ABTI/` 约 474MB。
- 包内包含两个纯静态网站：
  - `ABTI/abti_chinese_website/`
  - `ABTI/abti_vietnamese_website/`
- 每个站点均包含 `index.html`、`README.md` 与 `images/results/`。
- 两个站点各有 32 张结果 PNG，文件名与人格代码一致；两套图片内容重复。
- 包内还有 4 个 `.docx`，用于 SBTI 题库整理、人格描述与命名资料。

## 前端现状

- CNVN 前端位于 `frontend/`，技术栈为 React + Vite + TailwindCSS。
- 路由集中在 `frontend/src/app/routes.tsx`。
- 全局布局与导航在 `frontend/src/app/Layout.tsx`。
- 当前站点已有首页、教师列表、学习中心、教师中心、钱包、支付、运营争议等页面。

## 结论

ABTI 包不是 CNVN 主业务代码，而是一个可独立运行的娱乐型人格测试资料包。为了避免把大体积原始包直接纳入仓库，本次只抽取必要能力：

- 站内新增 `/abti` 页面。
- 复用 ABTI 的 30 题问卷、5 维度计分、32 种结果代码。
- 支持越南语与闽南语两种语言切换。
- 只导入一份结果图片资源，并转换为前端静态资产。
- 不改后端数据库与 API。
