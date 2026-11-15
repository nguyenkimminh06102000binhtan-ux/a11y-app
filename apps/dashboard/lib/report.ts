import { getLatestAudit, type Issue } from "./audit";
import { countByImpact, groupByRule, type Impact, type RuleGroup } from "./issues";
import { pageLabel } from "./page-label";
import { compareCriteria, criterionLabel, understandingUrl, wcagFor, type Criterion } from "./wcag";

/*
 * Audit › Reports: the site's current issues (each checked page's latest successful scan, as on Overview and
 * Issues) as a CSV for developers, and as numbers for the printable report. No score: counts only.
 * Server only (wcag.ts reads axe-core). Call after the ownership check.
 */

const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

export type CriterionRow = { criterion: Criterion; issues: number; pages: number };
export type PageRow = { url: string; label: string; checkedAt: Date | null; total: number; byImpact: Record<Impact, number> };

export type Report = {
  domain: string;
  pagesChecked: number;
  lastCheckedAt: Date | undefined;
  total: number;
  byImpact: Record<Impact, number>;
  byCriterion: CriterionRow[];
  bestPractice: { issues: number; pages: number }; // rules that aren't a WCAG requirement
  byPage: PageRow[];
  byRule: RuleGroup[];
  comparison: { fixed: number; new: number; pagesCompared: number } | null;
  rows: Issue[]; // impact, then page, then rule, then element
  checkedAtByUrl: Map<string, Date | null>;
};

export async function getReport(site: { id: string; domain: string }): Promise<Report> {
  const audit = await getLatestAudit(site.id);
  const rows = [...audit.rows].sort(
    (a, b) =>
      (IMPACT_ORDER[a.impact ?? ""] ?? 9) - (IMPACT_ORDER[b.impact ?? ""] ?? 9) ||
      a.pageUrl.localeCompare(b.pageUrl) ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.selector.localeCompare(b.selector)
  );

  const criteria = new Map<string, { criterion: Criterion; issues: number; pages: Set<string> }>();
  const bestPractice = { issues: 0, pages: new Set<string>() };
  for (const r of rows) {
    const { criteria: list } = wcagFor(r.ruleId);
    if (list.length === 0) {
      bestPractice.issues++;
      bestPractice.pages.add(r.pageUrl);
    }
    for (const c of list) {
      const entry = criteria.get(c.id) ?? { criterion: c, issues: 0, pages: new Set<string>() };
      entry.issues++;
      entry.pages.add(r.pageUrl);
      criteria.set(c.id, entry);
    }
  }

  const byPage: PageRow[] = [...audit.lastCheckedByUrl.entries()]
    .map(([url, checkedAt]) => {
      const onPage = rows.filter((r) => r.pageUrl === url);
      return { url, label: pageLabel(url, site.domain), checkedAt, total: onPage.length, byImpact: countByImpact(onPage) };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return {
    domain: site.domain,
    pagesChecked: audit.pagesChecked,
    lastCheckedAt: audit.lastCheckedAt,
    total: rows.length,
    byImpact: countByImpact(rows),
    byCriterion: [...criteria.values()]
      .sort((a, b) => compareCriteria(a.criterion.id, b.criterion.id))
      .map((e) => ({ criterion: e.criterion, issues: e.issues, pages: e.pages.size })),
    bestPractice: { issues: bestPractice.issues, pages: bestPractice.pages.size },
    byPage,
    byRule: groupByRule(rows),
    comparison: audit.comparison,
    rows,
    checkedAtByUrl: audit.lastCheckedByUrl,
  };
}

/** "2026-11-15 09:40 UTC" (sorts and reads the same in every spreadsheet) */
function utc(date: Date | null | undefined): string {
  return date ? `${date.toISOString().slice(0, 16).replace("T", " ")} UTC` : "";
}

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (=, +, -, @, tab, return at the start) gets a
 * leading apostrophe: the HTML and selectors come from the scanned site, so they can't be trusted.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_COLUMNS = [
  "Page",
  "Impact",
  "Issue",
  "WCAG criteria",
  "WCAG level",
  "Element",
  "HTML",
  "How to fix",
  "Learn more (W3C)",
  "Page last checked",
] as const;

/** The report's issues as CSV: a byte-order mark so Excel reads UTF-8, Windows line endings as RFC 4180 says. */
export function toCsv(report: Report): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of report.rows) {
    const { criteria } = wcagFor(r.ruleId);
    const levels = [...new Set(criteria.map((c) => c.level))];
    lines.push(
      [
        r.pageUrl,
        r.impact ?? "",
        r.help ?? r.ruleId,
        criteria.length ? criteria.map(criterionLabel).join("; ") : "Best practice (not a WCAG requirement)",
        levels.join("; "),
        r.selector,
        r.html,
        r.summary ?? "",
        criteria.map(understandingUrl).filter(Boolean).join(" "),
        utc(report.checkedAtByUrl.get(r.pageUrl)),
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** "shop.example-accessibility-issues-2026-11-15.csv" */
export function csvFilename(domain: string, now: Date): string {
  const safe = domain.replace(/[^a-z0-9.-]/gi, "-");
  return `${safe}-accessibility-issues-${now.toISOString().slice(0, 10)}.csv`;
}
