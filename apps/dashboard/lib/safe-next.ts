/**
 * Where to go after signing in (?next=…): only a path inside the dashboard, never another website ("//evil.com",
 * "/\\evil.com", "https://…") and never back to a sign-in page. Anything else means Sites.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length > 500) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  try {
    const url = new URL(next, "http://x"); // resolves "/a/../b" and rejects control characters
    if (url.origin !== "http://x") return "/";
    if (/^\/(login|signup|auth)(\/|$)/.test(url.pathname)) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
