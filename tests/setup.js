import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/vue";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
  }
});
