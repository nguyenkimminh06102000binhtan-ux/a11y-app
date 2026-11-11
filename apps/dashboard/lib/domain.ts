export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}