import { test } from "node:test";
import assert from "node:assert/strict";
import * as v from "valibot";
import {
    DEFAULT_PLACEMENT,
    DEFAULT_SITE_SETTINGS,
    OffsetSchema,
    SpotSchema,
    DefaultSettingsSchema,
    FALLBACK_CONFIG,
    StateColorSchema,
    contrastRatio,
    INK,
    isReadableStateColor,
    onStateColor,
    stateInk,
    parseConfig,
    readSiteSettings,
    stateTint,
    toWidgetConfig,
    StatementUrlSchema,
} from "./index.ts";

// ─── Served config (what the widget receives) ───

test("a valid config is kept as is", () => {
    const config = { v: 1, enabled: true, theme: { state: "#5B47C8" }, defaults: { focusOutline: true } };
    assert.deepEqual(parseConfig(config), { v: 1, enabled: true, theme: { state: "#5b47c8" }, defaults: { focusOutline: true } });
});

test("anything that isn't a version-1 config is rejected whole", () => {
    for (const input of [null, "x", 42, [], {}, { v: 2, enabled: true }]) {
        assert.equal(parseConfig(input), null, JSON.stringify(input));
    }
});

test("invalid parts are dropped, the rest is kept", () => {
    const parsed = parseConfig({
        v: 1,
        enabled: "no", // not a boolean: stays enabled (fail open)
        theme: { state: "red" }, // not #rrggbb
        defaults: { focusOutline: true, textSpacing: "yes", unknownSetting: true, highlightLinks: false },
        somethingNewer: { size: "xl" }, // a field from a newer dashboard: ignored
    });
    assert.deepEqual(parsed, { v: 1, enabled: true, theme: {}, defaults: { focusOutline: true } });
});

test("enabled: false is respected", () => {
    assert.equal(parseConfig({ v: 1, enabled: false })?.enabled, false);
});

test("the fallback keeps the widget working", () => {
    assert.deepEqual(FALLBACK_CONFIG, { v: 1, enabled: true, theme: {}, defaults: {} });
});

// ─── Stored settings (what the owner chose) ───

test("stored settings: missing or broken data reads as our defaults", () => {
    for (const input of [null, undefined, "x", 42, []]) {
        assert.deepEqual(readSiteSettings(input), DEFAULT_SITE_SETTINGS, JSON.stringify(input));
    }
    assert.deepEqual(readSiteSettings({}), DEFAULT_SITE_SETTINGS);
});

test("stored settings: one bad field falls back alone, the others are kept", () => {
    const settings = readSiteSettings({
        v: 1,
        appearance: { stateColor: "yellow" }, // not #rrggbb: our default color
        defaults: ["pauseAnimations", "nope", "focusOutline", "focusOutline"], // unknown dropped, duplicates merged, fixed order
    });
    assert.deepEqual(settings, { v: 1, appearance: {}, defaults: ["focusOutline", "pauseAnimations"], links: {} });
});

test("toWidgetConfig: what the owner chose becomes what the widget gets", () => {
    const settings = readSiteSettings({ v: 1, appearance: { stateColor: "#C62828" }, defaults: ["highlightLinks"] });
    assert.deepEqual(toWidgetConfig(settings, true), {
        v: 1,
        enabled: true,
        theme: { state: "#c62828" },
        defaults: { highlightLinks: true },
    });
    assert.deepEqual(toWidgetConfig(DEFAULT_SITE_SETTINGS, false), { v: 1, enabled: false, theme: {}, defaults: {} });
    // and the widget accepts what the server sends
    assert.deepEqual(parseConfig(toWidgetConfig(settings, true)), toWidgetConfig(settings, true));
});

// ─── Position ───

test("position: no choice stored = nothing sent, so the widget uses bottom right, 16px in", () => {
    assert.equal(toWidgetConfig(readSiteSettings({}), true).position, undefined);
    assert.deepEqual(DEFAULT_PLACEMENT, { spot: "bottom-right", side: 16, edge: 16 });
});

test("position: phones use the desktop placement unless they have their own", () => {
    const desktop = { spot: "top-left", side: 24, edge: 80 };
    const same = toWidgetConfig(readSiteSettings({ appearance: { position: { desktop } } }), true);
    assert.deepEqual(same.position, { desktop, phone: desktop });

    const phone = { spot: "middle-right", side: 0, edge: 16 };
    const own = toWidgetConfig(readSiteSettings({ appearance: { position: { desktop, phone } } }), true);
    assert.deepEqual(own.position, { desktop, phone });
    assert.deepEqual(parseConfig(own), own); // and the widget accepts it
});

test("position: a bad field falls back alone; the rest of the placement is kept", () => {
    const settings = readSiteSettings({
        appearance: { stateColor: "#c62828", position: { desktop: { spot: "center", side: 500, edge: 40 }, phone: "nope" } },
    });
    assert.deepEqual(settings.appearance, {
        stateColor: "#c62828",
        position: { desktop: { spot: "bottom-right", side: 16, edge: 40 } }, // bad phone = same as desktop
    });
});

test("position: the widget ignores a broken position from the server, and old configs without one still parse", () => {
    assert.equal(parseConfig({ v: 1, enabled: true, position: "left" })?.position, undefined);
    assert.equal(parseConfig({ v: 1, enabled: true })?.position, undefined);
    const parsed = parseConfig({ v: 1, position: { desktop: { spot: "top-left", side: -5, edge: 12.5 }, phone: { spot: "bottom-left" } } });
    assert.deepEqual(parsed?.position, {
        desktop: { spot: "top-left", side: 16, edge: 16 }, // negative and fractional values fall back
        phone: { spot: "bottom-left", side: 16, edge: 16 },
    });
});

test("position fields explain what's wrong", () => {
    const message = (schema: Parameters<typeof v.safeParse>[0], input: unknown) => v.safeParse(schema, input).issues?.[0].message;
    assert.equal(v.parse(OffsetSchema, 0), 0);
    assert.equal(v.parse(OffsetSchema, 200), 200);
    assert.match(message(OffsetSchema, 201) ?? "", /0 to 200/);
    assert.match(message(OffsetSchema, -1) ?? "", /0 to 200/);
    assert.match(message(OffsetSchema, Number.NaN) ?? "", /0 to 200/);
    assert.match(message(OffsetSchema, 10.5) ?? "", /whole pixels/);
    assert.equal(v.parse(SpotSchema, "middle-left"), "middle-left");
    assert.match(message(SpotSchema, "center") ?? "", /where the button goes/);
});

// ─── Field schemas (dashboard form) ───

test("the color field explains what's wrong", () => {
    const message = (input: unknown) => v.safeParse(StateColorSchema, input).issues?.[0].message;
    assert.equal(v.parse(StateColorSchema, "#FFD400"), "#ffd400"); // light colors are welcome: the widget adapts
    assert.match(message("red") ?? "", /like #5b47c8/);
});

test("the defaults field keeps known settings only", () => {
    assert.deepEqual(v.parse(DefaultSettingsSchema, ["textSpacing", "bogus", "highlightLinks"]), ["highlightLinks", "textSpacing"]);
});

// ─── Color math ───

/** Every 51st step of each channel (216 colors) plus some pastels and greys. */
const SAMPLE = [
    ...[0, 51, 102, 153, 204, 255].flatMap((r) =>
        [0, 51, 102, 153, 204, 255].flatMap((g) =>
            [0, 51, 102, 153, 204, 255].map((b) => "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join(""))
        )
    ),
    "#ffd400", "#ffc0cb", "#add8e6", "#98fb98", "#777777", "#767676", "#757575", "#5b47c8",
];

test("any brand color: icons and check marks on it reach 4.5:1", () => {
    for (const color of SAMPLE) {
        assert.ok(contrastRatio(onStateColor(color), color) >= 4.5, color);
    }
    assert.equal(onStateColor("#5b47c8"), "#ffffff"); // our violet keeps white icons
    assert.equal(onStateColor("#ffd400"), "#000000"); // yellow gets black ones
});

test("any brand color: state text and borders on white and on the tint reach 4.5:1", () => {
    for (const color of SAMPLE) {
        const ink = stateInk(color);
        assert.ok(contrastRatio(ink, "#ffffff") >= 4.5, `${color} on white`);
        assert.ok(contrastRatio(ink, stateTint(color)) >= 4.5, `${color} on its tint`);
    }
});

test("the brand color is used exactly when it's readable, never altered", () => {
    assert.equal(stateInk("#5b47c8"), "#5b47c8"); // our Iris violet
    assert.equal(stateInk("#C62828"), "#c62828"); // a dark red
    assert.equal(stateInk("#ffd400"), INK); // yellow: our ink instead
    assert.equal(isReadableStateColor("#8b7fd6"), false); // light violet
});

test("the tint matches the tokens package's fallback", () => {
    assert.equal(stateTint("#5b47c8"), "#efedfa");
});

test("contrast math matches WCAG", () => {
    assert.equal(contrastRatio("#000000", "#ffffff"), 21);
    assert.equal(contrastRatio("#777777", "#777777"), 1);
});

test("statement link: full http(s) addresses only, trimmed", () => {
    assert.equal(v.parse(StatementUrlSchema, "  https://shop.com/accessibility  "), "https://shop.com/accessibility");
    assert.ok(v.safeParse(StatementUrlSchema, "http://shop.com/a11y").success);
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "/accessibility", "shop.com/accessibility", "ftp://shop.com/x", "https://" + "a".repeat(500) + ".com"]) {
        assert.equal(v.safeParse(StatementUrlSchema, bad).success, false, bad);
    }
});

test("statement link: stored and served; a bad stored or served value is dropped, the rest kept", () => {
    const stored = readSiteSettings({ v: 1, appearance: { stateColor: "#123456" }, defaults: [], links: { statement: "https://shop.com/a11y" } });
    assert.equal(stored.links.statement, "https://shop.com/a11y");
    assert.equal(toWidgetConfig(stored, true).statementUrl, "https://shop.com/a11y");
    const bad = readSiteSettings({ v: 1, appearance: { stateColor: "#123456" }, defaults: [], links: { statement: "javascript:alert(1)" } });
    assert.equal(bad.links.statement, undefined);
    assert.equal(bad.appearance.stateColor, "#123456");
    assert.equal("statementUrl" in toWidgetConfig(bad, true), false);
    const served = parseConfig({ v: 1, enabled: true, theme: {}, defaults: {}, statementUrl: "javascript:alert(1)" });
    assert.equal(served?.statementUrl, undefined);
    assert.equal(served?.enabled, true);
    assert.deepEqual(readSiteSettings(undefined).links, {}); // old stored settings: no links
});
