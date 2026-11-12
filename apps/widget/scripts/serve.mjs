// Serves the production build. Used by `preview` and by the Playwright tests.
import * as esbuild from "esbuild";

const port = Number(process.env.PORT ?? 4001);
const ctx = await esbuild.context({}); // no entry points: just a static file server
await ctx.serve({ servedir: "dist", port });
console.log(`Serving dist/ at http://localhost:${port}/`);
