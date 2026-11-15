import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { buildFonts } from "./fonts.mjs";
import { minifyCss } from "./minify-css.mjs";

const OUT = "dist";
// The dashboard's origin, where the widget asks for its config. Set it for each deployment:
//   WIDGET_API_BASE=https://manage.accesspilot.org pnpm --filter widget build
const API_BASE = process.env.WIDGET_API_BASE ?? "http://localhost:3001";

const shared = {
  bundle: true,
  format: "iife",
  target: "es2018",
  minify: true,
  loader: { ".css": "text" },
  plugins: [minifyCss],
  write: false, // keep output in memory so we can hash it before writing
  logLevel: "warning",
  define: { __API_BASE__: JSON.stringify(API_BASE) },
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// 0. The Font setting's fonts and their stylesheets, next to the app (dist/fonts/).
shared.define.__FONT_CSS__ = JSON.stringify(await buildFonts(OUT, { hash: true }));

// 0b. Parts (src/parts/*.ts, see src/core/parts.ts): built and hashed first, so the app can carry their names
//     and integrity hashes, as the loader carries the app's.
const PARTS = ["image-descriptions"];
const partFiles = [];
const parts = {};
for (const name of PARTS) {
  const out = await esbuild.build({ ...shared, entryPoints: [`src/parts/${name}.ts`], outfile: `${name}.js` });
  const bytes = out.outputFiles[0].contents;
  const hash = createHash("sha384").update(bytes).digest();
  const file = `parts/${name}.${hash.toString("hex").slice(0, 10)}.js`;
  await mkdir(`${OUT}/parts`, { recursive: true });
  await writeFile(`${OUT}/${file}`, bytes);
  parts[name] = { file, integrity: `sha384-${hash.toString("base64")}` };
  partFiles.push({ name: file, bytes });
}
shared.define.__PARTS__ = JSON.stringify(parts);

// 1. Build the app and hash its exact bytes.
const app = await esbuild.build({ ...shared, entryPoints: ["src/entries/app.ts"], outfile: "app.js" });
const appBytes = app.outputFiles[0].contents;
const digest = createHash("sha384").update(appBytes).digest();

const appFile = `app.${digest.toString("hex").slice(0, 10)}.js`; // new name whenever the content changes
const integrity = `sha384-${digest.toString("base64")}`;         // what the browser verifies
await writeFile(`${OUT}/${appFile}`, appBytes);

// 2. Build the loader with the app's file name and integrity baked in.
const loader = await esbuild.build({
  ...shared,
  entryPoints: ["src/entries/loader.ts"],
  outfile: "l.js",
  define: {
    ...shared.define,
    __APP_FILE__: JSON.stringify(appFile),
    __APP_INTEGRITY__: JSON.stringify(integrity),
  },
});
await writeFile(`${OUT}/l.js`, loader.outputFiles[0].contents);

// 3. Response headers for the CDN (Cloudflare Pages reads dist/_headers). All files are loaded by customers' sites:
//    - l.js keeps its name across releases: cache it briefly, so a release reaches every site within minutes.
//    - app.<hash>.js, parts/*.<hash>.js and fonts/*.<hash>.(woff2|css) get a new name whenever they change: cache
//      them for a year.
//    - CORS: the loader fetches the app with an integrity check (crossorigin="anonymous"), which needs it; fonts
//      from another origin always need it.
//    - CORP: sites that isolate themselves (Cross-Origin-Embedder-Policy) only load scripts that allow it.
const SHARED_HEADERS = `  Access-Control-Allow-Origin: *
  Cross-Origin-Resource-Policy: cross-origin
  X-Content-Type-Options: nosniff`;
await writeFile(
  `${OUT}/_headers`,
  `/l.js
  Cache-Control: public, max-age=300
${SHARED_HEADERS}

/app.*
  Cache-Control: public, max-age=31536000, immutable
${SHARED_HEADERS}

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
${SHARED_HEADERS}

/parts/*
  Cache-Control: public, max-age=31536000, immutable
${SHARED_HEADERS}
`
);

// 4. Size limits (gzipped, roughly what the CDN sends). Raise them on purpose, never quietly.
const LIMITS = [
  { name: "l.js", bytes: loader.outputFiles[0].contents, max: 1024 },
  { name: appFile, bytes: appBytes, max: 25 * 1024 },
  ...partFiles.map((part) => ({ ...part, max: 8 * 1024 })), // each part, downloaded only when its setting is on
];

let overLimit = false;
for (const { name, bytes, max } of LIMITS) {
  const gzipped = gzipSync(bytes, { level: 9 }).length;
  const ok = gzipped <= max;
  if (!ok) overLimit = true;
  console.log(
    `${ok ? "✓" : "✗"} ${name.padEnd(40)} ${String(bytes.length).padStart(7)} B raw  ${String(gzipped).padStart(6)} B gzip  (limit ${max} B)`
  );
}
console.log(`integrity: ${integrity}`);
console.log(`config from: ${API_BASE}/api/widget/config`);

if (overLimit) {
  console.error("✗ Bundle over its size limit. Shrink it, or raise the limit deliberately in scripts/build.mjs.");
  process.exitCode = 1; // fails `pnpm build`, and CI with it
}

