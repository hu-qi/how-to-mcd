"use strict";

// UI-only interactions live in the browser. All recipe data and ingredient
// scaling come from the Rust HTTP API; the MCP token stays on the Rust host.
const state = {
  recipes: [], selected: null, servings: 2, filter: "all", query: "",
  checked: new Set(), requestId: 0, step: 0,
  seconds: 300, timerId: null, timerDeadline: null,
};

const byId = (id) => document.getElementById(id);
const emojiFor = (id) => ({ "chicken-burger": "🍔", "crispy-fries": "🍟", "chicken-nuggets": "🍗", "beef-burger": "🧀", "fish-sandwich": "🐟", "breakfast-muffin": "🍳", "apple-turnover": "🥧", "chicken-wings": "🍗", "chicken-wrap": "🌯", "potato-hashbrown": "🥔", "steamed-corn": "🌽", "ice-cream-sundae": "🍦", "milk-latte": "☕", "hot-cocoa": "🍫", "oat-cookies": "🍪", "breakfast-porridge": "🍚", "garden-salad": "🥗", "fruit-tea": "🍹", "fruit-milkshake": "🥤", "sparkling-lemonade": "🍋", "vegetable-soup": "🥣", "drip-coffee": "☕", "banana-pancake": "🥞" }[id] || "🍽️");
const toneFor = (id) => ({ "chicken-burger": "tone-one", "crispy-fries": "tone-two", "chicken-nuggets": "tone-three", "beef-burger": "tone-two", "fish-sandwich": "tone-one", "breakfast-muffin": "tone-three", "apple-turnover": "tone-two", "chicken-wings": "tone-one", "chicken-wrap": "tone-two", "potato-hashbrown": "tone-three", "steamed-corn": "tone-one", "ice-cream-sundae": "tone-two", "milk-latte": "tone-three", "hot-cocoa": "tone-one", "oat-cookies": "tone-two", "breakfast-porridge": "tone-three", "garden-salad": "tone-one", "fruit-tea": "tone-two", "fruit-milkshake": "tone-three", "sparkling-lemonade": "tone-one", "vegetable-soup": "tone-two", "drip-coffee": "tone-three", "banana-pancake": "tone-one" }[id] || "tone-one");
const showMessage = (message) => { byId("mcp-feedback").textContent = message; };
const formatAmount = (n) => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));

async function api(path) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    let description = `HTTP ${response.status}`;
    try { description += `：${(await response.text()).slice(0,120)}`; } catch (_) {}
    throw new Error(description);
  }
  return response.json();
}

// Native workbench uses the local Rust API. Public Pages preview loads
// identical Rust recipe logic compiled as WebAssembly, never a mock response.
let provider = null;

async function chooseProvider() {
  try {
    // GitHub Pages cannot host /api/*; skip an unavoidable misleading 404
    // and start the real Rust/WASM module directly on static hosting.
    if (location.hostname.endsWith(".github.io")) throw Error("static GitHub Pages");
    await api("/api/health");
    return {
      mode: "native",
      list: () => api("/api/recipes"),
      detail: (id, servings) => api(`/api/recipes/${encodeURIComponent(id)}?servings=${servings}`),
      suggest: (ingredients) => api(`/api/suggestions?ingredients=${encodeURIComponent(ingredients)}`),
    };
  } catch (_) {
    const url = new URL("pkg/howtomcd_wasm.js", document.baseURI);
    const wasm = await import(url.href);
    await wasm.default();
    return {
      mode: "wasm",
      list: async () => JSON.parse(wasm.recipes_json()),
      detail: async (id, servings) => JSON.parse(wasm.recipe_json(id, servings)),
      suggest: async (ingredients) => JSON.parse(wasm.suggestions_json(ingredients)),
    };
  }
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function filteredRecipes() {
  const query = state.query.trim().toLocaleLowerCase();
  return state.recipes.filter((recipe) => {
    const hasEquipment = state.filter === "all" || recipe.equipment.some((item) => item.includes(state.filter));
    const hasText = !query || [recipe.name, recipe.summary, ...recipe.equipment, ...recipe.ingredients.map((i) => i.name)]
      .join(" ").toLocaleLowerCase().includes(query);
    return hasEquipment && hasText;
  });
}

function renderCards() {
  const grid = byId("recipe-grid");
  grid.replaceChildren();
  const recipes = filteredRecipes();
  if (!recipes.length) {
    grid.append(make("div", "loading-card", "没有匹配的食谱，试试其他关键词或厨具。"));
    return;
  }
  recipes.forEach((recipe, index) => {
    const button = make("button", "recipe-card");
    button.type = "button";
    if (state.selected && state.selected.recipe.id === recipe.id) button.classList.add("selected");
    button.setAttribute("aria-label", `选择食谱：${recipe.name}`);
    button.dataset.recipeId = recipe.id;

    const art = make("div", `recipe-art ${toneFor(recipe.id)}`);
    art.append(make("span", "recipe-art-tag", "RECIPE / " + String(index + 1).padStart(2, "0")));
    art.append(make("span", "recipe-art-emoji", emojiFor(recipe.id)));

    const body = make("div", "recipe-card-body");
    body.append(make("h3", "", recipe.name));
    body.append(make("p", "", recipe.summary));
    const meta = make("div", "card-meta");
    meta.append(make("span", "", `◷ ${recipe.minutes} 分钟`));
    meta.append(make("span", "", `♙ ${recipe.servings} 人份`));
    meta.append(make("span", "", "查看做法 →"));
    body.append(meta);
    button.append(art, body);
    button.addEventListener("click", () => chooseRecipe(recipe.id, true));
    grid.append(button);
  });
}

function updateProgress() {
  const count = state.selected ? state.selected.ingredients.length : 0;
  byId("ingredient-progress").textContent = `${state.checked.size} / ${count} 已备齐`;
}

function renderIngredients() {
  const list = byId("ingredients-list");
  list.replaceChildren();
  if (!state.selected) return;
  state.selected.ingredients.forEach((ingredient, index) => {
    const label = make("label", "ingredient-item");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.checked.has(index);
    if (checkbox.checked) label.classList.add("checked");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.checked.add(index);
      else state.checked.delete(index);
      label.classList.toggle("checked", checkbox.checked);
      updateProgress();
    });
    label.append(checkbox);
    label.append(make("span", "ingredient-name", ingredient.name));
    label.append(make("span", "ingredient-amount", `${formatAmount(ingredient.amount)} ${ingredient.unit}`));
    list.append(label);
  });
  updateProgress();
}

function renderSelected() {
  const view = state.selected;
  if (!view) return;
  byId("bench-empty").hidden = true;
  byId("bench-content").hidden = false;
  byId("selected-title").textContent = view.recipe.name;
  byId("selected-summary").textContent = view.recipe.summary;
  byId("selected-emoji").textContent = emojiFor(view.recipe.id);
  byId("time-info").textContent = `⏱ 预计 ${view.recipe.minutes} 分钟`;
  byId("equip-info").textContent = "♧ " + view.recipe.equipment.join(" / ");
  byId("serving-value").textContent = String(state.servings);
  byId("decrease").disabled = state.servings <= 1;
  byId("increase").disabled = state.servings >= 20;
  byId("safety-list").replaceChildren(
    ...view.recipe.safety.map((message) => make("li", "", message))
  );
  renderIngredients();
  renderCards();
}

async function chooseRecipe(id, scroll = false) {
  const recipe = state.recipes.find((item) => item.id === id);
  if (!recipe) return;
  const request = ++state.requestId;
  const servings = state.selected && state.selected.recipe.id === id ? state.servings : recipe.servings;
  try {
    const view = await provider.detail(id, servings);
    if (request !== state.requestId) return;
    const changed = !state.selected || state.selected.recipe.id !== id;
    state.selected = view;
    state.servings = servings;
    if (changed) state.checked.clear();
    renderSelected();
    if (scroll) byId("workbench").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    byId("bench-empty").hidden = false;
    byId("bench-content").hidden = true;
    byId("bench-empty").querySelector("p").textContent = "加载食谱失败：" + error.message;
  }
}

async function changeServings(delta) {
  if (!state.selected) return;
  const next = Math.max(1, Math.min(20, state.servings + delta));
  if (next === state.servings) return;
  state.servings = next;
  await chooseRecipe(state.selected.recipe.id);
}

async function copyShoppingList() {
  if (!state.selected) return;
  const view = state.selected;
  const lines = [
    `【HowToMCD 食材清单】${view.recipe.name} · ${view.requested_servings} 人份`,
    ...view.ingredients.map((item) => `□ ${item.name}：${formatAmount(item.amount)} ${item.unit}`),
    "社区原创家庭食谱，非任何餐厅的官方配方。"
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    const button = byId("copy-list");
    button.textContent = "已复制 ✓";
    window.setTimeout(() => { button.textContent = "复制采购清单"; }, 2000);
  } catch (_) {
    window.prompt("复制下面的采购清单：", lines.join("\n"));
  }
}

function stopTimer() {
  if (state.timerId !== null) clearInterval(state.timerId);
  state.timerId = null;
  state.timerDeadline = null;
  byId("timer-toggle").textContent = "开始计时";
}

function updateTimerDisplay() {
  const m = String(Math.floor(state.seconds / 60)).padStart(2, "0");
  const s = String(state.seconds % 60).padStart(2, "0");
  byId("timer-display").textContent = `${m}:${s}`;
}

function setTimer(minutes) {
  stopTimer();
  state.seconds = minutes * 60;
  updateTimerDisplay();
}

function toggleTimer() {
  if (state.timerId !== null) {
    if (state.timerDeadline) state.seconds = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
    stopTimer();
    updateTimerDisplay();
    return;
  }
  if (state.seconds === 0) state.seconds = 300;
  state.timerDeadline = Date.now() + state.seconds * 1000;
  byId("timer-toggle").textContent = "暂停计时";
  state.timerId = window.setInterval(() => {
    state.seconds = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
    updateTimerDisplay();
    if (state.seconds === 0) {
      stopTimer();
      byId("timer-toggle").textContent = "计时结束 · 重新开始";
    }
  }, 250);
}

function renderStep() {
  if (!state.selected) return;
  const steps = state.selected.recipe.steps;
  byId("cook-counter").textContent = `STEP ${String(state.step + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
  byId("cook-title").textContent = state.selected.recipe.name;
  byId("cook-step").textContent = steps[state.step];
  byId("cook-prev").disabled = state.step === 0;
  byId("cook-next").textContent = state.step === steps.length - 1 ? "完成烹饪 ✓" : "下一步 →";
  const dots = byId("cook-dots");
  dots.replaceChildren();
  steps.forEach((_, index) => {
    const dot = make("span", index === state.step ? "current" : "");
    dots.append(dot);
  });
}

function openCooking() {
  if (!state.selected) return;
  state.step = 0;
  setTimer(5);
  renderStep();
  byId("cook-dialog").showModal();
}

function nextStep(direction) {
  if (!state.selected) return;
  const limit = state.selected.recipe.steps.length - 1;
  if (direction === 1 && state.step === limit) {
    byId("cook-dialog").close();
    return;
  }
  state.step = Math.max(0, Math.min(limit, state.step + direction));
  setTimer(5);
  renderStep();
}

async function matchPantry(event) {
  event.preventDefault();
  const query = byId("pantry-input").value.trim();
  const results = byId("pantry-results");
  if (!query) {
    results.hidden = false;
    results.replaceChildren(make("p", "pantry-result-empty", "请先输入至少一种食材。"));
    return;
  }
  results.hidden = false;
  results.replaceChildren(make("p", "pantry-result-empty", "Rust 正在匹配食谱…"));
  try {
    const matches = await provider.suggest(query);
    results.replaceChildren();
    for (const match of matches.slice(0, 3)) {
      const button = make("button", "pantry-result");
      button.type = "button";
      button.setAttribute("aria-label", `查看匹配食谱：${match.name}`);
      button.append(make("strong", "", match.name));
      button.append(make("span", "pantry-percent", match.score_percent + "%"));
      button.append(make("small", "", `已具备 ${match.matched_count}/${match.total_count} 种食材`));
      button.append(make("small", "", match.missing.length
        ? "仍需准备：" + match.missing.join("、")
        : "食材清单已齐全，请再核实用量。"));
      button.append(make("small", "pantry-next", "查看食谱 →"));
      button.addEventListener("click", () => chooseRecipe(match.id, true));
      results.append(button);
    }
    if (!matches.length) results.append(make("p", "pantry-result-empty", "没有找到可匹配的社区食谱。"));
  } catch (error) {
    results.replaceChildren(make("p", "pantry-result-empty", "匹配失败：" + error.message));
  }
}

let localNutritionConfigured = false;
async function initializeMcp() {
  const badge = byId("mcp-status");
  const button = byId("mcp-lookup");
  button.disabled = false; // The official public snapshot is available without a token.
  if (provider?.mode === "wasm") {
    badge.textContent = "官方快照可查";
    badge.classList.add("connected");
    showMessage("可直接查看官方营养快照；连接个人 MCP Token 后可实时刷新官方数据。");
    return;
  }
  try {
    const result = await api("/api/mcp/status");
    localNutritionConfigured = Boolean(result.configured);
    badge.textContent = localNutritionConfigured ? "本地官方 MCP 已连接" : "官方快照可查";
    badge.classList.toggle("connected", true);
    showMessage(localNutritionConfigured
      ? "本地 Rust 服务端已配置官方 MCP，可直接查询实时营养数据。"
      : "公开营养快照可直接查看；实时查询可连接下方个人 MCP Token。");
  } catch (_) {
    badge.textContent = "官方快照可查";
    showMessage("可以查看已发布的官方营养快照；个人 Token 可用于实时刷新。");
  }
}

async function lookupNutrition() {
  const button = byId("mcp-lookup");
  button.disabled = true;
  try {
    if (window.HowToMCDShop?.connected()) {
      showMessage("正在通过独立 Rust 网关实时查询官方营养数据……");
      const data = await window.HowToMCDShop.refreshNutrition();
      if (data) showMessage("官方 MCP 实时查询成功 · " + data.total +
        " 款营养记录，已更新下方的官方营养资料库。");
      else showMessage("请先连接个人 MCP Token，连接成功后即可实时查询。");
    } else if (provider?.mode === "native" && localNutritionConfigured) {
      showMessage("正在通过本地 Rust 服务实时请求官方 MCP……");
      const raw = await api("/api/mcp/nutrition");
      const parsed = window.HowToMCDNutrition?.extractRows(raw);
      if (!parsed) throw Error("官方营养解析器未加载");
      window.HowToMCDShop?.displayNutrition(parsed, "实时查询");
      showMessage("本地 Rust 官方 MCP 查询成功 · " + parsed.total + " 款营养记录。");
    } else {
      showMessage("这里展示的是麦当劳官方营养资料快照；实时查询请在下方连接个人 Token。");
    }
    document.querySelector(".nutrition-panel")?.scrollIntoView({
      behavior: "smooth", block: "start"
    });
  } catch (error) {
    showMessage("官方营养数据查询失败：" + error.message +
      "；已发布的官方快照仍可供查询。");
  } finally {
    button.disabled = false;
  }
}

async function start() {
  byId("pantry-form").addEventListener("submit", matchPantry);
  byId("recipe-search").addEventListener("input", (event) => { state.query = event.target.value; renderCards(); });
  document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((btn) => {
      btn.classList.toggle("active", btn === button);
      btn.setAttribute("aria-pressed", String(btn === button));
    });
    renderCards();
  }));
  byId("decrease").addEventListener("click", () => changeServings(-1));
  byId("increase").addEventListener("click", () => changeServings(1));
  byId("copy-list").addEventListener("click", copyShoppingList);
  byId("start-cooking").addEventListener("click", openCooking);
  byId("close-cooking").addEventListener("click", () => byId("cook-dialog").close());
  byId("cook-prev").addEventListener("click", () => nextStep(-1));
  byId("cook-next").addEventListener("click", () => nextStep(1));
  byId("cook-dialog").addEventListener("close", stopTimer);
  document.querySelectorAll(".timer-presets button").forEach((button) => button.addEventListener("click", () => setTimer(Number(button.dataset.minutes))));
  byId("timer-toggle").addEventListener("click", toggleTimer);
  byId("mcp-lookup").addEventListener("click", lookupNutrition);
  window.addEventListener("howtomcd:nutrition-updated", (event) => {
    showMessage("官方 MCP 实时营养查询成功 · " + event.detail.total +
      " 款记录，已更新官方营养资料库。");
    byId("mcp-status").textContent = "官方数据已刷新";
    byId("mcp-status").classList.add("connected");
  });

  try {
    provider = await chooseProvider();
    byId("rust-mode").textContent = provider.mode === "wasm" ? "RUST / WEBASSEMBLY" : "LOCAL RUST API";
    initializeMcp();
    state.recipes = await provider.list();
    byId("recipe-count").textContent = String(state.recipes.length);
    renderCards();
    if (state.recipes.length) await chooseRecipe(state.recipes[0].id, false);
  } catch (error) {
    byId("recipe-grid").replaceChildren(make("div", "loading-card", "Rust 食谱服务暂不可用：" + error.message));
  }
}

document.addEventListener("DOMContentLoaded", start);
