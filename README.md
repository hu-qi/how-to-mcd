# 🍔 HowToMCD · 程序员在家做麦麦风味

> 麦麦灵感，家里开做！Inspired by McDonald's menu ideas, made independently at home.

**HowToMCD** 是用 **Rust** 开发的开源 AI 烹饪 Skill + CLI：通过麦当劳中国 **真实 MCP 服务**获取官方菜单与营养数据，再关联**社区独立原创**的家庭食谱，根据人数和厨具生成可执行烹饪建议。

本项目不是麦当劳官方产品，不提供商业配方。官方 MCP 营养数据不等于社区自制餐品的营养数据；不下单、不支付，不处理会员数据。

## 🚀 快速开始

需要 **Rust 1.90+**。

```sh
git clone https://github.com/hu-qi/how-to-mcd.git
cd how-to-mcd
cargo run -- recipes
cargo run -- show chicken-burger --servings 4
cargo run -- show crispy-fries
cargo run -- show chicken-nuggets
cargo test
cargo run -- validate
```

三个独立设计的家庭食谱均包含食材数量、厨具、步骤、过敏原与食品安全提醒。鼓励社区实际动手验证后通过 PR 改进。

## 🖥️ 交互式 Rust 厨房工作台（新增）

```sh
cargo run -- serve
# 然后在浏览器打开 http://127.0.0.1:3000
```

**这是本地运行的真实 Web 应用，不是静态截图。** Rust `axum` 服务器直接提供页面与 JSON API；前端仅负责展示和交互。无需 Node.js、Python、数据库或外部 CDN。

- **食谱探索**：搜索名称、食材和厨具，按空气炸锅、平底锅、烤箱筛选。
- **Rust 精准换算**：选择菜谱后按人数（1–20）从后端重新获取食材用量，非浏览器臆测。
- **厨房工作台**：勾选备料、复制采购清单、查看过敏原和安全提示。
- **逐步烹饪**：全屏聚焦单步做法，带 5 / 10 / 15 分钟辅助计时器。
- **真实 MCP 桥接**：仅在服务端配置 `MCD_MCP_TOKEN` 后，界面提供只读官方营养查询。Token 从不发往浏览器。
- **本地网络安全**：服务仅允许绑定回环地址（默认 `127.0.0.1`），阻止无认证的远程客户端使用私人 MCP Token。

### 直接检查 Rust HTTP API

```sh
curl -s http://127.0.0.1:3000/api/health
curl -s http://127.0.0.1:3000/api/recipes
curl -s 'http://127.0.0.1:3000/api/recipes/chicken-burger?servings=4'
curl -s http://127.0.0.1:3000/api/mcp/status
```

若要查看真正的麦当劳官方营养数据，在启动 Rust 服务器的同一终端安全设置环境变量，随后在页面中点击「查询官方营养数据」。与官方 MCP 的联调是否成功，请以运行结果为准，不能将离线 API 测试当作真实接口验证。

## 🔗 真实 McDonald's China MCP

官方文档：https://open.mcd.cn/mcp/doc

MCP Endpoint：`https://mcp.mcd.cn`（Streamable HTTP + Bearer Token）。

```sh
# 请使用个人环境变量；切勿把真实 Token 提交到 GitHub
export MCD_MCP_TOKEN="<your-new-personal-token>"
cargo run -- mcp tools
cargo run -- mcp nutrition
# 先查询工具 schema，再使用所需参数调用允许的只读工具
cargo run -- mcp call query-meals --args '{"storeCode":"<actual-store-code>","beCode":"<actual-be-code>"}'
```

目前只允许调用三个只读工具：`list-nutrition-foods`、`query-meals`、`query-meal-detail`。代码使用官方 Rust SDK `rmcp`，不自行解析底层 SSE 或实现 MCP 协议。

- [MCP_INTEGRATION.md](MCP_INTEGRATION.md)：集成架构、调用流程及测试方法
- [mcp-config.example.json](mcp-config.example.json)：仅包含环境变量占位符的 MCP 配置
- [SKILL.md](SKILL.md)：AI Agent 的 Skill 指引

注意：部分 MCP 客户端不会自动展开 JSON 中的 `${MCD_MCP_TOKEN}`，请通过该客户端支持的安全密钥配置机制注入。

## 🦀 Rust 项目结构

```text
src/
  main.rs              # clap CLI
  lib.rs               # Rust library
  mcp.rs               # rmcp 只读官方服务客户端
  recipes.rs           # serde JSON 食谱模型 + 校验 + 份量换算
web/                   # 原生 HTML/CSS/JS 用户界面（业务在 Rust）\nrecipes/               # 社区原创家庭食谱
.github/workflows/
  ci.yml               # 构建 + 离线测试 + 内容校验
  mcp-smoke.yml        # 手动真实 MCP 冒烟测试（需 Secret）
SKILL.md               # Agent 烹饪指引
MCP_INTEGRATION.md     # MCP 接入记录
CONTEST_DECLARATION.md # 官方参赛声明
```

## 🔒 CI 密钥保护

进入 **GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret**，添加：

- **Name：** `MCD_MCP_TOKEN`
- **Value：** 麦当劳开放平台颁发的有效 Token（建议轮换聊天中曾明文分享的旧 Token）

普通 `Rust CI` 不使用 Secret，可安全运行于 PR；`MCP Smoke Test` 仅支持手动触发，执行真实 `tools/list` 和 `list-nutrition-foods`。任何真实 MCP 测试必须以 Action 成功结果为准，仓库提供配置不等于已经通过。

## 🌱 社区共创

项目借鉴 HowToCook 的开发者友好食谱格式，由社区共同完善步骤、食安提示及厨房实测记录；参考 [CONTRIBUTING.md](CONTRIBUTING.md) 提交 PR。

本项目报名 [麦当劳程序员创意开发大赛](https://github.com/M-China/mcd-developer-innovation-challenge)，并采用 MIT 许可证发布自有代码。参赛要求公开仓库；不使用未经授权的官方品牌标识。
