import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: { l: "src/loader.ts", app: "src/app.ts" }, // → public/l.js, public/app.js
  outdir: "public",
  bundle: true,
  format: "iife",
  target: "es2018",
  logLevel: "info",
  define: { 
    __APP_FILE__: JSON.stringify("app.js"),
    __APP_INTEGRITY__: JSON.stringify(""),  // dev: no integrity check, since the file changes on every save
  }, // dev: no hash in the name
});

await ctx.watch();
const { port } = await ctx.serve({ servedir: "public", port: 4000 });
console.log(`Test page: http://localhost:${port}/`);
