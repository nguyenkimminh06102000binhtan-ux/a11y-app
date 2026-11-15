// The Font setting's fonts: copied from their Fontsource packages (the Google Fonts releases, unchanged, SIL Open
// Font License) into <out>/fonts/, with each font's license and one stylesheet per font holding its @font-face
// rules. The widget links that stylesheet only when a visitor picks the font (__FONT_CSS__, src/features/font.ts),
// so the rules (Andika alone has 20) aren't in the app bundle. Used by build.mjs and dev.mjs.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FONTS = [
  { name: "clear", family: "AccessPilot Clear", pkg: "@fontsource-variable/atkinson-hyperlegible-next", css: ["index.css", "wght-italic.css"] },
  { name: "wide", family: "AccessPilot Wide", pkg: "@fontsource-variable/lexend", css: ["index.css"] },
  { name: "simple", family: "AccessPilot Simple", pkg: "@fontsource/andika", css: ["400.css", "700.css", "400-italic.css", "700-italic.css"] },
];

/**
 * Copy the fonts to `<outDir>/fonts/`, write each one's stylesheet there, and return their paths (`fonts/<file>.css`).
 * `hash`: put a content hash in file names (production: cached for a year, a new name on every change).
 */
export async function buildFonts(outDir, { hash }) {
  await mkdir(path.join(outDir, "fonts"), { recursive: true });
  const stylesheets = {};
  for (const font of FONTS) {
    const dir = path.join("node_modules", font.pkg);
    const rules = [];
    for (const file of font.css) {
      const css = await readFile(path.join(dir, file), "utf8");
      for (const [rule] of css.matchAll(/@font-face\s*{[^}]*}/g)) {
        const woff2 = rule.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
        if (!woff2) throw new Error(`${font.pkg}/${file}: an @font-face without a woff2 file`);
        const bytes = await readFile(path.join(dir, "files", woff2));
        const name = hash ? woff2.replace(/\.woff2$/, `.${shortHash(bytes)}.woff2`) : woff2;
        await writeFile(path.join(outDir, "fonts", name), bytes);
        rules.push(
          rule
            .replace(/font-family:[^;]+;/, `font-family:"${font.family}";`)
            .replace(/src:[^;]+;/, `src:url(${name}) format("woff2");`) // woff2 only: every browser we support reads it
            .replace(/\s+/g, " ")
        );
      }
    }
    if (rules.length === 0) throw new Error(`${font.pkg}: no @font-face rules found`);
    const css = rules.join("\n");
    const file = hash ? `${font.name}.${shortHash(css)}.css` : `${font.name}.css`;
    await writeFile(path.join(outDir, "fonts", file), css);
    stylesheets[font.name] = `fonts/${file}`;
    await copyFile(path.join(dir, "LICENSE"), path.join(outDir, "fonts", `${font.name}-LICENSE.txt`)); // the OFL asks for it
  }
  return stylesheets;
}

function shortHash(data) {
  return createHash("sha256").update(data).digest("hex").slice(0, 10);
}
