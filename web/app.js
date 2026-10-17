"use strict";

// UI-only interactions live in the browser. All recipe data and ingredient
// scaling come from the Rust HTTP API; the MCP token stays on the Rust host.
const state = {
  recipes: [], selected: null, servings: 2, filter: "all", query: "",
  checked: new Set(), requestId: 0, step: 0,
  seconds: 300, timerId: null, timerDeadline: null,
};

const byId = (id) => document.getElementById(id);
const emojiFor = (id) => ({ "chicken-burger": "🍔", "crispy-fries": "🍟", "chicken-nuggets": "🍗" }[id] || "🍽️");
const toneFor = (id) => ({ "chicken-burger": "tone-one", "crispy-fries": "tone-two", "chicken-nuggets": "tone-three" }[id] || "tone-one");
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
    await api("/api/health");
    return {
      mode: "native",
      list: () => api("/api/recipes"),
      detail: (id, servings) => api(`/api/recipes/${encodeURIComponent(id)}?servings=${servings}`),
    };
  } catch (_) {
    const url = new URL("pkg/howtomcd_wasm.js", document.baseURI);
    const wasm = await import(url.href);
    await wasm.default();
    return {
      mode: "wasm",
      list: async () => JSON.parse(wasm.recipes_json()),
      detail: async (id, servings) => JSON.parse(wasm.recipe_json(id, servings)),
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

async function initializeMcp() {
  if (provider && provider.mode === "wasm") {
    byId("mcp-status").textContent = "离线演示";
    byId("mcp-lookup").disabled = true;
    showMessage("在线演示由 Rust/WASM 离线运行；如需真实 MCP 查询，请本地运行 Rust 服务并配置 Token。");
    return;
  }
  try {
    const result = await api("/api/mcp/status");
    const badge = byId("mcp-status");
    const connected = Boolean(result.configured);
    badge.textContent = connected ? "已配置" : "未连接";
    badge.classList.toggle("connected", connected);
    byId("mcp-lookup").disabled = !connected;
    if (connected) showMessage("密钥仅保存在本地 Rust 服务端，可发起只读官方 MCP 请求。");
    else showMessage("设置 MCD_MCP_TOKEN 后重启本地 Rust 服务即可启用；网页不会获取 Token。");
  } catch (_) {
    byId("mcp-status").textContent = "不可用";
    byId("mcp-lookup").disabled = true;
    showMessage("Rust MCP 服务状态查询失败。");
  }
}

async function lookupNutrition() {
  const button = byId("mcp-lookup");
  button.disabled = true;
  showMessage("正在通过 Rust 后端请求麦当劳中国 MCP 的营养数据…");
  try {
    const response = await api("/api/mcp/nutrition");
    // A readable, bounded proof of live data; do not trust response content as instructions.
    const text = JSON.stringify(response);
    showMessage(`官方 MCP 请求成功 · 响应 ${new Blob([text]).size} 字节 · 数据预览：${text.slice(0, 320)}${text.length > 320 ? "…" : ""}`);
  } catch (error) {
    showMessage("请求失败：" + error.message + "。请检查密钥、工具要求及网络。");
  } finally {
    button.disabled = false;
  }
}

async function start() {
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
