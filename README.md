# 🍔 HowToMCD · 程序员在家做麦麦风味

> 麦麦灵感，家里开做！Inspired by McDonald's menu ideas, made independently at home.

**HowToMCD** 是用 **Rust** 开发的开源 AI 烹饪 Skill + CLI：通过麦当劳中国 **真实 MCP 服务**获取官方菜单与营养数据，再关联**社区独立原创**的家庭食谱，根据人数和厨具生成可执行烹饪建议。

本项目不是麦当劳官方产品，不提供商业配方。官方 MCP 营养数据不等于社区自制餐品的营养数据；访客明确确认后可以调用官方创建订单接口，但本站不会自动付款。仅转发请求所需的个人 Token，不在服务端保存。

## 🚀 快速开始

需要 **Rust 1.90+**。

```sh
git clone https://github.com/hu-qi/how-to-mcd.git
cd how-to-mcd
cargo run -- recipes
cargo run -- show chicken-burger --servings 4
cargo run -- show crispy-fries
cargo run -- show chicken-nuggets
cargo run -- suggest --ingredients "鸡腿肉、面包、生菜"
cargo test
cargo run -- validate
```

23 道独立设计的家庭完整食谱（汉堡、鸡翅、鸡肉卷、薯饼、蒸玉米、圣代、拿铁、热可可、烘焙、粥、沙拉、果茶、奶昔、柠檬饮、玉米浓汤等）均包含可缩放食材数量、厨具、步骤、过敏原与食品安全提醒。它们是社区家庭做法参考，**不是麦当劳官方制作工艺，也不声称已经过真实厨房实测**；欢迎通过 PR 提供实测数据。

## 🖥️ 交互式 Rust 厨房工作台（新增）

```sh
cargo run -- serve
# 然后在浏览器打开 http://127.0.0.1:3000
```

**这是本地运行的真实 Web 应用，不是静态截图。** Rust `axum` 服务器直接提供页面与 JSON API；前端仅负责展示和交互。无需 Node.js、Python、数据库或外部 CDN。

- **食谱探索**：搜索名称、食材和厨具，按空气炸锅、平底锅、烤箱筛选。
- **Rust 精准换算**：选择菜谱后按人数（1–20）从后端重新获取食材用量，非浏览器臆测。
- **厨房工作台**：勾选备料、复制采购清单、查看过敏原和安全提示。
- **冰箱食材推荐**：输入“鸡腿肉、面包、生菜”，Rust 计算食材匹配率、缺料清单和推荐优先级；CLI、本地 Web 与 WASM 共用相同的匹配规则。
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

## 🌐 免费在线预览：Rust WebAssembly

为了让不安装 Rust 的开发者也能体验食谱，项目提供**纯静态 Rust/WASM 演示**，与本地服务共享**同一份 `src/recipes.rs`** 源代码。

- 在本地启动 `cargo run -- serve`：浏览器通过 Rust HTTP API 读取菜谱并换算人数，可以在本机已配置 Token 的情况下访问只读官方 MCP。
- 在 GitHub Pages 打开：浏览器加载 Rust/WASM 引擎，直接运行食谱校验、查询和人数换算；**不要求 Rust 安装，不依赖 Python，也不发送或嵌入任何 MCP Token**。
- 公开演示**不会声称调用了实时官方 MCP**；真实餐品营养查询需在本地启动 Rust 服务并安全设置环境变量。

### 本地构建 WASM

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
wasm-pack build crates/howtomcd-wasm --target web --release --out-dir ../../site/pkg --no-opt
mkdir -p site/assets
cp web/index.html site/index.html
cp web/app.js site/assets/app.js
cp web/app.css site/assets/app.css
# 使用任意静态 Web 服务器从 site/ 提供文件；不要直接 file:// 打开。
```

GitHub Actions 的 [Rust WASM Demo and Pages](.github/workflows/wasm-pages.yml) 会自动构建 WASM、通过 Node.js 执行真实 WASM 份量换算测试，并上传可下载的静态演示产物；在 GitHub Pages 启用 Actions 发布源后，每次 main 更新也会自动尝试部署。

**首次启用 GitHub Pages：** 进入仓库 Settings → Pages，将 Source 设为 **GitHub Actions**。后续合并至 main 将自动部署到 `https://hu-qi.github.io/how-to-mcd/`；在首次发布成功前，该链接仅是预计地址，不代表服务已上线。

## 🛒 官方真实营养、门店菜单与点餐（新增）

在线页面增加「官方菜单 · 点餐」板块：https://hu-qi.github.io/how-to-mcd/#official

**真实营养资料库**：生产环境 GitHub Actions 使用受保护的 MCD_MCP_TOKEN 调用官方 list-nutrition-foods，仅将餐品名称与公开营养字段提取到静态目录。公开目录不包含令牌、账户、地址或订单信息。它是官方常见餐品营养信息，不代表全国所有门店此刻均有售。

**实时菜单与下单**：输入自己的个人 Token → 按城市搜索取餐门店，或选择官方账户中的已有外送地址 → 使用 query-meals 获取该店可售餐品与分类 → query-meal-detail 看套餐组成 → 加入选购清单 → calculate-price 获取真正含配送费和优惠的报价 → 核对并确认 → 再次询价确保金额未变化 → create-order 创建真实订单并由用户进入麦当劳官方支付链接。不会自动付款。首期支持到店自取与麦乐送，尚不支持复杂套餐改配、预约与积分兑换。

**公开 Pages 与 Rust API 的正确地址**：
- 网页：`https://hu-qi.github.io/how-to-mcd/`
- **实际后端健康检查**：`https://how-to-mcd-api.vercel.app/api/health`
- `https://hu-qi.github.io/api/health` 是错误地址，GitHub Pages 仅提供静态资源，不托管 Rust API，也不透传 `/api/*`。
- Pages 编译 Rust/WASM 供家庭烹饪使用；真实门店菜单、查询和询价通过独立的 **Vercel Rust HTTPS API** 连接官方麦当劳 MCP。个人 Token 仅存在页面内存，通过 HTTPS 在每次请求中发送，不进入静态文件或 Actions 发布物；后端无持久 Token 存储，服务不可达时停止连接。GitHub Actions Secret 仅用于受保护的 CI 联调，不是公共访客的共享下单账户。

**真实菜单体验**：登录个人 Token → 选择城市或官方配送地址 → 选择真实门店 → 展示官方该店在售分类和餐品 → **按商品名/编号搜索、按类别筛选** → 查看官方套餐详情 → 清单数量增减 → 官方最终价格查询 → 双重明确确认 → 重新核价并可提交实际订单。清单变动会使先前报价失效，支付操作始终需要用户进入官方页面自行完成。

**家庭做法灵感**：实时菜单中可识别的薯条、鸡块、鸡腿堡、牛肉堡、鱼堡、早餐麦满分、苹果派等可跳转对应的社区原创家庭做法；未建立关联的官方商品只显示官方实际返回的信息，不杜撰所谓「官方商业配方」。全部实售商品量按门店和时段变化，不保证全国统一数量。

## 🍳 全菜单家庭做法入口与 WorkBuddy 协作

麦当劳中国官方实时菜单由 MCP 按门店查询，不能长期固定为「全国所有商品」清单。本项目在官方菜单与营养资料库的**每个商品条目**中提供「家庭做法 / 参考」入口：

- **已有 23 道社区原创完整食谱**：含配比、步骤、设备、食安与过敏原，可直接在 Rust/WASM 厨房中使用。
- **20 多类家庭品类指南**：通过 `web/home-guides.js` 按真实餐品名称或分类，给出家庭材料、步骤、时长和食品安全参考，包含套餐拆解、汉堡、鸡翅、鸡块、薯条、鱼柳、早餐、派、冰淇淋、咖啡、茶饮等。
- **严格的未知兜底**：如果新品、复杂套餐或其他商品无法确认其商业配料，则展示「尚无可核实专属复刻配方」及如何核实和贡献；**有指南入口不等于已经完整复刻每个商品，更不等于官方商业配方**。
- 所有官方商品数据及价格仍然来自官方 MCP，家常指南由社区独立撰写，不反向推断专利、配方或营养数据。
- CI 检验每个真实菜单商品都有指南入口，但不会自动创建订单或付款。

### WorkBuddy 项目准备

本项目配置了 `.codebuddy/CODEBUDDY.md`、`.codebuddy/rules/` 和 `.codebuddy/skills/menu-recipe-audit/`，供 **WorkBuddy 官方支持的项目级配置机制**加载；`.workbuddy/` 则保存可跨工具复用的项目说明、任务清单和菜谱审核单。打开 WorkBuddy 并选择本仓库为工作目录，即可按照规则开始实际辅助开发。

这些文件是**预先准备的可用配置与任务资料，不是对历史曾使用 WorkBuddy 的证明，也不包含虚构会话日志**。

验证命令：

```sh
node scripts/test-home-guides.cjs
cargo check --all-targets
cargo test --all-targets
cargo run -- validate
```

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

通用 MCP 桥接只允许白名单只读工具，包括门店、菜单、餐品详情、营养与询价；具有副作用的 `create-order` 不允许通过通用桥接执行，仅在专用 checkout 路由经用户明确确认、重新核价一致后调用。代码默认使用 Rust `reqwest` 实现标准 Streamable HTTP / JSON-RPC（含协商、initialized 通知、工具发现、会话头及响应解析），同时保留 `rmcp` SDK 适配供兼容性调试；没有任何模拟 MCP 业务结果。

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
  recipes.rs           # 23 道 serde JSON 家庭食谱模型 + 校验 + 份量换算
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

普通 `Rust CI` 不使用 Secret，可安全运行于 PR；`MCP Smoke Test` 可手动触发，并仅在 main 上变更其工作流文件时自动执行一次，真实访问 `tools/list` 和 `list-nutrition-foods`。不会在 Fork PR 中运行 Secret；正式联调结论以 Action 成功结果为准。

## 🌱 社区共创

项目借鉴 HowToCook 的开发者友好食谱格式，由社区共同完善步骤、食安提示及厨房实测记录；参考 [CONTRIBUTING.md](CONTRIBUTING.md) 提交 PR。

本项目报名 [麦当劳程序员创意开发大赛](https://github.com/M-China/mcd-developer-innovation-challenge)，并采用 MIT 许可证发布自有代码。参赛要求公开仓库；不使用未经授权的官方品牌标识。
