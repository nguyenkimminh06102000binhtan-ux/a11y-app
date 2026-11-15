// The CSS bundled into the widget as text (widget.css, tokens.css): minified for production, so its comments and
// whitespace don't count against the size limit (about 3 KB gzipped). Dev keeps it readable.
import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";

export const minifyCss = {
  name: "minify-css",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
      const { code } = await esbuild.transform(await readFile(path, "utf8"), { loader: "css", minify: true });
      return { contents: code, loader: "text" };
    });
  },
};
