# GitHub Flow 规范

- 每个新 Spec 从仓库主干创建短生命周期分支；当前仓库主干为 master
- 同一活跃 Spec 的 update 复用原 Spec 分支
- 禁止直接在主干上实现、测试或归档 Spec
- writer/plan.md / updater/update-xxx.md 必须记录 git_branch、base_branch、pr_url
- 收尾时提交、推送当前分支并创建 PR
- PR 合并后同步主干并删除本地/远程工作分支

