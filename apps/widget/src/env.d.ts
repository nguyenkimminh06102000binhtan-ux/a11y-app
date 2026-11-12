declare const __APP_FILE__: string;
declare const __APP_INTEGRITY__: string;
declare const __API_BASE__: string; // the dashboard's origin, e.g. https://app.example.com (scripts/*.mjs)
// esbuild's "text" loader turns a .css file into its contents as a string (see scripts/*.mjs).
declare module "*.css" {
  const css: string;
  export default css;
}