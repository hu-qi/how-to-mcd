# HowToMCD · 参赛作品快速展示

> 麦麦灵感，家里开做！以 **Rust + WebAssembly + 麦当劳中国官方 MCP** 为技术核心的开源家庭烹饪助手。

## 体验入口

- **公开在线演示：** https://hu-qi.github.io/how-to-mcd/
- **官方参赛 Issue：** https://github.com/M-China/mcd-developer-innovation-challenge/issues/838
- **代码仓库：** https://github.com/hu-qi/how-to-mcd

## 评委 60 秒快速体验

| 阶段 | 操作 | 技术要点 |
| --- | --- | --- |
| 00–10 秒 | 打开网站，浏览三份开源家庭食谱 | 无需下载客户端，实际 Rust WebAssembly 在浏览器中运行 |
| 10–20 秒 | 输入「鸡腿肉、面包、生菜」，点击「智能匹配」 | Rust 食材归一化、匹配排序与缺料列表；不是模型幻觉 |
| 20–35 秒 | 打开鸡腿堡食谱，将人数调整为 4 | 共享 Rust 数据模型换算食材；WASM CI 验证首项为 600 g |
| 35–45 秒 | 勾选已备齐食材，查看采购清单 | 可交互的厨房工作台 |
| 45–60 秒 | 打开逐步烹饪模式，切换步骤及 10 分钟计时器 | 分步指导，强调熟度和过敏原安全提醒 |

## 真实技术验证

1. **麦当劳中国官方 MCP 已真实联调通过：** [MCP Smoke Test](https://github.com/hu-qi/how-to-mcd/actions/runs/39037176750)；Rust Streamable HTTP / JSON-RPC 客户端成功发现工具并查询官方营养数据。只允许三个只读工具，不包含下单或支付。
2. **Rust 原生构建与 HTTP API 测试：** [Rust CI](https://github.com/hu-qi/how-to-mcd/actions/runs/39037176719)。
3. **Rust/WASM 构建与实际执行测试、GitHub Pages 发布：** [Rust WASM Demo and Pages](https://github.com/hu-qi/how-to-mcd/actions/runs/39037176740)。
4. **浏览器桌面和移动端真实演示：** [Capture Contest Demo Evidence 工作流](../.github/workflows/showcase.yml)。此工作流从线上 GitHub Pages 页面真实操作食材匹配、份量换算、备料、分步烹饪与计时器，并将浏览器截图、无声 MP4 录屏、自动化验证报告上传为 GitHub Actions Artifact。**只有工作流执行成功后，其媒体才是验证过的实录；不要将未执行的截图或视频视为已完成。**

## 关于官方 MCP 和公开网页的区别

**公开网页是 Rust/WASM 离线交互演示**，可在不提供 Token 的情况下体验社区家庭食谱。它不会偷偷将私有密钥嵌入浏览器，也不把模拟数据冒充实时营养查询。

**真实官方 MCP 查询通过受控的 Rust 客户端执行**，在 GitHub Actions 使用 Repository Secret 验证，或由用户在自己的本地环境设置 Token。官方营养数据与社区独立开发的家庭食谱不应混为一谈；本项目并非麦当劳官方产品，也不公开或推测商业配方。

## 拍摄与素材审核原则

- 采用实际网页操作录屏，不使用 AI 合成的假截图。
- 展示桌面与移动端布局时，检查页面实际渲染、互动响应和浏览器 JS 异常。
- 视频可以配后期字幕或旁白，但不应声称 Pages 现场请求了官方 MCP。
- 任何公开截图、视频、Artifact 都不包含 \`MCD_MCP_TOKEN\`、授权标头或用户隐私数据。
