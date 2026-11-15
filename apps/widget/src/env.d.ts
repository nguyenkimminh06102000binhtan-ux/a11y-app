declare const __APP_FILE__: string;
declare const __APP_INTEGRITY__: string;
declare const __FONT_CSS__: { clear: string; wide: string; simple: string }; // the Font setting's stylesheets, e.g. fonts/clear.<hash>.css (scripts/fonts.mjs)
declare const __API_BASE__: string;
/** Parts downloaded on demand (src/core/parts.ts), by name: file (relative to the CDN) and integrity hash. */
declare const __PARTS__: Record<"image-descriptions" | "smart-contrast" | "reading-aid" | "pause-animations" | "page-structure", { file: string; integrity: string }>; // the dashboard's origin, e.g. https://app.example.com (scripts/*.mjs)
// esbuild's "text" loader turns a .css file into its contents as a string (see scripts/*.mjs).
declare module "*.css" {
  const css: string;
  export default css;
}