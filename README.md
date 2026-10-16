# 🍔 HowToMCD · 在家做麦麦风味

> 麦麦灵感，家里开做！ | Inspired by McDonald's menus, cooked your way at home.

[![CI](https://github.com/hu-qi/how-to-mcd/actions/workflows/ci.yml/badge.svg)](https://github.com/hu-qi/how-to-mcd/actions/workflows/ci.yml)

**HowToMCD** 是面向程序员与家庭厨房的开源 AI 烹饪 Skill：从麦当劳中国官方 MCP 查询真实餐品及营养信息，关联社区独立创作的家庭风味食谱，并根据人数、食材与厨具形成可执行烹饪步骤。

本项目**不是麦当劳官方产品**，不提供官方商业配方；社区食谱不等于官方配方，也不把家庭自制品的营养视为官方餐品营养。项目默认只读，不下单、不支付，不访问会员私有信息。

## ✨ 功能
- **真实 MCP**：通过 Streamable HTTP + Bearer Token 调用 `list-nutrition-foods`、`query-meals`、`query-meal-detail`（前两者分别用于营养和门店菜单，详情工具供支持的客户端使用）。
- **家庭食谱**：三个原创入门食谱——香煎鸡腿汉堡、香脆土豆条、香酥鸡块；完整 JSON 数据，便于社区 PR。
- **按人数缩放**：单位、用量、步骤与食安提示可被程序处理。
- **可复现**：Python 标准库实现 MCP 客户端，离线单测与手动触发的真实 MCP 冒烟测试隔离。
- **可移植 Skill**：参见 [SKILL.md](SKILL.md)，可交给支持自定义 Skill 和 MCP 的 AI 客户端使用。

## 🚀 30 秒上手

需要 Python 3.10+，核心功能**无第三方依赖**。

```bash
git clone https://github.com/hu-qi/how-to-mcd.git
cd how-to-mcd
python3 -m howtomcd recipes
python3 -m howtomcd show chicken-burger --servings 3
python3 -m unittest discover -s tests -v
```

启用 **真实麦当劳 MCP**（不要将 Token 提交到仓库）：

```bash
export MCD_MCP_TOKEN="从 https://open.mcd.cn/mcp 申请的个人 Token"
python3 -m howtomcd tools
python3 -m howtomcd nutrition
python3 -m howtomcd menu --store-code 你的门店编码 --be-code 你的BE编码
```

`menu` 只查询门店在售菜单，不会发起订单。真实菜单需填写有效门店码和 BE 码；未指定时可先调用 `tools` 检查 MCP 工具可用性。对于支持 MCP 的 AI 客户端，参见 [mcp-config.example.json](mcp-config.example.json)；配置中的 `${MCD_MCP_TOKEN}` 仅是环境变量占位符，取决于客户端是否支持展开。

## 🧑‍🍳 示例指令

> 我只有空气炸锅，想做两份香酥鸡块。请列出食材和制作步骤，注意鸡肉熟度。

> 从 MCP 查询真实餐品营养数据，找到名称包含“鸡”的餐品，并单独给我推荐适合家庭厨房的自制食谱。请区分官方数据与社区食谱。

> 我有鸡腿肉、面包胚和生菜，帮我调整香煎鸡腿汉堡食谱，并把用量换算成三人份。

## 📦 项目结构
```text
howtomcd/                 # 标准库 MCP 客户端、食谱校验与 CLI
recipes/                  # 社区原创食谱 JSON
tests/                    # 离线自动化测试
.github/workflows/        # CI 与手动真实 MCP 冒烟验证
SKILL.md                  # Agent 使用指令
MCP_INTEGRATION.md        # 实际 MCP 使用说明与限制
CONTRIBUTING.md           # 贡献食谱指南
mcp-config.example.json   # 无敏感信息的接入示例
CONTEST_DECLARATION.md    # 赛事官方原文参赛声明
```

## 🔐 Token 安全与 CI

- 永远不要把真实 Token 写进 README、Skill、Issue、日志或 JSON 示例。
- 本地通过环境变量 `MCD_MCP_TOKEN` 注入。
- GitHub Actions 通过 **Settings → Secrets and variables → Actions → New repository secret** 添加名为 `MCD_MCP_TOKEN` 的 Secret；`MCP Smoke Test` 工作流手动执行，避免向 Fork PR 暴露密钥。
- GitHub 默认 CI 只使用无密钥的 mock 测试，避免把网络故障误判成代码故障。

## 🤝 开源与参赛

欢迎提交真实厨房实践后的改进、可替换食材、步骤照片、无障碍烹饪体验等，见 [CONTRIBUTING.md](CONTRIBUTING.md)。本项目参加 [麦当劳程序员创意开发大赛](https://github.com/M-China/mcd-developer-innovation-challenge)，详情见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md) 和 [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md)。

使用 MIT 协议发布自有代码；第三方商标归各自权利人所有。不保证家庭菜品与门店成品相同；如涉及过敏原或饮食限制，请自行核实食材标签。
