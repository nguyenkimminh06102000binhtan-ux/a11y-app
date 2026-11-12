import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const OUT = "dist";
const shared = {
  bundle: true,
  format: "iife",
  target: "es2018",
  minify: true,
  write: false, // keep output in memory so we can hash it before writing
  logLevel: "warning",
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// 1. Build the app and hash its exact bytes.
const app = await esbuild.build({ ...shared, entryPoints: ["src/app.ts"], outfile: "app.js" });
const appBytes = app.outputFiles[0].contents;
const digest = createHash("sha384").update(appBytes).digest();

const appFile = `app.${digest.toString("hex").slice(0, 10)}.js`; // new name whenever the content changes
const integrity = `sha384-${digest.toString("base64")}`;         // what the browser verifies
await writeFile(`${OUT}/${appFile}`, appBytes);

// 2. Build the loader with the app's file name and integrity baked in.
const loader = await esbuild.build({
  ...shared,
  entryPoints: ["src/loader.ts"],
  outfile: "l.js",
  define: {
    __APP_FILE__: JSON.stringify(appFile),
    __APP_INTEGRITY__: JSON.stringify(integrity),
  },
});
await writeFile(`${OUT}/l.js`, loader.outputFiles[0].contents);

// 3. Size limits (gzipped, roughly what the CDN sends). Raise them on purpose, never quietly.
const LIMITS = [
  { name: "l.js", bytes: loader.outputFiles[0].contents, max: 1024 },
  { name: appFile, bytes: appBytes, max: 25 * 1024 },
];

let overLimit = false;
for (const { name, bytes, max } of LIMITS) {
  const gzipped = gzipSync(bytes, { level: 9 }).length;
  const ok = gzipped <= max;
  if (!ok) overLimit = true;
  console.log(
    `${ok ? "✓" : "✗"} ${name.padEnd(20)} ${String(bytes.length).padStart(7)} B raw  ${String(gzipped).padStart(6)} B gzip  (limit ${max} B)`
  );
}
console.log(`integrity: ${integrity}`);

if (overLimit) {
  console.error("✗ Bundle over its size limit. Shrink it, or raise the limit deliberately in scripts/build.mjs.");
  process.exitCode = 1; // fails `pnpm build`, and CI with it
}

