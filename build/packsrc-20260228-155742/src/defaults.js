import { clamp, deepMerge, normalizeUrl, safeClone } from "./utils.js";

export const SCHEMA_VERSION = 3;

export const SEARCH_ENGINES = {
  google: {
    label: "Google",
    template: "https://www.google.com/search?q={query}"
  },
  bing: {
    label: "Bing",
    template: "https://www.bing.com/search?q={query}"
  },
  duckduckgo: {
    label: "DuckDuckGo",
    template: "https://duckduckgo.com/?q={query}"
  },
  baidu: {
    label: "Baidu",
    template: "https://www.baidu.com/s?wd={query}"
  },
  custom: {
    label: "自定义",
    template: ""
  }
};

export const BACKGROUND_PRESETS = [
  {
    id: "sunrise",
    label: "日出橙",
    value:
      "radial-gradient(circle at 20% 10%, #ffd9a8 0%, transparent 36%), radial-gradient(circle at 80% 12%, #8ec9ff 0%, transparent 35%), linear-gradient(135deg, #f8f5ee 0%, #dde9f2 55%, #d8ece6 100%)"
  },
  {
    id: "forest",
    label: "松林绿",
    value:
      "radial-gradient(circle at 15% 12%, #bde9ce 0%, transparent 36%), radial-gradient(circle at 78% 8%, #8fd5c2 0%, transparent 35%), linear-gradient(135deg, #edf8f0 0%, #d2ece1 56%, #bfdcce 100%)"
  },
  {
    id: "harbor",
    label: "海湾蓝",
    value:
      "radial-gradient(circle at 18% 14%, #b6e1ff 0%, transparent 35%), radial-gradient(circle at 82% 10%, #8bc1f5 0%, transparent 36%), linear-gradient(135deg, #edf4fb 0%, #d2e5f6 58%, #cbdae7 100%)"
  },
  {
    id: "amber",
    label: "暖砂金",
    value:
      "radial-gradient(circle at 22% 8%, #ffe7b2 0%, transparent 36%), radial-gradient(circle at 79% 12%, #ffc59b 0%, transparent 34%), linear-gradient(135deg, #f9f2e6 0%, #efdeca 56%, #e0d3bf 100%)"
  },
  {
    id: "nightfall",
    label: "夜幕蓝",
    value:
      "radial-gradient(circle at 18% 14%, #355f8c 0%, transparent 40%), radial-gradient(circle at 82% 8%, #1f4f6f 0%, transparent 34%), linear-gradient(135deg, #112536 0%, #1a354a 55%, #223f52 100%)"
  }
];

const DEFAULT_LINKS = [
  { id: "link_google", title: "Google", url: "https://www.google.com", order: 0 },
  { id: "link_github", title: "GitHub", url: "https://github.com", order: 1 },
  { id: "link_youtube", title: "YouTube", url: "https://www.youtube.com", order: 2 },
  { id: "link_bilibili", title: "Bilibili", url: "https://www.bilibili.com", order: 3 }
];

export const DEFAULT_CONFIG = {
  version: SCHEMA_VERSION,
  theme: {
    mode: "auto",
    backgroundType: "preset",
    backgroundValue: BACKGROUND_PRESETS[0].id,
    autoRotate: false,
    rotateMinutes: 30
  },
  search: {
    engine: "google",
    customUrlTemplate: "https://www.google.com/search?q={query}"
  },
  ui: {
    showClock: true,
    layout: "cozy",
    gridColumns: 4
  },
  quickLinks: DEFAULT_LINKS,
  widgets: {
    clock: {
      enabled: true,
      format24h: true
    },
    weather: {
      enabled: false,
      city: "Beijing",
      unit: "C",
      cache: null
    },
    todo: {
      enabled: true
    }
  },
  todos: []
};

function sanitizeSearch(searchConfig) {
  const result = safeClone(searchConfig);
  if (!SEARCH_ENGINES[result.engine]) {
    result.engine = DEFAULT_CONFIG.search.engine;
  }
  const hasPlaceholder = String(result.customUrlTemplate).includes("{query}");
  if (!hasPlaceholder) {
    result.customUrlTemplate = DEFAULT_CONFIG.search.customUrlTemplate;
  }
  return result;
}

function sanitizeTheme(themeConfig) {
  const result = safeClone(themeConfig);
  if (!["auto", "light", "dark"].includes(result.mode)) {
    result.mode = "auto";
  }
  const backgroundExists = BACKGROUND_PRESETS.some((item) => item.id === result.backgroundValue);
  if (!backgroundExists) {
    result.backgroundValue = BACKGROUND_PRESETS[0].id;
  }
  result.rotateMinutes = clamp(Number(result.rotateMinutes) || 30, 1, 240);
  result.autoRotate = Boolean(result.autoRotate);
  result.backgroundType = "preset";
  return result;
}

function sanitizeUi(uiConfig) {
  const result = safeClone(uiConfig);
  result.layout = result.layout === "compact" ? "compact" : "cozy";
  result.showClock = Boolean(result.showClock);
  result.gridColumns = clamp(Number(result.gridColumns) || 4, 2, 8);
  return result;
}

function sanitizeQuickLinks(list) {
  if (!Array.isArray(list)) {
    return safeClone(DEFAULT_CONFIG.quickLinks);
  }
  const normalized = list
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const title = String(item.title || "").trim().slice(0, 40);
      const url = normalizeUrl(item.url || "");
      return {
        id: String(item.id || `link_${index}_${Date.now()}`),
        title: title || "未命名",
        url,
        order: Number(item.order) || index
      };
    })
    .filter((item) => {
      try {
        new URL(item.url);
        return true;
      } catch (_err) {
        return false;
      }
    })
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: index
    }));

  return normalized.length > 0 ? normalized : safeClone(DEFAULT_CONFIG.quickLinks);
}

function sanitizeTodos(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: String(item.id || `todo_${index}_${Date.now()}`),
      text: String(item.text || "").trim().slice(0, 120),
      done: Boolean(item.done)
    }))
    .filter((item) => item.text.length > 0);
}

function migrateLegacyConfig(workingConfig, version) {
  const config = safeClone(workingConfig);

  if (version < 1) {
    if (!config.widgets) {
      config.widgets = {};
    }
    if (!config.widgets.clock) {
      config.widgets.clock = { enabled: true, format24h: true };
    }
  }

  if (version < 2) {
    if (!config.ui) {
      config.ui = { showClock: true, layout: "cozy", gridColumns: 4 };
    }
    if (!config.theme) {
      config.theme = {};
    }
    if (typeof config.theme.rotateMinutes === "undefined") {
      config.theme.rotateMinutes = 30;
    }
  }

  if (version < 3) {
    if (!config.widgets) {
      config.widgets = {};
    }
    if (!config.widgets.weather) {
      config.widgets.weather = { enabled: false, city: "Beijing", unit: "C", cache: null };
    }
    if (!config.widgets.todo) {
      config.widgets.todo = { enabled: true };
    }
    if (!Array.isArray(config.todos)) {
      config.todos = [];
    }
  }

  return config;
}

export function migrateConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return safeClone(DEFAULT_CONFIG);
  }

  const incoming = safeClone(rawConfig);
  const version = Number(incoming.version) || 0;
  const migratedLegacy = migrateLegacyConfig(incoming, version);
  const merged = deepMerge(DEFAULT_CONFIG, migratedLegacy);

  merged.theme = sanitizeTheme(merged.theme);
  merged.search = sanitizeSearch(merged.search);
  merged.ui = sanitizeUi(merged.ui);
  merged.quickLinks = sanitizeQuickLinks(merged.quickLinks);
  merged.todos = sanitizeTodos(merged.todos);

  merged.widgets.clock.enabled = Boolean(merged.widgets.clock.enabled);
  merged.widgets.clock.format24h = Boolean(merged.widgets.clock.format24h);
  merged.widgets.todo.enabled = Boolean(merged.widgets.todo.enabled);
  merged.widgets.weather.enabled = Boolean(merged.widgets.weather.enabled);
  merged.widgets.weather.city = String(merged.widgets.weather.city || "Beijing").trim();
  merged.widgets.weather.unit = merged.widgets.weather.unit === "F" ? "F" : "C";
  if (!merged.widgets.weather.cache || typeof merged.widgets.weather.cache !== "object") {
    merged.widgets.weather.cache = null;
  }

  merged.version = SCHEMA_VERSION;
  return merged;
}

export function getBackgroundPreset(id) {
  return BACKGROUND_PRESETS.find((item) => item.id === id) || BACKGROUND_PRESETS[0];
}
