/*
 * "2 hours ago" for lists you scan for recency (Sites, Pages, Scans, Overview). Records people keep (one scan's
 * heading, the printable report, the CSV) stay exact. No database access: safe in client components.
 */

const UTC_DAY = { month: "short", day: "numeric", timeZone: "UTC" } as const;

/** "Nov 15, 2026, 9:40 AM UTC": the exact moment, for tooltips and screen readers */
export function exactTime(date: Date): string {
  return `${date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;
}

/**
 * "just now", "5 minutes ago", "2 hours ago", "yesterday", "4 days ago"; from 7 days: "Nov 3" (this year) or
 * "Nov 3, 2025". A time slightly in the future (clocks disagree) reads "just now".
 */
export function relativeTime(date: Date, now: Date): string {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return date.toLocaleDateString("en-US", sameYear ? UTC_DAY : { ...UTC_DAY, year: "numeric" });
}
