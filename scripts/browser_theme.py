#!/usr/bin/env python3
"""Verify color-scheme behavior and contrast against a local production build."""

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


def channel(value):
    value /= 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(css_color):
    match = re.fullmatch(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)", css_color)
    if not match:
        raise AssertionError(f"Unsupported computed color: {css_color}")
    red, green, blue = (channel(int(item)) for item in match.groups())
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast(foreground, background):
    lighter, darker = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def style_pair(page, foreground_selector, background_selector=None):
    return page.evaluate(
        """([foregroundSelector, backgroundSelector]) => {
          const foreground = document.querySelector(foregroundSelector);
          const background = document.querySelector(backgroundSelector || foregroundSelector);
          return {
            foreground: getComputedStyle(foreground).color,
            background: getComputedStyle(background).backgroundColor,
          };
        }""",
        [foreground_selector, background_selector],
    )


def install_api(page, origin):
    def api(route):
        path = urlsplit(route.request.url).path
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "authorization,content-type",
        }
        if route.request.method == "OPTIONS":
            route.fulfill(status=204, headers=headers)
            return
        if path.endswith("/health"):
            data = {"version": "2.14.1"}
        elif path.endswith("/config"):
            data = {
                "modes": ["detection", "loci", "cas", "tracrrna", "repeats"],
                "max_total_bases": 20000,
                "max_record_bases": 20000,
                "max_records": 1000,
                "max_request_bytes": 100000,
            }
        else:
            raise AssertionError(f"Unexpected request: {path}")
        route.fulfill(
            status=200,
            headers=headers,
            content_type="application/json",
            body=json.dumps(data),
        )

    page.route("https://analysis.example.org/**", api)


def check(origin, output):
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    ratios = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                color_scheme="dark", viewport={"width": 1440, "height": 1050}
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            install_api(page, origin)
            page.goto(origin)
            page.wait_for_load_state("networkidle")

            expect(page.locator("html")).to_have_attribute("data-theme", "dark")
            assert (
                page.locator('meta[name="theme-color"]').get_attribute("content") == "#080e0d"
            )
            expect(page.get_by_role("button", name="Switch to light mode")).to_be_visible()
            assert page.evaluate("getComputedStyle(document.documentElement).colorScheme") == "dark"

            checks = {
                "page_text": ("html", "body"),
                "navigation": (".nav-shell nav > a", ".hero"),
                "secondary_method_text": (".method-link span", "body"),
            }
            for name, selectors in checks.items():
                colors = style_pair(page, *selectors)
                ratios[name] = round(contrast(colors["foreground"], colors["background"]), 2)
                assert ratios[name] >= 4.5, (name, colors, ratios[name])

            page.screenshot(path=output / "dark-desktop.png", full_page=True)

            # With no saved choice, a live operating-system change is followed.
            page.emulate_media(color_scheme="light")
            expect(page.locator("html")).to_have_attribute("data-theme", "light")
            assert (
                page.locator('meta[name="theme-color"]').get_attribute("content") == "#292b2f"
            )
            expect(page.get_by_role("button", name="Switch to dark mode")).to_be_visible()

            # Keyboard activation makes an explicit choice that is not overwritten by the OS.
            toggle = page.get_by_role("button", name="Switch to dark mode")
            toggle.focus()
            expect(toggle).to_be_focused()
            toggle.press("Enter")
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")
            assert page.evaluate("localStorage.getItem('crisprloci-color-scheme')") == "dark"
            page.emulate_media(color_scheme="light")
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")

            page.reload()
            page.wait_for_load_state("networkidle")
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")

            page.get_by_role("link", name="Detect arrays", exact=True).click()
            heading = page.get_by_role("heading", name="Detect arrays", exact=True)
            expect(heading).to_be_visible()
            expect(heading).to_be_focused()
            input_colors = style_pair(page, "#fasta-input")
            ratios["sequence_input"] = round(
                contrast(input_colors["foreground"], input_colors["background"]), 2
            )
            assert ratios["sequence_input"] >= 7, (input_colors, ratios["sequence_input"])
            page.screenshot(path=output / "dark-input-desktop.png", full_page=True)

            page.set_viewport_size({"width": 390, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            expect(page.get_by_role("button", name="Switch to light mode")).to_have_css(
                "width", "44px"
            )
            heading.focus()
            expect(heading).to_be_focused()
            skip_state = page.locator("#skip-link").evaluate(
                """element => ({
                  focused: element.matches(':focus'),
                  position: getComputedStyle(element).position,
                  transform: getComputedStyle(element).transform,
                  top: element.getBoundingClientRect().top,
                  bottom: element.getBoundingClientRect().bottom,
                })"""
            )
            assert not skip_state["focused"] and skip_state["bottom"] <= 0, skip_state
            page.screenshot(path=output / "dark-input-mobile.png", full_page=True)

            page.set_viewport_size({"width": 1440, "height": 1050})
            page.get_by_role("button", name="Load example", exact=True).click()
            view_example = page.get_by_role("button", name="View precomputed result", exact=True)
            expect(view_example).to_be_enabled()
            view_example.click()
            expect(page.locator(".results")).to_be_visible()
            result_colors = style_pair(page, ".results")
            ratios["result_panel"] = round(
                contrast(result_colors["foreground"], result_colors["background"]), 2
            )
            assert ratios["result_panel"] >= 7, (result_colors, ratios["result_panel"])
            page.screenshot(path=output / "dark-result-desktop.png", full_page=True)

            page.set_viewport_size({"width": 390, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            page.screenshot(path=output / "dark-result-mobile.png", full_page=True)

            page.get_by_role("button", name="Switch to light mode").click()
            expect(page.locator("html")).to_have_attribute("data-theme", "light")
            assert page.evaluate("localStorage.getItem('crisprloci-color-scheme')") == "light"
            page.wait_for_timeout(250)
            page.screenshot(path=output / "light-result-mobile.png", full_page=True)
            context.close()

            clean_context = browser.new_context(
                color_scheme="light", viewport={"width": 1280, "height": 800}
            )
            clean_page = clean_context.new_page()
            clean_page.on("pageerror", lambda error: errors.append(str(error)))
            install_api(clean_page, origin)
            clean_page.goto(origin)
            clean_page.wait_for_load_state("networkidle")
            expect(clean_page.locator("html")).to_have_attribute("data-theme", "light")
            expect(clean_page.get_by_role("button", name="Switch to dark mode")).to_be_visible()
            clean_context.close()

            contrast_context = browser.new_context(
                color_scheme="dark",
                contrast="more",
                reduced_motion="reduce",
                viewport={"width": 1280, "height": 800},
            )
            contrast_page = contrast_context.new_page()
            contrast_page.on("pageerror", lambda error: errors.append(str(error)))
            install_api(contrast_page, origin)
            contrast_page.goto(origin)
            contrast_page.wait_for_load_state("networkidle")
            contrast_colors = style_pair(contrast_page, ".method-link span", "body")
            ratios["high_contrast_secondary_text"] = round(
                contrast(contrast_colors["foreground"], contrast_colors["background"]), 2
            )
            assert ratios["high_contrast_secondary_text"] >= 7, (
                contrast_colors,
                ratios["high_contrast_secondary_text"],
            )
            contrast_context.close()

            assert not errors, errors
            receipt = {
                "status": "passed",
                "api": "intercepted local fixtures; no scientific jobs submitted",
                "contrast_ratios": ratios,
                "checks": [
                    "system light and dark preferences",
                    "live system preference changes before an explicit choice",
                    "keyboard toggle activation and accessible state",
                    "saved preference across reloads",
                    "desktop and 390px mobile layouts without overflow",
                    "dark method picker and sequence-input rendering",
                    "dark precomputed-result rendering",
                    "dark high-contrast and reduced-motion preferences",
                    "WCAG AA text contrast samples",
                    "no JavaScript exceptions",
                ],
            }
            (output / "acceptance.json").write_text(json.dumps(receipt, indent=2) + "\n")
            print("Color-scheme browser acceptance passed:", output)
        finally:
            browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="http://127.0.0.1:4189")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    check(args.origin.rstrip("/"), args.output)
