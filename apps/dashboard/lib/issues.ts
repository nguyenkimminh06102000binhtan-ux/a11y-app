import type { Issue } from "./audit";

/** Most severe first. The word is always shown with it (never color alone). */
export const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
export type Impact = (typeof IMPACTS)[number];
const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

/** What Audit › Issues shows, all from the URL: ?impact=&wcag=&page=&q=&rule=&place= */
export type IssueParams = { impact?: Impact; wcag?: string; page?: string; q?: string; rule?: string; place?: number };

/** Read the URL's search params, ignoring anything unexpected (they can be typed or edited by hand). */
export function readIssueParams(sp: Record<string, string | string[] | undefined>): IssueParams {
  const one = (key: string) => {
    const value = sp[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
  };
  const impact = one("impact")?.toLowerCase();
  const place = Number(one("place"));
  return {
    impact: (IMPACTS as readonly string[]).includes(impact ?? "") ? (impact as Impact) : undefined,
    wcag: /^\d\.\d{1,2}\.\d{1,2}$/.test(one("wcag") ?? "") ? one("wcag") : undefined, // a criterion number, e.g. 1.4.3
    page: one("page"),
    q: one("q")?.slice(0, 100),
    rule: one("rule"),
    place: Number.isInteger(place) && place > 0 ? place : undefined,
  };
}

/** A link to Issues with these params; empty ones are left out, so URLs stay short. */
export function issuesHref(base: string, params: IssueParams): string {
  const query = new URLSearchParams();
  for (const key of ["impact", "wcag", "page", "q", "rule", "place"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Issues on one page (by URL) and matching the search: rule name or id, selector, page address, or (with
 * `alsoSearch`) a rule's WCAG criteria, e.g. "1.4.3" or "contrast".
 */
export function filterByPageAndSearch(
  rows: Issue[],
  pageUrl: string | undefined,
  q: string | undefined,
  alsoSearch: (ruleId: string) => string[] = () => []
): Issue[] {
  const needle = q?.toLowerCase();
  return rows.filter(
    (r) =>
      (!pageUrl || r.pageUrl === pageUrl) &&
      (!needle ||
        [r.help, r.ruleId, r.selector, r.pageUrl, ...alsoSearch(r.ruleId)].some((field) => field?.toLowerCase().includes(needle)))
  );
}

/** How many issues per impact (for the filter's counts), before the impact filter is applied. */
export function countByImpact(rows: Issue[]): Record<Impact, number> {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const r of rows) if (r.impact && r.impact in counts) counts[r.impact as Impact]++;
  return counts;
}

export type RuleGroup = {
  ruleId: string;
  title: string;
  impact: string | null;
  helpUrl: string | null;
  places: Issue[]; // ordered by page, then selector, so "place 3 of 34" is stable
  pages: number;
};

/** One group per rule: most severe first, then the rule on the most pages, then the most places. */
export function groupByRule(rows: Issue[]): RuleGroup[] {
  const groups = new Map<string, Issue[]>();
  for (const row of rows) {
    const list = groups.get(row.ruleId) ?? [];
    list.push(row);
    groups.set(row.ruleId, list);
  }
  return [...groups.entries()]
    .map(([ruleId, places]) => {
      places.sort((a, b) => a.pageUrl.localeCompare(b.pageUrl) || a.selector.localeCompare(b.selector));
      const first = places[0];
      return {
        ruleId,
        title: first.help ?? ruleId,
        impact: first.impact,
        helpUrl: first.helpUrl,
        places,
        pages: new Set(places.map((p) => p.pageUrl)).size,
      };
    })
    .sort(
      (a, b) =>
        (IMPACT_ORDER[a.impact ?? ""] ?? 9) - (IMPACT_ORDER[b.impact ?? ""] ?? 9) ||
        b.pages - a.pages ||
        b.places.length - a.places.length ||
        a.title.localeCompare(b.title)
    );
}
