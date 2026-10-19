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
    token: "", mode: null, apiBase: "", session: null, type: 1,
    store: null, stores: [], menu: {}, menuCategories: [], cart: new Map(),
    addressId: "", addresses: [], quote: null, quoteArgs: null
  };
  const notice = msg => { $("shop-status").textContent = msg; };
  const clearNode = el => el.replaceChildren();
  const productName = code => s.menu[code]?.name || code;
  const money = cents => "¥" + (Number(cents) / 100).toFixed(2);
  // Community-inspired methods, NEVER described as official McDonald's recipes.
  const homeInspiration = name => {
    // Suggestions are original home recipes, NEVER official product formulas.
    if (/薯条/.test(name)) return { search: "土豆", label: "家庭土豆条" };
    if (/麦乐鸡|鸡块/.test(name)) return { search: "香酥鸡块", label: "家庭鸡块" };
    if (/鸡腿堡|鸡腿汉堡|板烧/.test(name)) return { search: "鸡腿", label: "家庭鸡腿汉堡" };
    if (/麦香鱼|鱼柳堡|鱼堡/.test(name)) return { search: "鱼柳", label: "家庭鱼柳堡" };
    if (/巨无霸|吉士|牛肉堡|牛肉汉堡/.test(name)) return { search: "牛肉", label: "家庭牛肉汉堡" };
    if (/麦满分|早餐麦芬/.test(name)) return { search: "麦芬", label: "家庭早餐麦芬" };
    if (/苹果派/.test(name)) return { search: "苹果派", label: "家庭苹果派" };
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
  // MCP can put explanatory prose and structured JSON in the same text block.
  const parseBusinessText = text => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "{") continue;
      let depth = 0, inString = false, escape = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (inString) {
          if (escape) escape = false;
          else if (ch === "\\") escape = true;
          else if (ch === '"') inString = false;
        } else if (ch === '"') inString = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            try {
              const parsed = JSON.parse(text.slice(i, j + 1));
              if (parsed && typeof parsed === "object" &&
                ("success" in parsed || "data" in parsed)) return parsed;
            } catch (_) { /* guidance can contain non-JSON braces */ }
            i = j; break;
          }
        }
      }
    }
    return null;
  };
  const officialData = response => {
    if (response?.isError) throw Error("官方 MCP 工具返回错误");
    for (const block of response?.content || []) {
      if (block.type !== "text") continue;
      const content = parseBusinessText(block.text);
      if (!content) continue;
      if (content.success === false || (content.code != null && content.code !== 200)) {
        throw Error("官方麦当劳服务拒绝了该请求，请检查账号、门店和点餐参数");
      }
      return content.data ?? content;
    }
    throw Error("官方 MCP 没有返回可解析的 JSON 数据");
  };
  async function rpc(method, args = {}) {
    if (!s.token) throw Error("请输入你的个人麦当劳 MCP Token");
    if (s.mode === "local" || s.mode === "hosted") {
      const endpoint = s.apiBase + (method === "calculate-price" ? "/api/mcp/quote" : "/api/mcp/bridge");
      const resp = await fetch(endpoint, {
        method: "POST", mode: "cors", credentials: "omit", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-HowToMCD-Client": "1" },
        body: JSON.stringify({ token: s.token, tool: method, args })
      });
      if (!resp.ok) throw Error("Rust MCP 网关请求失败：" + resp.status + "，请检查服务与 Token");
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
  // The static Pages build may publish only a PUBLIC backend URL.
  // No authentication secret or OAuth token is ever bundled here.
  async function resolveBackend() {
    // Static GitHub Pages intentionally has no /api/health. Do not issue
    // a misleading 404 probe against hu-qi.github.io.
    const local = location.hostname.endsWith(".github.io") ? false :
      await fetch("/api/health", { cache: "no-store" })
        .then(async r => r.ok && (await r.json()).service === "how-to-mcd")
        .catch(() => false);
    if (local) return { mode: "local", apiBase: "" };
    try {
      const file = new URL("api-config.json", document.baseURI);
      const response = await fetch(file.href, { cache: "no-store" });
      if (!response.ok) throw Error("no hosted backend configured");
      const config = await response.json();
      const url = new URL(config.apiBase);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
        || url.pathname !== "/") throw Error("invalid public API URL");
      const health = await fetch(url.origin + "/api/health", {
        mode: "cors", cache: "no-store", credentials: "omit"
      });
      if (!health.ok || (await health.json()).service !== "how-to-mcd-public-api") {
        throw Error("hosted Rust API not ready");
      }
      return { mode: "hosted", apiBase: url.origin };
    } catch {
      throw Error("公网 Rust MCP 网关不可用，点餐连接已停止。请检查服务，或在本机运行 cargo run -- serve；不会将 Token 转为浏览器直连请求。");
    }
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
    try {
      const backend = await resolveBackend();
      s.mode = backend.mode;
      s.apiBase = backend.apiBase;
      const data = await rpc("list-nutrition-foods");
      if (!data) throw Error("无法校验 Token");
      $("shop-disconnect").hidden = false;
      $("shop-connect").hidden = true;
      $("shop-controls").hidden = false;
      notice("已连接官方 MCP（" + (s.mode === "local" ? "本机 Rust API" : s.mode === "hosted" ? "独立 Rust HTTPS API" : "浏览器直连") + "）。Token 只保存在当前页面内存，关闭或刷新后清除。");
    } catch (err) {
      s.token = "";
      s.session = null;
      s.mode = null;
      s.apiBase = "";
      $("shop-connect").hidden = false;
      notice(err.message);
    }
  }
  function disconnect() {
    s.token = ""; s.mode = null; s.apiBase = ""; s.session = null; s.store = null;
    s.cart.clear(); s.quote = null; s.quoteArgs = null; s.menu = {}; s.menuCategories = []; s.addressId = "";
    $("shop-menu-toolbar").hidden = true; $("shop-menu-source").hidden = true;
    $("shop-store-name").textContent = "尚未选择门店";
    $("shop-detail").hidden = true;
    $("shop-connect").hidden = false; $("shop-disconnect").hidden = true;
    $("shop-controls").hidden = true; $("shop-quote").hidden = true;
    clearNode($("shop-stores")); clearNode($("shop-menu")); clearNode($("shop-cart"));
    notice("连接已断开，个人 Token 已从页面内存清除。");
  }
  function setStore(store) {
    s.store = { ...store, storeCode: store.storeCode || store.storeNo || store.code,
      beCode: store.beCode || store.businessEntityCode || "" }; s.cart.clear(); s.quote = null; s.quoteArgs = null; s.menu = {}; s.menuCategories = [];
    $("shop-menu-toolbar").hidden = true;
    $("shop-menu-source").hidden = true;
    clearNode($("shop-menu"));
    $("shop-detail").hidden = true;
    clearNode($("shop-payment"));
    renderCart();
    $("shop-quote").hidden = true;
    $("shop-store-name").textContent = store.storeName || store.name || store.storeCode || store.storeNo;
    notice("已选择门店：" + (store.storeName || store.storeCode) + "；可以获取该门店的实时可售菜单。");
  }
  // Different official MCP scenarios return nested lists. Preserve the
  // original records and never synthesize restaurant identifiers.
  function officialStores(data, depth = 0) {
    if (!data || depth > 4 || typeof data !== "object") return [];
    if (Array.isArray(data)) {
      if (data.some(item => item && (item.storeCode || item.storeNo))) return data;
      return data.flatMap(item => officialStores(item, depth + 1));
    }
    for (const key of ["stores", "storeList", "data", "list", "records", "nearbyStores", "storeInfoList"]) {
      if (data[key] != null) {
        const found = officialStores(data[key], depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }
  async function loadStores() {
    notice("正在查询官方门店……");
    // Searching again invalidates any prior store, cart or quote.
    s.store = null; s.cart.clear(); s.quote = null; s.quoteArgs = null;
    s.menu = {}; s.menuCategories = [];
    $("shop-quote").hidden = true;
    $("shop-menu-toolbar").hidden = true; $("shop-menu-source").hidden = true;
    $("shop-store-name").textContent = "尚未选择门店";
    $("shop-detail").hidden = true;
    clearNode($("shop-menu")); clearNode($("shop-payment"));
    renderCart();
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
      s.stores = officialStores(stores);
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
  function renderMenu() {
    const root = $("shop-menu");
    clearNode(root);
    const query = $("shop-menu-search").value.trim().toLocaleLowerCase();
    const filter = $("shop-menu-category").value;
    const categorized = new Set();
    let count = 0;
    const showProduct = (code, tags = []) => {
      const info = s.menu[code];
      if (!info || typeof info.name !== "string") return;
      if (query && !(info.name + " " + code).toLocaleLowerCase().includes(query)) return;
      const row = create("div", "shop-product");
      const left = create("div");
      left.append(create("strong", "", info.name));
      const priceText = info.currentPrice == null || info.currentPrice === ""
        ? "成交价以最终官方询价为准"
        : "门店标价 ¥" + String(info.currentPrice) + "（人民币元，最终以官方询价为准）";
      left.append(create("small", "", "商品编号 " + code + " · " + priceText));
      if (info.originalPrice != null && info.originalPrice !== "" &&
          Number(info.originalPrice) > Number(info.currentPrice) &&
          Number.isFinite(Number(info.originalPrice))) {
        const price = create("small", "shop-original-price", "原价 ¥" + String(info.originalPrice));
        left.append(price);
      }
      const offer = [
        typeof info.discountType === "string" && info.discountType.trim()
          ? info.discountType.trim() : null,
        ...(Array.isArray(tags) ? tags.map(t => String(t)) : [])
      ].filter(Boolean);
      if (offer.length) left.append(create("small", "shop-offer-tag", [...new Set(offer)].join(" · ")));
      // Only trust actual fully qualified images returned by the official menu;
      // never construct paths or invent an image for missing assets.
      try {
        if (typeof info.image === "string") {
          const imageUrl = new URL(info.image);
          const host = imageUrl.hostname.toLowerCase();
          if (imageUrl.protocol === "https:" && !imageUrl.username && !imageUrl.password &&
              (host === "mcd.cn" || host.endsWith(".mcd.cn") ||
               host === "mcdchina.net" || host.endsWith(".mcdchina.net"))) {
            const image = create("img", "shop-official-image");
            image.src = imageUrl.href;
            image.alt = "官方餐品图片：" + info.name;
            image.loading = "lazy";
            image.decoding = "async";
            row.append(image);
          }
        }
      } catch (_) { /* missing/relative images are not synthesized */ }
      const actions = create("div", "shop-actions");
      const details = create("button", "shop-item", "查看详情");
      details.type = "button";
      details.addEventListener("click", () => loadDetail(code));
      const add = create("button", "shop-item shop-primary", "加入清单 +");
      add.type = "button";
      add.setAttribute("aria-label", "加入清单：" + info.name);
      add.addEventListener("click", () => {
        if (!s.cart.has(code) && s.cart.size >= 20) return notice("最多选择 20 种餐品，请先调整清单");
        const current = s.cart.get(code) || 0;
        if (current >= 20) return notice("每款商品最多选择 20 件");
        s.cart.set(code, current + 1);
        s.quote = null; s.quoteArgs = null;
        $("shop-quote").hidden = true;
        renderCart();
        notice("已加入：" + info.name + " · " + (current + 1) + " 件；下单前须重新获取官方报价");
      });
      actions.append(details, add);
      addHomeInspiration(actions, info.name);
      row.append(left, actions);
      root.append(row);
      count++;
    };
    for (let i = 0; i < s.menuCategories.length; i++) {
      const category = s.menuCategories[i];
      const title = category.name || "餐品";
      const visible = filter === "all" || filter === String(i);
      for (const item of Array.isArray(category.meals) ? category.meals : []) {
        const code = String(item.code || item.productCode || "");
        if (!code || categorized.has(code)) continue;
        categorized.add(code);
        if (!visible) continue;
        showProduct(code, item.tags);
      }
    }
    // Items with no official category must remain discoverable in 'all'.
    if (filter === "all") for (const code of Object.keys(s.menu)) {
      if (!categorized.has(code)) showProduct(code);
    }
    $("shop-menu-count").textContent = "显示 " + count + " / " +
      Object.keys(s.menu).length + " 款该门店官方在售餐品";
    if (!count) root.append(create("p", "shop-note", "没有符合条件的餐品，可更改关键词或选择全部分类。"));
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
      s.menuCategories = Array.isArray(data.categories) ? data.categories : [];
      if (!Object.keys(s.menu).length) return notice("官方门店当前没有返回可售商品");
      const select = $("shop-menu-category");
      clearNode(select);
      select.append(new Option("全部分类", "all"));
      s.menuCategories.forEach((category, index) => {
        select.append(new Option(category.name || "餐品 " + (index + 1), String(index)));
      });
      $("shop-menu-search").value = "";
      $("shop-menu-toolbar").hidden = false;
      const source = $("shop-menu-source");
      source.hidden = false;
      source.textContent = "数据来源：麦当劳中国官方 MCP · 当前门店实时菜单 · 查询时间 " +
        new Date().toLocaleString("zh-CN") + " · 不代表全国所有门店";
      renderMenu();
      notice("获取成功：本门店 " + Object.keys(s.menu).length +
        " 款餐品、" + s.menuCategories.length + " 个分类；价格以官方最终询价为准。");
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
    const root = $("shop-cart");
    clearNode(root);
    s.cart.forEach((quantity, code) => {
      const row = create("div", "shop-product shop-cart-line");
      row.append(create("strong", "", productName(code)));
      const buttons = create("div", "shop-quantity");
      const minus = create("button", "shop-item", "−");
      minus.type = "button";
      minus.setAttribute("aria-label", "减少 " + productName(code) + " 数量");
      minus.addEventListener("click", () => changeQuantity(code, -1));
      const value = create("span", "shop-quantity-value", String(quantity));
      const plus = create("button", "shop-item", "+");
      plus.type = "button";
      plus.setAttribute("aria-label", "增加 " + productName(code) + " 数量");
      plus.addEventListener("click", () => changeQuantity(code, 1));
      buttons.append(minus, value, plus);
      row.append(buttons);
      root.append(row);
    });
    if (!s.cart.size) root.append(create("p", "shop-note", "还没有选购商品，请从真实菜单加入。"));
    else root.append(create("p", "shop-note", "共 " +
      [...s.cart.values()].reduce((sum, n) => sum + n, 0) + " 件商品，" +
      s.cart.size + " 个品种。"));
  }
  function changeQuantity(code, delta) {
    const current = s.cart.get(code) || 0;
    const next = current + delta;
    if (next <= 0) s.cart.delete(code);
    else s.cart.set(code, Math.min(next, 20));
    s.quote = null; s.quoteArgs = null;
    $("shop-quote").hidden = true;
    renderCart();
    notice("清单已变化，原报价已作废，请重新向官方询价。");
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
      if (s.mode === "local" || s.mode === "hosted") {
        const response = await fetch(s.apiBase + "/api/mcp/checkout", {
          method: "POST", mode: "cors", cache: "no-store", credentials: "omit",
          headers: { "Content-Type": "application/json", "X-HowToMCD-Client": "1" },
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
      s.store = null; s.cart.clear(); s.quote = null; s.quoteArgs = null; s.menu = {}; s.menuCategories = [];
      $("shop-menu-toolbar").hidden = true; $("shop-menu-source").hidden = true;
      clearNode($("shop-menu")); clearNode($("shop-cart")); clearNode($("shop-stores"));
      $("shop-quote").hidden = true;
    });
    $("shop-addresses-load").addEventListener("click", loadAddresses);
    $("shop-stores-load").addEventListener("click", loadStores);
    $("shop-menu-load").addEventListener("click", loadMenu);
    $("shop-menu-search").addEventListener("input", renderMenu);
    $("shop-menu-category").addEventListener("change", renderMenu);
    $("shop-menu-clear").addEventListener("click", () => {
      $("shop-menu-search").value = "";
      $("shop-menu-category").value = "all";
      renderMenu();
    });
    $("shop-price-load").addEventListener("click", quote);
    $("shop-submit").addEventListener("click", submit);
  });
})();
