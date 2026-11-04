import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import ColorSchemeToggle from "../src/components/shell/ColorSchemeToggle.vue";
import {
  COLOR_SCHEME_STORAGE_KEY,
  applyColorScheme,
  preferredColorScheme,
} from "../src/composables/useColorScheme.js";

function colorPreference(matches = false) {
  let listener;
  return {
    media: "(prefers-color-scheme: dark)",
    matches,
    addEventListener: vi.fn((_type, next) => {
      listener = next;
    }),
    removeEventListener: vi.fn(),
    change(next) {
      this.matches = next;
      listener?.({ matches: next });
    },
  };
}

function installPreference(preference) {
  if (!document.querySelector('meta[name="theme-color"]')) {
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = "#292b2f";
    document.head.append(themeColor);
  }
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => preference),
  });
}

afterEach(() => {
  delete window.matchMedia;
  document.querySelector('meta[name="theme-color"]')?.remove();
});

describe("color scheme", () => {
  it("starts from the operating-system preference when no choice was saved", () => {
    const preference = colorPreference(true);
    installPreference(preference);

    const { unmount } = render(ColorSchemeToggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#080e0d",
    );
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(preference.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    unmount();
    expect(preference.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("toggles the scheme, updates its accessible name, and remembers the choice", async () => {
    installPreference(colorPreference(false));
    const { unmount } = render(ColorSchemeToggle);

    const darkButton = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(darkButton).toHaveTextContent("Dark");
    await fireEvent.click(darkButton);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveTextContent("Light");

    await fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#292b2f",
    );

    unmount();
    render(ColorSchemeToggle);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  });

  it("tracks system changes until the visitor makes an explicit choice", async () => {
    const preference = colorPreference(false);
    installPreference(preference);
    render(ColorSchemeToggle);

    preference.change(true);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeVisible(),
    );

    await fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    preference.change(true);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("ignores an invalid stored value and applies only supported schemes", () => {
    installPreference(colorPreference(true));
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "sepia");
    expect(preferredColorScheme()).toBe("dark");
    expect(applyColorScheme("sepia")).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
