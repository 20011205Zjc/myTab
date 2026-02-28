import { migrateConfig } from "./defaults.js";

const STORAGE_KEY = "uitab_local_clone_config";

function canUseChromeStorage() {
  return typeof chrome !== "undefined" && chrome?.storage?.local;
}

function chromeStorageGet() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const maybeError = chrome.runtime?.lastError;
      if (maybeError) {
        reject(new Error(maybeError.message));
        return;
      }
      resolve(result?.[STORAGE_KEY]);
    });
  });
}

function chromeStorageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: value }, () => {
      const maybeError = chrome.runtime?.lastError;
      if (maybeError) {
        reject(new Error(maybeError.message));
        return;
      }
      resolve();
    });
  });
}

function localStorageGet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch (_err) {
    return undefined;
  }
}

function localStorageSet(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export async function loadConfig() {
  try {
    const raw = canUseChromeStorage() ? await chromeStorageGet() : localStorageGet();
    return migrateConfig(raw);
  } catch (_err) {
    return migrateConfig(undefined);
  }
}

export async function saveConfig(config) {
  const normalized = migrateConfig(config);
  if (canUseChromeStorage()) {
    await chromeStorageSet(normalized);
    return normalized;
  }
  localStorageSet(normalized);
  return normalized;
}
