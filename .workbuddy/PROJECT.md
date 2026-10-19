# 产品知识库 · HowToMCD

## 项目定位

以 Rust 为核心的麦麦风味家庭烹饪工具 + 麦当劳中国官方 MCP 实时菜单/询价体验。**非麦当劳官方产品**，不能假称掌握官方商业配方。

## 模块

| 模块 | 位置 | 数据性质 |
| --- | --- | --- |
| 社区完整食谱 | `recipes/*.json`, `src/recipes.rs` | 社区独立创作 |
| Rust/WASM 厨房 | `crates/howtomcd-wasm/`, `web/app.js` | 共享 Rust 食谱数据 |
| 官方菜单 | `web/shop.js`, `src/web.rs` | 用户凭据、按门店实时查询 |
| 参考家庭做法指南 | `web/home-guides.js` | 非官方、按餐品类别归类 |
| 线上 Rust 网关 | `api/public_api.rs`, `vercel.json` | 仅转发用户请求、不保存 Token |
| CI | `.github/workflows/` | 自动化验证，不创建真实订单 |

## 技术规范

- `https://hu-qi.github.io/how-to-mcd/` 是静态网页，**没有 `/api/health`**；
- `https://how-to-mcd-api.vercel.app/api/health` 是公网 Rust 网关健康检查；
- 所有官方商品、价格、店铺、优惠与营养信息必须来自**实际官方 MCP**；
- 家庭做法必须标记 `社区原创 / 非官方制作工艺`；
- 对限时新品、套餐、饮品、加工食品等，若无法确认配方，只提供品类参考并注明缺失细节；
- 项目不得静态部署私有 Token，不保存用户账户或订单，不以 CI 创建真实订单；
- 保留明确下单确认和重新核价机制。

## 验证

```sh
cargo check --all-targets
cargo test --all-targets
cargo run -- validate
node --check web/app.js
node --check web/shop.js
node --check web/home-guides.js
```

线上只读联调须以成功的 GitHub Actions 记录为证，不能把模拟数据宣称为真实菜单。
