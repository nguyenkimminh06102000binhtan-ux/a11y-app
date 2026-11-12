import { test } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_CONFIG, contrastRatio, isUsableStateColor, parseConfig, stateTint } from "./index.ts";

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
  });
  assert.deepEqual(parsed, { v: 1, enabled: true, theme: {}, defaults: { focusOutline: true } });
});

test("enabled: false is respected", () => {
  assert.equal(parseConfig({ v: 1, enabled: false })?.enabled, false);
});

test("state colors without enough contrast are refused", () => {
  assert.equal(isUsableStateColor("#5b47c8"), true); // our Iris violet
  assert.equal(isUsableStateColor("#c62828"), true); // a dark red
  assert.equal(isUsableStateColor("#ffd400"), false); // yellow: white check marks would be unreadable
  assert.equal(isUsableStateColor("#8b7fd6"), false); // light violet
  assert.equal(parseConfig({ v: 1, theme: { state: "#ffd400" } })?.theme.state, undefined);
});

test("the tint matches the tokens package's fallback", () => {
  assert.equal(stateTint("#5b47c8"), "#efedfa");
});

test("contrast math matches WCAG", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
});

test("the fallback keeps the widget working", () => {
  assert.deepEqual(FALLBACK_CONFIG, { v: 1, enabled: true, theme: {}, defaults: {} });
});
