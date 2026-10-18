"use strict";
// McDonald's China official shopping, never mock storefront information.
// Entered token remains in this tab's JS memory; not stored in cookies or Web Storage.
(() => {
  const $ = id => document.getElementById(id);
  const create = (tag, cls, value) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = String(value);
    return e;
  };
  const s = {
    token: "", mode: null, session: null, type: 1,
    store: null, stores: [], menu: {}, cart: new Map(),
    addressId: "", addresses: [], quote: null, quoteArgs: null
  };
  const notice = msg => { $("shop-status").textContent = msg; };
  const clearNode = el => el.replaceChildren();
  const productName = code => s.menu[code]?.name || code;
  const money = cents => "¥" + (Number(cents) / 100).toFixed(2);
  // Community-inspired methods, NEVER described as official McDonald's recipes.
  const homeInspiration = name => {
    if (/薯条/.test(name)) return { search: "薯条", label: "家庭薯条" };
    if (/麦乐鸡|鸡块/.test(name)) return { search: "鸡块", label: "家庭鸡块" };
    if (/鸡腿堡|鸡腿汉堡/.test(name)) return { search: "鸡腿", label: "家庭鸡腿汉堡" };
    return null;
  };
  function addHomeInspiration(container, name) {
    const idea = homeInspiration(name);
    if (!idea) return;
    const button = create("button", "shop-item", "🍳 看" + idea.label + "做法（非官方）");
    button.type = "button";
    button.addEventListener("click", () => {
      const search = $("recipe-search");
      search.value = idea.search;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      const card = $("recipe-grid").querySelector(".recipe-card");
      if (card) card.click(); else $("explore").scrollIntoView({ behavior: "smooth" });
    });
    container.append(button);
  }

  const safeHttpPay = href => {
    try {
      const u = new URL(href);
      return u.protocol === "https:" && (u.hostname === "mcd.cn" || u.hostname.endsWith(".mcd.cn")) ? u.href : null;
    } catch { return null; }
  };
  const officialData = response => {
    if (response?.isError) throw Error("官方 MCP 工具返回错误");
    for (const block of response?.content || []) {
      if (block.type !== "text") continue;
      let content;
      try { content = JSON.parse(block.text); } catch {
        // Official MCP store queries may put a Chinese field guide before JSON.
        const start = block.text.indexOf('{"success"');
        const end = block.text.lastIndexOf("}");
        if (start < 0 || end < start) continue;
        try { content = JSON.parse(block.text.slice(start, end + 1)); }
        catch (_) { continue; }
      }
      if (content.success === false || (content.code != null && content.code !== 200)) {
        throw Error("官方麦当劳服务拒绝了该请求，请检查账号、门店和点餐参数");
      }
      return content.data ?? content;
    }
    throw Error("官方 MCP 没有返回可解析的 JSON 数据");
  };
  async function rpc(method, args = {}) {
    if (!s.token) throw Error("请输入你的个人麦当劳 MCP Token");
    if (s.mode === "local") {
      const endpoint = method === "calculate-price" ? "/api/mcp/quote" : "/api/mcp/bridge";
      const resp = await fetch(endpoint, {
        method: "POST", credentials: "omit", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: s.token, tool: method, args })
      });
      if (!resp.ok) throw Error("本地 Rust 桥接失败：" + resp.status + "，请检查服务与 Token");
      return officialData(await resp.json());
    }
    return officialData(await direct(method, args));
  }
  async function sendRaw(payload, init = false) {
    const headers = {
      Authorization: "Bearer " + s.token,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json"
    };
    if (s.session?.id) headers["Mcp-Session-Id"] = s.session.id;
    if (!init) headers["MCP-Protocol-Version"] = "2025-03-26";
    let response;
    try {
      response = await fetch("https://mcp.mcd.cn", {
        method: "POST", mode: "cors", cache: "no-store",
        credentials: "omit", redirect: "error",
        headers, body: JSON.stringify(payload)
      });
    } catch (_) {
      throw Error("浏览器无法直连官方 MCP（可能受 CORS 策略限制）。可在本机运行 cargo run -- serve，通过 http://127.0.0.1:3000 使用安全的 Rust 桥接；Token 不会写入仓库。");
    }
    if (!response.ok) throw Error("官方 MCP HTTP " + response.status + "（请检查 Token 或请求限制）");
    if (init) s.session = { id: response.headers.get("mcp-session-id") };
    const type = response.headers.get("content-type") || "";
    if (payload.method === "notifications/initialized") return {};
    if (type.includes("text/event-stream")) {
      const text = await response.text();
      for (const line of text.split("\n")) {
        if (line.startsWith("data:")) {
          try {
            const obj = JSON.parse(line.slice(5).trim());
            if (obj.result || obj.error) return obj;
          } catch (_) { /* ignore unrelated notifications */ }
        }
      }
      throw Error("官方 MCP 响应流未包含结果");
    }
    return response.json();
  }
  async function direct(method, args) {
    if (!s.session) {
      const init = await sendRaw({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: {
          protocolVersion: "2025-03-26", capabilities: {},
          clientInfo: { name: "howtomcd-browser", version: "0.3.0" }
        }
      }, true);
      if (init.error || !init.result?.protocolVersion) throw Error("官方 MCP 握手失败");
      await sendRaw({ jsonrpc: "2.0", method: "notifications/initialized" });
    }
    const result = await sendRaw({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: method, arguments: args }
    });
    if (result.error) throw Error("官方 MCP 调用失败");
    return result.result;
  }
  async function connect(event) {
    event.preventDefault();
    const token = $("shop-token").value.trim();
    if (!token || token.length > 2048) return notice("请输入有效 Token（最长 2048 个字符）");
    s.token = token;
    // The input is cleared immediately. No localStorage/sessionStorage.
    $("shop-token").value = "";
    s.session = null;
    s.mode = null;
    s.quote = null;
    const local = await fetch("/api/health", { cache: "no-store" }).then(r => r.ok).catch(() => false);
    s.mode = local ? "local" : "direct";
    try {
      const data = await rpc("list-nutrition-foods");
      if (!data) throw Error("无法校验 Token");
      $("shop-disconnect").hidden = false;
      $("shop-connect").hidden = true;
      $("shop-controls").hidden = false;
      notice("已连接官方 MCP（" + (local ? "本机 Rust 安全桥接" : "浏览器直连") + "）。Token 只保存在当前页面内存，关闭或刷新后清除。");
    } catch (err) {
      s.token = "";
      s.session = null;
      $("shop-connect").hidden = false;
      notice(err.message);
    }
  }
  function disconnect() {
    s.token = ""; s.mode = null; s.session = null; s.store = null;
    s.cart.clear(); s.quote = null; s.menu = {}; s.addressId = "";
    $("shop-connect").hidden = false; $("shop-disconnect").hidden = true;
    $("shop-controls").hidden = true; $("shop-quote").hidden = true;
    clearNode($("shop-stores")); clearNode($("shop-menu")); clearNode($("shop-cart"));
    notice("连接已断开，个人 Token 已从页面内存清除。");
  }
  function setStore(store) {
    s.store = store; s.cart.clear(); s.quote = null; s.menu = {};
    $("shop-quote").hidden = true;
    $("shop-store-name").textContent = store.storeName || store.name || store.storeCode;
    notice("已选择门店：" + (store.storeName || store.storeCode) + "；可以获取该门店的实时可售菜单。");
  }
  async function loadStores() {
    notice("正在查询官方门店……");
    const type = Number($("shop-type").value);
    s.type = type;
    let stores;
    try {
      if (type === 2) {
        const id = $("shop-address").value;
        if (!id) throw Error("请先查询并选择你的配送地址");
        s.addressId = id;
        stores = await rpc("delivery-query-stores", { addressId: id, beType: 2 });
      } else {
        const city = $("shop-city").value.trim(), keyword = $("shop-keyword").value.trim();
        if (!city || !keyword) throw Error("请输入城市和位置关键词");
        stores = await rpc("query-nearby-stores", { searchType: 2, beType: 1, city, keyword });
      }
      s.stores = Array.isArray(stores) ? stores : (stores.stores || stores.storeList || []);
      const root = $("shop-stores");
      clearNode(root);
      if (!s.stores.length) return notice("官方服务没有返回符合条件的门店，请调整城市或地址");
      s.stores.forEach(store => {
        const button = create("button", "shop-item", store.storeName || store.name || store.storeCode);
        button.type = "button";
        button.addEventListener("click", () => setStore(store));
        root.append(button);
      });
      notice("官方返回 " + s.stores.length + " 家门店，请选择后查询完整可售菜单。");
    } catch (err) { notice(err.message); }
  }
  async function loadAddresses() {
    try {
      const data = await rpc("delivery-query-addresses");
      const list = Array.isArray(data) ? data : (data.addresses || []);
      s.addresses = list;
      const select = $("shop-address");
      clearNode(select);
      select.append(new Option("选择已有配送地址", ""));
      list.forEach(x => select.append(new Option(x.fullAddress || x.address || "配送地址", x.addressId)));
      notice("已查询到 " + list.length + " 个已有官方配送地址；不会在本站保存地址。");
    } catch (err) { notice(err.message); }
  }
  async function loadMenu() {
    if (!s.store) return notice("请先选择门店");
    notice("正在读取该门店、该取餐方式下的实时菜单……");
    try {
      const data = await rpc("query-meals", {
        storeCode: s.store.storeCode, beCode: s.store.beCode,
        orderType: s.type === 1 ? 1 : 2, beType: s.type
      });
      s.menu = data.meals || {};
      const root = $("shop-menu");
      clearNode(root);
      if (!Object.keys(s.menu).length) return notice("官方门店当前没有返回可售商品");
      const categories = Array.isArray(data.categories) ? data.categories : [];
      const categorized = new Set();
      const showProduct = (code, item) => {
        const info = s.menu[code];
        if (!info) return;
        const row = create("div", "shop-product");
        const left = create("div");
        left.append(create("strong", "", info.name || code));
        left.append(create("small", "", code + " · 参考价 " + (info.currentPrice || "以官方报价为准")));
        if (item.tags?.length) left.append(create("small", "", item.tags.join(" · ")));
        const actions = create("div", "shop-actions");
        const details = create("button", "shop-item", "详情");
        details.type = "button";
        details.addEventListener("click", () => loadDetail(code));
        const add = create("button", "shop-item shop-primary", "加入清单 +");
        add.type = "button";
        add.addEventListener("click", () => {
          s.cart.set(code, Math.min(20, (s.cart.get(code) || 0) + 1));
          s.quote = null; $("shop-quote").hidden = true;
          renderCart();
        });
        actions.append(details, add);
        addHomeInspiration(actions, info.name || "");
        row.append(left, actions); root.append(row);
      };
      categories.forEach(category => {
        root.append(create("h3", "shop-category", category.name || "餐品"));
        (category.meals || []).forEach(item => {
          if (!item.code || categorized.has(item.code)) return;
          categorized.add(item.code); showProduct(item.code, item);
        });
      });
      Object.keys(s.menu).forEach(code => {
        if (!categorized.has(code)) showProduct(code, {});
      });
      notice("已获取官方门店实时菜单，共 " + Object.keys(s.menu).length + " 款商品，价格与库存以最终官方报价为准。");
    } catch (err) { notice(err.message); }
  }
  async function loadDetail(code) {
    try {
      const data = await rpc("query-meal-detail", {
        code, storeCode: s.store.storeCode, beCode: s.store.beCode,
        orderType: s.type === 1 ? 1 : 2, beType: s.type
      });
      const details = $("shop-detail"); clearNode(details);
      details.append(create("strong", "", productName(code) + " · 官方套餐组成"));
      (data.rounds || []).forEach(round => {
        const row = create("p", "", round.name + "：" + (round.choices || []).map(x => x.name).join("、"));
        details.append(row);
      });
      if (!data.rounds?.length) details.append(create("p", "", "此商品没有返回可展开的套餐组成信息。"));
      details.hidden = false;
      details.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) { notice(err.message); }
  }
  function renderCart() {
    const root = $("shop-cart"); clearNode(root);
    s.cart.forEach((quantity, code) => {
      const row = create("div", "shop-product");
      row.append(create("span", "", productName(code) + " × " + quantity));
      const remove = create("button", "shop-item", "减 1");
      remove.type = "button";
      remove.addEventListener("click", () => {
        if (quantity <= 1) s.cart.delete(code); else s.cart.set(code, quantity - 1);
        s.quote = null; $("shop-quote").hidden = true; renderCart();
      });
      row.append(remove); root.append(row);
    });
    if (!s.cart.size) root.append(create("p", "", "还没有选购商品"));
  }
  function cartArgs() {
    if (!s.store || !s.cart.size) throw Error("请选择门店并添加商品");
    return {
      storeCode: String(s.store.storeCode), beCode: String(s.store.beCode),
      beType: s.type, orderType: s.type === 1 ? 1 : 2,
      items: [...s.cart.entries()].map(([productCode, quantity]) => ({ productCode, quantity }))
    };
  }
  async function quote() {
    try {
      const args = cartArgs();
      notice("正在向官方 MCP 询价……");
      const data = await rpc("calculate-price", args);
      if (!Number.isInteger(data.price) || data.price < 0) throw Error("官方未返回有效人民币分价格");
      s.quote = data; s.quoteArgs = args;
      $("shop-price").textContent = money(data.price);
      $("shop-quote").hidden = false;
      $("shop-confirm").checked = false;
      $("shop-payment").replaceChildren();
      $("shop-submit").disabled = false;
      const select = $("shop-takeway"); clearNode(select);
      select.append(new Option("请选择报价中的取餐方式", ""));
      if (s.type === 1) {
        (data.takeWayList || []).forEach(item => {
          const value = item.takeWayCode || item.code;
          if (value) select.append(new Option(item.takeWayName || item.name || value, value));
        });
        $("shop-takeway-row").hidden = false;
      } else {
        $("shop-takeway-row").hidden = true;
      }
      notice("报价来自官方 MCP；请核对门店、数量、总额和取餐方式后再确认下单。");
    } catch (err) { notice(err.message); }
  }
  async function submit() {
    if (!s.quote || !s.quoteArgs || !$("shop-confirm").checked)
      return notice("请先获取报价并勾选明确确认条款");
    const { orderType: ignoredOrderType, ...args } = s.quoteArgs;
    if (s.type === 1) {
      args.takeWayCode = $("shop-takeway").value;
      if (!args.takeWayCode) return notice("官方价格接口未提供取餐方式或你尚未选择，无法安全提交。");
    } else {
      args.addressId = s.addressId;
      if (!args.addressId) return notice("请选择官方配送地址");
    }
    if (!window.confirm("确认创建真实麦当劳订单？门店：" + $("shop-store-name").textContent +
      "\n应付金额：" + money(s.quote.price) +
      "\n创建后将由官方返回支付链接，本站不会代你支付。")) return;
    $("shop-submit").disabled = true;
    notice("正在重新核对官方价格并提交真实订单，请勿重复点击……");
    try {
      let result;
      if (s.mode === "local") {
        const response = await fetch("/api/mcp/checkout", {
          method: "POST", cache: "no-store", credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: s.token, args, confirmed: true, expected_price_cents: s.quote.price
          })
        });
        if (!response.ok) throw Error("Rust 安全下单未完成：" + response.status + "（可能价格变化，请重新询价）");
        result = officialData(await response.json());
      } else {
        const newQuote = await rpc("calculate-price", s.quoteArgs);
        if (newQuote.price !== s.quote.price) throw Error("官方价格已发生变化，请重新询价");
        result = await rpc("create-order", args);
      }
      s.quote = null;
      $("shop-quote").hidden = true;
      const root = $("shop-payment");
      clearNode(root);
      root.append(create("strong", "", "官方订单已创建：" + (result.orderId || "请在官方服务核查订单号")));
      const link = safeHttpPay(result.payH5Url);
      if (link) {
        const a = create("a", "shop-item shop-primary", "打开麦当劳官方支付页面 ↗");
        a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer";
        root.append(a);
      }
      notice("已收到官方创建订单响应，支付需由你在麦当劳官方页面自行完成。");
    } catch (err) {
      notice("未确认订单成功：" + err.message + "。请先到麦当劳官方账号查询订单，避免重复下单。");
    } finally {
      $("shop-submit").disabled = true; // no automatic repeated submissions
    }
  }
  async function catalog() {
    const root = $("nutrition-products");
    try {
      const response = await fetch("catalog/nutrition.json", { cache: "no-store" });
      if (!response.ok) throw Error("暂无已发布的官方营养快照");
      const data = await response.json();
      if (data.source !== "McDonald's China official MCP: list-nutrition-foods")
        throw Error("来源标记与官方 MCP 不一致");
      const products = data.products || [];
      $("nutrition-meta").textContent = "麦当劳中国官方 MCP · " + products.length +
        " 款常见餐品 · 更新时间 " + new Date(data.generatedAt).toLocaleString("zh-CN") +
        "（营养参考，不代表门店现售清单）";
      const render = () => {
        const query = $("nutrition-search").value.trim().toLowerCase();
        clearNode(root);
        const filtered = products.filter(p => p.name.toLowerCase().includes(query));
        filtered.forEach(p => {
          const card = create("div", "shop-product");
          const info = create("div");
          info.append(create("strong", "", p.name));
          info.append(create("small", "", [
            p.energyKcal == null ? null : p.energyKcal + " kcal",
            p.protein == null ? null : "蛋白质 " + p.protein + " g",
            p.fat == null ? null : "脂肪 " + p.fat + " g",
            p.sodium == null ? null : "钠 " + p.sodium + " mg"
          ].filter(Boolean).join(" · ")));
          card.append(info);
          addHomeInspiration(card, p.name);
          root.append(card);
        });
        if (!filtered.length) root.append(create("p", "", "暂无符合条件的官方营养条目。"));
      };
      $("nutrition-search").addEventListener("input", render);
      render();
    } catch (err) {
      $("nutrition-meta").textContent = err.message + "。可在本机启动 Rust 服务，通过个人 Token 查询最新数据。";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    catalog();
    $("shop-connect").addEventListener("submit", connect);
    $("shop-disconnect").addEventListener("click", disconnect);
    $("shop-type").addEventListener("change", event => {
      s.type = Number(event.target.value);
      $("shop-location-row").hidden = s.type === 2;
      $("shop-address-row").hidden = s.type !== 2;
      s.store = null; s.cart.clear(); s.quote = null;
      clearNode($("shop-menu")); clearNode($("shop-cart")); clearNode($("shop-stores"));
      $("shop-quote").hidden = true;
    });
    $("shop-addresses-load").addEventListener("click", loadAddresses);
    $("shop-stores-load").addEventListener("click", loadStores);
    $("shop-menu-load").addEventListener("click", loadMenu);
    $("shop-price-load").addEventListener("click", quote);
    $("shop-submit").addEventListener("click", submit);
  });
})();
