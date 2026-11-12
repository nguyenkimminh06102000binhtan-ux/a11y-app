import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const toggle = (page: Page) => page.getByRole("button", { name: "Accessibility" });
const panel = (page: Page) => page.getByRole("region", { name: "Accessibility settings" });
const closeButton = (page: Page) => page.getByRole("button", { name: "Close", exact: true });

async function turnOn(page: Page, label: string) {
    await toggle(page).click();
    await page.getByRole("checkbox", { name: label }).check();
}

/** Adds a muted looping video and an unmuted audio, both autoplaying a generated silent WAV (no files, no network). */
async function addAutoplayMedia(page: Page, inComponent = false) {
    await page.evaluate((inComponent) => {
        const rate = 8000;
        const samples = rate * 2; // 2 seconds of silence
        const buf = new ArrayBuffer(44 + samples * 2);
        const v = new DataView(buf);
        const text = (offset: number, s: string) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
        text(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); text(8, "WAVE");
        text(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        text(36, "data"); v.setUint32(40, samples * 2, true);
        const src = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));

        const holder = document.createElement("div");
        holder.innerHTML = `<video id="test-video" muted loop autoplay src="${src}"></video>
                            <audio id="test-audio" loop autoplay src="${src}"></audio>`;
        holder.querySelectorAll("video, audio").forEach((el) =>
            el.addEventListener("play", () => ((el as HTMLElement).dataset.played = "yes"))
        );
        const target = inComponent ? document.querySelector("link-card")!.shadowRoot! : document.body;
        target.appendChild(holder);
    }, inComponent);
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
            await expect(toggle(page)).toBeFocused(); // disclosure: focus doesn't jump into the panel

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

        test("Text spacing applies WCAG 1.4.12 values to the page, not the widget", async ({ page }) => {
            await turnOn(page, "Text spacing");

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
                page.evaluate(() => (document.getElementById("test-video") as HTMLVideoElement).play().catch(() => {}));

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
        await turnOn(page, "Text spacing");
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
});
