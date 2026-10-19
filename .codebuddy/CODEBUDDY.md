# HowToMCD WorkBuddy / CodeBuddy 项目上下文

你正在开发一个 Rust-first 的社区原创家庭烹饪项目：HowToMCD。它通过麦当劳中国官方 MCP 展示真实门店餐品，但家庭食谱始终是**非官方参考做法**。

请遵守：
1. 优先修复并复用现有 Rust/WASM/网页代码；不要复制官方菜单为陈旧常量。
2. MCP 用于官方名称、价格、套餐组成和营养查询；不能从这些字段推断商业配方。
3. 涉及不同过敏原、温度与食材时优先验证食品安全；不具备信息时显式拒绝精确复刻的声明。
4. 禁止曝光 `MCD_MCP_TOKEN`；浏览器只在当前内存保存用户 Token；所有真实下单必须有人工确认和最新报价。
5. 前端 `/api/*` 走 Vercel Rust 网关，不假定 GitHub Pages 上有 API。
6. 提交前运行 `cargo check --all-targets`、`cargo test --all-targets`、`cargo run -- validate` 和对应 WASM/browser E2E。
7. 记录真实验证证据而不是模拟工具执行历史。

参考：`/.workbuddy/PROJECT.md`、`/.workbuddy/TASKS.md` 与 `/.codebuddy/skills/menu-recipe-audit/SKILL.md`。

目录本身不是历史 WorkBuddy 使用证明；任何工具参与记录只能由真实执行产生。
