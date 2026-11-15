import * as esbuild from "esbuild";
import { buildFonts } from "./fonts.mjs";

const fontCss = await buildFonts("public", { hash: false }); // → public/fonts/

const ctx = await esbuild.context({
  // → public/l.js, public/app.js, public/parts/<name>.js
  entryPoints: { l: "src/entries/loader.ts", app: "src/entries/app.ts", "parts/image-descriptions": "src/parts/image-descriptions.ts" },
  outdir: "public",
  bundle: true,
  format: "iife",
  target: "es2018",
  loader: { ".css": "text" },
  logLevel: "info",
  define: {
    __APP_FILE__: JSON.stringify("app.js"),
    __APP_INTEGRITY__: JSON.stringify(""),  // dev: no integrity check, since the file changes on every save
    // The dashboard's dev server, where the widget asks for its config (WIDGET_API_BASE=http://localhost:3001 to change)
    __API_BASE__: JSON.stringify(process.env.WIDGET_API_BASE ?? "http://localhost:3001"),
    __FONT_CSS__: JSON.stringify(fontCss),
    __PARTS__: JSON.stringify({ "image-descriptions": { file: "parts/image-descriptions.js", integrity: "" } }), // dev: no hashes

  }, // dev: no hash in the name
});

await ctx.watch();
const { port } = await ctx.serve({ servedir: "public", port: 4000 });
console.log(`Test page: http://localhost:${port}/`);
