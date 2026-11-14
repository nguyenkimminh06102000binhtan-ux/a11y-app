/**
 * The plan's month: the calendar month in UTC (until billing cycles exist). Scan quotas count from the 1st,
 * 00:00 UTC, and reset on the next 1st.
 */
export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** "Dec 1": when the quota resets, for messages. */
export function formatResetDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
