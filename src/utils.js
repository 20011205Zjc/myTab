export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return safeClone(source);
  }

  const output = safeClone(target);
  const entries = Object.entries(source);
  for (const [key, value] of entries) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
      continue;
    }
    output[key] = safeClone(value);
  }
  return output;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return "";
  }
  if (/^[a-zA-Z][a-zA-Z\d+-.]*:\/\//.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

export function getDomain(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.replace(/^www\./, "");
  } catch (_err) {
    return urlString;
  }
}

export function formatDateTime(date, use24h) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !use24h
  }).format(date);
}
