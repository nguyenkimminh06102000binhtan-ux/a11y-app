import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const toggle = (page: Page) => page.getByRole("button", { name: "Accessibility" });
const panel = (page: Page) => page.getByRole("region", { name: "Accessibility settings" });
const closeButton = (page: Page) => page.getByRole("button", { name: "Close", exact: true });

/** The dashboard's answer in these tests (no dashboard runs here). Default: allowed, our colors, nothing on by default. */
const CONFIG = { v: 1, enabled: true, theme: {}, defaults: {} };
async function serveConfig(page: Page, config: object | null) {
    // The last route registered wins, so a test can replace the default below. null = the dashboard is unreachable.
    await page.route("**/api/widget/config?**", (route) =>
        config ? route.fulfill({ json: config, headers: { "Access-Control-Allow-Origin": "*" } }) : route.abort()
    );
}
test.beforeEach(({ page }) => serveConfig(page, CONFIG));



async function turnOn(page: Page, label: string) {
    await toggle(page).click();
    await page.getByRole("checkbox", { name: label }).check();
}

/** Open the panel and pick a level of a level setting, e.g. choose(page, "Font", "Wide"). */
async function choose(page: Page, setting: string, level: string) {
    await toggle(page).click();
    await page.getByRole("group", { name: setting }).getByRole("radio", { name: level, exact: true }).check();
}

/** A silent 2-second WAV as a blob URL on the page: autoplay tests need no files and no network. */
async function silentWavUrl(page: Page): Promise<string> {
    return page.evaluate(() => {
        const rate = 8000;
        const samples = rate * 2;
        const buf = new ArrayBuffer(44 + samples * 2);
        const v = new DataView(buf);
        const text = (offset: number, s: string) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
        text(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); text(8, "WAVE");
        text(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        text(36, "data"); v.setUint32(40, samples * 2, true);
        return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    });
}

/** Adds a muted looping video and an unmuted audio, both autoplaying a silent WAV. */
async function addAutoplayMedia(page: Page, inComponent = false) {
    const src = await silentWavUrl(page);
    await page.evaluate(({ inComponent, src }) => {
        const holder = document.createElement("div");
        holder.innerHTML = `<video id="test-video" muted loop autoplay src="${src}"></video>
                            <audio id="test-audio" loop autoplay src="${src}"></audio>`;
        holder.querySelectorAll("video, audio").forEach((el) =>
            el.addEventListener("play", () => ((el as HTMLElement).dataset.played = "yes"))
        );
        const target = inComponent ? document.querySelector("link-card")!.shadowRoot! : document.body;
        target.appendChild(holder);
    }, { inComponent, src });
}


function mediaState(page: Page, inComponent = false) {
    return page.evaluate((inComponent) => {
        const root: Document | ShadowRoot = inComponent ? document.querySelector("link-card")!.shadowRoot! : document;
        const video = root.querySelector<HTMLVideoElement>("#test-video")!;
        const audio = root.querySelector<HTMLAudioElement>("#test-audio")!;
        return {
            videoPlayed: video.dataset.played === "yes",
            videoPaused: video.paused,
            audioPaused: audio.paused,
        };
    }, inComponent);
}

/**
 * A <video-card> whose shadow root autoplays a muted video as soon as it's created.
 * defineLate: the element is on the page first and only defined later, so the browser upgrades it
 * with no DOM change at all: only the once-a-second rescan can find it.
 */
async function addVideoComponent(page: Page, defineLate: boolean) {
    const src = await silentWavUrl(page);
    if (defineLate) {
        await page.evaluate(() => document.body.appendChild(document.createElement("video-card")));
        await page.waitForTimeout(700); // let the observer's batch (max 500ms) pass while it's still undefined
    }
    await page.evaluate(({ src, defineLate }) => {
        customElements.define("video-card", class extends HTMLElement {
            connectedCallback() {
                if (this.shadowRoot) return;
                const root = this.attachShadow({ mode: "open" });
                root.innerHTML = `<video id="test-video" muted loop autoplay src="${src}"></video>`;
                const video = root.getElementById("test-video") as HTMLVideoElement;
                video.addEventListener("play", () => (video.dataset.played = "yes"));
            }
        });
        if (!defineLate) document.body.appendChild(document.createElement("video-card"));
    }, { src, defineLate });
}

function videoCardState(page: Page) {
    return page.evaluate(() => {
        const video = document.querySelector("video-card")!.shadowRoot!.getElementById("test-video") as HTMLVideoElement;
        return { played: video.dataset.played === "yes", paused: video.paused };
    });
}

const GIF_1PX = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
async function routeTestGifs(page: Page) {
    const body = Buffer.from(GIF_1PX, "base64");
    // No CORS headers: the cross-origin GIF can be drawn but not read back, like a real third-party GIF
    await page.route(/\/test-[\w-]+\.gif$|cross-origin\.test/, (route) => route.fulfill({ body, contentType: "image/gif" }));
}

/** Same-origin <img>, <picture>, cross-origin <img> and a CSS background GIF. Waits until the images have loaded. */
async function addGifs(page: Page) {
    await page.evaluate(() => {
        document.body.insertAdjacentHTML(
            "beforeend",
            `<div id="gif-fixtures">
         <img id="gif-same" src="/test-same.gif" alt="Dancing cat" width="40" height="40">
         <picture><source srcset="/test-picture.gif"><img id="gif-picture" src="/test-picture.gif" alt="Picture cat" width="40" height="40"></picture>
         <img id="gif-cross" src="https://cross-origin.test/cat.gif" alt="Cross-origin cat" width="40" height="40">
         <span id="gif-bg" style="display:inline-block;width:40px;height:40px;background-image:url(/test-bg.gif)"></span>
       </div>`
        );
    });
    await page.waitForFunction(() =>
        ["gif-same", "gif-picture", "gif-cross"].every((id) => {
            const img = document.getElementById(id) as HTMLImageElement;
            return img.complete && img.naturalWidth > 0;
        })
    );
}

/**
 * How to check each setting inside a given area, keyed by the setting's public id. A test fails if a
 * setting in the panel has no entry here: adding a setting means adding its ignore check too.
 */
type Probe = {
    fixture: string; // HTML placed both in an area that opts out of the setting and in a normal area
    turnOn: (page: Page) => Promise<void>;
    read: (page: Page, area: string) => Promise<string>; // something the setting changes, read inside #area
};

/** Settings that recolor the whole screen through the lens (core/lens.ts): no area can be excluded from them. */
/** Opt-out tested with the feature itself (Page structure's lists, Read aloud's voice). */
const TESTED_WITH_THEMSELVES = ["page-structure", "read-aloud"];

const SCREEN_WIDE = ["color", "reading-aid"]; // reading-aid: a layer over the screen, following the pointer

const PROBES: Record<string, Probe> = {
    "big-cursor": {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: (page) => choose(page, "Big cursor", "Black"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).cursor),
    },
    contrast: {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: (page) => choose(page, "Contrast", "Dark"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).backgroundColor),
    },
    "hide-images": {
        fixture: `<img class="probe" alt="Probe" width="20" height="20" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E">`,
        turnOn: (page) => turnOn(page, "Hide images"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).objectPosition),
    },
    "text-size": {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: async (page) => {
            await toggle(page).click();
            await page.getByRole("radio", { name: "Larger (150%)" }).check();
        },
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).fontSize),
    },
    "line-height": {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: (page) => choose(page, "Line height", "Double (2)"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).lineHeight),
    },
    font: {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: (page) => choose(page, "Font", "Wide"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).fontFamily),
    },
    "text-align": {
        fixture: `<p class="probe" style="text-align: center">Some text</p>`,
        turnOn: (page) => choose(page, "Align text", "Left"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).textAlign),
    },
    "image-descriptions": {
        // Centered with room below, so it never ends up under the widget's button in the bottom corner
        fixture: `<img class="probe" alt="Probe image" width="80" height="40" style="display: block; margin: 0 auto 240px"
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40'/%3E%3C/svg%3E">`,
        turnOn: async (page) => {
            await turnOn(page, "Image descriptions");
            await closeButton(page).click(); // the open panel can cover the images (the hostile page is right-to-left)
        },
        read: async (page, area) => {
            await page.mouse.move(0, 0);
            // Mid-screen: the hostile page's fixed header and cookie banner cover the top and bottom
            await page.locator(`#${area} .probe`).evaluate((el) => el.scrollIntoView({ block: "center" }));
            await page.locator(`#${area} .probe`).hover();
            await page.waitForTimeout(300); // longer than the label's show delay
            const tip = page.locator("a11yw-root .a11yw-tip");
            return (await tip.count()) && (await tip.isVisible()) ? ((await tip.textContent()) ?? "") : "";
        },
    },
    "highlight-links": {
        fixture: `<a class="probe" href="/probe">A link</a>`,
        turnOn: (page) => turnOn(page, "Highlight links"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).backgroundColor),
    },
    "text-spacing": {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: (page) => choose(page, "Text spacing", "Wide"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).letterSpacing),
    },
    "focus-outline": {
        fixture: `<button type="button" class="start">Start</button> <a class="probe" href="/probe">Focus me</a>`,
        turnOn: (page) => turnOn(page, "Stronger focus outline"),
        read: async (page, area) => {
            // Focus by keyboard (Tab), so :focus-visible applies
            await page.locator(`#${area} .start`).focus();
            await page.keyboard.press("Tab");
            return page.locator(`#${area} .probe`).evaluate((el) => `${document.activeElement === el}:${getComputedStyle(el).outlineStyle}`);
        },
    },
    "pause-animations": {
        // A CSS animation (handled by the setting's CSS) and an SVG animation (handled by its JavaScript)
        fixture: `<style>@keyframes probe-spin { to { transform: rotate(1turn); } } .spin { animation: probe-spin 1s linear infinite; }</style>
                  <div class="spin">spin</div>
                  <svg class="probe-svg" width="10" height="10"><circle cx="5" cy="5" r="3">
                    <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" /></circle></svg>`,
        turnOn: (page) => turnOn(page, "Pause animations"),
        read: (page, area) =>
            page.locator(`#${area}`).evaluate((root) => {
                const css = root.querySelector(".spin")!.getAnimations().some((a) => a.playState === "running");
                const svg = (root.querySelector(".probe-svg") as unknown as SVGSVGElement).animationsPaused();
                return `css:${css ? "running" : "stopped"} svg:${svg ? "paused" : "running"}`;
            }),
    },
};

/** axe scan of the widget only. The hostile page's own problems are deliberate and not ours. */
async function widgetViolations(page: Page) {
    const results = await new AxeBuilder({ page }).include("a11yw-root").withTags(WCAG).analyze();
    // Readable failure output: "rule-id: selector, selector"
    return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const path of ["/", "/hostile.html", "/components.html"]) {
    test.describe(`widget on ${path}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(path);
            await expect(toggle(page)).toBeVisible(); // mounts after the page's load event
        });

        test("loads the hashed app with an integrity check", async ({ page }) => {
            await expect(page.locator("head script[integrity][crossorigin='anonymous']")).toHaveCount(1);
        });

        test("has no WCAG violations, closed and open", async ({ page }) => {
            expect(await widgetViolations(page)).toEqual([]);
            await toggle(page).click();
            await expect(panel(page)).toBeVisible();
            expect(await widgetViolations(page)).toEqual([]);
        });

        test("page styles don't leak in", async ({ page }) => {
            const style = await toggle(page).evaluate((el) => {
                const s = getComputedStyle(el);
                return { font: s.fontFamily, color: s.color, direction: s.direction, letterSpacing: s.letterSpacing };
            });
            expect(style.font).not.toContain("Comic Sans");
            expect(style.color).toBe("rgb(255, 255, 255)");
            expect(style.direction).toBe("ltr");
            expect(style.letterSpacing).toBe("normal");

            const lang = await toggle(page).evaluate((el) => el.closest("[lang]")?.getAttribute("lang"));
            expect(lang).toBe("en");
        });

        test("stays in the bottom-right corner, on top, while scrolling", async ({ page }) => {
            for (const scrollY of [0, 2000]) {
                await page.evaluate((y) => window.scrollTo(0, y), scrollY);
                const box = await toggle(page).boundingBox();
                const viewport = page.viewportSize()!;
                expect(box).not.toBeNull();
                expect(box!.x + box!.width).toBeGreaterThan(viewport.width - 40);
                expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 40);

                // Nothing on the page covers it (e.g. the hostile page's cookie banner)
                const topTag = await page.evaluate(
                    ([x, y]) => document.elementFromPoint(x, y)?.tagName,
                    [box!.x + box!.width / 2, box!.y + box!.height / 2]
                );
                expect(topTag).toBe("A11YW-ROOT");
            }
        });

        test("keyboard: Enter opens, Escape closes and returns focus, page never sees Escape", async ({ page }) => {
            const pageEscapes: string[] = [];
            page.on("console", (msg) => {
                if (msg.text() === "PAGE saw Escape") pageEscapes.push(msg.text());
            });

            await toggle(page).focus();
            await page.keyboard.press("Enter");
            await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
            await expect(panel(page)).toBeVisible();
            await expect(closeButton(page)).toBeFocused(); // focus moves into the panel: keyboard users start at the settings

            await page.keyboard.press("Shift+Tab"); // and can step straight back to the launcher
            await expect(toggle(page)).toBeFocused();
            await page.keyboard.press("Tab");
            await expect(closeButton(page)).toBeFocused();


            await page.keyboard.press("Escape");
            await expect(panel(page)).toBeHidden();
            await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
            await expect(toggle(page)).toBeFocused();

            if (path === "/hostile.html") {
                // Positive control: an Escape pressed on the page itself IS seen, so the listener works...
                await page.locator("h1").click();
                await page.keyboard.press("Escape");
                await expect.poll(() => pageEscapes.length).toBe(1); // ...and the widget's Escape earlier was not.
            }


        });

        test("Close button closes and returns focus", async ({ page }) => {
            await toggle(page).click();
            await closeButton(page).click();
            await expect(panel(page)).toBeHidden();
            await expect(toggle(page)).toBeFocused();
        });

        test("panel stays open while the visitor uses the page", async ({ page }) => {
            await toggle(page).click();
            await page.locator("h1").click();
            await expect(panel(page)).toBeVisible();
        });

        test("focus ring is visible, also in forced-colors mode", async ({ page }) => {
            for (const forcedColors of ["none", "active"] as const) {
                await page.emulateMedia({ forcedColors });
                await toggle(page).focus();
                const ring = await toggle(page).evaluate((el) => {
                    const s = getComputedStyle(el);
                    return { focusVisible: el.matches(":focus-visible"), style: s.outlineStyle, width: s.outlineWidth };
                });
                expect(ring).toEqual({ focusVisible: true, style: "solid", width: "3px" });
            }
        });

        test("buttons are at least 44px tall at default text size", async ({ page }) => {
            await toggle(page).click();
            for (const button of [toggle(page), closeButton(page)]) {
                const box = await button.boundingBox();
                expect(box!.height).toBeGreaterThanOrEqual(44); // WCAG 2.5.8 minimum is 24; 44 is our own standard
            }
        });

        test("a setting's whole tile toggles it, and 'on' is shown by more than color", async ({ page }) => {
            await toggle(page).click();
            const tile = page.locator("a11yw-root li[data-feature-id='highlight-links']");
            const badge = tile.locator(".check-badge");
            await expect(badge).toBeHidden();

            await tile.scrollIntoViewIfNeeded(); // the panel body scrolls; a visitor scrolls to it first
            const box = (await tile.boundingBox())!;
            await page.mouse.click(box.x + 12, box.y + box.height - 12); // a corner, away from the label text
            await expect(page.getByRole("checkbox", { name: "Highlight links" })).toBeChecked();
            await expect(badge).toBeVisible(); // the check mark, not only the tint
        });



        test("Highlight links: applies to the page, survives reload, resets", async ({ page }) => {
            const linkBackground = () =>
                page.locator("a[href]").first().evaluate((el) => getComputedStyle(el).backgroundColor);
            const before = await linkBackground();

            await toggle(page).click();
            await page.getByRole("checkbox", { name: "Highlight links" }).check();
            expect(await linkBackground()).toBe("rgb(255, 255, 0)"); // wins against the hostile page's !important too

            // Remembered, and applied before the panel is ever opened
            await page.reload();
            await expect(toggle(page)).toBeVisible();
            expect(await linkBackground()).toBe("rgb(255, 255, 0)");

            await toggle(page).click();
            await expect(page.getByRole("checkbox", { name: "Highlight links" })).toBeChecked();
            await page.getByRole("button", { name: "Reset all" }).click();
            expect(await linkBackground()).toBe(before);
            expect(await page.evaluate(() => localStorage.getItem("a11yw:settings:v1"))).toBeNull();
            await expect(page.locator("#a11yw-page-adjustments")).toHaveCount(0); // nothing left behind
        });

        test("survives junk in saved settings", async ({ page }) => {
            const errors: string[] = [];
            page.on("pageerror", (e) => errors.push(e.message));
            await page.addInitScript(() => localStorage.setItem("a11yw:settings:v1", "{not json"));

            await page.reload();
            await expect(toggle(page)).toBeVisible();
            expect(errors).toEqual([]);
        });

        test("a saved level that isn't one of the setting's levels falls back to Default", async ({ page }) => {
            for (const textSize of [4, -1, 1.5, "2"]) {
                await page.evaluate((value) => localStorage.setItem("a11yw:settings:v1", JSON.stringify({ textSize: value, textSpacing: true })), textSize);
                await page.reload();
                await toggle(page).click();
                await expect(page.getByRole("group", { name: "Text size" }).getByRole("radio", { name: "Default" }), String(textSize)).toBeChecked();
                await expect(page.getByRole("group", { name: "Text spacing" }).getByRole("radio", { name: "Wide", exact: true })).toBeChecked(); // the rest is kept (an old saved `true` = Wide)
            }
        });

        test("settings are grouped under section headings, in order, and empty sections don't show", async ({ page }) => {
            await toggle(page).click();
            const headings = panel(page).getByRole("heading", { level: 3 });
            await expect(headings).toHaveText(["Profiles", "Content", "Appearance", "Navigation", "Tools"]);
            for (const [section, settings] of [
                ["Content", ["Text size", "Text spacing", "Line height", "Font", "Align text", "Image descriptions"]],
                ["Appearance", ["Contrast", "Color", "Hide images", "Pause animations"]],
                ["Navigation", ["Reading aid", "Big cursor", "Highlight links", "Stronger focus outline", "Page structure"]],
                ["Tools", ["Read aloud"]],
            ] as const) {
                const list = panel(page).getByRole("list", { name: section }); // each list is named by its heading
                for (const name of settings) {
                    const isLevels = ["Text size", "Text spacing", "Line height", "Font", "Align text", "Contrast", "Color", "Reading aid", "Big cursor"].includes(name);
                    const role = isLevels ? "group" : name === "Page structure" ? "button" : "checkbox";
                    await expect(list.getByRole(role, { name })).toBeVisible();
                }
                await expect(list.getByRole("listitem")).toHaveCount(settings.length);
            }
            // Every section reachable and accessible on phones, tablets, desktops and at 200% zoom (1280×900 → 640×450)
            for (const [width, height] of [[320, 640], [768, 1024], [1280, 900], [640, 450]] as const) {
                await page.setViewportSize({ width, height });
                await panel(page).getByRole("checkbox", { name: "Read aloud" }).scrollIntoViewIfNeeded(); // the last item
                await expect(panel(page).getByRole("checkbox", { name: "Read aloud" })).toBeInViewport();
                expect(await widgetViolations(page), `${width}×${height}`).toEqual([]);
            }
            // Text size's segments follow its number of levels
            expect(await panel(page).locator(".level-options").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(4);
        });

        test("Text spacing applies WCAG 1.4.12 values to the page, not the widget", async ({ page }) => {
            await choose(page, "Text spacing", "Wide");

            const p = await page.locator("main p, body > p").first().evaluate((el) => {
                const s = getComputedStyle(el);
                const font = parseFloat(s.fontSize);
                return {
                    lineHeight: parseFloat(s.lineHeight) / font,
                    letterSpacing: parseFloat(s.letterSpacing) / font,
                    wordSpacing: parseFloat(s.wordSpacing) / font,
                    marginBottom: parseFloat(s.marginBottom) / font,
                };
            });
            expect(p.lineHeight).toBeCloseTo(1.5, 1);
            expect(p.letterSpacing).toBeCloseTo(0.12, 2); // also beats the hostile page's letter-spacing: 2px !important
            expect(p.wordSpacing).toBeCloseTo(0.16, 2);
            expect(p.marginBottom).toBeCloseTo(2, 1);

            // The widget keeps its own spacing
            const hint = await page.getByText("Adds space between lines").evaluate((el) => getComputedStyle(el).letterSpacing);
            expect(hint).toBe("normal");
        });

        test("Stronger focus outline beats the page's own focus styles", async ({ page }) => {
            await turnOn(page, "Stronger focus outline");

            // Click the heading, then Tab: the browser treats this as keyboard focus, so :focus-visible applies
            await page.locator("h1").click();
            await page.keyboard.press("Tab");
            const ring = await page.evaluate(() => {
                const s = getComputedStyle(document.activeElement!);
                return { tag: document.activeElement!.tagName, style: s.outlineStyle, width: s.outlineWidth };
            });
            expect(ring).toEqual({ tag: "A", style: "solid", width: "3px" }); // hostile page has *:focus { outline: none !important }
        });

        test("Pause animations stops CSS movement without hiding content", async ({ page }) => {
            await page.evaluate(() => {
                const style = document.createElement("style");
                style.textContent = `
                    @keyframes test-spin { to { transform: rotate(360deg); } }
                    @keyframes test-fade { from { opacity: 0; } to { opacity: 1; } }
                    html { scroll-behavior: smooth; }
                    #test-spinner { animation: test-spin 1s linear infinite; }
                    #test-fade { opacity: 0; animation: test-fade 10s forwards; }
                `;
                document.head.appendChild(style);
                document.body.insertAdjacentHTML("beforeend", '<div id="test-spinner">spin</div><div id="test-fade">fade</div>');
            });
            const state = () =>
                page.evaluate(() => ({
                    spinnerRunning: document.getElementById("test-spinner")!.getAnimations().some((a) => a.playState === "running"),
                    fadeOpacity: getComputedStyle(document.getElementById("test-fade")!).opacity,
                    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
                }));

            expect((await state()).spinnerRunning).toBe(true); // proves the test elements really animate
            await turnOn(page, "Pause animations");
            // Spinner stopped, fade-in finished (visible, not stuck at opacity 0), smooth scrolling off
            await expect.poll(state).toEqual({ spinnerRunning: false, fadeOpacity: "1", scrollBehavior: "auto" });
        });

        test("Pause animations pauses autoplay but lets the visitor press play", async ({ page }) => {
            const play = () =>
                page.evaluate(() => (document.getElementById("test-video") as HTMLVideoElement).play().catch(() => { }));

            await addAutoplayMedia(page);
            await expect.poll(() => mediaState(page)).toEqual({ videoPlayed: true, videoPaused: false, audioPaused: false });

            // 1. Turning it on pauses what's playing
            await turnOn(page, "Pause animations");
            await expect.poll(() => mediaState(page)).toMatchObject({ videoPaused: true, audioPaused: true });

            // 2. A script calling play() is paused again (our own checkbox click doesn't count as the visitor)
            await play();
            await expect.poll(() => mediaState(page)).toMatchObject({ videoPaused: true });

            // 3. Turning it off resumes the muted video only: unmuted audio never restarts by surprise
            await page.getByRole("checkbox", { name: "Pause animations" }).uncheck();
            await expect.poll(() => mediaState(page)).toMatchObject({ videoPaused: false, audioPaused: true });

            // 4. With it on again, a real click on the page followed by play is allowed
            await page.getByRole("checkbox", { name: "Pause animations" }).check();
            await expect.poll(() => mediaState(page)).toMatchObject({ videoPaused: true });
            await page.locator("h1").click();
            await play();
            await page.waitForTimeout(300); // give the widget a chance to (wrongly) pause it
            expect((await mediaState(page)).videoPaused).toBe(false);
        });
        test("Pause animations freezes GIFs in place, keeps alt text, and restores them", async ({ page }) => {
            await routeTestGifs(page);
            await addGifs(page);

            const state = () =>
                page.evaluate(() => {
                    const img = (id: string) => document.getElementById(id) as HTMLImageElement;
                    return {
                        same: img("gif-same").currentSrc.slice(0, 22),
                        sameAlt: img("gif-same").alt,
                        picture: img("gif-picture").currentSrc.slice(0, 22),
                        crossHidden: getComputedStyle(img("gif-cross")).display === "none",
                        background: getComputedStyle(document.getElementById("gif-bg")!).backgroundImage.slice(0, 27),
                    };
                });

            await turnOn(page, "Pause animations");
            await expect.poll(state).toEqual({
                same: "data:image/png;base64,",       // same element, now a still PNG
                sameAlt: "Dancing cat",               // alt kept
                picture: "data:image/png;base64,",    // <source> no longer wins over the still
                crossHidden: true,                    // cross-origin: covered by a canvas...
                background: 'url("data:image/png;base64,',
            });
            // ...which screen readers announce with the original alt text
            await expect(page.getByRole("img", { name: "Cross-origin cat" })).toHaveJSProperty("tagName", "CANVAS");

            await page.getByRole("checkbox", { name: "Pause animations" }).uncheck();
            await expect.poll(() =>
                page.evaluate(() => ({
                    same: document.getElementById("gif-same")!.getAttribute("src"),
                    pictureSource: document.querySelector("#gif-fixtures source")!.getAttribute("srcset"),
                    crossVisible: getComputedStyle(document.getElementById("gif-cross")!).display !== "none",
                    canvases: document.querySelectorAll("#gif-fixtures canvas").length,
                    background: getComputedStyle(document.getElementById("gif-bg")!).backgroundImage.includes("test-bg.gif"),
                }))
            ).toEqual({ same: "/test-same.gif", pictureSource: "/test-picture.gif", crossVisible: true, canvases: 0, background: true });
        });
        for (const [id, probe] of Object.entries(PROBES)) {
            test(`data-a11yw-ignore="${id}" keeps an area out of that setting`, async ({ page }) => {
                await page.evaluate(({ id, fixture }) => {
                    document.body.insertAdjacentHTML(
                        "beforeend",
                        `<div id="ignored-area" data-a11yw-ignore="${id}">${fixture}</div><div id="normal-area">${fixture}</div>`
                    );
                }, { id, fixture: probe.fixture });
                const before = { ignored: await probe.read(page, "ignored-area"), normal: await probe.read(page, "normal-area") };

                await probe.turnOn(page);
                await expect.poll(() => probe.read(page, "normal-area")).not.toBe(before.normal); // the setting works here...
                expect(await probe.read(page, "ignored-area")).toBe(before.ignored);              // ...but not in the opted-out area
            });
        }

        test("data-a11yw-ignore keeps a section of the page untouched", async ({ page }) => {
            await page.evaluate(() => {
                document.body.insertAdjacentHTML(
                    "beforeend",
                    `<div data-a11yw-ignore><a href="/ignored" id="ignored-link">Ignored link</a></div>
                     <a href="/normal" id="normal-link">Normal link</a>`
                );
            });
            const background = (id: string) =>
                page.evaluate((id) => getComputedStyle(document.getElementById(id)!).backgroundColor, id);
            const ignoredBefore = await background("ignored-link");

            await turnOn(page, "Highlight links");
            expect(await background("normal-link")).toBe("rgb(255, 255, 0)");
            expect(await background("ignored-link")).toBe(ignoredBefore);
        });
        test("Text size enlarges the page's text in 3 levels, not the widget, and restores it", async ({ page }) => {
            const pageText = () => page.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
            const widgetText = () => toggle(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
            const original = await pageText();
            const widgetBefore = await widgetText();

            await toggle(page).click();
            for (const [name, scale] of [["Large (125%)", 1.25], ["Larger (150%)", 1.5], ["Largest (200%)", 2]] as const) {
                await page.getByRole("radio", { name }).check();
                expect(await pageText()).toBeCloseTo(original * scale, 0);
            }
            expect(await widgetText()).toBe(widgetBefore); // the widget keeps its own size

            // Remembered after a reload (applied once the page has loaded)
            await page.reload();
            await expect(toggle(page)).toBeVisible();
            await expect.poll(pageText).toBeCloseTo(original * 2, 0);

            // Reset leaves no trace
            await toggle(page).click();
            await page.getByRole("button", { name: "Reset all" }).click();
            expect(await pageText()).toBeCloseTo(original, 1);
            expect(await page.locator("h1").evaluate((el) => (el as HTMLElement).style.fontSize)).toBe("");
            expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--a11yw-text-scale"))).toBe("");
        });

        test("Text size: px-sized text grows, and content added later is enlarged once, not twice", async ({ page }) => {
            await page.evaluate(() => {
                document.body.insertAdjacentHTML(
                    "beforeend",
                    `<p id="t-px" style="font-size: 13px">Sized in px</p>
                     <p id="t-parent" style="font-size: 20px">Parent <span id="t-old">old child</span></p>`
                );
            });
            const size = (id: string) => page.evaluate((id) => parseFloat(getComputedStyle(document.getElementById(id)!).fontSize), id);

            await toggle(page).click();
            await page.getByRole("radio", { name: "Larger (150%)" }).check();
            expect(await size("t-px")).toBeCloseTo(19.5, 1);   // 13px × 1.5: px-based sites work
            expect(await size("t-parent")).toBeCloseTo(30, 1);
            expect(await size("t-old")).toBeCloseTo(30, 1);

            // Added after the setting is on: a new paragraph, and a child inside the already enlarged parent
            await page.evaluate(() => {
                document.body.insertAdjacentHTML("beforeend", '<p id="t-late" style="font-size: 10px">Late</p>');
                document.getElementById("t-parent")!.insertAdjacentHTML("beforeend", ' <span id="t-new">new child</span>');
            });
            await expect.poll(() => size("t-late")).toBeCloseTo(15, 1);
            await expect.poll(() => size("t-new")).toBeCloseTo(30, 1); // 20 × 1.5, not 20 × 1.5 × 1.5 = 45
        });
        test("comes back with the visitor's settings when a single-page app replaces the page", async ({ page }) => {
            await turnOn(page, "Highlight links");
            const yellow = (selector: string) =>
                page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);

            // 1. The app re-renders <body>'s contents (client-side navigation)
            await page.evaluate(() => {
                document.body.innerHTML = '<main><h1>New page</h1><p><a href="/next">Next link</a></p></main>';
            });
            await expect(toggle(page)).toBeVisible();
            await expect.poll(() => yellow("a[href='/next']")).toBe("rgb(255, 255, 0)");

            // 2. The app swaps in a brand-new <body>
            await page.evaluate(() => {
                const body = document.createElement("body");
                body.innerHTML = '<h1>Another page</h1><p><a href="/other">Other link</a></p>';
                document.documentElement.replaceChild(body, document.body);
            });
            await expect(toggle(page)).toBeVisible();

            // 3. Something removes the widget and our page styles directly
            await page.evaluate(() => {
                document.querySelector("a11yw-root")!.remove();
                document.getElementById("a11yw-page-adjustments")!.remove();
            });
            await expect(toggle(page)).toBeVisible();
            await expect(page.locator("#a11yw-page-adjustments")).toHaveCount(1);
            await expect.poll(() => yellow("a[href='/other']")).toBe("rgb(255, 255, 0)");

            // Same widget, same state: the panel and the visitor's choice survived
            if ((await toggle(page).getAttribute("aria-expanded")) !== "true") await toggle(page).click();
            await expect(page.getByRole("checkbox", { name: "Highlight links" })).toBeChecked();
        });

        test("Text size survives the page rewriting <html>'s style attribute", async ({ page }) => {
            const h1 = () => page.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
            const original = await h1();
            await toggle(page).click();
            await page.getByRole("radio", { name: "Larger (150%)" }).check();
            expect(await h1()).toBeCloseTo(original * 1.5, 0);

            await page.evaluate(() => document.documentElement.removeAttribute("style")); // e.g. a framework resetting <html>
            await expect.poll(h1).toBeCloseTo(original * 1.5, 0);
        });
    });
}

test.describe("web components (/components.html)", () => {
    const YELLOW = "rgb(255, 255, 0)";
    const background = (page: Page, name: string) =>
        page.getByRole("link", { name, exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);

    async function turnOnHighlightLinks(page: Page) {
        await turnOn(page, "Highlight links");
    }

    test.beforeEach(async ({ page }) => {
        await page.goto("/components.html");
        await expect(toggle(page)).toBeVisible();
    });

    test("Highlight links reaches open shadow roots, nested ones and slotted links", async ({ page }) => {
        await turnOnHighlightLinks(page);
        for (const name of ["Light DOM link", "Open shadow link", "Nested shadow link", "Slotted link"]) {
            await expect.poll(() => background(page, name), { message: name }).toBe(YELLOW);
        }
    });

    test("components added later are adjusted too", async ({ page }) => {
        await turnOnHighlightLinks(page);
        await page.getByRole("button", { name: "Add cards" }).click();
        for (const name of ["Late card link", "Late nested card link"]) {
            await expect.poll(() => background(page, name), { message: name }).toBe(YELLOW); // waits for the observer's batch
        }
    });

    test("a component defined late is adjusted on the next settings change", async ({ page }) => {
        await page.getByRole("button", { name: "Define late component" }).click();
        await turnOnHighlightLinks(page); // the settings change rescans the page
        await expect.poll(() => background(page, "Late-defined link")).toBe(YELLOW);
    });

    test("closed shadow roots are left alone, without errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.reload();
        await expect(toggle(page)).toBeVisible();

        await turnOnHighlightLinks(page);
        await expect.poll(() => background(page, "Open shadow link")).toBe(YELLOW); // proves the setting is on
        const closed = await page.evaluate(() => {
            const root = (window as unknown as { closedRoot: ShadowRoot }).closedRoot;
            return getComputedStyle(root.querySelector("a")!).backgroundColor;
        });
        expect(closed).not.toBe(YELLOW); // known limit: closed roots can't be reached by any outside script
        expect(errors).toEqual([]);
    });

    test("Text spacing applies inside open shadow roots", async ({ page }) => {
        await choose(page, "Text spacing", "Wide");
        const ratio = () =>
            page.getByRole("link", { name: "Open shadow link", exact: true }).evaluate((el) => {
                const s = getComputedStyle(el);
                return parseFloat(s.letterSpacing) / parseFloat(s.fontSize);
            });
        await expect.poll(ratio).toBeCloseTo(0.12, 2);
    });

    test("Pause animations stops CSS movement inside open shadow roots", async ({ page }) => {
        await page.evaluate(() => {
            const holder = document.createElement("div");
            holder.innerHTML = `
                <style>
                    @keyframes test-spin { to { transform: rotate(360deg); } }
                    #test-spinner { animation: test-spin 1s linear infinite; }
                </style>
                <div id="test-spinner">spin</div>`;
            document.querySelector("link-card")!.shadowRoot!.appendChild(holder);
        });
        const running = () =>
            page.evaluate(() =>
                document.querySelector("link-card")!.shadowRoot!.getElementById("test-spinner")!
                    .getAnimations().some((a) => a.playState === "running")
            );

        expect(await running()).toBe(true);
        await turnOn(page, "Pause animations");
        await expect.poll(running).toBe(false);
    });

    test("Pause animations catches autoplay that starts later inside a component", async ({ page }) => {
        await turnOn(page, "Pause animations"); // first, so only the "play" listener on the shadow root can catch it
        await addAutoplayMedia(page, true);
        // videoPlayed proves autoplay really started, so "paused" isn't just "never started"
        await expect.poll(() => mediaState(page, true)).toEqual({ videoPlayed: true, videoPaused: true, audioPaused: true });
    });
    test("Pause animations freezes a GIF loaded later inside a component", async ({ page }) => {
        await routeTestGifs(page);
        await turnOn(page, "Pause animations"); // first, so only the shadow root's "load" listener can catch it
        await page.evaluate(() => {
            const img = document.createElement("img");
            img.id = "late-gif";
            img.alt = "Late cat";
            img.src = "/test-late.gif";
            document.querySelector("link-card")!.shadowRoot!.appendChild(img);
        });
        const src = () =>
            page.evaluate(() => {
                const img = document.querySelector("link-card")!.shadowRoot!.getElementById("late-gif") as HTMLImageElement;
                return img.currentSrc.slice(0, 22);
            });
        await expect.poll(src).toBe("data:image/png;base64,");
    });
    test("Pause animations pauses SVG animations added later inside a component", async ({ page }) => {
        await turnOn(page, "Pause animations");
        await page.evaluate(() => {
            const holder = document.createElement("div");
            holder.innerHTML = `<svg id="test-svg" width="20" height="20"><circle cx="10" cy="10" r="5">
                <animate attributeName="r" values="5;9;5" dur="1s" repeatCount="indefinite" /></circle></svg>`;
            document.querySelector("link-card")!.shadowRoot!.appendChild(holder);
        });
        const paused = () =>
            page.evaluate(() =>
                (document.querySelector("link-card")!.shadowRoot!.getElementById("test-svg") as unknown as SVGSVGElement)
                    .animationsPaused()
            );
        await expect.poll(paused).toBe(true);
    });
    test("Pause animations pauses a video already playing in a component added later", async ({ page }) => {
        await turnOn(page, "Pause animations");
        await addVideoComponent(page, false); // starts playing before the observer's batch finds its shadow root
        await expect.poll(() => videoCardState(page)).toEqual({ played: true, paused: true });
    });

    test("Pause animations reaches a component defined late (no DOM change at all)", async ({ page }) => {
        await turnOn(page, "Pause animations");
        await addVideoComponent(page, true);
        await expect.poll(() => videoCardState(page)).toEqual({ played: true, paused: true }); // found by the 1s rescan
    });
    test("Text size enlarges text inside open shadow roots", async ({ page }) => {
        const link = page.getByRole("link", { name: "Open shadow link", exact: true });
        const original = await link.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        await toggle(page).click();
        await page.getByRole("radio", { name: "Larger (150%)" }).check();
        await expect.poll(() => link.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(original * 1.5, 0);
    });

    test("browsers without constructable stylesheets get a <style> in each shadow root", async ({ page }) => {
        // Pretend to be Safari < 16.4
        await page.addInitScript(() => {
            delete (CSSStyleSheet.prototype as Partial<CSSStyleSheet>).replaceSync;
        });
        await page.reload();
        await expect(toggle(page)).toBeVisible();

        await turnOnHighlightLinks(page);
        for (const name of ["Open shadow link", "Nested shadow link"]) {
            await expect.poll(() => background(page, name), { message: name }).toBe(YELLOW);
        }
        await page.getByRole("button", { name: "Add cards" }).click(); // components added after the setting was on
        await expect.poll(() => background(page, "Late card link")).toBe(YELLOW);

        // Turning it off removes every <style> we added
        await page.getByRole("checkbox", { name: "Highlight links" }).uncheck();
        await expect.poll(() => background(page, "Open shadow link")).not.toBe(YELLOW);
        const leftovers = await page.evaluate(() => {
            const roots: ShadowRoot[] = [];
            const walk = (node: Document | ShadowRoot) =>
                node.querySelectorAll("*").forEach((el) => {
                    if (el.shadowRoot && el.localName !== "a11yw-root") {
                        roots.push(el.shadowRoot);
                        walk(el.shadowRoot);
                    }
                });
            walk(document);
            return roots.filter((r) => r.getElementById("a11yw-page-adjustments")).length;
        });
        expect(leftovers).toBe(0);
    });



});

test.describe("Pause animations: other animation engines (/)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    });

    test("pauses SVG, marquee and script animations; resumes them when turned off", async ({ page }) => {
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<svg id="test-svg" width="20" height="20"><circle cx="10" cy="10" r="5">
                   <animate attributeName="r" values="5;9;5" dur="1s" repeatCount="indefinite" />
                 </circle></svg>
                 <marquee id="test-marquee">Breaking news</marquee>
                 <div id="test-spin">spin</div>
                 <div id="test-fade">fade</div>`
            );
            // Record start()/stop() calls: a marquee has no "is it running?" property to check
            const m = document.getElementById("test-marquee") as HTMLMarqueeElement;
            const stop = m.stop.bind(m);
            const start = m.start.bind(m);
            m.stop = () => { m.dataset.running = "no"; stop(); };
            m.start = () => { m.dataset.running = "yes"; start(); };

            document.getElementById("test-spin")!.animate(
                [{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }],
                { duration: 1000, iterations: Infinity }
            );
            document.getElementById("test-fade")!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 10000, fill: "forwards" });
        });

        const state = () =>
            page.evaluate(() => ({
                svgPaused: (document.getElementById("test-svg") as unknown as SVGSVGElement).animationsPaused(),
                marquee: (document.getElementById("test-marquee") as HTMLElement).dataset.running ?? "untouched",
                spinRunning: document.getElementById("test-spin")!.getAnimations().some((a) => a.playState === "running"),
                fadeOpacity: getComputedStyle(document.getElementById("test-fade")!).opacity,
            }));

        await turnOn(page, "Pause animations");
        await expect.poll(state).toEqual({ svgPaused: true, marquee: "no", spinRunning: false, fadeOpacity: "1" });

        // An endless animation started by a script AFTER the setting was turned on is caught by the regular re-check
        await page.evaluate(() =>
            document.getElementById("test-spin")!.animate([{ opacity: 1 }, { opacity: 0.5 }], { duration: 500, iterations: Infinity })
        );
        await expect.poll(state).toMatchObject({ spinRunning: false });

        await page.getByRole("checkbox", { name: "Pause animations" }).uncheck();
        // Resumed; the fade that was finished stays at its end state (harmless, like our CSS rule)
        await expect.poll(state).toEqual({ svgPaused: false, marquee: "yes", spinRunning: true, fadeOpacity: "1" });
    });

    test("pauses Lottie players and lottie-web, finishes jQuery animations; restores them", async ({ page }) => {
        // Small fakes that follow each library's public API
        await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const animation = { isPaused: false, pause() { this.isPaused = true; }, play() { this.isPaused = false; } };
            w.lottie = { getRegisteredAnimations: () => [animation] };
            w.testLottieAnimation = animation;

            customElements.define("lottie-player", class extends HTMLElement {
                currentState = "playing";
                pause() { this.currentState = "paused"; }
                play() { this.currentState = "playing"; }
            });
            document.body.appendChild(document.createElement("lottie-player"));

            const finished: string[] = [];
            w.jQuery = Object.assign((selector: string) => ({ finish: () => finished.push(selector) }), { fx: { off: false } });
            w.testJqueryFinished = finished;
        });

        const state = () =>
            page.evaluate(() => {
                const w = window as unknown as {
                    testLottieAnimation: { isPaused: boolean };
                    jQuery: { fx: { off: boolean } };
                    testJqueryFinished: string[];
                };
                return {
                    lottieWebPaused: w.testLottieAnimation.isPaused,
                    player: (document.querySelector("lottie-player") as HTMLElement & { currentState: string }).currentState,
                    jqueryFxOff: w.jQuery.fx.off,
                    jqueryFinishedRunning: w.testJqueryFinished.includes(":animated"),
                };
            });

        await turnOn(page, "Pause animations");
        await expect.poll(state).toEqual({ lottieWebPaused: true, player: "paused", jqueryFxOff: true, jqueryFinishedRunning: true });

        // A player that restarts itself (dotLottie does this on scroll) is paused again by the re-check
        await page.evaluate(() => (document.querySelector("lottie-player") as HTMLElement & { play(): void }).play());
        await expect.poll(state).toMatchObject({ player: "paused" });

        await page.getByRole("checkbox", { name: "Pause animations" }).uncheck();
        await expect.poll(state).toMatchObject({ lottieWebPaused: false, player: "playing", jqueryFxOff: false });
    });
    test("pauses YouTube and Vimeo embeds; stops re-pausing one the visitor clicks into", async ({ page }) => {
        // Fake players on the real hosts (no network): each reports every message it receives back to the page
        await page.route(/youtube\.com\/embed|player\.vimeo\.com\/video/, (route) =>
            route.fulfill({
                contentType: "text/html",
                body: `<body style="margin:0;height:100px"><script>
                         addEventListener("message", (e) => parent.postMessage({ testEmbed: location.hostname, data: e.data }, "*"));
                       </script></body>`,
            })
        );
        await page.evaluate(() => {
            const w = window as unknown as { testEmbedMessages: Array<{ testEmbed: string; data: string }> };
            w.testEmbedMessages = [];
            addEventListener("message", (e) => {
                if (e.data?.testEmbed) w.testEmbedMessages.push(e.data);
            });
            document.body.insertAdjacentHTML(
                "beforeend",
                `<iframe id="yt" title="YouTube video" width="200" height="100" src="https://www.youtube.com/embed/abc?enablejsapi=1"></iframe>
                 <iframe id="vimeo" title="Vimeo video" width="200" height="100" src="https://player.vimeo.com/video/123"></iframe>`
            );
        });
        await page.frameLocator("#yt").locator("body").waitFor();
        await page.frameLocator("#vimeo").locator("body").waitFor();

        const received = (host: string) =>
            page.evaluate(
                (host) =>
                    (window as unknown as { testEmbedMessages: Array<{ testEmbed: string; data: string }> }).testEmbedMessages
                        .filter((m) => m.testEmbed === host)
                        .map((m) => m.data),
                host
            );

        await turnOn(page, "Pause animations");
        await expect.poll(() => received("www.youtube.com")).toContain(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }));
        await expect.poll(() => received("player.vimeo.com")).toContain(JSON.stringify({ method: "pause" }));

        // It keeps asking while the player may still be loading...
        await expect.poll(async () => (await received("player.vimeo.com")).length).toBeGreaterThanOrEqual(2);

        // ...until the visitor clicks into that player to watch
        await page.frameLocator("#vimeo").locator("body").click();
        await page.waitForTimeout(200);
        const countAfterClick = (await received("player.vimeo.com")).length;
        await page.waitForTimeout(1500); // more than one re-check
        expect((await received("player.vimeo.com")).length).toBe(countAfterClick);
    });

    test("stops Swiper, Bootstrap and Slick carousels; resumes only auto-advancing ones", async ({ page }) => {
        // Small fakes that follow each library's public API
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<div class="swiper" id="test-swiper"></div>
                 <div class="carousel" id="test-bootstrap" data-bs-ride="carousel"></div>
                 <div class="slick-initialized" id="test-slick" data-playing="yes"></div>`
            );
            const w = window as unknown as Record<string, unknown>;

            const swiperEl = document.getElementById("test-swiper") as HTMLElement & { swiper: unknown };
            swiperEl.swiper = { autoplay: { running: true, stop() { this.running = false; }, start() { this.running = true; } } };

            const bootstrapCarousel = { cycling: true, pause() { this.cycling = false; }, cycle() { this.cycling = true; } };
            w.testBootstrapCarousel = bootstrapCarousel;
            w.bootstrap = {
                Carousel: { getInstance: (el: Element) => (el.id === "test-bootstrap" ? bootstrapCarousel : null) },
            };

            // Slick is a jQuery plugin: $(el).slick("method"). No `fx` here, so the jQuery animation code leaves it alone.
            w.jQuery = (el: HTMLElement) => ({
                slick(method: string, option?: string) {
                    if (method === "slickGetOption") return option === "autoplay";
                    if (method === "slickPause") el.dataset.playing = "no";
                    if (method === "slickPlay") el.dataset.playing = "yes";
                },
            });
        });

        const state = () =>
            page.evaluate(() => ({
                swiper: (document.getElementById("test-swiper") as HTMLElement & { swiper: { autoplay: { running: boolean } } })
                    .swiper.autoplay.running,
                bootstrap: (window as unknown as { testBootstrapCarousel: { cycling: boolean } }).testBootstrapCarousel.cycling,
                slick: document.getElementById("test-slick")!.dataset.playing,
            }));

        await turnOn(page, "Pause animations");
        await expect.poll(state).toEqual({ swiper: false, bootstrap: false, slick: "no" });

        // Bootstrap restarts a carousel when the mouse leaves it: the re-check pauses it again
        await page.evaluate(() => (window as unknown as { testBootstrapCarousel: { cycle(): void } }).testBootstrapCarousel.cycle());
        await expect.poll(state).toMatchObject({ bootstrap: false });

        await page.getByRole("checkbox", { name: "Pause animations" }).uncheck();
        await expect.poll(state).toEqual({ swiper: true, bootstrap: true, slick: "yes" });
    });
    test("settles GSAP and anime.js animations; resumes only the endless ones we paused", async ({ page }) => {
        // Small fakes that follow each library's public API
        await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const gsapAnimation = (repeat: number) => ({
                active: true,
                pausedByUs: false,
                finished: false,
                isActive() { return this.active && !this.pausedByUs; },
                repeat() { return repeat; },
                pause() { this.pausedByUs = true; },
                resume() { this.pausedByUs = false; },
                totalProgress(value: number) { if (value === 1) { this.finished = true; this.active = false; } },
            });
            const gsapEndless = gsapAnimation(-1);
            const gsapFade = gsapAnimation(0);
            w.gsap = { globalTimeline: { getChildren: () => [gsapEndless, gsapFade] } };

            const animeLoop = { paused: false, loop: true, duration: 1000, pause() { this.paused = true; }, play() { this.paused = false; }, seek() { } };
            const animeOnce = {
                paused: false, loop: 1, duration: 500, seekedTo: -1,
                pause() { this.paused = true; }, play() { this.paused = false; }, seek(t: number) { this.seekedTo = t; },
            };
            w.anime = { running: [animeLoop, animeOnce] };
            Object.assign(w, { gsapEndless, gsapFade, animeLoop, animeOnce });
        });

        const state = () =>
            page.evaluate(() => {
                const w = window as unknown as {
                    gsapEndless: { pausedByUs: boolean };
                    gsapFade: { finished: boolean };
                    animeLoop: { paused: boolean };
                    animeOnce: { paused: boolean; seekedTo: number };
                };
                return {
                    gsapEndlessPaused: w.gsapEndless.pausedByUs,
                    gsapFadeFinished: w.gsapFade.finished,
                    animeLoopPaused: w.animeLoop.paused,
                    animeOnceAtEnd: w.animeOnce.paused && w.animeOnce.seekedTo === 500,
                };
            });

        await turnOn(page, "Pause animations");
        await expect.poll(state).toEqual({ gsapEndlessPaused: true, gsapFadeFinished: true, animeLoopPaused: true, animeOnceAtEnd: true });

        await page.getByRole("checkbox", { name: "Pause animations" }).uncheck();
        // Endless ones resume; finished ones stay at their end state (harmless, like our CSS rule)
        await expect.poll(state).toEqual({ gsapEndlessPaused: false, gsapFadeFinished: true, animeLoopPaused: false, animeOnceAtEnd: true });
    });
});

test.describe("staying mounted (/)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    });

    test("gives up, with one warning, if the page keeps removing it", async ({ page }) => {
        const warnings: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "warning") warnings.push(msg.text());
        });

        await page.evaluate(async () => {
            for (let i = 0; i < 15; i++) {
                document.querySelector("a11yw-root")?.remove();
                await new Promise((resolve) => setTimeout(resolve, 20)); // let the widget put itself back
            }
        });
        await page.waitForTimeout(200);

        await expect(page.locator("a11yw-root")).toHaveCount(0); // left removed: no fight with the page
        expect(warnings.filter((w) => w.includes("keeps removing"))).toHaveLength(1);
    });
});


test.describe("Line height, Font and Align text (/)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    });

    const ratio = (page: Page, selector: string) =>
        page.locator(selector).first().evaluate((el) => {
            const s = getComputedStyle(el);
            return parseFloat(s.lineHeight) / parseFloat(s.fontSize);
        });

    test("Line height: each level on the page, not the widget; it beats Text spacing; Default puts the page's back", async ({ page }) => {
        const before = await page.locator("body > p").first().evaluate((el) => getComputedStyle(el).lineHeight);
        for (const [level, value] of [["Comfortable (1.5)", 1.5], ["Roomy (1.75)", 1.75], ["Double (2)", 2]] as const) {
            await choose(page, "Line height", level);
            expect(await ratio(page, "body > p"), level).toBeCloseTo(value, 1);
            await toggle(page).click(); // close, for the next choose()
        }
        expect(await ratio(page, "a11yw-root .feature-hint")).toBeCloseTo(1.4, 1); // the widget keeps its own

        await choose(page, "Text spacing", "Widest"); // its line height is 1.5: the chosen 2 still wins
        expect(await ratio(page, "body > p")).toBeCloseTo(2, 1);
        await page.getByRole("group", { name: "Text spacing" }).getByRole("radio", { name: "Default" }).check();

        await page.getByRole("group", { name: "Line height" }).getByRole("radio", { name: "Default" }).check();
        expect(await page.locator("body > p").first().evaluate((el) => getComputedStyle(el).lineHeight)).toBe(before);
    });

    test("Font: nothing downloaded until picked, then only that font, from our CDN; code, icons and the widget keep theirs", async ({ page }) => {
        const fontRequests: string[] = [];
        page.on("request", (r) => {
            if (r.url().includes("/fonts/")) fontRequests.push(new URL(r.url()).pathname);
        });
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<style>.fa { font-family: "FontAwesome" !important; } .material-icons { font-family: "Material Icons"; }</style>
                 <p id="font-text">Reading text, đọc tiếng Việt</p>
                 <code id="font-code">const x = 1;</code> <pre id="font-pre"><span>let y = 2;</span></pre>
                 <i id="font-fa" class="fa fa-star"></i> <span id="font-material" class="material-icons">home</span>`
            );
        });
        const family = (id: string) => page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).fontFamily);
        const pageFont = await family("font-text");
        const codeFont = await family("font-code");
        const widgetFont = await page.locator("a11yw-root .title").evaluate((el) => getComputedStyle(el).fontFamily);

        await toggle(page).click();
        expect(fontRequests).toEqual([]); // the panel alone downloads nothing

        await page.getByRole("group", { name: "Font" }).getByRole("radio", { name: "Wide", exact: true }).check();
        expect(await family("font-text")).toMatch(/^"AccessPilot Wide"/);
        await expect.poll(() => page.evaluate(async () => (await document.fonts.ready, document.fonts.check('16px "AccessPilot Wide"', "đ")))).toBe(true);
        expect(fontRequests.length).toBeGreaterThan(0);
        expect(fontRequests.every((path) => /^\/fonts\/(wide\.[0-9a-f]{10}\.css|lexend-[a-z-]+\.[0-9a-f]{10}\.woff2)$/.test(path)), fontRequests.join(", ")).toBe(true);
        await expect.poll(() => fontRequests.some((path) => path.includes("vietnamese"))).toBe(true); // the page has Vietnamese: its part is fetched too

        expect(await family("font-code")).toBe(codeFont);
        expect(await page.locator("#font-pre span").evaluate((el) => getComputedStyle(el).fontFamily)).toBe(codeFont);
        expect(await family("font-fa")).toMatch(/^"?FontAwesome"?$/); // the browser may drop the quotes
        expect(await family("font-material")).toMatch(/^"?Material Icons"?$/);
        expect(await page.locator("a11yw-root .title").evaluate((el) => getComputedStyle(el).fontFamily)).toBe(widgetFont);

        // Switching font swaps the stylesheet; Default removes it and gives the page its font back
        fontRequests.length = 0;
        await page.getByRole("group", { name: "Font" }).getByRole("radio", { name: "Simple" }).check();
        expect(await family("font-text")).toMatch(/^"AccessPilot Simple"/);
        await expect(page.locator("link#a11yw-font")).toHaveAttribute("href", /\/fonts\/simple\.[0-9a-f]{10}\.css$/);
        await expect.poll(() => fontRequests.some((path) => path.startsWith("/fonts/andika-"))).toBe(true);
        expect(fontRequests.some((path) => path.includes("lexend") || path.includes("atkinson"))).toBe(false);
        await expect(page.locator("link#a11yw-font")).toHaveCount(1);

        await page.getByRole("group", { name: "Font" }).getByRole("radio", { name: "Default" }).check();
        await expect(page.locator("link#a11yw-font")).toHaveCount(0);
        expect(await family("font-text")).toBe(pageFont);
    });

    test("Font: a chosen font comes back after reload, and after a single-page app replaces <head>", async ({ page }) => {
        await choose(page, "Font", "Clear");
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        await expect(page.locator("link#a11yw-font")).toHaveAttribute("href", /\/fonts\/clear\.[0-9a-f]{10}\.css$/);
        await page.evaluate(() => document.getElementById("a11yw-font")!.remove());
        await expect(page.locator("link#a11yw-font")).toHaveCount(1);
        await page.getByRole("button", { name: "Accessibility" }).click();
        await page.getByRole("button", { name: "Reset all" }).click();
        await expect(page.locator("link#a11yw-font")).toHaveCount(0);
    });

    test("fonts are served with their licenses, and cross-origin headers for customers' sites", async ({ request }) => {
        for (const name of ["clear", "wide", "simple"]) {
            const license = await request.get(`/fonts/${name}-LICENSE.txt`);
            expect(license.ok(), name).toBe(true);
            expect(await license.text()).toContain("SIL OPEN FONT LICENSE");
        }
        const headers = await (await request.get("/_headers")).text();
        expect(headers).toMatch(/\/fonts\/\*\n\s+Cache-Control: public, max-age=31536000, immutable\n\s+Access-Control-Allow-Origin: \*/);
    });

    test("Align text: Left and Right line up centered and justified text on that side, on RTL pages too; centered layouts stay", async ({ page }) => {
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<p id="al-center" style="text-align: center">Centered text</p>
                 <p id="al-justify" style="text-align: justify">Justified text</p>
                 <h2 id="al-heading" style="text-align: center">Centered heading</h2>
                 <p id="al-rtl" dir="rtl" style="text-align: center">نص في الوسط</p>
                 <div id="al-layout" style="text-align: center"><button type="button">Centered button</button></div>`
            );
        });
        const align = (id: string) => page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).textAlign);
        /** Space between the text and the paragraph's left and right edges. */
        const gaps = (id: string) =>
            page.locator(`#${id}`).evaluate((el) => {
                const range = document.createRange();
                range.selectNodeContents(el);
                const [box, text] = [el.getBoundingClientRect(), range.getBoundingClientRect()];
                return { left: text.left - box.left, right: box.right - text.right };
            });

        for (const [level, side] of [["Left", "left"], ["Right", "right"]] as const) {
            await choose(page, "Align text", level);
            for (const id of ["al-center", "al-justify", "al-heading", "al-rtl"]) expect(await align(id), `${level} ${id}`).toBe(side);
            expect((await gaps("al-rtl"))[side], `${level} on an RTL paragraph`).toBeLessThan(2); // the physical side, RTL too
            expect(await align("al-layout")).toBe("center");
            await toggle(page).click(); // close, for the next choose()
        }
        await choose(page, "Align text", "Default");
        expect(await align("al-center")).toBe("center");
    });
});

test.describe("Text spacing levels (/)", () => {
    const spacing = (page: Page) =>
        page.locator("body > p").first().evaluate((el) => {
            const s = getComputedStyle(el);
            const font = parseFloat(s.fontSize);
            return {
                letters: +(parseFloat(s.letterSpacing) / font).toFixed(2),
                words: +(parseFloat(s.wordSpacing) / font).toFixed(2),
                paragraphs: +(parseFloat(s.marginBottom) / font).toFixed(2),
            };
        });

    test("each level's spacing on the page", async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        for (const [level, expected] of [
            ["Wide", { letters: 0.12, words: 0.16, paragraphs: 2 }],
            ["Wider", { letters: 0.16, words: 0.24, paragraphs: 2 }],
            ["Widest", { letters: 0.2, words: 0.32, paragraphs: 2.5 }],
        ] as const) {
            await choose(page, "Text spacing", level);
            expect(await spacing(page), level).toEqual(expected);
            await toggle(page).click(); // close, for the next choose()
        }
    });

    test("an owner's 'Text spacing on by default' means Wide", async ({ page }) => {
        await serveConfig(page, { ...CONFIG, defaults: { textSpacing: true } });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await expect.poll(() => spacing(page)).toEqual({ letters: 0.12, words: 0.16, paragraphs: 2 });
        await toggle(page).click();
        await expect(page.getByRole("group", { name: "Text spacing" }).getByRole("radio", { name: "Wide", exact: true })).toBeChecked();
    });
});

test.describe("Image descriptions (/)", () => {
    const pic = (w: number, h: number) =>
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='${w}' height='${h}' fill='#c33'/></svg>`)}`;
    const tip = (page: Page) => page.locator("a11yw-root .a11yw-tip");
    const partRequests: string[] = [];

    test.beforeEach(async ({ page }) => {
        partRequests.length = 0;
        page.on("request", (r) => {
            if (r.url().includes("/parts/image-descriptions")) partRequests.push(new URL(r.url()).pathname);
        });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate((src) => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<div style="display:flex;flex-wrap:wrap;gap:24px;padding:24px">
                   <img id="i-alt" alt="A red bicycle" src="${src}">
                   <img id="i-empty" alt="" src="${src}">
                   <img id="i-none" src="${src}">
                   <a id="i-link" href="#home"><img alt="Home page" src="${src}"></a>
                   <svg id="i-svg" role="img" width="100" height="60"><title>Sales chart</title><rect width="100" height="60" fill="#36c"/></svg>
                   <div data-a11yw-ignore="image-descriptions"><img id="i-ignored" alt="Not shown" src="${src}"></div>
                 </div>`
            );
        }, pic(100, 60));
    });

    test("off: nothing downloaded and nothing shown; on: the part downloads once, and pointing shows the description", async ({ page }) => {
        await page.locator("#i-alt").hover();
        await page.waitForTimeout(400);
        await expect(tip(page)).toHaveCount(0);
        expect(partRequests).toEqual([]);

        await turnOn(page, "Image descriptions");
        await expect.poll(() => partRequests).toEqual([expect.stringMatching(/^\/parts\/image-descriptions\.[0-9a-f]{10}\.js$/)]);
        await closeButton(page).click();

        await page.locator("#i-alt").hover();
        await expect(tip(page)).toBeVisible();
        await expect(tip(page)).toHaveText("A red bicycle");
        await expect(tip(page)).toHaveAttribute("aria-hidden", "true"); // screen readers already read the alt text
        const [img, box] = [await page.locator("#i-alt").boundingBox(), await tip(page).boundingBox()];
        expect(box!.y).toBeGreaterThan(img!.y + img!.height); // below the image

        // WCAG 1.4.13: the pointer can move onto it, and it stays
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 4 });
        await page.waitForTimeout(500);
        await expect(tip(page)).toBeVisible();
        // ...Esc closes it
        await page.keyboard.press("Escape");
        await expect(tip(page)).toBeHidden();

        await page.locator("#i-svg").hover();
        await expect(tip(page)).toHaveText("Sales chart");
        await page.mouse.move(5, 500); // away
        await expect(tip(page)).toBeHidden();
        expect(partRequests).toHaveLength(1); // downloaded once
        expect(await widgetViolations(page)).toEqual([]);
    });

    test("decorative, undescribed and opted-out images show nothing; keyboard focus shows a link's image", async ({ page }) => {
        await turnOn(page, "Image descriptions");
        await closeButton(page).click();
        await expect.poll(() => partRequests.length).toBe(1);
        await page.locator("#i-alt").hover();
        await expect(tip(page)).toBeVisible(); // the part is running
        for (const id of ["i-empty", "i-none", "i-ignored"]) {
            await page.locator(`#${id}`).hover();
            await expect(tip(page), id).toBeHidden();
        }

        await page.mouse.move(5, 500);
        await page.locator("#i-link").focus();
        await expect(tip(page)).toHaveText("Home page");
        await page.locator("#i-link").blur();
        await expect(tip(page)).toBeHidden();
    });

    test("stays on screen next to the screen's edges, at 320px too", async ({ page }) => {
        await turnOn(page, "Image descriptions");
        await closeButton(page).click();
        await page.setViewportSize({ width: 320, height: 640 });
        await page.evaluate((src) => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<img id="i-corner" alt="A long description of a photo taken at the very edge of the screen" src="${src}"
                  style="position:fixed;right:0;bottom:100px">`
            );
        }, pic(60, 40));
        await page.locator("#i-corner").hover();
        await expect(tip(page)).toBeVisible();
        const box = (await tip(page).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
        expect(box.y + box.height).toBeLessThanOrEqual(640);
    });

    test("turning it off removes it; a saved 'on' downloads the part at the next visit", async ({ page }) => {
        await turnOn(page, "Image descriptions");
        await page.getByRole("checkbox", { name: "Image descriptions" }).uncheck();
        await closeButton(page).click();
        await page.locator("#i-alt").hover();
        await page.waitForTimeout(400);
        await expect(tip(page)).toHaveCount(0);

        await toggle(page).click();
        await page.getByRole("checkbox", { name: "Image descriptions" }).check();
        partRequests.length = 0;
        await page.reload();
        await expect.poll(() => partRequests.length).toBe(1); // without opening the panel
    });

    test("a part whose bytes don't match its integrity hash is refused: the setting does nothing, the page sees no errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/parts/image-descriptions*", async (route) => {
            const response = await route.fetch();
            route.fulfill({ response, body: (await response.text()) + "\n;window.tampered = true;" });
        });
        await turnOn(page, "Image descriptions");
        await expect.poll(() => partRequests.length).toBe(1);
        await closeButton(page).click();
        await page.locator("#i-alt").hover();
        await page.waitForTimeout(400);
        await expect(tip(page)).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { tampered?: boolean }).tampered)).toBeUndefined();
        expect(errors).toEqual([]);
    });
});

/** The color of one screen pixel, read from a screenshot (so it includes the lens's backdrop-filter). */
async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
    const shot = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
    return page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b] as [number, number, number];
    }, shot.toString("base64"));
}

test.describe("Appearance: Contrast, Color, Hide images (/)", () => {
    const lens = (page: Page) => page.locator("a11yw-lens");

    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<div id="ap-box" style="width:120px;height:60px;background:#cc3333;margin:16px"></div>
                 <button id="ap-under" type="button" onclick="this.dataset.clicked='yes'">Under the lens</button>`
            );
        });
    });

    test("Color: each level recolors the screen through the lens; clicks go through; the widget keeps its colors", async ({ page }) => {
        const box = (await page.locator("#ap-box").boundingBox())!;
        const at = () => pixel(page, box.x + 60, box.y + 30);
        const launcher = (await toggle(page).boundingBox())!;
        const brand = await pixel(page, launcher.x + 8, launcher.y + launcher.height / 2);
        const [r0, g0] = await at();
        expect(r0 - g0).toBeGreaterThan(140); // red

        await choose(page, "Color", "Grayscale");
        await expect(lens(page)).toHaveCount(1);
        await expect.poll(async () => { const [r, g, b] = await at(); return Math.max(Math.abs(r - g), Math.abs(g - b)); }).toBeLessThan(6);
        expect(await pixel(page, launcher.x + 8, launcher.y + launcher.height / 2)).toEqual(brand); // above the lens

        await page.getByRole("group", { name: "Color" }).getByRole("radio", { name: "Muted" }).check();
        await expect.poll(async () => { const [r, g] = await at(); return r - g; }).toBeLessThan(r0 - g0 - 30);
        await page.getByRole("group", { name: "Color" }).getByRole("radio", { name: "Vivid" }).check();
        await expect.poll(async () => { const [r, g] = await at(); return r - g; }).toBeGreaterThan(r0 - g0 + 20);

        await closeButton(page).click();
        await page.locator("#ap-under").click(); // the lens lets clicks through
        await expect(page.locator("#ap-under")).toHaveAttribute("data-clicked", "yes");
        await expect(lens(page)).toHaveAttribute("aria-hidden", "true");

        await toggle(page).click();
        await page.getByRole("group", { name: "Color" }).getByRole("radio", { name: "Default" }).check();
        await expect(lens(page)).toHaveCount(0); // nothing left behind
        expect(await at()).toEqual([r0, g0, (await at())[2]]);
    });

    test("the lens stays before the widget, also after a page removes it; Contrast doesn't use it", async ({ page }) => {
        await choose(page, "Color", "Muted");
        await expect(lens(page)).toHaveCount(1);
        expect(await lens(page).evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("saturate(0.5)");
        const before = () => lens(page).evaluate((el) => !!(el.compareDocumentPosition(document.querySelector("a11yw-root")!) & Node.DOCUMENT_POSITION_FOLLOWING));
        expect(await before()).toBe(true);

        await page.evaluate(() => document.querySelector("a11yw-lens")!.remove()); // e.g. a single-page app replacing <body>'s children
        await expect(lens(page)).toHaveCount(1);
        expect(await before()).toBe(true);

        await page.getByRole("group", { name: "Contrast" }).getByRole("radio", { name: "Dark" }).check(); // CSS, not the lens
        expect(await lens(page).evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("saturate(0.5)");
    });

    test("the lens doesn't change layout: a fixed header stays fixed while scrolling", async ({ page }) => {
        await page.evaluate(() => {
            document.body.insertAdjacentHTML("beforeend", `<header id="ap-fixed" style="position:fixed;top:0;left:0;right:0;height:40px;background:#036">Fixed</header><div style="height:3000px"></div>`);
        });
        await choose(page, "Color", "Grayscale");
        await closeButton(page).click();
        await page.mouse.move(300, 300); // over the page: the wheel goes through the lens
        await page.mouse.wheel(0, 1200);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
        expect((await page.locator("#ap-fixed").boundingBox())!.y).toBe(0);
    });

    test("Contrast Dark and Light: page colors, links and their contents, form borders; Highlight links still wins; the widget keeps its own", async ({ page }) => {
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<p id="ap-text" style="color:#777;background:#eee">Text <a id="ap-link" href="#x"><span id="ap-link-span">a link</span></a></p>
                 <input id="ap-input" placeholder="Search" style="border:2px solid #ccc">`
            );
        });
        const css = (sel: string, prop: string) => page.locator(sel).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
        const widgetTitle = await css("a11yw-root .title", "color");

        await choose(page, "Contrast", "Dark");
        expect(await css("#ap-text", "background-color")).toBe("rgb(0, 0, 0)");
        expect(await css("#ap-text", "color")).toBe("rgb(255, 255, 255)");
        expect(await css("#ap-link", "color")).toBe("rgb(255, 255, 0)");
        expect(await css("#ap-link-span", "color")).toBe("rgb(255, 255, 0)"); // link contents inherit the link's color
        expect(await css("#ap-input", "border-top-color")).toBe("rgb(255, 255, 255)");
        expect(await css("#ap-input", "box-shadow")).toBe("rgb(255, 255, 255) 0px 0px 0px 1px inset"); // an edge without changing size
        expect(await css("html", "color-scheme")).toBe("dark");
        expect(await css("a11yw-root .title", "color")).toBe(widgetTitle);
        expect(await widgetViolations(page)).toEqual([]);

        await page.getByRole("checkbox", { name: "Highlight links" }).check();
        expect(await css("#ap-link", "background-color")).toBe("rgb(255, 255, 0)");
        expect(await css("#ap-link", "color")).toBe("rgb(0, 0, 0)");
        expect(await css("#ap-link-span", "color")).toBe("rgb(0, 0, 0)");
        await page.getByRole("checkbox", { name: "Highlight links" }).uncheck();

        await page.getByRole("group", { name: "Contrast" }).getByRole("radio", { name: "Light" }).check();
        expect(await css("#ap-text", "background-color")).toBe("rgb(255, 255, 255)");
        expect(await css("#ap-text", "color")).toBe("rgb(0, 0, 0)");
        expect(await css("#ap-link", "color")).toBe("rgb(0, 0, 238)");
        await expect(lens(page)).toHaveCount(0); // Dark and Light are page CSS

        await page.getByRole("group", { name: "Contrast" }).getByRole("radio", { name: "Default" }).check();
        expect(await css("#ap-text", "color")).toBe("rgb(119, 119, 119)");
    });

    test("Hide images: pictures become plain boxes of the same size, still described for screen readers; background images go; icons stay", async ({ page }) => {
        await page.evaluate(() => {
            const pic = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60'><rect width='100' height='60' fill='#c33'/></svg>")}`;
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<img id="hi-img" alt="A red bicycle" src="${pic}" width="100" height="60">
                 <svg id="hi-chart" role="img" width="80" height="40"><title>Sales chart</title><rect id="hi-bar" width="80" height="40" fill="#36c"/></svg>
                 <button type="button"><svg id="hi-icon" width="16" height="16"><circle cx="8" cy="8" r="6"/></svg> Menu</button>
                 <div id="hi-bg" style="width:80px;height:40px"></div>`
            );
            document.getElementById("hi-bg")!.style.background = `#036 url("${pic}")`;
        });
        const size = () => page.locator("#hi-img").boundingBox();
        const before = await size();
        await turnOn(page, "Hide images");
        expect(await page.locator("#hi-img").evaluate((el) => getComputedStyle(el).objectPosition)).toBe("-99999px 0px");
        expect(await size()).toEqual(before); // nothing moves
        await expect(page.getByRole("img", { name: "A red bicycle" })).toBeVisible(); // still there for screen readers
        await expect(page.getByRole("img", { name: "Sales chart" })).toBeVisible();
        expect(await page.locator("#hi-bar").evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
        expect(await page.locator("#hi-icon").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
        expect(await page.locator("#hi-bg").evaluate((el) => [getComputedStyle(el).backgroundImage, getComputedStyle(el).backgroundColor])).toEqual(["none", "rgb(0, 51, 102)"]);

        await page.getByRole("checkbox", { name: "Hide images" }).uncheck();
        expect(await page.locator("#hi-img").evaluate((el) => getComputedStyle(el).objectPosition)).toBe("50% 50%");
    });
});

test.describe("Contrast › Smart (/)", () => {
    const partRequests: string[] = [];
    const ids = ["sc-gray", "sc-link", "sc-dark", "sc-large", "sc-ok", "sc-bgimg", "sc-disabled", "sc-semi", "sc-ignored", "sc-inline"];

    test.beforeEach(async ({ page }) => {
        partRequests.length = 0;
        page.on("request", (r) => {
            if (r.url().includes("/parts/smart-contrast")) partRequests.push(r.url());
        });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<div id="sc" style="background:#fff;padding:8px;font-size:16px">
                   <p id="sc-gray" style="color:#aaaaaa">Light gray text</p>
                   <p><a id="sc-link" href="#x" style="color:#88aaff">Pale blue link</a></p>
                   <div style="background:#222;padding:4px"><p id="sc-dark" style="color:#444">Dark on dark</p></div>
                   <p id="sc-large" style="color:#949494;font-size:24px">Large text</p>
                   <p id="sc-ok" style="color:#333">Fine text</p>
                   <div style="background:#eee linear-gradient(#eee, #ddd)"><p id="sc-bgimg" style="color:#ccc">Over a gradient</p></div>
                   <button id="sc-disabled" disabled style="color:#ccc;background:#fff">Disabled</button>
                   <div style="background:rgba(0,0,0,0.5)"><p id="sc-semi" style="color:#555">On semi-transparent</p></div>
                   <div data-a11yw-ignore="contrast"><p id="sc-ignored" style="color:#bbb">Opted out</p></div>
                   <p id="sc-inline" style="color:#cccccc !important">Had its own inline color</p>
                 </div>`
            );
        });
    });

    /** [r, g, b] of an element's text, and its contrast with `bg`. */
    const measure = (page: Page, id: string, bg: [number, number, number]) =>
        page.locator(`#${id}`).evaluate((el, bg) => {
            const [r, g, b] = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
            const lum = (c: number[]) => {
                const [R, G, B] = c.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
                return 0.2126 * R + 0.7152 * G + 0.0722 * B;
            };
            const [hi, lo] = [lum([r, g, b]), lum(bg)].sort((x, y) => y - x);
            return { rgb: [r, g, b], ratio: (hi + 0.05) / (lo + 0.05) };
        }, bg);
    /** Each element's own inline color and its priority (the browser rewrites the attribute's text, e.g. #aaa → rgb(), when we touch it). */
    const styles = (page: Page) =>
        page.evaluate((ids) => ids.map((id) => {
            const style = document.getElementById(id)!.style;
            return `${style.getPropertyValue("color")} ${style.getPropertyPriority("color")}`;
        }), ids);
    const colorContrastIssues = async (page: Page) =>
        (await new AxeBuilder({ page }).include("#sc").withRules(["color-contrast"]).analyze()).violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")));

    test("fixes only failing text, to AA, keeping its hue; leaves passing, large, image-backed, disabled and opted-out text alone; Default restores the page exactly", async ({ page }) => {
        const before = await styles(page);
        expect((await colorContrastIssues(page)).length).toBeGreaterThan(0);
        expect(partRequests).toEqual([]);

        await choose(page, "Contrast", "Smart");
        await expect.poll(() => measure(page, "sc-gray", [255, 255, 255]).then((m) => m.ratio)).toBeGreaterThanOrEqual(4.5);
        expect(partRequests).toHaveLength(1);
        const link = await measure(page, "sc-link", [255, 255, 255]);
        expect(link.ratio).toBeGreaterThanOrEqual(4.5);
        expect(link.rgb[2]).toBeGreaterThan(Math.max(link.rgb[0], link.rgb[1]) + 40); // still blue
        const dark = await measure(page, "sc-dark", [34, 34, 34]);
        expect(dark.ratio).toBeGreaterThanOrEqual(4.5);
        expect(dark.rgb[0]).toBeGreaterThan(0x44); // lightened, on a dark background
        expect((await measure(page, "sc-semi", [128, 128, 128])).ratio).toBeGreaterThanOrEqual(4.5); // black at 50% over white
        expect(await colorContrastIssues(page)).toEqual(["#sc-ignored"]); // axe agrees: only the opted-out text still fails

        const after = await styles(page);
        for (const [i, id] of ids.entries()) {
            if (["sc-large", "sc-ok", "sc-bgimg", "sc-disabled", "sc-ignored"].includes(id)) expect(after[i], id).toBe(before[i]);
        }

        await page.getByRole("group", { name: "Contrast" }).getByRole("radio", { name: "Default" }).check();
        expect(await styles(page)).toEqual(before); // every inline style back as it was, own !important colors included
    });

    test("text added later and text in web components are fixed too; Highlight links still wins; Dark replaces every fix", async ({ page }) => {
        await choose(page, "Contrast", "Smart");
        await expect.poll(() => measure(page, "sc-gray", [255, 255, 255]).then((m) => m.ratio)).toBeGreaterThanOrEqual(4.5);
        await page.evaluate(() => {
            document.getElementById("sc")!.insertAdjacentHTML("beforeend", `<p id="sc-late" style="color:#bbb">Added later</p>`);
            const host = document.createElement("div");
            host.attachShadow({ mode: "open" }).innerHTML = `<p id="sc-shadow" style="color:#bbb">In a web component</p>`;
            document.getElementById("sc")!.append(host);
        });
        await expect.poll(() => measure(page, "sc-late", [255, 255, 255]).then((m) => m.ratio)).toBeGreaterThanOrEqual(4.5);
        await expect.poll(() => measure(page, "sc-shadow", [255, 255, 255]).then((m) => m.ratio)).toBeGreaterThanOrEqual(4.5);

        await page.getByRole("checkbox", { name: "Highlight links" }).check();
        await expect.poll(() => measure(page, "sc-link", [255, 255, 0]).then((m) => m.rgb)).toEqual([0, 0, 0]);
        await page.getByRole("checkbox", { name: "Highlight links" }).uncheck();

        await page.getByRole("group", { name: "Contrast" }).getByRole("radio", { name: "Dark" }).check();
        expect((await measure(page, "sc-gray", [0, 0, 0])).rgb).toEqual([255, 255, 255]); // no inline fix left to beat Dark
    });

    test("a long page never blocks the main thread for 50ms or more", async ({ page }) => {
        await page.evaluate(() => {
            const html = Array.from({ length: 5000 }, (_, i) => `<p style="color:#b0b0b0">Paragraph ${i}</p>`).join("");
            document.getElementById("sc")!.insertAdjacentHTML("beforeend", `<div id="sc-long">${html}</div>`);
            (window as unknown as { longTasks: number[] }).longTasks = [];
            new PerformanceObserver((list) => list.getEntries().forEach((e) => (window as unknown as { longTasks: number[] }).longTasks.push(e.duration))).observe({ type: "longtask" });
        });
        await choose(page, "Contrast", "Smart");
        await expect.poll(() => page.locator("#sc-long p").last().evaluate((el) => getComputedStyle(el).color), { timeout: 15_000 }).not.toBe("rgb(176, 176, 176)");
        const longTasks = await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks);
        expect(longTasks, longTasks.join(", ")).toEqual([]); // the browser reports every task of 50ms or more
    });
});

test.describe("Reading aid and Big cursor (/)", () => {
    const guide = (page: Page) => page.locator("a11yw-root .a11yw-guide");
    const partRequests: string[] = [];

    test.beforeEach(async ({ page }) => {
        partRequests.length = 0;
        page.on("request", (r) => {
            if (r.url().includes("/parts/reading-aid")) partRequests.push(r.url());
        });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<div id="ra" style="height:700px;background:#fff">
                   <p style="margin:0;padding-top:400px"><a id="ra-link" href="#x">A link to tab to</a></p>
                 </div>`
            );
        });
    });

    test("Guide: downloaded when chosen; a full-width bar under the pointer's line that follows the mouse, focus and taps", async ({ page }) => {
        expect(partRequests).toEqual([]);
        await choose(page, "Reading aid", "Guide");
        await expect(guide(page)).toBeVisible(); // at once, in the middle of the screen
        const box = async () => (await guide(page).boundingBox())!;
        expect((await box()).y).toBe(Math.round(page.viewportSize()!.height / 2 + 14));
        expect(partRequests).toHaveLength(1);
        await closeButton(page).click();
        await page.mouse.move(300, 200);
        await expect.poll(async () => (await box()).y).toBe(214);
        expect((await box()).width).toBe(page.viewportSize()!.width);
        await expect(page.locator("a11yw-root .a11yw-aid")).toHaveAttribute("aria-hidden", "true");

        await page.mouse.move(300, 300);
        await expect.poll(async () => (await box()).y).toBe(314);

        await page.locator("#ra-link").focus(); // keyboard: to the focused element
        const link = (await page.locator("#ra-link").boundingBox())!;
        await expect.poll(async () => (await box()).y).toBe(Math.round(link.y + link.height / 2 + 14));

        await page.evaluate(() => {
            document.dispatchEvent(new PointerEvent("pointerdown", { clientY: 150, pointerType: "touch", bubbles: true }));
            document.dispatchEvent(new PointerEvent("pointermove", { clientY: 600, pointerType: "touch", bubbles: true })); // a finger scrolling: ignored
        });
        await expect.poll(async () => (await box()).y).toBe(164);

        await toggle(page).click();
        await page.getByRole("group", { name: "Reading aid" }).getByRole("radio", { name: "Default" }).check();
        await expect(page.locator("a11yw-root .a11yw-aid")).toHaveCount(0);
    });

    test("Mask: dims above and below a window at the pointer; clicks go through; the panel stays above it, undimmed", async ({ page }) => {
        await toggle(page).click();
        const title = (await page.locator("a11yw-root .title").boundingBox())!;
        const titlePixel = () => pixel(page, title.x + 2, title.y + title.height + 4);
        const panelBefore = await titlePixel();
        const pageBefore = await pixel(page, 100, 100);

        await page.getByRole("group", { name: "Reading aid" }).getByRole("radio", { name: "Mask" }).check();
        await expect(page.locator("a11yw-root .a11yw-shade-top")).toBeVisible(); // at once
        await page.mouse.move(100, 600); // the window around y=600: the top of the screen is dimmed
        await expect.poll(async () => (await pixel(page, 100, 100))[0]).toBeLessThan(pageBefore[0] - 60); // dimmed
        expect((await pixel(page, 100, 600))[0]).toBe(pageBefore[0]); // the window is clear
        expect(await titlePixel()).toEqual(panelBefore); // the panel is above the mask

        // Clicks and hit-testing go through: the page element is what's under a dimmed point
        expect(await page.evaluate(() => document.elementFromPoint(100, 100)?.localName)).not.toBe("a11yw-root");
        expect(await widgetViolations(page)).toEqual([]);
    });

    test("Big cursor: a big arrow on the page, a big hand on links and buttons, the text cursor in fields, in the panel too; Default restores", async ({ page }) => {
        await page.evaluate(() => document.body.insertAdjacentHTML("afterbegin", `<input id="bc-input"> <input id="bc-check" type="checkbox"> <button id="bc-button">Go</button>`));
        const cursor = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).cursor);
        await choose(page, "Big cursor", "Black");
        expect(await cursor("#ra")).toMatch(/^url\("data:image\/svg\+xml,.*fill%3D%22%23000%22.*"\) 8 4, auto$/);
        expect(await cursor("#ra-link")).toMatch(/^url\("data:image\/svg\+xml,.*"\) 22 5, pointer$/);
        expect(await cursor("#bc-button")).toMatch(/, pointer$/);
        expect(await cursor("#bc-check")).toMatch(/, pointer$/);
        expect(await cursor("#bc-input")).toBe("text");
        expect(await cursor("a11yw-root .close")).toMatch(/^url\(.*, pointer$/); // the panel gets it too
        expect(await cursor("a11yw-root .title")).toMatch(/^url\(.*, auto$/);

        await page.getByRole("group", { name: "Big cursor" }).getByRole("radio", { name: "White" }).check();
        expect(await cursor("#ra")).toMatch(/fill%3D%22%23fff%22/);

        await page.getByRole("group", { name: "Big cursor" }).getByRole("radio", { name: "Default" }).check();
        expect(await cursor("#ra")).toBe("auto");
        expect(await cursor("a11yw-root .close")).toBe("pointer");
    });
});

test.describe("Pause animations as a part (/)", () => {
    test("CSS animations stop at once, even if the part can't load; the part downloads only when turned on, and at page start when saved on", async ({ page }) => {
        const requests: string[] = [];
        page.on("request", (r) => {
            if (r.url().includes("/parts/pause-animations")) requests.push(r.url());
        });
        await page.route("**/parts/pause-animations*", (route) => route.abort()); // blocked (e.g. a strict site policy)
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `<style>@keyframes pa-spin { to { transform: rotate(1turn); } }</style><div id="pa-spin" style="animation: pa-spin 1s linear infinite">spin</div>`));
        expect(requests).toEqual([]);
        await turnOn(page, "Pause animations");
        await expect.poll(() => page.locator("#pa-spin").evaluate((el) => el.getAnimations().some((a) => a.playState === "running"))).toBe(false);
        expect(requests).toHaveLength(1); // asked for, and blocked: the CSS part still works

        await page.unroute("**/parts/pause-animations*");
        requests.length = 0;
        await page.reload();
        await expect.poll(() => requests.length).toBe(1); // saved on: fetched as the page starts, without opening the panel
    });
});

test.describe("Page structure (/)", () => {
    const dialog = (page: Page) => page.getByRole("dialog", { name: "Page structure" });
    const openButton = (page: Page) => page.getByRole("button", { name: "Page structure" });

    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<header id="psx-banner"><nav aria-label="Main menu"><a href="/shop">Shop</a> <a href="/shop">Shop</a> <a href="/about">About</a></nav></header>
                 <main>
                   <h1>Store</h1>
                   <section aria-label="Deals"><h2 id="psx-deals">Today's deals</h2><p>…</p></section>
                   <section><h3>Unnamed section</h3></section>
                   <div role="heading" aria-level="4">A div heading</div>
                   <h2 style="display:none">Hidden heading</h2>
                   <div data-a11yw-ignore="page-structure"><h2>Opted-out heading</h2><a href="/secret">Opted-out link</a></div>
                   <div style="height:2000px"></div>
                   <h2 id="psx-far">Far down</h2>
                 </main>
                 <footer>Footer</footer>`
            );
            const host = document.createElement("div");
            host.attachShadow({ mode: "open" }).innerHTML = `<h2>Inside a web component</h2>`;
            document.querySelector("main")!.append(host);
        });
    });

    test("a modal dialog listing headings, landmarks and links; Esc returns focus to its button", async ({ page }) => {
        await toggle(page).click();
        await openButton(page).click();
        await expect(dialog(page)).toBeVisible();
        await expect(page.getByRole("radio", { name: /^Headings/ })).toBeFocused();

        const items = () => dialog(page).getByRole("list").getByRole("button").allTextContents();
        const headingTexts = await items();
        expect(headingTexts.slice(0, 5)).toEqual(["H1 Store", "H2 Today's deals", "H3 Unnamed section", "H4 A div heading", "H2 Far down"]);
        expect(headingTexts).toContain("H2 Inside a web component");
        expect(headingTexts.join("|")).not.toMatch(/Hidden heading|Opted-out heading|Accessibility settings/);
        await expect(page.getByRole("radio", { name: /^Headings/ })).toHaveAccessibleName(`Headings (${headingTexts.length})`);

        await page.getByRole("radio", { name: /^Landmarks/ }).check();
        expect(await items()).toEqual(expect.arrayContaining(["Header", "Navigation: Main menu", "Main", "Region: Deals", "Footer"]));
        expect((await items()).filter((t) => t.startsWith("Region"))).toEqual(["Region: Deals"]); // unnamed sections aren't landmarks

        await page.getByRole("radio", { name: /^Links/ }).check();
        const linkTexts = await items();
        expect(linkTexts.filter((t) => t === "Shop")).toHaveLength(1); // same words, same place: once
        expect(linkTexts).toContain("About");
        expect(linkTexts).not.toContain("Opted-out link");

        expect(await widgetViolations(page)).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(dialog(page)).toBeHidden();
        await expect(openButton(page)).toBeFocused();
    });

    test("choosing an item scrolls to it and moves focus there (a temporary tabindex for a heading)", async ({ page }) => {
        await toggle(page).click();
        await openButton(page).click();
        await dialog(page).getByRole("button", { name: "H2 Far down" }).click();
        await expect(dialog(page)).toBeHidden();
        await expect(page.locator("#psx-far")).toBeFocused();
        await expect(page.locator("#psx-far")).toBeInViewport();
        await expect(page.locator("#psx-far")).toHaveAttribute("tabindex", "-1");
        await page.keyboard.press("Tab"); // focus moves on: the temporary tabindex goes
        await expect(page.locator("#psx-far")).not.toHaveAttribute("tabindex");
    });

    for (const [width, height] of [[320, 640], [768, 1024], [1280, 900], [640, 450]] as const) {
        test(`the dialog fits and passes axe at ${width}×${height}`, async ({ page }) => {
            await page.setViewportSize({ width, height });
            await toggle(page).click();
            await openButton(page).click();
            await expect(dialog(page)).toBeVisible();
            const box = (await dialog(page).boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
            expect(box.y + box.height).toBeLessThanOrEqual(height);
            expect(await widgetViolations(page)).toEqual([]);
            await dialog(page).getByRole("button", { name: "Close" }).click();
            await expect(openButton(page)).toBeFocused();
        });
    }
});

test.describe("Profiles (/)", () => {
    const profile = (page: Page, name: string) => panel(page).getByRole("list", { name: "Profiles" }).getByRole("checkbox", { name });
    const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("a11yw:settings:v1") ?? "null"));
    const level = (page: Page, setting: string, name: string) => page.getByRole("group", { name: setting }).getByRole("radio", { name, exact: true });

    const EXPECTED: Record<string, Record<string, boolean | number>> = {
        "Seizure safe": { pauseAnimations: true, color: 1 },
        Vision: { textSize: 2, font: 1, contrast: 1, bigCursor: 1, focusOutline: true, imageDescriptions: true },
        "ADHD friendly": { pauseAnimations: true, readingAid: 2, color: 1 },
        "Easier reading": { textSize: 1, contrast: 1, readingAid: 1, imageDescriptions: true, pauseAnimations: true },
        "Dyslexia friendly": { font: 2, lineHeight: 1, textSpacing: 1, textAlign: 1 },
        "Motor & keyboard": { focusOutline: true, bigCursor: 1, highlightLinks: true, pauseAnimations: true },
    };

    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    });

    test("each profile turns on exactly its settings, and off puts them all back", async ({ page }) => {
        await toggle(page).click();
        await expect(panel(page).getByRole("list", { name: "Profiles" }).getByRole("checkbox")).toHaveCount(6);
        for (const [name, expected] of Object.entries(EXPECTED)) {
            await profile(page, name).check();
            await expect(profile(page, name)).toBeChecked();
            const changed = Object.fromEntries(Object.entries(await saved(page)).filter(([, v]) => v !== false && v !== 0));
            expect(changed, name).toEqual(expected);
            await profile(page, name).uncheck();
            expect(await saved(page), name).toBeNull(); // back to the starting point exactly
        }
    });

    test("screen readers hear what a profile turned on; Reset all clears profiles too", async ({ page }) => {
        await toggle(page).click();
        await profile(page, "Vision").check();
        await expect(panel(page).getByRole("status")).toHaveText("Vision on: Text size 150%, Font Clear, Contrast Smart, Big cursor Black, Stronger focus outline, Image descriptions.");
        await profile(page, "Vision").uncheck();
        await expect(panel(page).getByRole("status")).toHaveText("Vision off.");
        await profile(page, "Seizure safe").check();
        await page.getByRole("button", { name: "Reset all" }).click();
        await expect(profile(page, "Seizure safe")).not.toBeChecked();
        expect(await saved(page)).toBeNull();
    });

    test("combined: size-like settings take the larger; turning one off falls back to what the other needs", async ({ page }) => {
        await toggle(page).click();
        await profile(page, "Easier reading").check();
        await profile(page, "Vision").check();
        await expect(level(page, "Text size", "Larger (150%)")).toBeChecked();
        await expect(profile(page, "Easier reading")).toBeChecked(); // 150% is at least its 125%
        await profile(page, "Vision").uncheck();
        await expect(level(page, "Text size", "Large (125%)")).toBeChecked(); // not Default: Easier reading still needs it
        await expect(level(page, "Contrast", "Smart")).toBeChecked(); // shared setting kept
        await expect(page.getByRole("group", { name: "Font" }).getByRole("radio", { name: "Default" })).toBeChecked(); // Vision's own setting gone
    });

    test("the newest profile wins a conflict; changing a setting by hand turns a profile's tile off (raising size doesn't)", async ({ page }) => {
        await toggle(page).click();
        await profile(page, "Vision").check();
        await profile(page, "Dyslexia friendly").check();
        await expect(level(page, "Font", "Wide")).toBeChecked();
        await expect(profile(page, "Vision")).not.toBeChecked();
        await expect(profile(page, "Dyslexia friendly")).toBeChecked();

        await profile(page, "Dyslexia friendly").uncheck();
        await profile(page, "Vision").check();
        await level(page, "Text size", "Largest (200%)").check();
        await expect(profile(page, "Vision")).toBeChecked(); // still at least 150%
        await level(page, "Font", "Default").check();
        await expect(profile(page, "Vision")).not.toBeChecked();
    });

    test("a profile inside another (Seizure safe in ADHD friendly) shows as on with it, and goes off with it", async ({ page }) => {
        await toggle(page).click();
        await profile(page, "ADHD friendly").check();
        await expect(profile(page, "Seizure safe")).toBeChecked(); // its settings are all in effect
        await profile(page, "ADHD friendly").uncheck();
        await expect(profile(page, "Seizure safe")).not.toBeChecked();
        expect(await saved(page)).toBeNull();
    });

    test("an owner's 'on by default' setting survives a profile turned on and off", async ({ page }) => {
        await serveConfig(page, { ...CONFIG, defaults: { highlightLinks: true } });
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        await toggle(page).click();
        await profile(page, "Motor & keyboard").check();
        await profile(page, "Motor & keyboard").uncheck();
        await expect(page.getByRole("checkbox", { name: "Highlight links" })).toBeChecked();
        expect(await saved(page)).toBeNull();
    });

    test("Tab goes from Close into the profiles first; accessible at every width and 200% zoom", async ({ page }) => {
        await toggle(page).click();
        await expect(closeButton(page)).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(profile(page, "Seizure safe")).toBeFocused();
        await profile(page, "ADHD friendly").check();
        for (const [width, height] of [[320, 640], [768, 1024], [1280, 900], [640, 450]] as const) {
            await page.setViewportSize({ width, height });
            await profile(page, "Motor & keyboard").scrollIntoViewIfNeeded();
            expect(await widgetViolations(page), `${width}×${height}`).toEqual([]);
            const body = panel(page).locator(".panel-body");
            expect(await body.evaluate((el) => el.scrollWidth - el.clientWidth), `${width}×${height}: scrolls sideways`).toBeLessThanOrEqual(0);
        }
    });
});

test.describe("Shortcut, Hide and statement link (/)", () => {
    const hiddenNotice = (page: Page) => page.locator("a11yw-root").getByRole("status").filter({ hasText: "Accessibility button hidden" });

    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => document.body.insertAdjacentHTML("afterbegin", `<p><a id="sk-link" href="#x">A page link</a> <input id="sk-input" aria-label="Search"></p>`));
    });

    test("Alt+A opens the panel from the page and closes it back to where the visitor was; not while typing", async ({ page }) => {
        await expect(toggle(page)).toHaveAttribute("aria-keyshortcuts", "Alt+A");
        await page.locator("#sk-link").focus();
        await page.keyboard.press("Alt+KeyA");
        await expect(panel(page)).toBeVisible();
        await expect(closeButton(page)).toBeFocused();
        await page.keyboard.press("Alt+KeyA");
        await expect(panel(page)).toBeHidden();
        await expect(page.locator("#sk-link")).toBeFocused(); // back where they were

        await page.locator("#sk-input").focus();
        await page.keyboard.press("Alt+KeyA");
        await expect(panel(page)).toBeHidden(); // typing: the key is the page's

        // The physical key counts, whatever character it types (Option+A types "å" on a Mac)
        await page.locator("#sk-link").focus();
        await page.evaluate(() => document.getElementById("sk-link")!.dispatchEvent(new KeyboardEvent("keydown", { key: "å", code: "KeyA", altKey: true, bubbles: true, composed: true })));
        await expect(panel(page)).toBeVisible();
        await expect(panel(page)).toContainText(/Shortcut: (Alt|Option)\+A/);
    });

    test("Hide for this visit: a choice first (Cancel goes back), then the button hides, settings stay, a notice says how to get it back", async ({ page, context }) => {
        await turnOn(page, "Highlight links");
        await page.getByRole("button", { name: "Hide" }).click();
        const choice = panel(page).getByRole("group", { name: "Hide the accessibility button?" });
        await expect(choice).toBeVisible();
        await expect(choice.getByRole("button", { name: "For this visit" })).toBeFocused();
        expect(await widgetViolations(page)).toEqual([]);
        await choice.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("button", { name: "Hide" })).toBeFocused();

        await page.getByRole("button", { name: "Hide" }).click();
        await panel(page).getByRole("button", { name: "For this visit" }).click();
        await expect(toggle(page)).toBeHidden();
        await expect(panel(page)).toBeHidden();
        await expect(hiddenNotice(page)).toHaveText(/Press (Alt|Option)\+A to show it again/);
        await expect(hiddenNotice(page)).toBeFocused(); // nothing on the page had focus before: focus lands on the notice
        expect(await widgetViolations(page)).toEqual([]);
        expect(await page.locator("#sk-link").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 0)"); // settings stay

        await page.reload(); // same tab: still hidden
        await expect(page.locator("a11yw-root")).toBeAttached();
        await expect(toggle(page)).toBeHidden();
        const other = await context.newPage(); // a new tab: shown
        await other.goto("/");
        await expect(other.getByRole("button", { name: "Accessibility" })).toBeVisible();
    });

    test("Hide for 30 days survives a new tab; it shows again once the date passes; Alt+A brings it back and clears it", async ({ page, context }) => {
        await toggle(page).click();
        await page.getByRole("button", { name: "Hide" }).click();
        await panel(page).getByRole("button", { name: "For 30 days" }).click();
        await expect(toggle(page)).toBeHidden();
        const until = Number(await page.evaluate(() => localStorage.getItem("a11yw:hidden:v1")));
        expect(until - Date.now()).toBeGreaterThan(29.9 * 24 * 60 * 60 * 1000);

        const other = await context.newPage();
        await other.goto("/");
        await expect(other.locator("a11yw-root")).toBeAttached();
        await expect(other.getByRole("button", { name: "Accessibility" })).toBeHidden();

        await other.keyboard.press("Alt+KeyA"); // back, with the panel open
        await expect(other.getByRole("region", { name: "Accessibility settings" })).toBeVisible();
        await expect(other.getByRole("button", { name: "Accessibility" })).toBeVisible();
        expect(await other.evaluate(() => localStorage.getItem("a11yw:hidden:v1"))).toBeNull();

        await other.evaluate(() => localStorage.setItem("a11yw:hidden:v1", String(Date.now() - 1000))); // the date has passed
        await other.reload();
        await expect(other.getByRole("button", { name: "Accessibility" })).toBeVisible();
    });

    test("the owner's accessibility statement link: shown when set, never a javascript: address", async ({ page }) => {
        await toggle(page).click();
        await expect(panel(page).getByRole("link", { name: "Accessibility statement" })).toHaveCount(0);

        await serveConfig(page, { ...CONFIG, statementUrl: "https://shop.example/accessibility" });
        await page.reload();
        await toggle(page).click();
        await expect(panel(page).getByRole("link", { name: "Accessibility statement" })).toHaveAttribute("href", "https://shop.example/accessibility");
        for (const [width, height] of [[320, 640], [1280, 900], [640, 450]] as const) {
            await page.setViewportSize({ width, height });
            expect(await widgetViolations(page), `${width}×${height}`).toEqual([]);
        }

        await serveConfig(page, { ...CONFIG, statementUrl: "javascript:alert(1)" });
        await page.reload();
        await toggle(page).click();
        await expect(panel(page).getByRole("link", { name: "Accessibility statement" })).toHaveCount(0);
    });
});

test.describe("Read aloud (/)", () => {
    type Spoken = { text: string; lang: string; rate: number; voice?: string };
    const player = (page: Page) => page.getByRole("region", { name: "Read aloud" });
    const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __speech: { spoken: Spoken[] } }).__speech.spoken);
    const texts = async (page: Page) => (await spoken(page)).map((s) => s.text);
    const finish = (page: Page) => page.evaluate(() => (window as unknown as { __speech: { finish(): void } }).__speech.finish());
    const speechState = (page: Page) => page.evaluate(() => (window as unknown as { __speech: { state: string } }).__speech.state);
    const partRequests: string[] = [];

    test.beforeEach(async ({ page }) => {
        partRequests.length = 0;
        page.on("request", (r) => {
            if (r.url().includes("/parts/read-aloud")) partRequests.push(r.url());
        });
        // A fake voice: headless Chrome has none. It records what would be said; finish() ends the current sentence.
        await page.addInitScript(() => {
            const spoken: unknown[] = [];
            let current: { onend?: () => void } | null = null;
            let state = "idle";
            class FakeUtterance {
                lang = "";
                rate = 1;
                voice: { name: string } | null = null;
                onend: (() => void) | null = null;
                onerror: (() => void) | null = null;
                constructor(public text: string) {}
            }
            const voices = [
                { name: "Network voice", lang: "en-US", localService: false },
                { name: "On-device voice", lang: "en-US", localService: true },
                { name: "Voix", lang: "fr-FR", localService: true },
            ];
            const synth = {
                speak(u: FakeUtterance) {
                    spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name });
                    current = u as unknown as { onend?: () => void };
                    state = "speaking";
                },
                cancel() {
                    current = null;
                    state = "idle";
                },
                pause() {
                    state = "paused";
                },
                resume() {
                    state = "speaking";
                },
                getVoices: () => voices,
            };
            Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
            (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
            (window as unknown as Record<string, unknown>).__speech = {
                spoken,
                finish() {
                    const u = current;
                    current = null;
                    u?.onend?.();
                },
                get state() {
                    return state;
                },
            };
        });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "afterbegin",
                `<main id="ra-main">
                   <h2 id="ra-h">Our story</h2>
                   <p id="ra-p1">First sentence here. Second one follows! And a third?</p>
                   <p id="ra-p2">Another paragraph. <a id="ra-link" href="#linked">A link</a> inside it.</p>
                   <p id="ra-form">Name <input aria-label="Name" value="secret value"> <input aria-label="Password" type="password" value="hunter2"></p>
                   <p aria-hidden="true">Hidden words</p>
                   <div data-a11yw-ignore="read-aloud"><p>Ignored words</p></div>
                   <p id="ra-fr" lang="fr">Bonjour tout le monde.</p>
                 </main>`
            );
        });
    });

    test("turning it on downloads the part and shows the player, and says nothing", async ({ page }) => {
        expect(partRequests).toEqual([]);
        await turnOn(page, "Read aloud");
        await expect(player(page)).toBeVisible();
        await expect(player(page)).toContainText("Click any text to hear it, or press Play.");
        expect(partRequests).toHaveLength(1);
        expect(await spoken(page)).toEqual([]);
    });

    test("clicking text reads it sentence by sentence, then the next block, in the page's language with an on-device voice", async ({ page }) => {
        await turnOn(page, "Read aloud");
        await closeButton(page).click();
        await page.locator("#ra-p1").click();
        await expect.poll(() => spoken(page)).toEqual([{ text: "First sentence here.", lang: "en", rate: 1, voice: "On-device voice" }]);
        expect(await page.locator("#ra-p1").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
        expect(await page.evaluate(() => String([...((CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get("a11yw-reading") ?? [])][0]))).toBe("First sentence here."); // the sentence, highlighted
        await finish(page);
        await finish(page);
        await finish(page);
        expect(await texts(page)).toEqual(["First sentence here.", "Second one follows!", "And a third?", "Another paragraph."]); // on to the next block
        expect(await page.locator("#ra-p1").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none"); // moved on
    });

    test("clicking a link follows it and doesn't read", async ({ page }) => {
        await turnOn(page, "Read aloud");
        await closeButton(page).click();
        await page.locator("#ra-link").click();
        await expect(page).toHaveURL(/#linked$/);
        expect(await spoken(page)).toEqual([]);
    });

    test("form values, hidden and opted-out text are never read; other languages get their own voice", async ({ page }) => {
        await turnOn(page, "Read aloud");
        await closeButton(page).click();
        await page.locator("#ra-form").click({ position: { x: 4, y: 4 } });
        await expect.poll(() => texts(page)).toEqual(["Name"]);
        await finish(page);
        const all = await spoken(page);
        expect(all.at(-1)).toEqual({ text: "Bonjour tout le monde.", lang: "fr", rate: 1, voice: "Voix" });
        expect(JSON.stringify(all)).not.toMatch(/secret value|hunter2|Hidden words|Ignored words/);
    });

    test("the player: pause and resume, next and previous, speed, stop; by keyboard; accessible at every width", async ({ page }) => {
        await turnOn(page, "Read aloud");
        await closeButton(page).click();
        await page.locator("#ra-p1").click();
        await expect.poll(() => texts(page)).toEqual(["First sentence here."]);

        const pause = player(page).getByRole("button", { name: "Pause" });
        await pause.focus();
        await page.keyboard.press("Enter");
        expect(await speechState(page)).toBe("paused");
        await expect(player(page).getByRole("button", { name: "Play" })).toBeFocused();
        await page.keyboard.press("Enter");
        expect(await speechState(page)).toBe("speaking");

        await player(page).getByRole("button", { name: "Next" }).click();
        expect((await texts(page)).at(-1)).toBe("Another paragraph.");
        await player(page).getByRole("button", { name: "Previous" }).click();
        expect((await texts(page)).at(-1)).toBe("First sentence here.");

        await player(page).getByLabel("Speed").selectOption("Fast"); // the sentence again, faster
        expect((await spoken(page)).at(-1)).toMatchObject({ text: "First sentence here.", rate: 1.25 });

        await player(page).getByRole("button", { name: "Stop" }).click();
        expect(await speechState(page)).toBe("idle");
        expect(await page.locator("#ra-p1").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
        await expect(player(page)).toBeVisible(); // stays while Read aloud is on

        for (const [width, height] of [[320, 640], [768, 1024], [1280, 900], [640, 450]] as const) {
            await page.setViewportSize({ width, height });
            const box = (await player(page).boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
            expect(await widgetViolations(page), `${width}×${height}`).toEqual([]);
        }
    });

    test("Play reads the selected text; a saved 'on' shows the player at the next visit", async ({ page }) => {
        await turnOn(page, "Read aloud");
        await closeButton(page).click();
        await page.evaluate(() => {
            const text = document.getElementById("ra-p2")!.firstChild!;
            const range = document.createRange();
            range.setStart(text, 0);
            range.setEnd(text, "Another paragraph.".length);
            getSelection()!.removeAllRanges();
            getSelection()!.addRange(range);
        });
        await player(page).getByRole("button", { name: "Play" }).click();
        expect(await texts(page)).toEqual(["Another paragraph."]);

        await page.reload();
        await expect(player(page)).toBeVisible(); // without opening the panel
    });

    test("a browser without speech: the player says so", async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true }));
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        await turnOn(page, "Read aloud");
        await expect(player(page)).toContainText("Your browser can't read aloud.");
        await expect(player(page).getByRole("button", { name: "Play" })).toBeDisabled();
    });
});

test.describe("The panel as a part (/)", () => {
    const panelRequests = (page: Page) => {
        const times: number[] = [];
        page.on("request", (r) => {
            if (r.url().includes("/parts/panel.")) times.push(Date.now());
        });
        return times;
    };

    test("downloaded once, after the page has loaded, while idle; the first click opens it at once", async ({ page }) => {
        const requests = panelRequests(page);
        let loadedAt = 0;
        page.on("load", () => (loadedAt = Date.now()));
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await expect.poll(() => requests.length).toBe(1);
        expect(requests[0]).toBeGreaterThanOrEqual(loadedAt);
        await expect(page.locator("a11yw-root #panel")).toBeAttached(); // mounted, closed
        await expect(panel(page)).toBeHidden();
        await toggle(page).click();
        await expect(closeButton(page)).toBeFocused();
        expect(requests).toHaveLength(1);
    });

    test("with Save data on, nothing is downloaded until the first click", async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true } }));
        const requests = panelRequests(page);
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await page.waitForTimeout(2500); // longer than the idle fallback
        expect(requests).toHaveLength(0);
        await toggle(page).click();
        await expect(closeButton(page)).toBeFocused();
        expect(requests).toHaveLength(1);
    });

    test("clicked while it's still downloading: the button says busy, then the panel opens with focus inside", async ({ page }) => {
        await page.route("**/parts/panel.*", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
        });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await toggle(page).click();
        await expect(toggle(page)).toHaveAttribute("aria-busy", "true");
        await expect(closeButton(page)).toBeFocused({ timeout: 10_000 });
        await expect(toggle(page)).not.toHaveAttribute("aria-busy");
        await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    });

    test("if it can't load: a notice; saved settings still apply; Alt+A still brings a hidden button back", async ({ page }) => {
        await page.route("**/parts/panel.*", (route) => route.abort());
        await page.addInitScript(() => {
            localStorage.setItem("a11yw:settings:v1", JSON.stringify({ highlightLinks: true }));
            sessionStorage.setItem("a11yw:hidden:v1", "1");
        });
        await page.goto("/");
        await expect(page.locator("a11yw-root")).toBeAttached();
        await expect(toggle(page)).toBeHidden();
        expect(await page.locator("a[href]").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 0)"); // the main script applied it
        await page.keyboard.press("Alt+KeyA");
        await expect(toggle(page)).toBeVisible();
        await expect(page.locator("a11yw-root").getByRole("status").filter({ hasText: "Couldn't open the settings" })).toBeVisible();
        expect(await widgetViolations(page)).toEqual([]);
    });
});

test.describe("data-a11yw-ignore with setting names (/)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    });

    test("every setting in the panel has a unique id and an ignore check", async ({ page }) => {
        const ids = await page.locator("a11yw-root [data-feature-id]").evaluateAll((els) =>
            els.map((el) => (el as HTMLElement).dataset.featureId!)
        );
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.filter((id) => !PROBES[id] && !SCREEN_WIDE.includes(id) && !TESTED_WITH_THEMSELVES.includes(id))).toEqual([]); // add a PROBES entry for a new setting
        expect(Object.keys(PROBES).filter((id) => !ids.includes(id))).toEqual([]);     // no checks for settings that don't exist
    });

    test("a list of names opts out of only those settings", async ({ page }) => {
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<div data-a11yw-ignore="text-size focus-outline"><a href="/only" id="only-link">Only some settings ignored</a></div>`
            );
        });
        await turnOn(page, "Highlight links"); // not in the list, so it still applies here
        const background = () => page.locator("#only-link").evaluate((el) => getComputedStyle(el).backgroundColor);
        await expect.poll(background).toBe("rgb(255, 255, 0)");
    });

    test("an opted-out area inside adjusted text inherits none of the settings", async ({ page }) => {
        await page.evaluate(() => {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<p id="mixed">Paragraph <span id="mixed-ignored" data-a11yw-ignore="text-size text-spacing">ignored words</span></p>`
            );
        });
        const style = () =>
            page.locator("#mixed-ignored").evaluate((el) => {
                const s = getComputedStyle(el);
                return { fontSize: s.fontSize, letterSpacing: s.letterSpacing, lineHeight: s.lineHeight };
            });
        const before = await style();

        await toggle(page).click();
        await page.getByRole("radio", { name: "Larger (150%)" }).check();
        await page.getByRole("group", { name: "Text spacing" }).getByRole("radio", { name: "Wide", exact: true }).check();
        expect(await style()).toEqual(before); // nothing inherited from the paragraph around it
    });

    test("browsers without :has() still get Highlight links and Text spacing", async ({ page }) => {
        // Pretend to be an older browser: CSS.supports says :has() isn't available
        await page.addInitScript(() => {
            const original = CSS.supports as (...args: string[]) => boolean;
            CSS.supports = function (...args: string[]) {
                if (args.length === 1 && args[0].includes(":has(")) return false;
                return original.apply(CSS, args);
            } as typeof CSS.supports;
        });
        await page.reload();
        await expect(toggle(page)).toBeVisible();

        await turnOn(page, "Highlight links");
        await page.getByRole("group", { name: "Text spacing" }).getByRole("radio", { name: "Wide", exact: true }).check();

        // A rule using :has() would be dropped whole by such a browser
        const css = await page.locator("#a11yw-page-adjustments").evaluate((el) => el.textContent ?? "");
        expect(css).toContain("a[href]");
        expect(css).not.toContain(":has(");
    });


    test("warns once about names that aren't settings (typos)", async ({ page }) => {
        const warnings: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "warning") warnings.push(msg.text());
        });
        await page.addInitScript(() =>
            document.addEventListener("DOMContentLoaded", () =>
                document.body.insertAdjacentHTML("beforeend", '<div data-a11yw-ignore="text-sise highlight-links">x</div>')
            )
        );
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        await expect.poll(() => warnings.filter((w) => w.includes("data-a11yw-ignore"))).toHaveLength(1);
        expect(warnings.find((w) => w.includes("data-a11yw-ignore"))).toContain("text-sise");
        expect(warnings.find((w) => w.includes("data-a11yw-ignore"))).not.toContain("value: highlight-links");
    });
});

test.describe("same-origin iframes (/)", () => {
    const YELLOW = "rgb(255, 255, 0)";
    // A same-origin page without the widget, served by the test instead of a file
    const FRAME_PAGE = `<!doctype html><html lang="en"><head><title>Frame</title></head>
                        <body><a href="/x" id="in-frame">Link in a frame</a></body></html>`;

    const addFrame = (page: Page, id: string, src = "/frame.html", attrs = "") =>
        page.evaluate(
            ([id, src, attrs]) =>
                new Promise<void>((resolve) => {
                    document.body.insertAdjacentHTML("beforeend", `<iframe id="${id}" title="${id}" src="${src}" ${attrs}></iframe>`);
                    document.getElementById(id)!.addEventListener("load", () => resolve(), { once: true });
                }),
            [id, src, attrs]
        );
    const frameLink = (page: Page, id: string) => page.frameLocator(`#${id}`).locator("#in-frame");
    const background = (page: Page, id: string) => frameLink(page, id).evaluate((el) => getComputedStyle(el).backgroundColor);
    const hasOurStyle = (page: Page, id: string) =>
        page.locator(`#${id}`).evaluate((f) => !!(f as HTMLIFrameElement).contentDocument?.getElementById("a11yw-page-adjustments"));

    test.beforeEach(async ({ page }) => {
        await page.route("**/frame.html*", (route) => route.fulfill({ contentType: "text/html", body: FRAME_PAGE }));
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    });

    test("CSS settings reach iframes already there, added later and loading a new page", async ({ page }) => {
        await addFrame(page, "f1");
        await turnOn(page, "Highlight links");
        await expect.poll(() => background(page, "f1")).toBe(YELLOW);

        await addFrame(page, "f2"); // added after the setting was on
        await expect.poll(() => background(page, "f2")).toBe(YELLOW);

        await page.locator("#f1").evaluate( // a new page wipes what we added: it's put back on load
            (f) =>
                new Promise<void>((resolve) => {
                    f.addEventListener("load", () => resolve(), { once: true });
                    (f as HTMLIFrameElement).src = "/frame.html?again";
                })
        );
        await expect.poll(() => background(page, "f1")).toBe(YELLOW);

        await page.getByRole("checkbox", { name: "Highlight links" }).uncheck();
        await expect.poll(() => background(page, "f1")).not.toBe(YELLOW);
        expect(await hasOurStyle(page, "f1")).toBe(false); // no trace left
        expect(await hasOurStyle(page, "f2")).toBe(false);
    });

    test("an <iframe> with data-a11yw-ignore skips only the settings it names", async ({ page }) => {
        await addFrame(page, "f-ignored", "/frame.html", 'data-a11yw-ignore="highlight-links"');
        await turnOn(page, "Highlight links");
        await page.getByRole("group", { name: "Text spacing" }).getByRole("radio", { name: "Wide", exact: true }).check();

        const letterSpacing = () => frameLink(page, "f-ignored").evaluate((el) => getComputedStyle(el).letterSpacing);
        await expect.poll(letterSpacing).not.toBe("normal"); // Text spacing applies...
        expect(await background(page, "f-ignored")).not.toBe(YELLOW); // ...Highlight links doesn't
    });

    test("iframes running their own widget and other-origin iframes are left alone, without errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await addFrame(page, "own", "/"); // a page with our snippet: its own widget handles it
        await expect(page.frameLocator("#own").getByRole("button", { name: "Accessibility" })).toBeVisible();
        await addFrame(page, "other", "http://127.0.0.1:4002/frame.html"); // another origin (127.0.0.1 ≠ localhost)

        await turnOn(page, "Highlight links");
        await addFrame(page, "f1"); // proves iframes are being handled at all
        await expect.poll(() => background(page, "f1")).toBe(YELLOW);

        expect(await hasOurStyle(page, "own")).toBe(false);
        expect(await page.locator("#other").evaluate((f) => (f as HTMLIFrameElement).contentDocument)).toBeNull();
        expect(errors).toEqual([]);
    });
});


test.describe("site owner's config (/)", () => {
    const VIOLET = "rgb(91, 71, 200)"; // our default state color
    const launcherColor = (page: Page) => toggle(page).evaluate((el) => getComputedStyle(el).backgroundColor);
    const linkBackground = (page: Page) => page.locator("a[href]").first().evaluate((el) => getComputedStyle(el).backgroundColor);

    test("asks for this account and hostname", async ({ page }) => {
        const request = page.waitForRequest("**/api/widget/config?**");
        await page.goto("/");
        const url = new URL((await request).url());
        expect(url.searchParams.get("account")).toBe("acct_test");
        expect(url.searchParams.get("host")).toBe("localhost");
    });

    test("doesn't show on a domain that isn't one of the account's sites, and applies nothing", async ({ page }) => {
        await serveConfig(page, { ...CONFIG, enabled: false });
        await page.addInitScript(() => localStorage.setItem("a11yw:settings:v1", JSON.stringify({ highlightLinks: true })));
        const warning = page.waitForEvent("console", (msg) => msg.type() === "warning" && msg.text().includes("isn't one of this account's sites"));
        await page.goto("/");
        await warning;
        await expect(page.locator("a11yw-root")).toHaveCount(0);
        expect(await linkBackground(page)).not.toBe("rgb(255, 255, 0)");
    });

    test("uses the owner's exact brand color, light ones too, and keeps everything readable", async ({ page }) => {
        const launcherIcon = () => toggle(page).evaluate((el) => getComputedStyle(el).color); // the icon draws in this color

        await serveConfig(page, { ...CONFIG, theme: { state: "#c62828" } });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        expect(await launcherColor(page)).toBe("rgb(198, 40, 40)");
        expect(await launcherIcon()).toBe("rgb(255, 255, 255)"); // white icon on dark red

        await serveConfig(page, { ...CONFIG, theme: { state: "#ffd400" } }); // yellow
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        expect(await launcherColor(page)).toBe("rgb(255, 212, 0)"); // exactly their color
        expect(await launcherIcon()).toBe("rgb(0, 0, 0)"); // with a black icon

        // State borders and text on white use our ink instead of yellow, and the open panel passes axe
        await toggle(page).click();
        await page.getByRole("checkbox", { name: "Highlight links" }).check();
        const tileBorder = await page
            .locator("a11yw-root li[data-feature-id='highlight-links'] .tile-face")
            .evaluate((el) => getComputedStyle(el).borderTopColor);
        expect(tileBorder).toBe("rgb(28, 26, 51)");
        expect(await widgetViolations(page)).toEqual([]);
    });



    test("turns on the owner's defaults for new visitors; the visitor's own choice wins and Reset all brings them back", async ({ page }) => {
        await serveConfig(page, { ...CONFIG, defaults: { highlightLinks: true } });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        await expect.poll(() => linkBackground(page)).toBe("rgb(255, 255, 0)");

        await toggle(page).click();
        await page.getByRole("checkbox", { name: "Highlight links" }).uncheck();
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        expect(await linkBackground(page)).not.toBe("rgb(255, 255, 0)"); // turning it off stuck

        await toggle(page).click();
        await page.getByRole("button", { name: "Reset all" }).click();
        await expect(page.getByRole("checkbox", { name: "Highlight links" })).toBeChecked(); // back to the owner's starting point
        expect(await page.evaluate(() => localStorage.getItem("a11yw:settings:v1"))).toBeNull();
    });

    test("still shows, with our defaults, when the dashboard can't be reached", async ({ page }) => {
        await serveConfig(page, null);
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        expect(await launcherColor(page)).toBe(VIOLET);
    });

    test("a returning visitor keeps the last brand color while the dashboard is down", async ({ page }) => {
        await serveConfig(page, { ...CONFIG, theme: { state: "#c62828" } });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();

        await serveConfig(page, null);
        await page.reload();
        await expect(toggle(page)).toBeVisible();
        expect(await launcherColor(page)).toBe("rgb(198, 40, 40)");
    });
});


test.describe("button position (/)", () => {
    type Spot = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "middle-right" | "middle-left";
    const SPOTS: Spot[] = ["bottom-right", "bottom-left", "top-right", "top-left", "middle-right", "middle-left"];
    const place = (spot: Spot, side = 24, edge = 40) => ({ spot, side, edge });
    const box = async (page: Page, which: "toggle" | "panel") => (await (which === "toggle" ? toggle(page) : panel(page)).boundingBox())!;

    async function openAt(page: Page, size: { width: number; height: number }, position: object | undefined) {
        await page.setViewportSize(size);
        await serveConfig(page, { ...CONFIG, ...(position && { position }) });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
    }

    /** The panel is fully on screen and opens toward the middle: above, below or beside the button. */
    async function expectPanelFits(page: Page, spot: Spot, size: { width: number; height: number }, beside: boolean) {
        await toggle(page).click();
        await expect(panel(page)).toBeVisible();
        const b = await box(page, "toggle");
        const p = await box(page, "panel");
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width).toBeLessThanOrEqual(size.width + 0.5);
        expect(p.y + p.height).toBeLessThanOrEqual(size.height + 0.5);
        if (spot.startsWith("bottom")) expect(p.y + p.height).toBeLessThanOrEqual(b.y); // above the button
        if (spot.startsWith("top")) expect(p.y).toBeGreaterThanOrEqual(b.y + b.height); // below it
        if (beside && spot === "middle-right") expect(p.x + p.width).toBeLessThanOrEqual(b.x); // to its left
        if (beside && spot === "middle-left") expect(p.x).toBeGreaterThanOrEqual(b.x + b.width); // to its right
        await expect(closeButton(page)).toBeFocused(); // focus behaviour unchanged
    }

    test("without a position from the owner: bottom right, 16px in, panel above it", async ({ page }) => {
        const size = { width: 1280, height: 800 };
        await openAt(page, size, undefined);
        const b = await box(page, "toggle");
        expect(Math.round(size.width - (b.x + b.width))).toBe(16);
        expect(Math.round(size.height - (b.y + b.height))).toBe(16);
        await expectPanelFits(page, "bottom-right", size, false);
    });

    for (const spot of SPOTS) {
        test(`desktop: ${spot}, 24px from the side and 40px from the edge; the panel opens toward the middle and fits`, async ({ page }) => {
            const size = { width: 1280, height: 800 };
            await openAt(page, size, { desktop: place(spot), phone: place("bottom-right") });
            const b = await box(page, "toggle");
            const [y, x] = spot.split("-");
            if (x === "right") expect(Math.round(size.width - (b.x + b.width))).toBe(24);
            else expect(Math.round(b.x)).toBe(24);
            if (y === "bottom") expect(Math.round(size.height - (b.y + b.height))).toBe(40);
            if (y === "top") expect(Math.round(b.y)).toBe(40);
            if (y === "middle") expect(Math.abs(b.y + b.height / 2 - size.height / 2)).toBeLessThan(1); // centered
            await expectPanelFits(page, spot, size, true);
            expect(await widgetViolations(page)).toEqual([]);
        });
    }

    test("phones use the phone placement (and desktop the desktop one)", async ({ page }) => {
        await openAt(page, { width: 375, height: 700 }, { desktop: place("top-left"), phone: place("bottom-right", 10, 90) });
        let b = await box(page, "toggle");
        expect(Math.round(375 - (b.x + b.width))).toBe(10);
        expect(Math.round(700 - (b.y + b.height))).toBe(90);

        await page.setViewportSize({ width: 1024, height: 700 }); // same page, wider: CSS switches, no reload
        b = await box(page, "toggle");
        expect(Math.round(b.x)).toBe(24);
        expect(Math.round(b.y)).toBe(40);
    });

    for (const spot of SPOTS) {
        test(`phone at 320px: ${spot}; the panel takes the screen's width and fits`, async ({ page }) => {
            const size = { width: 320, height: 640 };
            await openAt(page, size, { desktop: place("bottom-right"), phone: place(spot, 12, 24) });
            await expectPanelFits(page, spot, size, false);
            const p = await box(page, "panel");
            expect(Math.round(p.x)).toBe(16);
            expect(Math.round(p.width)).toBe(320 - 32);
        });
    }

    test("big distances on a small screen can't push the button off it", async ({ page }) => {
        const size = { width: 320, height: 400 };
        for (const spot of ["bottom-right", "top-left"] as Spot[]) {
            await openAt(page, size, { desktop: place(spot, 200, 200), phone: place(spot, 200, 200) });
            await page.setViewportSize({ width: 240, height: 200 }); // and smaller still (e.g. zoomed in)
            const b = await box(page, "toggle");
            expect(b.x).toBeGreaterThanOrEqual(8 - 0.5);
            expect(b.y).toBeGreaterThanOrEqual(8 - 0.5);
            expect(b.x + b.width).toBeLessThanOrEqual(240 - 8 + 0.5);
            expect(b.y + b.height).toBeLessThanOrEqual(200 - 8 + 0.5);
            await page.evaluate(() => localStorage.clear());
        }
    });

    test("the page's CSS can't move it", async ({ page }) => {
        const size = { width: 1280, height: 800 };
        await openAt(page, size, { desktop: place("top-left"), phone: place("top-left") });
        await page.addStyleTag({
            content: "a11yw-root { top: auto !important; bottom: 0 !important; left: auto !important; right: 0 !important; --ap-side: 500px !important; --ap-edge: 500px !important; }",
        });
        const b = await box(page, "toggle");
        expect(Math.round(b.x)).toBe(24);
        expect(Math.round(b.y)).toBe(40);
    });
});

test.describe("visitors move the button (/)", () => {
    const moveButton = (page: Page, to: "left" | "right") => page.getByRole("button", { name: `Move to the ${to}` });
    const box = async (page: Page) => (await toggle(page).boundingBox())!;
    const owner = { desktop: { spot: "bottom-right", side: 24, edge: 40 }, phone: { spot: "top-left", side: 10, edge: 20 } };

    test("Move to the left: the button and the panel move, focus stays, it's announced, and it sticks", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await serveConfig(page, { ...CONFIG, position: owner });
        await page.goto("/");
        await toggle(page).click();

        await moveButton(page, "left").click();
        let b = await box(page);
        expect(Math.round(b.x)).toBe(24); // the owner's distance, now from the left
        expect(Math.round(800 - (b.y + b.height))).toBe(40); // the owner's height is kept
        await expect(panel(page)).toBeVisible(); // still open…
        const p = (await panel(page).boundingBox())!;
        expect(Math.round(p.x)).toBe(24); // …and moved with the button
        expect(p.y + p.height).toBeLessThanOrEqual(b.y);
        await expect(moveButton(page, "right")).toBeFocused(); // same button, now offering the way back
        await expect(panel(page).getByRole("status")).toHaveText("Moved to the left.");
        expect(await widgetViolations(page)).toEqual([]);

        await page.reload();
        await expect(toggle(page)).toBeVisible();
        b = await box(page);
        expect(Math.round(b.x)).toBe(24); // still on the left on the next page view
    });

    test("on phones it moves the phone placement too, and the label follows the screen width", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 700 });
        await serveConfig(page, { ...CONFIG, position: owner });
        await page.goto("/");
        await toggle(page).click();
        await expect(moveButton(page, "right")).toBeVisible(); // phone placement is top left

        await moveButton(page, "right").click();
        const b = await box(page);
        expect(Math.round(375 - (b.x + b.width))).toBe(10);
        expect(Math.round(b.y)).toBe(20);

        await page.setViewportSize({ width: 1280, height: 800 }); // desktop: the visitor's side applies there too
        await expect(moveButton(page, "left")).toBeVisible();
        expect(Math.round(1280 - ((await box(page)).x + (await box(page)).width))).toBe(24);
    });

    test("Reset all brings the button back to the site's side and forgets the move", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await serveConfig(page, { ...CONFIG, position: owner });
        await page.goto("/");
        await toggle(page).click();
        await moveButton(page, "left").click();
        await page.getByRole("button", { name: "Reset all" }).click();
        const b = await box(page);
        expect(Math.round(1280 - (b.x + b.width))).toBe(24);
        await expect(moveButton(page, "left")).toBeVisible();
        expect(await page.evaluate(() => localStorage.getItem("a11yw:side:v1"))).toBeNull();
    });

    test("a broken saved side is ignored", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.addInitScript(() => localStorage.setItem("a11yw:side:v1", "center; left: 0"));
        await serveConfig(page, { ...CONFIG, position: owner });
        await page.goto("/");
        await expect(toggle(page)).toBeVisible();
        const b = await box(page);
        expect(Math.round(1280 - (b.x + b.width))).toBe(24);
    });
});

test.describe("slow pages (/)", () => {
    test("shows within seconds when an image never finishes loading, and works", async ({ page }) => {
        // An image that never answers: the page's load event never fires
        await page.route("**/never-loads.png", () => {});
        await page.route((url) => url.pathname === "/", async (route) => {
            const response = await route.fetch();
            const html = (await response.text()).replace("<body>", '<body><img src="/never-loads.png" alt="">');
            await route.fulfill({ response, body: html });
        });
        const started = Date.now();
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(toggle(page)).toBeVisible({ timeout: 8000 });
        expect(Date.now() - started).toBeLessThan(6000);
        expect(await page.evaluate(() => document.readyState)).not.toBe("complete"); // shown before the page loaded

        await toggle(page).click();
        await expect(panel(page)).toBeVisible();
        await page.getByRole("checkbox", { name: "Highlight links" }).check();
        expect(await page.locator("a[href]").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 0)");
    });
});
