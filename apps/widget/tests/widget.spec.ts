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

const PROBES: Record<string, Probe> = {
    "text-size": {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: async (page) => {
            await toggle(page).click();
            await page.getByRole("radio", { name: "Larger (150%)" }).check();
        },
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).fontSize),
    },
    "highlight-links": {
        fixture: `<a class="probe" href="/probe">A link</a>`,
        turnOn: (page) => turnOn(page, "Highlight links"),
        read: (page, area) => page.locator(`#${area} .probe`).evaluate((el) => getComputedStyle(el).backgroundColor),
    },
    "text-spacing": {
        fixture: `<p class="probe">Some text</p>`,
        turnOn: (page) => turnOn(page, "Text spacing"),
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
        expect(ids.filter((id) => !PROBES[id])).toEqual([]);                           // add a PROBES entry for a new setting
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
        await page.getByRole("checkbox", { name: "Text spacing" }).check();
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
        await page.getByRole("checkbox", { name: "Text spacing" }).check();

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
        await page.getByRole("checkbox", { name: "Text spacing" }).check();

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

