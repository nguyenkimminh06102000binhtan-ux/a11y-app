/** Local development hosts. They can be added as sites, so owners can try the widget on their own machine. */
export function isLocalHost(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1";
}

export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    if (isLocalHost(host)) return host; // the port isn't part of a site: localhost:4000 → localhost
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}