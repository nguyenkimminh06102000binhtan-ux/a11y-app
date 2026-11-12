declare const __APP_FILE__: string;
declare const __APP_INTEGRITY__: string;
// esbuild's "text" loader turns a .css file into its contents as a string (see scripts/*.mjs).
declare module "*.css" {
  const css: string;
  export default css;
}