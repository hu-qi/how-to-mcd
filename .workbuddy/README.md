# HowToMCD · WorkBuddy 协作资料（准备就绪）

此目录提供给将来使用 WorkBuddy 或其他开发智能体的**项目协作资料**，并非 WorkBuddy 的历史会话记录。

> 说明：官方 WorkBuddy **代码项目级自动加载**的配置目录是根目录 `.codebuddy/`，而不是本目录。这里用于跨工具共享研发任务、领域知识和人工验收检查表。

## 导航

- [产品与架构](PROJECT.md)：Rust/WASM/麦当劳中国 MCP/数据隔离
- [迭代任务](TASKS.md)：全量官方菜单与家庭烹饪参考的迭代目标
- [菜谱审核模版](recipe-review.md)：食谱安全、来源、可复核证据模板
- 自动加载规则：[.codebuddy/CODEBUDDY.md](../.codebuddy/CODEBUDDY.md)
- 可执行审核技能：[.codebuddy/skills/menu-recipe-audit/SKILL.md](../.codebuddy/skills/menu-recipe-audit/SKILL.md)

## 工作方式

在 WorkBuddy 中选择本仓库为工作目录，要求遵循 `.codebuddy/CODEBUDDY.md`，按 `TASKS.md` 逐项执行。新增菜谱必须注明来源、审核过敏原与食品安全，并运行仓库 CI。

请勿提交本机 `~/.workbuddy` 会话记录、账户信息、Token、地址、订单、请求/响应原文，**不要凭空生成历史执行日志**。
