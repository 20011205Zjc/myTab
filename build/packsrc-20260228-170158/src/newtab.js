import {
  BACKGROUND_PRESETS,
  DEFAULT_CONFIG,
  SEARCH_ENGINES,
  getBackgroundPreset,
  migrateConfig
} from "./defaults.js";
import { loadConfig, saveConfig } from "./storage.js";
import { clamp, formatDateTime, getDomain, normalizeUrl, safeClone, uid } from "./utils.js";

const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const SEARCH_ENGINE_ICON_DOMAINS = {
  google: "google.com",
  bing: "bing.com",
  duckduckgo: "duckduckgo.com",
  baidu: "baidu.com",
  custom: "search"
};

const state = {
  config: null,
  editingLinkId: null,
  draggingLinkId: null,
  clockTimer: null,
  weatherTimer: null,
  backgroundTimer: null,
  statusResetTimer: null,
  weatherLoading: false
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => {
    console.error(error);
    setStatus(`初始化失败：${error.message}`, true);
  });
});

async function bootstrap() {
  cacheDom();
  populateSelectOptions();
  bindEvents();

  state.config = await loadConfig();
  hydrateSettingsForm();
  renderSearchSelectValue();
  renderAll();

  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", () => {
    if (state.config.theme.mode === "auto") {
      applyThemeAndBackground();
    }
  });

  setStatus("初始化完成");
}

function cacheDom() {
  el.dashboard = document.querySelector(".dashboard");
  el.clockDisplay = document.getElementById("clock");
  el.searchForm = document.getElementById("search-form");
  el.searchEngineSelect = document.getElementById("search-engine-select");
  el.searchEngineIcon = document.getElementById("search-engine-icon");
  el.searchInput = document.getElementById("search-input");
  el.settingsOpen = document.getElementById("settings-open");
  el.themeToggle = document.getElementById("theme-toggle");
  el.addLinkButton = document.getElementById("add-link-btn");
  el.quickLinksGrid = document.getElementById("quick-links-grid");
  el.statusText = document.getElementById("status-text");

  el.settingsPanel = document.getElementById("settings-panel");
  el.settingsOverlay = document.getElementById("settings-overlay");
  el.settingsClose = document.getElementById("settings-close");
  el.settingsCancelButton = document.getElementById("settings-cancel-btn");
  el.settingsForm = document.getElementById("settings-form");

  el.settingThemeMode = document.getElementById("setting-theme-mode");
  el.settingBackground = document.getElementById("setting-background");
  el.settingAutoRotate = document.getElementById("setting-auto-rotate");
  el.settingRotateMinutes = document.getElementById("setting-rotate-minutes");

  el.settingSearchEngine = document.getElementById("setting-search-engine");
  el.settingCustomSearch = document.getElementById("setting-custom-search");

  el.settingShowClock = document.getElementById("setting-show-clock");
  el.settingClock24h = document.getElementById("setting-clock-24h");
  el.settingLayoutMode = document.getElementById("setting-layout-mode");
  el.settingGridColumns = document.getElementById("setting-grid-columns");
  el.gridColumnsValue = document.getElementById("grid-columns-value");

  el.settingWeatherEnabled = document.getElementById("setting-weather-enabled");
  el.settingWeatherCity = document.getElementById("setting-weather-city");
  el.settingWeatherUnit = document.getElementById("setting-weather-unit");
  el.settingTodoEnabled = document.getElementById("setting-todo-enabled");

  el.exportConfigButton = document.getElementById("export-config-btn");
  el.importConfigButton = document.getElementById("import-config-btn");
  el.resetConfigButton = document.getElementById("reset-config-btn");
  el.importConfigInput = document.getElementById("import-config-input");

  el.linkModal = document.getElementById("link-modal");
  el.linkModalOverlay = document.getElementById("link-modal-overlay");
  el.linkModalTitle = document.getElementById("link-modal-title");
  el.linkModalClose = document.getElementById("link-modal-close");
  el.linkForm = document.getElementById("link-form");
  el.linkDeleteButton = document.getElementById("link-delete-btn");
  el.linkTitleInput = document.getElementById("link-title-input");
  el.linkUrlInput = document.getElementById("link-url-input");

  el.weatherWidget = document.getElementById("weather-widget");
  el.weatherStatus = document.getElementById("weather-status");
  el.weatherRefreshButton = document.getElementById("weather-refresh-btn");

  el.todoWidget = document.getElementById("todo-widget");
  el.todoForm = document.getElementById("todo-form");
  el.todoInput = document.getElementById("todo-input");
  el.todoList = document.getElementById("todo-list");
  el.todoProgress = document.getElementById("todo-progress");
}

function populateSelectOptions() {
  populateSearchEngineSelect(el.searchEngineSelect);
  populateSearchEngineSelect(el.settingSearchEngine);

  el.settingBackground.innerHTML = "";
  for (const preset of BACKGROUND_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    el.settingBackground.appendChild(option);
  }
}

function populateSearchEngineSelect(selectElement) {
  selectElement.innerHTML = "";
  for (const [key, value] of Object.entries(SEARCH_ENGINES)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = value.label;
    selectElement.appendChild(option);
  }
}

function bindEvents() {
  el.searchForm.addEventListener("submit", handleSearchSubmit);
  el.searchEngineSelect.addEventListener("change", handleQuickSearchEngineChange);
  el.settingsOpen.addEventListener("click", openSettings);
  el.settingsClose.addEventListener("click", closeSettings);
  el.settingsCancelButton.addEventListener("click", closeSettings);
  el.settingsOverlay.addEventListener("click", closeSettings);
  el.themeToggle.addEventListener("click", handleThemeToggle);

  el.settingsForm.addEventListener("submit", handleSettingsSubmit);
  el.settingSearchEngine.addEventListener("change", updateCustomSearchInputState);
  el.settingGridColumns.addEventListener("input", () => {
    el.gridColumnsValue.textContent = String(el.settingGridColumns.value);
  });

  el.addLinkButton.addEventListener("click", () => openLinkModal(null));
  el.linkModalClose.addEventListener("click", closeLinkModal);
  el.linkModalOverlay.addEventListener("click", closeLinkModal);
  el.linkForm.addEventListener("submit", handleLinkFormSubmit);
  el.linkDeleteButton.addEventListener("click", handleDeleteEditingLink);

  el.exportConfigButton.addEventListener("click", handleExportConfig);
  el.importConfigButton.addEventListener("click", () => el.importConfigInput.click());
  el.importConfigInput.addEventListener("change", handleImportConfig);
  el.resetConfigButton.addEventListener("click", handleResetConfig);

  el.weatherRefreshButton.addEventListener("click", () => {
    refreshWeather(true).catch((error) => {
      setStatus(`天气刷新失败：${error.message}`, true);
    });
  });

  el.todoForm.addEventListener("submit", handleAddTodo);
  el.todoList.addEventListener("click", handleTodoListClick);
  el.todoList.addEventListener("change", handleTodoListChange);

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function renderAll() {
  applyThemeAndBackground();
  applyLayout();
  renderClock();
  renderQuickLinks();
  renderTodoWidget();
  renderSearchSelectValue();

  configureBackgroundRotationTimer();
  configureClockTimer();
  configureWeatherTimer();
  renderWeatherWidget();
}

function applyThemeAndBackground() {
  const mode = resolveThemeMode(state.config.theme.mode);
  document.documentElement.dataset.theme = mode;

  const background = getBackgroundPreset(state.config.theme.backgroundValue);
  document.documentElement.style.setProperty("--bg-main", background.value);

  el.themeToggle.textContent = mode === "dark" ? "浅色" : "深色";
}

function resolveThemeMode(mode) {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function handleThemeToggle() {
  const currentMode = resolveThemeMode(state.config.theme.mode);
  state.config.theme.mode = currentMode === "dark" ? "light" : "dark";
  await persistConfig("主题已切换");
  applyThemeAndBackground();
}

function applyLayout() {
  el.dashboard.classList.toggle("layout-compact", state.config.ui.layout === "compact");
  el.dashboard.classList.toggle("layout-cozy", state.config.ui.layout !== "compact");
  el.quickLinksGrid.style.gridTemplateColumns = `repeat(${state.config.ui.gridColumns}, minmax(0, 1fr))`;
}

function renderClock() {
  const visible = state.config.ui.showClock && state.config.widgets.clock.enabled;
  el.clockDisplay.style.display = visible ? "block" : "none";
  if (visible) {
    renderClockText();
  }
}

function configureClockTimer() {
  if (state.clockTimer) {
    clearInterval(state.clockTimer);
  }
  if (!state.config.ui.showClock || !state.config.widgets.clock.enabled) {
    return;
  }
  renderClockText();
  state.clockTimer = window.setInterval(renderClockText, 1000);
}

function renderClockText() {
  el.clockDisplay.textContent = formatDateTime(new Date(), state.config.widgets.clock.format24h);
}

function renderSearchSelectValue() {
  el.searchEngineSelect.value = state.config.search.engine;
  updateSearchEngineIcon();
}

function handleSearchSubmit(event) {
  event.preventDefault();
  const keyword = el.searchInput.value.trim();
  if (!keyword) {
    setStatus("请输入关键词后再搜索");
    return;
  }
  window.location.assign(buildSearchUrl(state.config.search, keyword));
}

async function handleQuickSearchEngineChange() {
  state.config.search.engine = el.searchEngineSelect.value;
  renderSearchSelectValue();
  await persistConfig("已切换默认搜索引擎");
}

function updateSearchEngineIcon() {
  if (!el.searchEngineIcon) {
    return;
  }

  const engine = state.config.search.engine;
  let domain = SEARCH_ENGINE_ICON_DOMAINS[engine] || SEARCH_ENGINE_ICON_DOMAINS.google;
  if (engine === "custom") {
    domain = getDomainFromSearchTemplate(state.config.search.customUrlTemplate) || "search";
  }

  el.searchEngineIcon.src =
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(domain)}&sz=64`;
  el.searchEngineIcon.alt = `${SEARCH_ENGINES[engine]?.label || "搜索引擎"} icon`;
}

function getDomainFromSearchTemplate(template) {
  const value = String(template || "").trim();
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value.replace("{query}", "test"));
    return parsed.hostname || "";
  } catch (_error) {
    return "";
  }
}

function buildSearchUrl(searchConfig, keyword) {
  const encoded = encodeURIComponent(keyword);
  const engine = searchConfig.engine;
  let template =
    engine === "custom"
      ? searchConfig.customUrlTemplate
      : SEARCH_ENGINES[engine]?.template || SEARCH_ENGINES.google.template;
  template = String(template || "");
  if (!template.includes("{query}")) {
    template += template.includes("?") ? "&q={query}" : "?q={query}";
  }
  return template.replace("{query}", encoded);
}

function getSortedLinks() {
  return safeClone(state.config.quickLinks).sort((a, b) => a.order - b.order);
}

function renderQuickLinks() {
  el.quickLinksGrid.innerHTML = "";
  const links = getSortedLinks();

  for (const link of links) {
    const card = document.createElement("article");
    card.className = "quick-card";
    card.draggable = true;
    card.dataset.linkId = link.id;

    const icon = document.createElement("div");
    icon.className = "quick-icon";

    const image = document.createElement("img");
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.alt = "";
    image.src = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(
      link.url
    )}&sz=64`;
    image.addEventListener("error", () => {
      icon.textContent = link.title.slice(0, 1).toUpperCase();
      image.remove();
    });
    icon.appendChild(image);

    const info = document.createElement("div");
    info.className = "quick-info";

    const title = document.createElement("div");
    title.className = "quick-title";
    title.textContent = link.title;

    const url = document.createElement("p");
    url.className = "quick-domain";
    url.textContent = getDomain(link.url);

    info.appendChild(title);
    info.appendChild(url);

    const actions = document.createElement("div");
    actions.className = "quick-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn-edit";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openLinkModal(link.id);
    });

    actions.appendChild(editButton);
    card.append(icon, info, actions);

    card.addEventListener("click", () => {
      window.location.assign(link.url);
    });
    card.addEventListener("dragstart", handleCardDragStart);
    card.addEventListener("dragover", handleCardDragOver);
    card.addEventListener("dragleave", handleCardDragLeave);
    card.addEventListener("drop", handleCardDrop);
    card.addEventListener("dragend", handleCardDragEnd);

    el.quickLinksGrid.appendChild(card);
  }

  const addCard = document.createElement("article");
  addCard.className = "quick-card add-card";
  addCard.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    <span class="add-text">添加快捷方式</span>
  `;
  addCard.addEventListener("click", () => openLinkModal(null));
  el.quickLinksGrid.appendChild(addCard);
} 

function handleCardDragStart(event) {
  const card = event.currentTarget;
  state.draggingLinkId = card.dataset.linkId;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}

function handleCardDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
}

function handleCardDragLeave(event) {
  event.currentTarget.classList.remove("drag-over");
}

async function handleCardDrop(event) {
  event.preventDefault();
  const targetCard = event.currentTarget;
  targetCard.classList.remove("drag-over");
  const targetId = targetCard.dataset.linkId;
  await reorderQuickLinks(state.draggingLinkId, targetId);
}

function handleCardDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  state.draggingLinkId = null;
  for (const card of el.quickLinksGrid.querySelectorAll(".quick-card")) {
    card.classList.remove("drag-over");
  }
}

async function reorderQuickLinks(draggingId, targetId) {
  if (!draggingId || !targetId || draggingId === targetId) {
    return;
  }

  const links = getSortedLinks();
  const sourceIndex = links.findIndex((item) => item.id === draggingId);
  const targetIndex = links.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [moved] = links.splice(sourceIndex, 1);
  links.splice(targetIndex, 0, moved);
  links.forEach((item, index) => {
    item.order = index;
  });

  state.config.quickLinks = links;
  await persistConfig("快捷网站顺序已更新");
  renderQuickLinks();
}

function openSettings() {
  hydrateSettingsForm();
  el.settingsPanel.style.display = "grid";
  el.settingsOverlay.style.display = "block";
  el.settingsPanel.classList.add("is-open");
  el.settingsOverlay.classList.add("is-open");
  el.settingsPanel.setAttribute("aria-hidden", "false");
  el.settingsOverlay.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  el.settingsPanel.classList.remove("is-open");
  el.settingsOverlay.classList.remove("is-open");
  el.settingsPanel.setAttribute("aria-hidden", "true");
  el.settingsOverlay.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (!el.settingsPanel.classList.contains("is-open")) {
      el.settingsPanel.style.display = "none";
    }
    if (!el.settingsOverlay.classList.contains("is-open")) {
      el.settingsOverlay.style.display = "none";
    }
  }, 200);
}

function hydrateSettingsForm() {
  el.settingThemeMode.value = state.config.theme.mode;
  el.settingBackground.value = state.config.theme.backgroundValue;
  el.settingAutoRotate.checked = state.config.theme.autoRotate;
  el.settingRotateMinutes.value = String(state.config.theme.rotateMinutes);

  el.settingSearchEngine.value = state.config.search.engine;
  el.settingCustomSearch.value = state.config.search.customUrlTemplate;

  el.settingShowClock.checked = state.config.ui.showClock;
  el.settingClock24h.checked = state.config.widgets.clock.format24h;
  el.settingLayoutMode.value = state.config.ui.layout;
  el.settingGridColumns.value = String(state.config.ui.gridColumns);
  el.gridColumnsValue.textContent = String(state.config.ui.gridColumns);

  el.settingWeatherEnabled.checked = state.config.widgets.weather.enabled;
  el.settingWeatherCity.value = state.config.widgets.weather.city;
  el.settingWeatherUnit.value = state.config.widgets.weather.unit;
  el.settingTodoEnabled.checked = state.config.widgets.todo.enabled;

  updateCustomSearchInputState();
}

function updateCustomSearchInputState() {
  const isCustom = el.settingSearchEngine.value === "custom";
  el.settingCustomSearch.disabled = !isCustom;
  el.settingCustomSearch.style.opacity = isCustom ? "1" : "0.6";
}

async function handleSettingsSubmit(event) {
  event.preventDefault();

  const previousWeatherCity = state.config.widgets.weather.city;
  const previousWeatherUnit = state.config.widgets.weather.unit;

  state.config.theme.mode = el.settingThemeMode.value;
  state.config.theme.backgroundValue = el.settingBackground.value;
  state.config.theme.autoRotate = el.settingAutoRotate.checked;
  state.config.theme.rotateMinutes = clamp(Number(el.settingRotateMinutes.value) || 30, 1, 240);

  state.config.search.engine = el.settingSearchEngine.value;
  state.config.search.customUrlTemplate = String(el.settingCustomSearch.value || "").trim();
  if (
    state.config.search.engine === "custom" &&
    !state.config.search.customUrlTemplate.includes("{query}")
  ) {
    setStatus("自定义搜索模板必须包含 {query}", true);
    return;
  }

  state.config.ui.showClock = el.settingShowClock.checked;
  state.config.widgets.clock.format24h = el.settingClock24h.checked;
  state.config.ui.layout = el.settingLayoutMode.value === "compact" ? "compact" : "cozy";
  state.config.ui.gridColumns = clamp(Number(el.settingGridColumns.value) || 4, 2, 8);

  state.config.widgets.weather.enabled = el.settingWeatherEnabled.checked;
  state.config.widgets.weather.city = String(el.settingWeatherCity.value || "").trim();
  state.config.widgets.weather.unit = el.settingWeatherUnit.value === "F" ? "F" : "C";
  state.config.widgets.todo.enabled = el.settingTodoEnabled.checked;

  const weatherChanged =
    previousWeatherCity !== state.config.widgets.weather.city ||
    previousWeatherUnit !== state.config.widgets.weather.unit;
  if (weatherChanged) {
    state.config.widgets.weather.cache = null;
  }

  await persistConfig("设置已保存");
  closeSettings();
  renderAll();
}

function openLinkModal(linkId) {
  state.editingLinkId = linkId;
  if (linkId) {
    const link = state.config.quickLinks.find((item) => item.id === linkId);
    if (!link) {
      return;
    }
    el.linkModalTitle.textContent = "编辑快捷网站";
    el.linkTitleInput.value = link.title;
    el.linkUrlInput.value = link.url;
    el.linkDeleteButton.style.visibility = "visible";
  } else {
    el.linkModalTitle.textContent = "新增快捷网站";
    el.linkTitleInput.value = "";
    el.linkUrlInput.value = "";
    el.linkDeleteButton.style.visibility = "hidden";
  }

  el.linkModal.classList.add("is-open");
  el.linkModalOverlay.classList.add("is-open");
  el.linkModal.setAttribute("aria-hidden", "false");
  el.linkModalOverlay.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    el.linkTitleInput.focus();
  }, 0);
}

function closeLinkModal() {
  el.linkModal.classList.remove("is-open");
  el.linkModalOverlay.classList.remove("is-open");
  el.linkModal.setAttribute("aria-hidden", "true");
  el.linkModalOverlay.setAttribute("aria-hidden", "true");
  state.editingLinkId = null;
}

async function handleLinkFormSubmit(event) {
  event.preventDefault();

  const title = String(el.linkTitleInput.value || "").trim();
  const normalizedUrl = normalizeUrl(el.linkUrlInput.value);
  if (!title || !normalizedUrl) {
    setStatus("名称和网址都不能为空", true);
    return;
  }
  try {
    new URL(normalizedUrl);
  } catch (_err) {
    setStatus("网址格式不正确", true);
    return;
  }

  if (state.editingLinkId) {
    const target = state.config.quickLinks.find((item) => item.id === state.editingLinkId);
    if (!target) {
      setStatus("未找到要编辑的快捷网站", true);
      return;
    }
    target.title = title;
    target.url = normalizedUrl;
    await persistConfig("快捷网站已更新");
  } else {
    state.config.quickLinks.push({
      id: uid(),
      title,
      url: normalizedUrl,
      order: state.config.quickLinks.length
    });
    await persistConfig("快捷网站已新增");
  }

  closeLinkModal();
  renderQuickLinks();
}

async function handleDeleteEditingLink() {
  if (!state.editingLinkId) {
    return;
  }
  const nextLinks = state.config.quickLinks.filter((item) => item.id !== state.editingLinkId);
  nextLinks.forEach((item, index) => {
    item.order = index;
  });
  state.config.quickLinks = nextLinks;

  await persistConfig("快捷网站已删除");
  closeLinkModal();
  renderQuickLinks();
}

function renderTodoWidget() {
  const enabled = state.config.widgets.todo.enabled;
  el.todoWidget.style.display = enabled ? "block" : "none";
  if (!enabled) return;

  const todoList = el.todoList;
  todoList.innerHTML = "";
  
  let doneCount = 0;
  const todos = state.config.todos || [];
  
  for (const item of todos) {
    if (item.done) doneCount++;
    const row = document.createElement("li");
    row.className = `todo-item${item.done ? " done" : ""}`;

    const checkWrap = document.createElement("div");
    checkWrap.className = "todo-checkbox-wrap";
    
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = item.done;
    check.dataset.todoId = item.id;
    
    const fakeBox = document.createElement("div");
    fakeBox.className = "todo-checkbox-fake";
    
    checkWrap.appendChild(check);
    checkWrap.appendChild(fakeBox);

    const label = document.createElement("span");
    label.className = "todo-label";
    label.textContent = item.text;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-delete-todo";
    deleteButton.textContent = "删除";
    deleteButton.dataset.todoDeleteId = item.id;

    row.append(checkWrap, label, deleteButton);
    todoList.appendChild(row);
  }
  
  const progressEl = el.todoProgress;
  if (progressEl) {
    progressEl.textContent = `${doneCount} / ${todos.length} 完成`;
  }
}

async function handleAddTodo(event) {
  event.preventDefault();
  const text = String(el.todoInput.value || "").trim();
  if (!text) {
    return;
  }
  state.config.todos.unshift({
    id: uid(),
    text: text.slice(0, 120),
    done: false
  });
  el.todoInput.value = "";
  await persistConfig("待办已新增");
  renderTodoWidget();
}

async function handleTodoListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const deleteId = target.dataset.todoDeleteId;
  if (!deleteId) {
    return;
  }
  state.config.todos = state.config.todos.filter((item) => item.id !== deleteId);
  await persistConfig("待办已删除");
  renderTodoWidget();
}

async function handleTodoListChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const todoId = target.dataset.todoId;
  if (!todoId) {
    return;
  }
  const item = state.config.todos.find((todo) => todo.id === todoId);
  if (!item) {
    return;
  }
  item.done = target.checked;
  await persistConfig("待办状态已更新");
  renderTodoWidget();
}

function configureBackgroundRotationTimer() {
  if (state.backgroundTimer) {
    clearInterval(state.backgroundTimer);
  }
  if (!state.config.theme.autoRotate) {
    return;
  }
  const minutes = clamp(Number(state.config.theme.rotateMinutes) || 30, 1, 240);
  state.backgroundTimer = window.setInterval(async () => {
    rotateBackgroundPreset();
    await persistConfig();
    applyThemeAndBackground();
  }, minutes * 60 * 1000);
}

function rotateBackgroundPreset() {
  const currentIndex = BACKGROUND_PRESETS.findIndex(
    (item) => item.id === state.config.theme.backgroundValue
  );
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % BACKGROUND_PRESETS.length;
  state.config.theme.backgroundValue = BACKGROUND_PRESETS[nextIndex].id;
}

function configureWeatherTimer() {
  if (state.weatherTimer) {
    clearInterval(state.weatherTimer);
  }
  if (!state.config.widgets.weather.enabled) {
    return;
  }
  state.weatherTimer = window.setInterval(() => {
    refreshWeather(false).catch((error) => {
      setStatus(`天气更新失败：${error.message}`, true);
    });
  }, WEATHER_REFRESH_INTERVAL_MS);
}

function renderWeatherWidget() {
  const weatherConfig = state.config.widgets.weather;
  el.weatherWidget.classList.toggle("hidden", !weatherConfig.enabled);
  el.weatherWidget.style.display = weatherConfig.enabled ? "block" : "none";
  if (!weatherConfig.enabled) {
    return;
  }
  if (!weatherConfig.city) {
    el.weatherStatus.textContent = "请在设置中填写天气城市。";
    return;
  }

  const cache = weatherConfig.cache;
  if (isWeatherCacheValid(cache, weatherConfig)) {
    paintWeather(cache, true);
  } else {
    el.weatherStatus.textContent = "正在获取天气...";
  }

  refreshWeather(false).catch((error) => {
    setStatus(`天气更新失败：${error.message}`, true);
  });
}

function isWeatherCacheValid(cache, weatherConfig) {
  if (!cache || typeof cache !== "object") {
    return false;
  }
  const age = Date.now() - Number(cache.updatedAt || 0);
  const cityMatched = cache.queryCity === weatherConfig.city;
  const unitMatched = cache.unit === weatherConfig.unit;
  return cityMatched && unitMatched && age < WEATHER_CACHE_MAX_AGE_MS;
}

async function refreshWeather(forceRefresh) {
  const weatherConfig = state.config.widgets.weather;
  if (!weatherConfig.enabled || state.weatherLoading || !weatherConfig.city) {
    return;
  }
  if (!forceRefresh && isWeatherCacheValid(weatherConfig.cache, weatherConfig)) {
    paintWeather(weatherConfig.cache, true);
    return;
  }

  state.weatherLoading = true;
  el.weatherStatus.textContent = "正在获取天气...";

  try {
    const weather = await fetchWeather(weatherConfig.city, weatherConfig.unit);
    state.config.widgets.weather.cache = weather;
    await persistConfig();
    paintWeather(weather, false);
  } catch (error) {
    const cache = state.config.widgets.weather.cache;
    if (cache) {
      paintWeather(cache, true, true);
    } else {
      el.weatherStatus.textContent = `天气获取失败：${error.message}`;
    }
  } finally {
    state.weatherLoading = false;
  }
}

async function fetchWeather(city, unit) {
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=zh&format=json`;
  const geocodeResponse = await fetch(geocodeUrl);
  if (!geocodeResponse.ok) {
    throw new Error(`地理编码请求失败（${geocodeResponse.status}）`);
  }
  const geocodeData = await geocodeResponse.json();
  const firstResult = geocodeData?.results?.[0];
  if (!firstResult) {
    throw new Error("未找到对应城市");
  }

  const forecastUrl =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(firstResult.latitude)}` +
    `&longitude=${encodeURIComponent(firstResult.longitude)}` +
    "&current=temperature_2m,apparent_temperature,weather_code,is_day&timezone=auto";

  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    throw new Error(`天气请求失败（${forecastResponse.status}）`);
  }
  const forecastData = await forecastResponse.json();
  const current = forecastData?.current;
  if (!current) {
    throw new Error("天气数据缺失");
  }

  let temperature = Number(current.temperature_2m);
  let apparent = Number(current.apparent_temperature);
  if (unit === "F") {
    temperature = temperature * 1.8 + 32;
    apparent = apparent * 1.8 + 32;
  }

  return {
    queryCity: city,
    cityLabel: `${firstResult.name}, ${firstResult.country_code}`,
    unit,
    temperature: Math.round(temperature),
    apparent: Math.round(apparent),
    code: Number(current.weather_code),
    description: mapWeatherCode(Number(current.weather_code), Number(current.is_day) === 1),
    updatedAt: Date.now()
  };
}

function mapWeatherCode(code, isDay) {
  const dictionary = {
    0: isDay ? "晴朗" : "晴夜",
    1: "大部晴",
    2: "局部多云",
    3: "阴天",
    45: "有雾",
    48: "冻雾",
    51: "小毛毛雨",
    53: "中等毛毛雨",
    55: "浓毛毛雨",
    56: "冻毛毛雨",
    57: "强冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "强冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "强阵雨",
    82: "暴雨阵雨",
    85: "阵雪",
    86: "强阵雪",
    95: "雷雨",
    96: "雷雨夹小冰雹",
    99: "雷雨夹大冰雹"
  };
  return dictionary[code] || "天气未知";
}

function paintWeather(weatherData, fromCache, stale) {
  const unit = weatherData.unit === "F" ? "F" : "C";
  const updateTime = new Date(weatherData.updatedAt);
  const clock = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(updateTime);

  const cacheTag = stale ? "（缓存，已过期）" : fromCache ? "（缓存）" : "";
  el.weatherStatus.textContent =
    `${weatherData.cityLabel} · ${weatherData.temperature}°${unit}` +
    ` · ${weatherData.description}（体感 ${weatherData.apparent}°${unit}）` +
    ` · 更新于 ${clock}${cacheTag}`;
}

function handleKeyboardShortcuts(event) {
  const target = event.target;
  const editing = isEditableTarget(target);

  if (!editing && event.key === "/") {
    event.preventDefault();
    el.searchInput.focus();
    el.searchInput.select();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    event.preventDefault();
    openSettings();
    return;
  }

  if (event.key === "Escape") {
    closeSettings();
    closeLinkModal();
    return;
  }

  if (!editing && event.altKey && /^[1-9]$/.test(event.key)) {
    event.preventDefault();
    const links = getSortedLinks();
    const index = Number(event.key) - 1;
    const item = links[index];
    if (item) {
      window.location.assign(item.url);
    }
  }
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target.isContentEditable)
  );
}

function handleExportConfig() {
  const blob = new Blob([JSON.stringify(state.config, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `uitab-config-${buildTimestamp()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("配置已导出");
}

async function handleImportConfig(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    state.config = migrateConfig(parsed);
    await persistConfig("配置已导入");
    hydrateSettingsForm();
    renderAll();
  } catch (error) {
    setStatus(`导入失败：${error.message}`, true);
  } finally {
    el.importConfigInput.value = "";
  }
}

async function handleResetConfig() {
  state.config = safeClone(DEFAULT_CONFIG);
  await persistConfig("已恢复默认配置");
  hydrateSettingsForm();
  closeSettings();
  renderAll();
}

function buildTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

async function persistConfig(message, isError) {
  state.config = await saveConfig(state.config);
  if (message) {
    setStatus(message, isError);
  }
}

function setStatus(message, isError) {
  if (!el.statusText) {
    return;
  }
  el.statusText.textContent = message;
  el.statusText.style.color = isError ? "var(--danger)" : "var(--text-soft)";

  if (state.statusResetTimer) {
    clearTimeout(state.statusResetTimer);
  }
  if (message !== "准备就绪") {
    state.statusResetTimer = window.setTimeout(() => {
      el.statusText.textContent = "准备就绪";
      el.statusText.style.color = "var(--text-soft)";
    }, 2600);
  }
}


