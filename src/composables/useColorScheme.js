import { onBeforeUnmount, onMounted, ref } from "vue";

export const COLOR_SCHEME_STORAGE_KEY = "crisprloci-color-scheme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const VALID_SCHEMES = new Set(["light", "dark"]);

function savedScheme(browser) {
  try {
    const value = browser.localStorage?.getItem(COLOR_SCHEME_STORAGE_KEY);
    return VALID_SCHEMES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function systemScheme(browser) {
  return browser.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

export function preferredColorScheme(browser = window) {
  return savedScheme(browser) || systemScheme(browser);
}

export function applyColorScheme(scheme, root = document.documentElement) {
  const next = VALID_SCHEMES.has(scheme) ? scheme : "light";
  root.dataset.theme = next;
  root.style.colorScheme = next;
  root.ownerDocument
    ?.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", next === "dark" ? "#080e0d" : "#292b2f");
  return next;
}

export function initializeColorScheme(browser = window, root = document.documentElement) {
  return applyColorScheme(preferredColorScheme(browser), root);
}

export function useColorScheme(browser = window, root = document.documentElement) {
  const scheme = ref(preferredColorScheme(browser));
  let preference;

  function sync(next) {
    scheme.value = applyColorScheme(next, root);
  }

  function followSystem(event) {
    if (!savedScheme(browser)) sync(event.matches ? "dark" : "light");
  }

  function toggle() {
    const next = scheme.value === "dark" ? "light" : "dark";
    try {
      browser.localStorage?.setItem(COLOR_SCHEME_STORAGE_KEY, next);
    } catch {
      // A blocked storage API must not make the visual control unusable.
    }
    sync(next);
  }

  onMounted(() => {
    sync(preferredColorScheme(browser));
    preference = browser.matchMedia?.(DARK_QUERY);
    preference?.addEventListener?.("change", followSystem);
  });

  onBeforeUnmount(() => preference?.removeEventListener?.("change", followSystem));

  return { scheme, toggle };
}
