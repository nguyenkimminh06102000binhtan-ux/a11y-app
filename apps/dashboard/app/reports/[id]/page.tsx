import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getOwnedSite } from "@/lib/site";
import { getReport } from "@/lib/report";
import { IMPACTS } from "@/lib/issues";
import { criterionLabel } from "@/lib/wcag";
import { Mark } from "@/components/Mark";
import { PrintButton } from "@/components/PrintButton";
import { Skeleton, Bone, SkeletonText, SkeletonList } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Accessibility report" };

const fmt = (n: number) => n.toLocaleString("en-US");
const day = (d: Date) => d.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
const time = (d: Date) => `${d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;
const IMPACT_NAMES = { critical: "Critical", serious: "Serious", moderate: "Moderate", minor: "Minor" } as const;

/**
 * The printable accessibility report for one site (outside the app's menu, so it prints cleanly). Counts only,
 * no score, and a plain note on what automated checks can and can't tell. Owner only, like every site page.
 */
export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <main id="main" className="max-w-4xl print:max-w-none print:p-0">
      <Suspense
        fallback={
          <Skeleton label="Preparing the report…">
            <Bone className="h-5 w-32" />
            <Bone className="h-9 w-full max-w-xl" />
            <SkeletonText lines={1} />
            <SkeletonList rows={4} />
          </Skeleton>
        }
      >
        <Report params={params} />
      </Suspense>
    </main>
  );
}

/**
 * A wide table that scrolls sideways on narrow screens: focusable and named, so keyboard users can scroll it too
 * (the arrow keys move it once it has focus).
 */
function ScrollBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-lg">
      {children}
    </div>
  );
}

const th = "border-b-[1.5px] border-frame px-3 py-2 text-left text-small font-bold";
const td = "border-b border-line px-3 py-2 align-top";
const num = `${td} text-right tabular-nums`;

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const report = await getReport(site);
  const now = new Date();

  return (
    <article aria-labelledby="report-title" className="flex flex-col gap-8">
      {/* On screen only: back and print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/sites/${site.id}/audit/reports`} className="inline-flex min-h-11 items-center">
          <span aria-hidden="true">‹&nbsp;</span>Back to Reports
        </Link>
        <PrintButton />
      </div>

      <header className="flex flex-col gap-2 border-b-[1.5px] border-frame pb-6">
        <p className="m-0 flex items-center gap-2 font-bold">
          <Mark className="size-6" />
          AccessPilot
        </p>
        <h1 id="report-title" className="m-0 wrap-anywhere">
          Accessibility report: {site.domain}
        </h1>
        <p className="m-0 text-muted">
          Prepared {day(now)} · {report.pagesChecked} {report.pagesChecked === 1 ? "page" : "pages"} checked
          {report.lastCheckedAt && ` · latest check ${time(report.lastCheckedAt)}`}
        </p>
      </header>

      {report.pagesChecked === 0 ? (
        <p>No pages of {site.domain} have been checked yet.</p>
      ) : (
        <>
          <section aria-labelledby="summary-heading" className="flex flex-col gap-3 break-inside-avoid">
            <h2 id="summary-heading" className="m-0 break-after-avoid">
              Summary
            </h2>
            <p className="m-0">
              Automated checks found <strong>{fmt(report.total)} open {report.total === 1 ? "issue" : "issues"}</strong>{" "}
              on the {report.pagesChecked} {report.pagesChecked === 1 ? "page" : "pages"} checked, each page as of its latest
              scan.
              {report.comparison &&
                ` Since the previous check of ${report.comparison.pagesCompared} of these pages: ${fmt(report.comparison.fixed)} fixed, ${fmt(report.comparison.new)} new.`}
            </p>
            <table className="w-full max-w-md border-collapse">
              <caption className="sr-only">Open issues by impact</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>Impact</th>
                  <th scope="col" className={`${th} text-right`}>Issues</th>
                </tr>
              </thead>
              <tbody>
                {IMPACTS.map((impact) => (
                  <tr key={impact}>
                    <th scope="row" className={`${td} text-left font-normal`}>{IMPACT_NAMES[impact]}</th>
                    <td className={num}>{fmt(report.byImpact[impact])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="wcag-heading" className="flex flex-col gap-3">
            <h2 id="wcag-heading" className="m-0 break-after-avoid">
              By WCAG success criterion
            </h2>
            <p className="m-0 break-after-avoid text-small text-muted">
              An issue can relate to more than one criterion, so these add up to more than the total.
            </p>
            <ScrollBox label="Open issues by WCAG success criterion">
              <table className="w-full border-collapse">
                <caption className="sr-only">Open issues by WCAG success criterion</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>Criterion</th>
                    <th scope="col" className={th}>Level</th>
                    <th scope="col" className={`${th} text-right`}>Issues</th>
                    <th scope="col" className={`${th} text-right`}>Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCriterion.map(({ criterion, issues, pages }) => (
                    <tr key={criterion.id} className="break-inside-avoid">
                      <th scope="row" className={`${td} text-left font-normal`}>{criterionLabel(criterion)}</th>
                      <td className={td}>{criterion.level}</td>
                      <td className={num}>{fmt(issues)}</td>
                      <td className={num}>{fmt(pages)}</td>
                    </tr>
                  ))}
                  {report.bestPractice.issues > 0 && (
                    <tr className="break-inside-avoid">
                      <th scope="row" className={`${td} text-left font-normal`}>Best practice (not a WCAG requirement)</th>
                      <td className={td}>
                        <span aria-hidden="true">–</span>
                        <span className="sr-only">none</span>
                      </td>
                      <td className={num}>{fmt(report.bestPractice.issues)}</td>
                      <td className={num}>{fmt(report.bestPractice.pages)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollBox>
          </section>

          <section aria-labelledby="pages-heading" className="flex flex-col gap-3">
            <h2 id="pages-heading" className="m-0 break-after-avoid">
              By page
            </h2>
            <ScrollBox label="Open issues by page">
              <table className="w-full border-collapse">
                <caption className="sr-only">Open issues by page, most first</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>Page</th>
                    <th scope="col" className={th}>Last checked</th>
                    <th scope="col" className={`${th} text-right`}>Issues</th>
                    {IMPACTS.map((impact) => (
                      <th key={impact} scope="col" className={`${th} text-right`}>
                        {IMPACT_NAMES[impact]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.byPage.map((page) => (
                    <tr key={page.url} className="break-inside-avoid">
                      <th scope="row" className={`${td} text-left font-normal wrap-anywhere`}>{page.label}</th>
                      <td className={`${td} text-small`}>{page.checkedAt ? time(page.checkedAt) : ""}</td>
                      <td className={`${num} font-bold`}>{fmt(page.total)}</td>
                      {IMPACTS.map((impact) => (
                        <td key={impact} className={num}>
                          {fmt(page.byImpact[impact])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          </section>

          <section aria-labelledby="rules-heading" className="flex flex-col gap-3">
            <h2 id="rules-heading" className="m-0 break-after-avoid">
              Issues to fix
            </h2>
            <p className="m-0 break-after-avoid text-small text-muted">
              Most severe first. The CSV download lists every element with its HTML.
            </p>
            <ScrollBox label="Issues to fix">
              <table className="w-full border-collapse">
                <caption className="sr-only">Issues to fix, most severe first</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>Issue</th>
                    <th scope="col" className={th}>Impact</th>
                    <th scope="col" className={`${th} text-right`}>Places</th>
                    <th scope="col" className={`${th} text-right`}>Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byRule.map((group) => (
                    <tr key={group.ruleId} className="break-inside-avoid">
                      <th scope="row" className={`${td} text-left font-normal`}>
                        {group.title}
                      </th>
                      <td className={`${td} capitalize`}>{group.impact ?? "unknown"}</td>
                      <td className={num}>{fmt(group.places.length)}</td>
                      <td className={num}>{fmt(group.pages)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          </section>
        </>
      )}

      <section aria-labelledby="about-heading" className="flex flex-col gap-2 border-t-[1.5px] border-frame pt-6 break-inside-avoid">
        <h2 id="about-heading" className="m-0 text-lg">
          About this report
        </h2>
        <p className="m-0 text-small">
          These results come from automated checks of the pages listed above, each as of its latest scan.
          Automated checks find only part of the accessibility issues a site can have; a manual review by people,
          including people who use assistive technology, is needed for the rest. Pages not listed weren&apos;t checked.
          This report isn&apos;t a certificate or legal statement of conformance with WCAG or any law.
        </p>
      </section>
    </article>
  );
}
