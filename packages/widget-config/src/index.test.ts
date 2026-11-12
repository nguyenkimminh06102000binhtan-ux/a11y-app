import { test } from "node:test";
import assert from "node:assert/strict";
import * as v from "valibot";
import {
  DEFAULT_SITE_SETTINGS,
  DefaultSettingsSchema,
  FALLBACK_CONFIG,
  StateColorSchema,
  contrastRatio,
  isUsableStateColor,
  parseConfig,
  readSiteSettings,
  stateTint,
  toWidgetConfig,
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
    appearance: { stateColor: "#ffd400" }, // too light: our default color
    defaults: ["pauseAnimations", "nope", "focusOutline", "focusOutline"], // unknown dropped, duplicates merged, fixed order
  });
  assert.deepEqual(settings, { v: 1, appearance: {}, defaults: ["focusOutline", "pauseAnimations"] });
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

// ─── Field schemas (dashboard form) ───

test("the color field explains what's wrong", () => {
  const message = (input: unknown) => v.safeParse(StateColorSchema, input).issues?.[0].message;
  assert.equal(v.parse(StateColorSchema, "#C62828"), "#c62828");
  assert.match(message("red") ?? "", /like #5b47c8/);
  assert.match(message("#ffd400") ?? "", /too light/);
});

test("the defaults field keeps known settings only", () => {
  assert.deepEqual(v.parse(DefaultSettingsSchema, ["textSpacing", "bogus", "highlightLinks"]), ["highlightLinks", "textSpacing"]);
});

// ─── Color math ───

test("state colors without enough contrast are refused", () => {
  assert.equal(isUsableStateColor("#5b47c8"), true); // our Iris violet
  assert.equal(isUsableStateColor("#c62828"), true); // a dark red
  assert.equal(isUsableStateColor("#ffd400"), false); // yellow: white check marks would be unreadable
  assert.equal(isUsableStateColor("#8b7fd6"), false); // light violet
});

test("the tint matches the tokens package's fallback", () => {
  assert.equal(stateTint("#5b47c8"), "#efedfa");
});

test("contrast math matches WCAG", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
});
