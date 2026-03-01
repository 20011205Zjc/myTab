import {
  BACKGROUND_PRESETS,
  DEFAULT_CONFIG,
  SEARCH_ENGINES,
  getBackgroundPreset,
  migrateConfig
} from "./defaults.js";
import { loadConfig, saveConfig } from "./storage.js";
import { clamp, formatDateTime, getDomain, normalizeCoverUrl, normalizeUrl, safeClone, uid } from "./utils.js";

const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const WEATHER_FORECAST_MIN_DAYS = 3;
const WEATHER_FORECAST_MAX_DAYS = 6;
const OPENWEATHER_API_KEY = "";
const OPENWEATHER_BASE_URL = "https://api.openweathermap.org";
const AMAP_API_KEY = "";
const AMAP_SECURITY_JSCODE = "";
const AMAP_IP_API_URL = "https://restapi.amap.com/v3/ip";
const AMAP_REGEO_API_URL = "https://restapi.amap.com/v3/geocode/regeo";
const SEARCH_ENGINE_ICON_DOMAINS = {
  google: "google.com",
  bing: "bing.com",
  duckduckgo: "duckduckgo.com",
  baidu: "baidu.com",
  custom: "search"
};
const LUNAR_MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const LUNAR_DAY_NAMES = [
  "",
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十"
];
const UPPER_NUMERAL_MAP = {
  "0": "零",
  "1": "壹",
  "2": "贰",
  "3": "叁",
  "4": "肆",
  "5": "伍",
  "6": "陆",
  "7": "柒",
  "8": "捌",
  "9": "玖",
  "〇": "零",
  "○": "零",
  "一": "壹",
  "二": "贰",
  "三": "叁",
  "四": "肆",
  "五": "伍",
  "六": "陆",
  "七": "柒",
  "八": "捌",
  "九": "玖",
  "十": "拾"
};
const UPPER_DIGITS = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const SOLAR_FESTIVALS = {
  "01-01": "元旦",
  "02-14": "情人节",
  "05-01": "劳动节",
  "06-01": "儿童节",
  "10-01": "国庆节",
  "12-25": "圣诞节"
};
const LUNAR_FESTIVALS = {
  "正月初一": "春节",
  "正月十五": "元宵节",
  "五月初五": "端午节",
  "七月初七": "七夕",
  "八月十五": "中秋节",
  "九月初九": "重阳节",
  "腊月初八": "腊八节",
  "腊月廿三": "小年",
  "腊月廿四": "小年"
};
const SOLAR_TERMS = [
  { name: "小寒", month: 1, c20: 6.11, c21: 5.4055 },
  { name: "大寒", month: 1, c20: 20.84, c21: 20.12 },
  { name: "立春", month: 2, c20: 4.6295, c21: 3.87 },
  { name: "雨水", month: 2, c20: 19.4599, c21: 18.73 },
  { name: "惊蛰", month: 3, c20: 6.3826, c21: 5.63 },
  { name: "春分", month: 3, c20: 21.4155, c21: 20.646 },
  { name: "清明", month: 4, c20: 5.59, c21: 4.81 },
  { name: "谷雨", month: 4, c20: 20.888, c21: 20.1 },
  { name: "立夏", month: 5, c20: 6.318, c21: 5.52 },
  { name: "小满", month: 5, c20: 21.86, c21: 21.04 },
  { name: "芒种", month: 6, c20: 6.5, c21: 5.678 },
  { name: "夏至", month: 6, c20: 22.2, c21: 21.37 },
  { name: "小暑", month: 7, c20: 7.928, c21: 7.108 },
  { name: "大暑", month: 7, c20: 23.65, c21: 22.83 },
  { name: "立秋", month: 8, c20: 8.35, c21: 7.5 },
  { name: "处暑", month: 8, c20: 23.95, c21: 23.13 },
  { name: "白露", month: 9, c20: 8.44, c21: 7.646 },
  { name: "秋分", month: 9, c20: 23.822, c21: 23.042 },
  { name: "寒露", month: 10, c20: 9.098, c21: 8.318 },
  { name: "霜降", month: 10, c20: 24.218, c21: 23.438 },
  { name: "立冬", month: 11, c20: 8.218, c21: 7.438 },
  { name: "小雪", month: 11, c20: 23.08, c21: 22.36 },
  { name: "大雪", month: 12, c20: 7.9, c21: 7.18 },
  { name: "冬至", month: 12, c20: 22.6, c21: 21.94 }
];

const state = {
  config: null,
  editingLinkId: null,
  draggingLinkId: null,
  clockTimer: null,
  weatherTimer: null,
  backgroundTimer: null,
  iconCacheSaveTimer: null,
  statusResetTimer: null,
  weatherLoading: false,
  lastFestivalText: "",
  coverDraft: ""
};

const el = {};
const quickLinkIconCacheTasks = new Map();

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
  el.app = document.getElementById("app");
  el.dashboard = document.getElementById("dashboard");
  el.clockDisplay = document.getElementById("clock");
  el.clockWeather = document.getElementById("clock-weather");
  el.searchForm = document.getElementById("search-form");

  el.quickLinksGrid = document.getElementById("quick-links-grid");
  el.timeWidget = document.getElementById("time-widget");
  el.timeMain = document.getElementById("time-main");
  el.timeWeekday = document.getElementById("time-weekday");
  el.timeLunar = document.getElementById("time-lunar");
  el.timeFestival = document.getElementById("time-festival");
  el.timeSolarTerm = document.getElementById("time-solar-term");
  el.festivalBanner = document.getElementById("festival-banner");
  el.festivalBannerText = document.getElementById("festival-banner-text");
  el.festivalRibbons = document.getElementById("festival-ribbons");
  el.weatherForecast = document.getElementById("weather-forecast");
  el.weatherForecastGrid = document.getElementById("weather-forecast-grid");
  el.weatherWidget = document.getElementById("weather-widget");
  el.weatherIcon = document.getElementById("weather-icon");
  el.weatherDesc = document.getElementById("weather-desc");
  el.weatherLocation = document.getElementById("weather-location");
  el.weatherUpdate = document.getElementById("weather-update");
  el.weatherRefreshButton = document.getElementById("btn-refresh-weather");

  el.searchEngineWrap = document.getElementById("search-engine-wrap");
  el.searchEngineIcon = document.getElementById("search-engine-icon");
  el.searchEngineName = document.getElementById("search-engine-name");
  el.searchEngineMenu = document.getElementById("search-engine-menu");

  document.addEventListener("click", (event) => {
    if (el.searchEngineWrap && !el.searchEngineWrap.contains(event.target)) {
      el.searchEngineWrap.classList.remove("is-open");
      el.searchEngineWrap.setAttribute("aria-expanded", "false");
    }
  });

  if (el.searchEngineWrap) {
    el.searchEngineWrap.addEventListener("click", () => {
      const isOpen = el.searchEngineWrap.classList.contains("is-open");
      if (isOpen) {
        el.searchEngineWrap.classList.remove("is-open");
        el.searchEngineWrap.setAttribute("aria-expanded", "false");
      } else {
        el.searchEngineWrap.classList.add("is-open");
        el.searchEngineWrap.setAttribute("aria-expanded", "true");
      }
    });

    el.searchEngineWrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        el.searchEngineWrap.click();
      }
    });
  }

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
  el.settingWeatherDays = document.getElementById("setting-weather-days");
  el.weatherDaysValue = document.getElementById("weather-days-value");
  el.settingWeatherUseLocation = document.getElementById("setting-weather-use-location");
  el.weatherLocateButton = document.getElementById("weather-locate-btn");

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
  el.linkCoverArea = document.getElementById("link-cover-area");
  el.linkCoverFile = document.getElementById("link-cover-file");

  el.weatherWidget = document.getElementById("weather-widget");
  el.weatherStatus = document.getElementById("weather-status");
  el.weatherRefreshButton = document.getElementById("weather-refresh-btn");
}

function populateSelectOptions() {
  populateCustomSearchEngineMenu();
  populateSearchEngineSelect(el.settingSearchEngine);

  el.settingBackground.innerHTML = "";
  for (const preset of BACKGROUND_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    el.settingBackground.appendChild(option);
  }
}

function populateCustomSearchEngineMenu() {
  if (!el.searchEngineMenu) return;
  el.searchEngineMenu.innerHTML = "";

  for (const [key, value] of Object.entries(SEARCH_ENGINES)) {
    const li = document.createElement("li");
    li.className = "engine-option";
    li.dataset.engine = key;
    li.setAttribute("role", "option");

    const domain = getSearchEngineIconDomain(key, state.config?.search?.customUrlTemplate);
    const icon = document.createElement("img");
    icon.alt = "";
    loadImageWithCandidates(
      icon,
      buildFaviconCandidates(domain),
      createMonogramIconDataUrl(value.label)
    );
    li.append(icon, document.createTextNode(value.label));

    li.addEventListener("click", async (event) => {
      event.stopPropagation();
      state.config.search.engine = key;
      await persistConfig("已切换默认搜索引擎");
      renderSearchSelectValue();
      el.searchEngineWrap.classList.remove("is-open");
      el.searchEngineWrap.setAttribute("aria-expanded", "false");
    });

    el.searchEngineMenu.appendChild(li);
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
  // Custom search engine dropdown click handled in populateCustomSearchEngineMenu
  el.settingsOpen.addEventListener("click", openSettings);
  el.settingsClose.addEventListener("click", closeSettings);
  el.settingsCancelButton.addEventListener("click", closeSettings);
  el.settingsOverlay.addEventListener("click", closeSettings);
  el.themeToggle.addEventListener("click", handleThemeToggle);

  el.settingsForm.addEventListener("submit", handleSettingsSubmit);
  el.settingSearchEngine.addEventListener("change", updateCustomSearchInputState);
  el.settingWeatherUseLocation.addEventListener("change", updateWeatherLocationInputState);
  if (el.settingWeatherDays && el.weatherDaysValue) {
    el.settingWeatherDays.addEventListener("input", () => {
      el.weatherDaysValue.textContent = String(el.settingWeatherDays.value);
    });
  }
  el.settingGridColumns.addEventListener("input", () => {
    el.gridColumnsValue.textContent = String(el.settingGridColumns.value);
  });

  el.addLinkButton.addEventListener("click", () => openLinkModal(null));
  el.linkModalClose.addEventListener("click", closeLinkModal);
  el.linkModalOverlay.addEventListener("click", closeLinkModal);
  el.linkForm.addEventListener("submit", handleLinkFormSubmit);
  el.linkDeleteButton.addEventListener("click", handleDeleteEditingLink);
  el.linkCoverArea.addEventListener("click", () => el.linkCoverFile.click());
  el.linkCoverArea.addEventListener("keydown", (event) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      setCoverDraft("");
    }
  });
  el.linkCoverFile.addEventListener("change", handleCoverFileChange);

  el.exportConfigButton.addEventListener("click", handleExportConfig);
  el.importConfigButton.addEventListener("click", () => el.importConfigInput.click());
  el.importConfigInput.addEventListener("change", handleImportConfig);
  el.resetConfigButton.addEventListener("click", handleResetConfig);

  if (el.weatherRefreshButton) {
    el.weatherRefreshButton.addEventListener("click", () => {
      refreshWeather(true).catch((error) => {
        setStatus(`天气刷新失败：${error.message}`, true);
      });
    });
  }
  if (el.weatherLocateButton) {
    el.weatherLocateButton.addEventListener("click", () => {
      handleLocateWeather().catch((error) => {
        setStatus(`定位失败：${error.message}`, true);
      });
    });
  }

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function renderAll() {
  applyThemeAndBackground();
  applyLayout();
  renderClock();
  renderQuickLinks();
  renderTimePanel();
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
  document.documentElement.style.setProperty("--page-bg", background.value);
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
  const effectiveCols = clamp(Number(state.config.ui.gridColumns) || 5, 2, 5);
  state.config.ui.gridColumns = effectiveCols;
  el.quickLinksGrid.style.gridTemplateColumns = `repeat(${effectiveCols}, minmax(0, 1fr))`;
}

function renderClock() {
  const visible = state.config.ui.showClock && state.config.widgets.clock.enabled;
  el.clockDisplay.style.display = visible ? "block" : "none";
  renderClockText();
}

function configureClockTimer() {
  if (state.clockTimer) {
    clearInterval(state.clockTimer);
  }
  if (!state.config.widgets.clock.enabled && !el.timeWidget) {
    return;
  }
  renderClockText();
  state.clockTimer = window.setInterval(renderClockText, 1000);
}

function renderClockText() {
  const now = new Date();
  if (el.clockDisplay) {
    el.clockDisplay.textContent = formatDateTime(now, state.config.widgets.clock.format24h);
  }
  renderTimePanel(now);
}

function renderSearchSelectValue() {
  const engineKey = state.config.search.engine;
  const engineData = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES.google;

  // Update Settings Native Select
  if (el.settingSearchEngine) {
    el.settingSearchEngine.value = engineKey;
  }

  // Update Custom Wrap UI
  if (el.searchEngineName && el.searchEngineIcon) {
    el.searchEngineName.textContent = engineData.label;
    updateSearchEngineIcon();
  }

  // Update selected state in menu
  if (el.searchEngineMenu) {
    const options = el.searchEngineMenu.querySelectorAll(".engine-option");
    options.forEach(opt => {
      opt.classList.toggle("is-selected", opt.dataset.engine === engineKey);
      opt.setAttribute("aria-selected", opt.dataset.engine === engineKey ? "true" : "false");
    });
  }
}

function handleSearchSubmit(event) {
  event.preventDefault();
  const keyword = el.searchInput.value.trim();
  if (!keyword) {
    setStatus("请输入关键词后再搜索");
    return;
  }
  window.open(buildSearchUrl(state.config.search, keyword), '_blank');
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
  const domain = getSearchEngineIconDomain(engine, state.config.search.customUrlTemplate);
  loadImageWithCandidates(
    el.searchEngineIcon,
    buildFaviconCandidates(domain),
    createMonogramIconDataUrl(SEARCH_ENGINES[engine]?.label || "搜")
  );
  el.searchEngineIcon.alt = `${SEARCH_ENGINES[engine]?.label || "搜索引擎"} icon`;
}

function getSearchEngineIconDomain(engineKey, customTemplate = "") {
  if (engineKey === "custom") {
    return getDomainFromSearchTemplate(customTemplate) || SEARCH_ENGINE_ICON_DOMAINS.custom;
  }
  return SEARCH_ENGINE_ICON_DOMAINS[engineKey] || SEARCH_ENGINE_ICON_DOMAINS.google;
}

function getHostnameFromUrlLike(value) {
  const normalized = normalizeUrl(value || "");
  if (!normalized) {
    return "";
  }
  try {
    return new URL(normalized).hostname;
  } catch (_error) {
    return "";
  }
}

function buildFaviconCandidates(urlLike) {
  const hostname = getHostnameFromUrlLike(urlLike);
  if (!hostname) {
    return [];
  }

  const rootHost = hostname.replace(/^www\./i, "");
  const hosts = [hostname];
  if (hostname.startsWith("www.")) {
    hosts.push(rootHost);
  } else if (hostname.split(".").length === 2) {
    hosts.push(`www.${hostname}`);
  }

  const candidates = [];
  for (const host of hosts) {
    candidates.push(`https://${host}/favicon.ico`);
    candidates.push(`https://${host}/favicon.png`);
    candidates.push(`https://${host}/apple-touch-icon.png`);
  }

  // Keep a third-party favicon service as last fallback for environments where it is reachable.
  candidates.push(`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(rootHost)}&sz=64`);
  return Array.from(new Set(candidates));
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createMonogramIconDataUrl(label) {
  const glyph = String(label || "?").trim().slice(0, 1).toUpperCase() || "?";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#0f766e"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif"
        font-size="34" fill="#ffffff">${escapeSvgText(glyph)}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function loadImageWithCandidates(image, candidates, fallbackSrc, onResolved = null) {
  const queue = Array.from(new Set((candidates || []).filter(Boolean)));
  const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  image.dataset.iconRequestId = requestId;
  image.src = fallbackSrc;
  if (queue.length === 0) {
    if (typeof onResolved === "function") {
      onResolved(null);
    }
    return;
  }

  const probe = new Image();
  probe.referrerPolicy = "no-referrer";
  let index = 0;

  const tryNext = () => {
    if (image.dataset.iconRequestId !== requestId) {
      return;
    }
    if (index >= queue.length) {
      if (typeof onResolved === "function") {
        onResolved(null);
      }
      return;
    }
    const candidate = queue[index];
    probe.onload = () => {
      if (image.dataset.iconRequestId !== requestId) {
        return;
      }
      image.src = candidate;
      if (typeof onResolved === "function") {
        onResolved(candidate);
      }
    };
    probe.onerror = () => {
      if (image.dataset.iconRequestId !== requestId) {
        return;
      }
      index += 1;
      tryNext();
    };
    probe.src = candidate;
  };

  tryNext();
}

function queuePersistIconCache() {
  if (state.iconCacheSaveTimer) {
    return;
  }
  state.iconCacheSaveTimer = window.setTimeout(async () => {
    state.iconCacheSaveTimer = null;
    try {
      state.config = await saveConfig(state.config);
    } catch (error) {
      console.warn("保存图标缓存失败", error);
    }
  }, 400);
}

function scheduleQuickLinkIconCache(linkId, resolvedSrc) {
  if (!linkId || !resolvedSrc) {
    return;
  }
  const currentTaskSrc = quickLinkIconCacheTasks.get(linkId);
  if (currentTaskSrc === resolvedSrc) {
    return;
  }
  quickLinkIconCacheTasks.set(linkId, resolvedSrc);
  cacheQuickLinkIcon(linkId, resolvedSrc).finally(() => {
    if (quickLinkIconCacheTasks.get(linkId) === resolvedSrc) {
      quickLinkIconCacheTasks.delete(linkId);
    }
  });
}

async function cacheQuickLinkIcon(linkId, sourceUrl) {
  if (!state.config || !Array.isArray(state.config.quickLinks)) {
    return;
  }
  const target = state.config.quickLinks.find((item) => item.id === linkId);
  if (!target) {
    return;
  }
  if (String(target.cover || "").trim()) {
    return;
  }
  const currentIcon = String(target.icon || "").trim();
  const source = String(sourceUrl || "").trim();
  if (!source || currentIcon === source) {
    return;
  }

  const persistedIcon = await tryInlineImageToDataUrl(source);
  const nextIcon = persistedIcon || source;
  if (String(target.icon || "").trim() === nextIcon) {
    return;
  }
  target.icon = nextIcon;
  queuePersistIconCache();
}

async function tryInlineImageToDataUrl(url) {
  const value = String(url || "").trim();
  if (!value || value.startsWith("data:image/")) {
    return value;
  }
  try {
    const response = await fetch(value, { cache: "force-cache" });
    if (!response.ok) {
      return "";
    }
    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.startsWith("image/")) {
      return "";
    }
    const blob = await response.blob();
    if (!blob.size || blob.size > 64 * 1024) {
      return "";
    }
    return await blobToDataUrl(blob);
  } catch (_error) {
    return "";
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("blob read failed"));
    reader.readAsDataURL(blob);
  });
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
    const coverUrl = String(link.cover || "").trim();
    const cachedIcon = String(link.icon || "").trim();
    if (coverUrl) {
      card.classList.add("has-cover");
    }

    const icon = document.createElement("div");
    icon.className = "quick-icon";

    const image = document.createElement("img");
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.alt = "";
    const candidates = coverUrl
      ? [coverUrl, ...buildFaviconCandidates(link.url)]
      : cachedIcon
        ? [cachedIcon, ...buildFaviconCandidates(link.url)]
        : buildFaviconCandidates(link.url);
    const fallbackIcon = createMonogramIconDataUrl(link.title);
    loadImageWithCandidates(image, candidates, fallbackIcon, (resolvedSrc) => {
      if (coverUrl && resolvedSrc !== coverUrl) {
        card.classList.remove("has-cover");
      }
      if (!coverUrl && resolvedSrc && resolvedSrc !== cachedIcon) {
        scheduleQuickLinkIconCache(link.id, resolvedSrc);
      }
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
    editButton.title = "编辑";
    editButton.setAttribute("aria-label", "编辑");
    editButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
      </svg>
    `;
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openLinkModal(link.id);
    });

    actions.appendChild(editButton);
    card.append(icon, info, actions);

    card.addEventListener("click", () => {
      window.open(link.url, '_blank');
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
    <span class="add-icon" aria-hidden="true">+</span>
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
  const effectiveCols = clamp(Number(state.config.ui.gridColumns) || 5, 2, 5);
  el.settingGridColumns.value = String(effectiveCols);
  el.gridColumnsValue.textContent = String(effectiveCols);

  el.settingWeatherEnabled.checked = state.config.widgets.weather.enabled;
  el.settingWeatherCity.value = state.config.widgets.weather.city;
  el.settingWeatherUnit.value = state.config.widgets.weather.unit;
  if (el.settingWeatherDays && el.weatherDaysValue) {
    const forecastDays = clamp(
      Number(state.config.widgets.weather.forecastDays) || WEATHER_FORECAST_MIN_DAYS,
      WEATHER_FORECAST_MIN_DAYS,
      WEATHER_FORECAST_MAX_DAYS
    );
    el.settingWeatherDays.value = String(forecastDays);
    el.weatherDaysValue.textContent = String(forecastDays);
  }
  el.settingWeatherUseLocation.checked = state.config.widgets.weather.useLocation;

  updateCustomSearchInputState();
  updateWeatherLocationInputState();
}

function updateCustomSearchInputState() {
  const isCustom = el.settingSearchEngine.value === "custom";
  el.settingCustomSearch.disabled = !isCustom;
  el.settingCustomSearch.style.opacity = isCustom ? "1" : "0.6";
}

function updateWeatherLocationInputState() {
  const useLocation = Boolean(el.settingWeatherUseLocation.checked);
  el.settingWeatherCity.disabled = useLocation;
  el.settingWeatherCity.style.opacity = useLocation ? "0.6" : "1";
  el.settingWeatherCity.placeholder = useLocation ? "自动定位" : "例如 Beijing";
  if (el.weatherLocateButton) {
    el.weatherLocateButton.style.opacity = useLocation ? "1" : "0.7";
  }
}

async function handleSettingsSubmit(event) {
  event.preventDefault();

  const previousWeatherCity = state.config.widgets.weather.city;
  const previousWeatherUnit = state.config.widgets.weather.unit;
  const previousUseLocation = state.config.widgets.weather.useLocation;
  const previousLocation = state.config.widgets.weather.location;

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
  state.config.ui.gridColumns = clamp(Number(el.settingGridColumns.value) || 5, 2, 5);

  state.config.widgets.weather.enabled = el.settingWeatherEnabled.checked;
  state.config.widgets.weather.city = String(el.settingWeatherCity.value || "").trim();
  state.config.widgets.weather.unit = el.settingWeatherUnit.value === "F" ? "F" : "C";
  if (el.settingWeatherDays) {
    state.config.widgets.weather.forecastDays = clamp(
      Number(el.settingWeatherDays.value) || WEATHER_FORECAST_MIN_DAYS,
      WEATHER_FORECAST_MIN_DAYS,
      WEATHER_FORECAST_MAX_DAYS
    );
  }
  state.config.widgets.weather.useLocation = el.settingWeatherUseLocation.checked;
  if (!previousUseLocation && state.config.widgets.weather.useLocation) {
    try {
      const permissionState = await getGeolocationPermissionState();
      if (permissionState === "denied") {
        throw new Error("浏览器定位权限已被禁用，请在浏览器设置中启用该扩展的位置权限");
      }
      const location = await getCurrentLocation({ allowIpFallback: false });
      state.config.widgets.weather.location = location;
    } catch (error) {
      setStatus(`开启定位失败：${error.message}`, true);
      return;
    }
  }

  const locationChanged =
    previousUseLocation !== state.config.widgets.weather.useLocation ||
    (state.config.widgets.weather.useLocation &&
      (!previousLocation ||
        !state.config.widgets.weather.location ||
        Math.abs(previousLocation.lat - state.config.widgets.weather.location.lat) > 0.01 ||
        Math.abs(previousLocation.lon - state.config.widgets.weather.location.lon) > 0.01));
  const weatherChanged =
    previousWeatherUnit !== state.config.widgets.weather.unit ||
    locationChanged ||
    (!state.config.widgets.weather.useLocation &&
      previousWeatherCity !== state.config.widgets.weather.city);
  if (weatherChanged) {
    state.config.widgets.weather.cache = null;
  }

  await persistConfig("设置已保存");
  closeSettings();
  renderAll();
}

function setCoverDraft(value) {
  state.coverDraft = String(value || "").trim();
  updateCoverPreview();
}

function updateCoverPreview() {
  if (!el.linkCoverArea) {
    return;
  }
  const cover = state.coverDraft;
  if (!cover) {
    el.linkCoverArea.style.backgroundImage = "";
    el.linkCoverArea.classList.add("is-empty");
    return;
  }
  el.linkCoverArea.style.backgroundImage = `url("${cover}")`;
  el.linkCoverArea.classList.remove("is-empty");
}

function handleCoverFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    setStatus("请选择图片文件", true);
    el.linkCoverFile.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || "");
    setCoverDraft(result);
    el.linkCoverFile.value = "";
  };
  reader.onerror = () => {
    setStatus("图片读取失败", true);
    el.linkCoverFile.value = "";
  };
  reader.readAsDataURL(file);
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
    setCoverDraft(link.cover || "");
    el.linkDeleteButton.style.visibility = "visible";
  } else {
    el.linkModalTitle.textContent = "新增快捷网站";
    el.linkTitleInput.value = "";
    el.linkUrlInput.value = "";
    setCoverDraft("");
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
  el.linkCoverFile.value = "";
  setCoverDraft("");
}

async function handleLinkFormSubmit(event) {
  event.preventDefault();

  const title = String(el.linkTitleInput.value || "").trim();
  const normalizedUrl = normalizeUrl(el.linkUrlInput.value);
  const rawCover = state.coverDraft;
  const cover = normalizeCoverUrl(rawCover);
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
  if (rawCover && !cover) {
    setStatus("封面图链接无效", true);
    return;
  }

  if (state.editingLinkId) {
    const target = state.config.quickLinks.find((item) => item.id === state.editingLinkId);
    if (!target) {
      setStatus("未找到要编辑的快捷网站", true);
      return;
    }
    const urlChanged = target.url !== normalizedUrl;
    target.title = title;
    target.url = normalizedUrl;
    target.cover = cover;
    if (urlChanged) {
      target.icon = "";
    }
    await persistConfig("快捷网站已更新");
  } else {
    state.config.quickLinks.push({
      id: uid(),
      title,
      url: normalizedUrl,
      cover,
      icon: "",
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

function renderTimePanel(now = new Date()) {
  if (!el.timeWidget) {
    return;
  }

  const calendar = formatGregorian(now);
  const lunar = formatLunar(now);
  const solarTerm = getSolarTermOnDate(now);
  const festivalText = detectFestival(now, lunar.monthDayText, solarTerm);

  if (el.timeMain) {
    el.timeMain.textContent = calendar.time;
  }
  if (el.timeWeekday) {
    el.timeWeekday.textContent = `${calendar.date} ${calendar.weekday}`;
  }
  if (el.timeLunar) {
    el.timeLunar.textContent = lunar.full;
  }

  setOptionalTimeChip(el.timeSolarTerm, solarTerm);
  setOptionalTimeChip(el.timeFestival, festivalText);
  setFestivalCelebration(festivalText);
}

function setOptionalTimeChip(node, text) {
  if (!node) {
    return;
  }
  const content = String(text || "").trim();
  const active = Boolean(content);
  node.hidden = !active;
  node.textContent = active ? content : "";
  node.classList.toggle("is-muted", false);
  node.classList.toggle("is-active", active);
}

function formatGregorian(date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((item) => item.type === type)?.value || "00";
  return {
    date: `${get("year")}年${get("month")}月${get("day")}日`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
    weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date)
  };
}

function formatLunar(date) {
  try {
    const yearText = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric" })
      .format(date)
      .replace(/\s+/g, "");
    const monthDay = getLunarMonthDay(date);
    const displayYear = toUpperChineseNumerals(yearText);
    const displayMonth = toUpperLunarMonth(monthDay.month);
    const displayDay = toUpperLunarDay(monthDay.day);
    return {
      full: `${displayYear}${displayMonth}${displayDay}`,
      monthDayText: `${monthDay.month}${monthDay.day}`
    };
  } catch (_error) {
    return {
      full: "暂不可用",
      monthDayText: ""
    };
  }
}

function getLunarMonthDay(date) {
  try {
    const formatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" });
    const parts = formatter.formatToParts(date);
    let month = parts.find((item) => item.type === "month")?.value || "";
    let day = parts.find((item) => item.type === "day")?.value || "";

    if (!month || !day) {
      const raw = formatter.format(date).replace(/\s+/g, "");
      const match = raw.match(/(闰?[正一二三四五六七八九十冬腊\d]{1,2}月)([初十廿三一二四五六七八九\d]{1,3})/);
      if (match) {
        month = match[1];
        day = match[2];
      }
    }

    return {
      month: normalizeLunarMonth(month),
      day: normalizeLunarDay(day)
    };
  } catch (_error) {
    return {
      month: "未知月",
      day: "未知日"
    };
  }
}

function normalizeLunarMonth(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "未知月";
  }
  if (!/\d/.test(value)) {
    return value;
  }
  const leap = value.includes("闰");
  const monthNumber = Number(value.replace(/\D/g, ""));
  const monthName = LUNAR_MONTH_NAMES[monthNumber - 1] || String(monthNumber);
  return `${leap ? "闰" : ""}${monthName}月`;
}

function normalizeLunarDay(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "未知日";
  }
  if (!/^\d+$/.test(value)) {
    return value;
  }
  const dayNumber = Number(value);
  return LUNAR_DAY_NAMES[dayNumber] || `第${dayNumber}天`;
}

function toUpperChineseNumerals(text) {
  return String(text || "").replace(/[0-9〇○一二三四五六七八九十]/g, (char) => UPPER_NUMERAL_MAP[char] || char);
}

function toUpperNumberText(number) {
  const value = Number(number);
  if (!Number.isInteger(value) || value <= 0) {
    return "";
  }
  if (value < 10) {
    return UPPER_DIGITS[value];
  }
  if (value === 10) {
    return "拾";
  }
  if (value < 20) {
    return `拾${UPPER_DIGITS[value - 10]}`;
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${UPPER_DIGITS[tens]}拾${ones ? UPPER_DIGITS[ones] : ""}`;
}

function getLunarMonthNumber(monthText) {
  const value = String(monthText || "")
    .replace(/^闰/, "")
    .replace(/月$/, "")
    .trim();
  if (!value) {
    return 0;
  }
  const monthMap = {
    正: 1,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十一: 11,
    十二: 12,
    冬: 11,
    腊: 12
  };
  if (monthMap[value]) {
    return monthMap[value];
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  return 0;
}

function toUpperLunarMonth(monthText) {
  const value = String(monthText || "").trim();
  if (!value || value.includes("未知")) {
    return value;
  }
  const leap = value.startsWith("闰");
  const monthNumber = getLunarMonthNumber(value);
  if (monthNumber > 0) {
    return `${leap ? "闰" : ""}${toUpperNumberText(monthNumber)}月`;
  }
  const base = value.replace(/^闰/, "").replace(/月$/, "");
  return `${leap ? "闰" : ""}${toUpperChineseNumerals(base)}月`;
}

function toUpperLunarDay(dayText) {
  const value = String(dayText || "").trim();
  if (!value || value.includes("未知")) {
    return value;
  }
  if (value.startsWith("初")) {
    return `初${toUpperChineseNumerals(value.slice(1))}`;
  }
  return toUpperChineseNumerals(value).replace(/廿/g, "贰拾").replace(/卅/g, "叁拾").replace(/卌/g, "肆拾");
}

function detectFestival(date, lunarMonthDay, solarTerm) {
  const labels = [];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const solarKey = `${month}-${day}`;

  if (SOLAR_FESTIVALS[solarKey]) {
    labels.push(SOLAR_FESTIVALS[solarKey]);
  }
  if (LUNAR_FESTIVALS[lunarMonthDay]) {
    labels.push(LUNAR_FESTIVALS[lunarMonthDay]);
  }
  if (solarTerm === "清明") {
    labels.push("清明节");
  }
  if (isLunarNewYearEve(date)) {
    labels.push("除夕");
  }
  return Array.from(new Set(labels)).join("、");
}

function isLunarNewYearEve(date) {
  const today = getLunarMonthDay(date);
  if (!today.month.includes("腊月")) {
    return false;
  }
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLunar = getLunarMonthDay(tomorrow);
  return tomorrowLunar.month.includes("正月") && tomorrowLunar.day.includes("初一");
}

function getSolarTermOnDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const term of SOLAR_TERMS) {
    if (term.month !== month) {
      continue;
    }
    if (calculateSolarTermDay(year, term) === day) {
      return term.name;
    }
  }
  return "";
}

function calculateSolarTermDay(year, term) {
  const yearTail = year % 100;
  const c = year >= 2000 ? term.c21 : term.c20;
  return Math.floor(yearTail * 0.2422 + c) - Math.floor((yearTail - 1) / 4);
}

function setFestivalCelebration(festivalText) {
  const active = Boolean(festivalText);
  if (el.festivalBanner) {
    el.festivalBanner.hidden = !active;
    el.festivalBanner.classList.toggle("is-active", active);
    if (active && el.festivalBannerText) {
      el.festivalBannerText.textContent = `${festivalText}，节日快乐`;
    }
  }

  if (!el.festivalRibbons) {
    return;
  }

  if (active) {
    if (!el.festivalRibbons.dataset.seeded) {
      seedFestivalRibbons();
      el.festivalRibbons.dataset.seeded = "1";
    }
    el.festivalRibbons.classList.add("is-active");
  } else {
    el.festivalRibbons.classList.remove("is-active");
  }

  state.lastFestivalText = festivalText || "";
}

function seedFestivalRibbons() {
  if (!el.festivalRibbons) {
    return;
  }
  el.festivalRibbons.innerHTML = "";
  const count = 140;
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement("span");
    item.className = "ribbon";
    item.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    item.style.setProperty("--delay", `${(Math.random() * 8).toFixed(2)}s`);
    item.style.setProperty("--duration", `${(6.5 + Math.random() * 6).toFixed(2)}s`);
    item.style.setProperty("--drift", `${(-90 + Math.random() * 180).toFixed(0)}px`);
    item.style.setProperty("--spin", `${(420 + Math.random() * 480).toFixed(0)}deg`);
    item.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
    item.style.setProperty("--size", `${(7 + Math.random() * 7).toFixed(1)}px`);
    el.festivalRibbons.appendChild(item);
  }
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
  if (!weatherConfig.enabled) {
    if (el.weatherWidget) {
      el.weatherWidget.classList.add("hidden");
      el.weatherWidget.style.display = "none";
    }
    renderWeatherForecastCards(null, "天气未开启");
    setHeaderWeather("天气未开启", true);
    return;
  }

  if (el.weatherWidget) {
    el.weatherWidget.classList.remove("hidden");
    el.weatherWidget.style.display = "block";
  }

  if (!weatherConfig.useLocation && !weatherConfig.city) {
    if (el.weatherStatus) {
      el.weatherStatus.textContent = "请在设置中填写天气城市。";
    }
    renderWeatherForecastCards(null, "请先设置城市");
    setHeaderWeather("未设置城市", true);
    return;
  }
  if (weatherConfig.useLocation && !canUseAmapIpLocation() && !navigator.geolocation && !weatherConfig.city) {
    if (el.weatherStatus) {
      el.weatherStatus.textContent = "当前环境不支持定位，且未设置城市。";
    }
    renderWeatherForecastCards(null, "定位不可用");
    setHeaderWeather("定位不可用", true);
    return;
  }

  const cache = weatherConfig.cache;
  if (isWeatherCacheValid(cache, weatherConfig)) {
    paintWeather(cache, true);
  } else {
    if (el.weatherStatus) {
      el.weatherStatus.textContent = "正在获取天气...";
    }
    renderWeatherForecastCards(null, "天气获取中...");
    setHeaderWeather("天气获取中", true);
  }

  refreshWeather(false).catch((error) => {
    setStatus(`天气更新失败：${error.message}`, true);
  });
}

function canUseAmapIpLocation() {
  return Boolean(
    String(AMAP_API_KEY || "").trim() &&
      String(AMAP_SECURITY_JSCODE || "").trim() &&
      String(AMAP_IP_API_URL || "").trim()
  );
}

function isWeatherCacheValid(cache, weatherConfig) {
  if (!cache || typeof cache !== "object") {
    return false;
  }
  if (!Array.isArray(cache.dailyForecast) || cache.dailyForecast.length === 0) {
    return false;
  }
  const age = Date.now() - Number(cache.updatedAt || 0);
  const unitMatched = cache.unit === weatherConfig.unit;
  if (weatherConfig.useLocation) {
    const location = weatherConfig.location;
    if (!location || typeof location !== "object") {
      return false;
    }
    const lat = Number(location.lat);
    const lon = Number(location.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return false;
    }
    const cacheLat = Number(cache.lat);
    const cacheLon = Number(cache.lon);
    const same =
      Number.isFinite(cacheLat) &&
      Number.isFinite(cacheLon) &&
      Math.abs(cacheLat - lat) < 0.01 &&
      Math.abs(cacheLon - lon) < 0.01;
    return same && unitMatched && age < WEATHER_CACHE_MAX_AGE_MS;
  }
  const cityMatched = cache.queryCity === weatherConfig.city;
  return cityMatched && unitMatched && age < WEATHER_CACHE_MAX_AGE_MS;
}

async function refreshWeather(forceRefresh) {
  const weatherConfig = state.config.widgets.weather;
  if (!weatherConfig.enabled || state.weatherLoading || !weatherConfig.city) {
    if (weatherConfig.enabled && weatherConfig.useLocation) {
      // Allow location flow even when city is empty.
    } else {
      return;
    }
  }
  if (!forceRefresh && isWeatherCacheValid(weatherConfig.cache, weatherConfig)) {
    paintWeather(weatherConfig.cache, true);
    return;
  }

  state.weatherLoading = true;
  if (el.weatherStatus) {
    el.weatherStatus.textContent = "正在获取天气...";
  }
  renderWeatherForecastCards(null, "天气获取中...");
  setHeaderWeather("天气获取中", true);

  try {
    let weather;
    if (weatherConfig.useLocation) {
      try {
        weather = await fetchWeatherByLocation(weatherConfig, forceRefresh);
      } catch (locationError) {
        if (weatherConfig.city) {
          weather = await fetchWeatherByCity(weatherConfig.city, weatherConfig.unit);
          setStatus(`定位失败，已使用城市天气：${locationError.message}`, false);
        } else {
          throw locationError;
        }
      }
    } else {
      weather = await fetchWeatherByCity(weatherConfig.city, weatherConfig.unit);
    }
    state.config.widgets.weather.cache = weather;
    await persistConfig();
    paintWeather(weather, false);
  } catch (error) {
    const cache = state.config.widgets.weather.cache;
    if (cache) {
      paintWeather(cache, true, true);
    } else {
      if (el.weatherStatus) {
        el.weatherStatus.textContent = `天气获取失败：${error.message}`;
      }
      renderWeatherForecastCards(null, "天气获取失败");
      if (weatherConfig.useLocation) {
        setHeaderWeather("定位失败", true);
      }
    }
  } finally {
    state.weatherLoading = false;
  }
}

async function getCurrentLocation(options = {}) {
  const allowIpFallback = options.allowIpFallback !== false;

  if (navigator.geolocation) {
    try {
      return await getCurrentLocationByBrowserEnhanced();
    } catch (browserError) {
      if (!allowIpFallback) {
        throw browserError;
      }
      console.warn("浏览器定位失败，回退高德IP定位", browserError);
    }
  }
  if (allowIpFallback && canUseAmapIpLocation()) {
    return getCurrentLocationByAmapIp();
  }
  if (navigator.geolocation) {
    return getCurrentLocationByBrowser();
  }
  throw new Error("当前环境不支持定位");
}

async function getGeolocationPermissionState() {
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
      return "";
    }
    const result = await navigator.permissions.query({ name: "geolocation" });
    return String(result?.state || "");
  } catch (error) {
    return "";
  }
}

async function getCurrentLocationByBrowserEnhanced() {
  const location = await getCurrentLocationByBrowser();
  if (!canUseAmapIpLocation()) {
    return location;
  }
  try {
    const label = await reverseGeocodeByAmap(location);
    if (label) {
      return {
        ...location,
        label
      };
    }
  } catch (error) {
    console.warn("高德逆地理编码失败，使用浏览器默认地点名", error);
  }
  return location;
}

async function getCurrentLocationByAmapIp() {
  const key = String(AMAP_API_KEY || "").trim();
  const jscode = String(AMAP_SECURITY_JSCODE || "").trim();
  if (!key || !jscode) {
    throw new Error("高德定位 Key 或安全密钥未配置");
  }

  const query = new URLSearchParams({
    key,
    jscode,
    s: "rsv3",
    platform: "JS"
  });
  const response = await fetch(`${AMAP_IP_API_URL}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`高德定位请求失败（${response.status}）`);
  }

  const data = await response.json();
  if (String(data?.status) !== "1") {
    const info = String(data?.info || "高德定位失败");
    const infoCode = String(data?.infocode || "");
    throw new Error(infoCode ? `${info}（${infoCode}）` : info);
  }

  const center = parseAmapRectangleCenter(data?.rectangle);
  if (!center) {
    throw new Error("高德定位结果缺少有效坐标");
  }
  return {
    lat: center.lat,
    lon: center.lon,
    label: buildAmapLocationLabel(data)
  };
}

function parseAmapRectangleCenter(rectangle) {
  const text = String(rectangle || "").trim();
  if (!text) {
    return null;
  }
  const points = text
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [lngText, latText] = segment.split(",");
      const lon = Number(lngText);
      const lat = Number(latText);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      return { lat, lon };
    })
    .filter(Boolean);

  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return points[0];
  }
  const first = points[0];
  const last = points[points.length - 1];
  return {
    lat: Number(((first.lat + last.lat) / 2).toFixed(6)),
    lon: Number(((first.lon + last.lon) / 2).toFixed(6))
  };
}

function buildAmapLocationLabel(data) {
  const province = String(data?.province || "").trim();
  const cityRaw = data?.city;
  const city =
    Array.isArray(cityRaw) && cityRaw.length > 0 ? String(cityRaw[0] || "").trim() : String(cityRaw || "").trim();
  const cleanCity = city === "[]" ? "" : city;
  const district = String(data?.district || "").trim();
  const parts = [province];
  if (cleanCity && cleanCity !== province) {
    parts.push(cleanCity);
  }
  if (district && district !== cleanCity) {
    parts.push(district);
  }
  return parts.join("") || "当前位置";
}

async function reverseGeocodeByAmap(location) {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "";
  }
  const key = String(AMAP_API_KEY || "").trim();
  const jscode = String(AMAP_SECURITY_JSCODE || "").trim();
  if (!key || !jscode) {
    return "";
  }

  const query = new URLSearchParams({
    key,
    jscode,
    s: "rsv3",
    platform: "JS",
    location: `${lon},${lat}`,
    extensions: "base"
  });
  const response = await fetch(`${AMAP_REGEO_API_URL}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`高德逆地理请求失败（${response.status}）`);
  }
  const data = await response.json();
  if (String(data?.status) !== "1") {
    return "";
  }
  const formattedAddress = String(data?.regeocode?.formatted_address || "").trim();
  if (formattedAddress) {
    return formattedAddress;
  }

  const component = data?.regeocode?.addressComponent || {};
  const province = String(component?.province || "").trim();
  const cityRaw = component?.city;
  const city =
    Array.isArray(cityRaw) && cityRaw.length > 0 ? String(cityRaw[0] || "").trim() : String(cityRaw || "").trim();
  const district = String(component?.district || "").trim();
  const township = String(component?.township || "").trim();
  const parts = [province];
  if (city && city !== province) {
    parts.push(city);
  }
  if (district && district !== city) {
    parts.push(district);
  }
  if (township && township !== district) {
    parts.push(township);
  }
  return parts.join("");
}

function getCurrentLocationByBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("当前环境不支持定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude),
          lon: Number(position.coords.longitude),
          label: "当前位置"
        });
      },
      (error) => {
        const code = error?.code;
        if (code === 1) {
          reject(new Error("定位权限被拒绝，请在浏览器/系统设置中允许位置访问"));
          return;
        }
        if (code === 2) {
          reject(new Error("无法获取定位"));
          return;
        }
        if (code === 3) {
          reject(new Error("定位请求超时"));
          return;
        }
        reject(new Error("定位失败"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60 * 1000 }
    );
  });
}

async function fetchWeatherByLocation(weatherConfig, forceRefresh) {
  const cachedLocation =
    weatherConfig.location && typeof weatherConfig.location === "object"
      ? weatherConfig.location
      : null;

  let resolved = null;
  try {
    // Always try a fresh location first, to avoid long-term stale coordinates.
    resolved = await getCurrentLocation();
  } catch (error) {
    const canUseCached =
      !forceRefresh &&
      cachedLocation &&
      Number.isFinite(cachedLocation.lat) &&
      Number.isFinite(cachedLocation.lon);
    if (!canUseCached) {
      throw error;
    }
    resolved = cachedLocation;
  }

  weatherConfig.location = resolved;
  await persistConfig();
  return fetchWeatherByCoords(resolved, weatherConfig.unit);
}

async function fetchWeatherByCity(city, unit) {
  try {
    return await fetchWeatherByCityOpenWeather(city, unit);
  } catch (primaryError) {
    console.warn("OpenWeather 获取失败，回退到 Open-Meteo", primaryError);
    return fetchWeatherByCityOpenMeteo(city, unit);
  }
}

async function fetchWeatherByCoords(location, unit) {
  try {
    return await fetchWeatherByCoordsOpenWeather(location, unit);
  } catch (primaryError) {
    console.warn("OpenWeather 获取失败，回退到 Open-Meteo", primaryError);
    return fetchWeatherByCoordsOpenMeteo(location, unit);
  }
}

async function fetchWeatherByCityOpenWeather(city, unit) {
  const apiKey = String(OPENWEATHER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OpenWeather Key 未配置");
  }
  const geocodeUrl =
    `${OPENWEATHER_BASE_URL}/geo/1.0/direct` +
    `?q=${encodeURIComponent(city)}` +
    `&limit=1&appid=${encodeURIComponent(apiKey)}`;
  const geocodeResponse = await fetch(geocodeUrl);
  if (!geocodeResponse.ok) {
    throw new Error(`OpenWeather 地理编码失败（${geocodeResponse.status}）`);
  }
  const geocodeData = await geocodeResponse.json();
  const first = Array.isArray(geocodeData) ? geocodeData[0] : null;
  if (!first) {
    throw new Error("OpenWeather 未找到对应城市");
  }
  const cityLabel = `${first.local_names?.zh || first.name || city}, ${first.country || ""}`.replace(/,\s*$/, "");
  return fetchWeatherByCoordsOpenWeather(
    {
      lat: Number(first.lat),
      lon: Number(first.lon),
      label: cityLabel
    },
    unit,
    city
  );
}

async function fetchWeatherByCoordsOpenWeather(location, unit, queryCity = "geo") {
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("定位坐标无效");
  }
  const { currentData, forecastData } = await fetchOpenWeatherCurrentAndForecast(lat, lon, unit);
  const weatherMain = currentData?.weather?.[0] || {};
  const cityFromApi =
    currentData?.name && currentData?.sys?.country
      ? `${currentData.name}, ${currentData.sys.country}`
      : currentData?.name || "";
  const cityLabel =
    String(location.label || "").trim() && String(location.label || "").trim() !== "当前位置"
      ? String(location.label || "").trim()
      : cityFromApi || String(location.label || "当前位置");

  const dailyForecast = buildOpenWeatherDailyForecast(forecastData, currentData);
  const temperature = Number(currentData?.main?.temp);
  const apparent = Number(currentData?.main?.feels_like);

  return {
    queryCity,
    cityLabel,
    unit,
    temperature: Math.round(temperature),
    apparent: Math.round(apparent),
    code: Number(weatherMain.id || 0),
    description: String(weatherMain.description || "天气未知"),
    dailyForecast,
    updatedAt: Date.now(),
    lat,
    lon
  };
}

async function fetchOpenWeatherCurrentAndForecast(lat, lon, unit) {
  const apiKey = String(OPENWEATHER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OpenWeather Key 未配置");
  }
  const unitsParam = unit === "F" ? "imperial" : "metric";
  const currentUrl =
    `${OPENWEATHER_BASE_URL}/data/2.5/weather` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&appid=${encodeURIComponent(apiKey)}` +
    `&units=${encodeURIComponent(unitsParam)}` +
    "&lang=zh_cn";
  const forecastUrl =
    `${OPENWEATHER_BASE_URL}/data/2.5/forecast` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&appid=${encodeURIComponent(apiKey)}` +
    `&units=${encodeURIComponent(unitsParam)}` +
    "&lang=zh_cn";

  const [currentResponse, forecastResponse] = await Promise.all([fetch(currentUrl), fetch(forecastUrl)]);
  if (!currentResponse.ok) {
    throw new Error(`OpenWeather 实时天气失败（${currentResponse.status}）`);
  }
  if (!forecastResponse.ok) {
    throw new Error(`OpenWeather 预报天气失败（${forecastResponse.status}）`);
  }
  const currentData = await currentResponse.json();
  const forecastData = await forecastResponse.json();
  if (!currentData || !currentData.main) {
    throw new Error("OpenWeather 实时天气数据缺失");
  }
  if (!forecastData || !Array.isArray(forecastData.list)) {
    throw new Error("OpenWeather 预报数据缺失");
  }
  return { currentData, forecastData };
}

function buildOpenWeatherDailyForecast(forecastData, currentData) {
  const timezoneOffset = Number(forecastData?.city?.timezone ?? currentData?.timezone ?? 0);
  const grouped = new Map();
  const list = Array.isArray(forecastData?.list) ? forecastData.list : [];

  for (const item of list) {
    const key = getDateKeyByOffsetSeconds(Number(item?.dt), timezoneOffset);
    if (!key) {
      continue;
    }
    const tempMin = Number(item?.main?.temp_min);
    const tempMax = Number(item?.main?.temp_max);
    const weather = item?.weather?.[0] || {};
    const code = Number(weather.id || 0);
    const description = String(weather.description || "天气未知");
    const hour = getHourByOffsetSeconds(Number(item?.dt), timezoneOffset);

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        code,
        description,
        min: tempMin,
        max: tempMax,
        representativeDiff: Math.abs(hour - 12)
      });
      continue;
    }

    const current = grouped.get(key);
    if (Number.isFinite(tempMin)) {
      current.min = Number.isFinite(current.min) ? Math.min(current.min, tempMin) : tempMin;
    }
    if (Number.isFinite(tempMax)) {
      current.max = Number.isFinite(current.max) ? Math.max(current.max, tempMax) : tempMax;
    }
    const diff = Math.abs(hour - 12);
    if (diff < current.representativeDiff) {
      current.representativeDiff = diff;
      current.code = code;
      current.description = description;
    }
  }

  const currentDateKey = getDateKeyByOffsetSeconds(Number(currentData?.dt), timezoneOffset);
  if (currentDateKey && !grouped.has(currentDateKey)) {
    const weather = currentData?.weather?.[0] || {};
    const temp = Number(currentData?.main?.temp);
    grouped.set(currentDateKey, {
      date: currentDateKey,
      code: Number(weather.id || 0),
      description: String(weather.description || "天气未知"),
      min: temp,
      max: temp,
      representativeDiff: 0
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 6)
    .map((item) => ({
      date: item.date,
      code: item.code,
      description: item.description,
      max: Math.round(Number(item.max)),
      min: Math.round(Number(item.min))
    }));
}

function getDateKeyByOffsetSeconds(unixSeconds, offsetSeconds) {
  if (!Number.isFinite(unixSeconds)) {
    return "";
  }
  const date = new Date((unixSeconds + Number(offsetSeconds || 0)) * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getHourByOffsetSeconds(unixSeconds, offsetSeconds) {
  if (!Number.isFinite(unixSeconds)) {
    return 0;
  }
  const date = new Date((unixSeconds + Number(offsetSeconds || 0)) * 1000);
  return date.getUTCHours();
}

async function fetchWeatherByCityOpenMeteo(city, unit) {
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
    "&current=temperature_2m,apparent_temperature,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&forecast_days=7&timezone=auto";

  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    throw new Error(`天气请求失败（${forecastResponse.status}）`);
  }
  const forecastData = await forecastResponse.json();
  const current = forecastData?.current;
  const dailyForecast = buildDailyForecastList(forecastData?.daily, unit);
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
    dailyForecast,
    updatedAt: Date.now(),
    lat: Number(firstResult.latitude),
    lon: Number(firstResult.longitude)
  };
}

async function fetchWeatherByCoordsOpenMeteo(location, unit) {
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  const forecastUrl =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&current=temperature_2m,apparent_temperature,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&forecast_days=7&timezone=auto";

  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    throw new Error(`天气请求失败（${forecastResponse.status}）`);
  }
  const forecastData = await forecastResponse.json();
  const current = forecastData?.current;
  const dailyForecast = buildDailyForecastList(forecastData?.daily, unit);
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
    queryCity: "geo",
    cityLabel: String(location.label || "当前位置"),
    unit,
    temperature: Math.round(temperature),
    apparent: Math.round(apparent),
    code: Number(current.weather_code),
    description: mapWeatherCode(Number(current.weather_code), Number(current.is_day) === 1),
    dailyForecast,
    updatedAt: Date.now(),
    lat,
    lon
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

function mapWeatherCodeToIcon(code) {
  if (code >= 200 && code < 300) {
    return "⛈️";
  }
  if (code >= 300 && code < 600) {
    return "🌧️";
  }
  if (code >= 600 && code < 700) {
    return "❄️";
  }
  if (code >= 700 && code < 800) {
    return "🌫️";
  }
  if (code === 800) {
    return "☀️";
  }
  if (code > 800 && code <= 804) {
    return "☁️";
  }
  if (code === 0) {
    return "☀️";
  }
  if ([1, 2].includes(code)) {
    return "🌤️";
  }
  if (code === 3) {
    return "☁️";
  }
  if ([45, 48].includes(code)) {
    return "🌫️";
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "🌧️";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "❄️";
  }
  if ([95, 96, 99].includes(code)) {
    return "⛈️";
  }
  return "🌈";
}

function buildDailyForecastList(daily, unit) {
  if (!daily || typeof daily !== "object") {
    return [];
  }
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const maxList = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const minList = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const codeList = Array.isArray(daily.weather_code) ? daily.weather_code : [];
  const count = Math.min(dates.length, maxList.length, minList.length, codeList.length, 7);
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const code = Number(codeList[index]);
    let max = Number(maxList[index]);
    let min = Number(minList[index]);
    if (unit === "F") {
      max = max * 1.8 + 32;
      min = min * 1.8 + 32;
    }
    result.push({
      date: String(dates[index] || ""),
      code,
      description: mapWeatherCode(code, true),
      max: Math.round(max),
      min: Math.round(min)
    });
  }
  return result;
}

function formatForecastLabel(index, dateText) {
  if (index === 0) {
    return "今天";
  }
  if (index === 1) {
    return "明天";
  }
  if (index === 2) {
    return "后天";
  }
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return `${index + 1}天后`;
  }
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  return weekday;
}

function formatShortDate(dateText) {
  const value = String(dateText || "");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }
  return `${Number(match[2])}/${Number(match[3])}`;
}

function renderWeatherForecastCards(weatherData, message = "") {
  if (!el.weatherForecast || !el.weatherForecastGrid) {
    return;
  }
  const weatherConfig = state.config.widgets.weather;
  if (!weatherConfig.enabled) {
    el.weatherForecast.hidden = true;
    el.weatherForecastGrid.innerHTML = "";
    return;
  }

  const days = clamp(
    Number(weatherConfig.forecastDays) || WEATHER_FORECAST_MIN_DAYS,
    WEATHER_FORECAST_MIN_DAYS,
    WEATHER_FORECAST_MAX_DAYS
  );
  el.weatherForecast.hidden = false;
  el.weatherForecastGrid.style.setProperty("--weather-days", String(days));
  el.weatherForecastGrid.innerHTML = "";

  const dailyList = Array.isArray(weatherData?.dailyForecast) ? weatherData.dailyForecast.slice(0, days) : [];
  const unit = weatherData?.unit === "F" ? "F" : "C";

  if (dailyList.length === 0) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "weather-day-card weather-day-empty";
    emptyCard.textContent = message || "天气数据暂不可用";
    el.weatherForecastGrid.appendChild(emptyCard);
    return;
  }

  for (let index = 0; index < dailyList.length; index += 1) {
    const day = dailyList[index];
    const card = document.createElement("article");
    card.className = "weather-day-card";

    const label = document.createElement("div");
    label.className = "weather-day-label";
    label.textContent = formatForecastLabel(index, day.date);

    const date = document.createElement("div");
    date.className = "weather-day-date";
    date.textContent = formatShortDate(day.date);

    const icon = document.createElement("div");
    icon.className = "weather-day-icon";
    icon.textContent = mapWeatherCodeToIcon(day.code);

    const desc = document.createElement("div");
    desc.className = "weather-day-desc";
    desc.textContent = day.description;

    const temp = document.createElement("div");
    temp.className = "weather-day-temp";
    temp.textContent = `${day.max}°${unit} / ${day.min}°${unit}`;

    card.append(label, date, icon, desc, temp);
    el.weatherForecastGrid.appendChild(card);
  }
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
  if (el.weatherStatus) {
    el.weatherStatus.textContent =
      `${weatherData.cityLabel} · ${weatherData.temperature}°${unit}` +
      ` · ${weatherData.description}（体感 ${weatherData.apparent}°${unit}）` +
      ` · 更新于 ${clock}${cacheTag}`;
  }

  renderWeatherForecastCards(weatherData);
  setHeaderWeather(`${weatherData.temperature}°${unit} ${weatherData.description}`, false);
}

function setHeaderWeather(text, muted) {
  if (!el.clockWeather) {
    return;
  }
  el.clockWeather.textContent = text;
  el.clockWeather.classList.toggle("is-muted", Boolean(muted));
}

async function handleLocateWeather() {
  const weatherConfig = state.config.widgets.weather;
  try {
    const permissionState = await getGeolocationPermissionState();
    if (permissionState === "denied") {
      throw new Error("浏览器定位权限已被禁用，请在浏览器设置中启用该扩展的位置权限");
    }
    const location = await getCurrentLocation({ allowIpFallback: false });
    weatherConfig.useLocation = true;
    weatherConfig.location = location;
    weatherConfig.cache = null;
    el.settingWeatherUseLocation.checked = true;
    updateWeatherLocationInputState();
    await persistConfig("定位已更新");
    renderWeatherWidget();
  } catch (error) {
    weatherConfig.location = null;
    weatherConfig.cache = null;
    setHeaderWeather("定位失败", true);
    throw error;
  }
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
