import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, DEFAULTABLE, DEFAULTABLE_ENTRIES, DEFAULTABLE_LABELS, PROFILES, SECTIONS, SETTINGS, bySection } from "./index.ts";

test("catalog ids and keys are unique", () => {
    const ids = CATALOG.map((e) => e.id);
    const keys = SETTINGS.map((e) => e.key);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(keys).size, keys.length);
});

test("every entry is in a known section, and entries are listed in section order", () => {
    const order = SECTIONS.map((s) => s.id as string);
    const positions = CATALOG.map((e) => order.indexOf(e.section));
    assert.ok(positions.every((p) => p >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("level settings have an off level first and at least one more", () => {
    for (const entry of CATALOG) {
        if (entry.kind !== "levels") continue;
        assert.ok(entry.levels.length >= 2, entry.id);
        assert.equal(entry.levels[0].label, "Default", entry.id);
        assert.ok(entry.levels.every((level) => level.label.includes(level.short) || level.short === level.label), entry.id); // speech input: the visible text is in the name
    }
});

test("settings on by default are catalog settings, with the panel's words", () => {
    assert.equal(DEFAULTABLE_ENTRIES.length, DEFAULTABLE.length);
    for (const key of DEFAULTABLE) {
        const entry = SETTINGS.find((e) => e.key === key);
        assert.ok(entry, key);
        assert.equal(DEFAULTABLE_LABELS[key], entry.label);
    }
});

test("actions have no saved value; settings are everything else", () => {
    assert.deepEqual(CATALOG.filter((e) => e.kind === "action").map((e) => e.id), ["page-structure"]);
    assert.equal(SETTINGS.length, CATALOG.length - 1);
    assert.ok(SETTINGS.every((e) => typeof e.key === "string"));
});

test("bySection keeps section order and leaves out empty sections", () => {
    const groups = bySection(CATALOG);
    assert.deepEqual(
        groups.map((g) => g.section.id),
        ["content", "appearance", "navigation", "tools"]
    );
    assert.deepEqual(groups[0].items.map((e) => e.id), ["text-size", "text-spacing", "line-height", "font", "text-align", "image-descriptions"]);
    assert.deepEqual(bySection([]), []);
});

test("profiles: unique ids, and every setting and level they name exists (and isn't Default/off)", () => {
    assert.equal(new Set(PROFILES.map((p) => p.id)).size, PROFILES.length);
    for (const profile of PROFILES) {
        const entries = Object.entries(profile.settings);
        assert.ok(entries.length >= 2, profile.id);
        for (const [key, value] of entries) {
            const setting = SETTINGS.find((e) => e.key === key);
            assert.ok(setting, `${profile.id}: ${key}`);
            if (setting.kind === "levels") {
                assert.ok(Number.isInteger(value) && (value as number) > 0 && (value as number) < setting.levels.length, `${profile.id}: ${key}=${value}`);
            } else assert.equal(value, true, `${profile.id}: ${key}`);
        }
    }
});

test("only size-like level settings are ordered", () => {
    const ordered = SETTINGS.filter((e) => e.kind === "levels" && "ordered" in e && e.ordered).map((e) => e.key);
    assert.deepEqual(ordered, ["textSize", "textSpacing", "lineHeight"]);
});
