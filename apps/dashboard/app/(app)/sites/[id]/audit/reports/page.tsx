import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit } from "@/lib/audit";
import { Card } from "@/components/ui/Card";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Skeleton, SkeletonText, SkeletonCards } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Reports · Audit" };

/** Audit › Reports: the open issues as a CSV for developers, and a printable report (save it as a PDF). */
export default function ReportsPage({ params }: PageProps<"/sites/[id]/audit/reports">) {
  return (
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading" className="mt-0">
        Reports
      </h2>
      <Suspense
        fallback={
          <Skeleton label="Loading reports…">
            <SkeletonText lines={1} />
            <SkeletonCards count={2} />
          </Skeleton>
        }
      >
        <Reports params={params} />
      </Suspense>
    </section>
  );
}

async function Reports({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const { rows, pagesChecked } = await getLatestAudit(site.id);

  if (pagesChecked === 0) {
    return (
      <p>
        No pages checked yet, so there&apos;s nothing to report.{" "}
        <Link href={`/sites/${site.id}/audit/pages`}>Choose pages to scan</Link>.
      </p>
    );
  }

  const scope = `${rows.length.toLocaleString("en-US")} open ${rows.length === 1 ? "issue" : "issues"} on ${pagesChecked} ${
    pagesChecked === 1 ? "page" : "pages"
  }, each from its latest scan.`;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-muted">Both reports show the issues open now: {scope}</p>

      <Card title="Issues spreadsheet (CSV)" headingLevel={3}>
        <p className="mt-1 mb-4">
          One row per issue: page, impact, WCAG criteria, the element and its HTML, and how to fix it. Opens in Excel,
          Numbers or Google Sheets, or import it into your issue tracker.
        </p>
        {/* A plain link: the browser downloads the file */}
        <a href={`/api/sites/${site.id}/issues-csv`} download className={buttonClass("primary")}>
          Download issues as CSV
        </a>
      </Card>

      <Card title="Printable report" headingLevel={3}>
        <p className="mt-1 mb-4">
          A summary for clients or your team: issues by impact, by WCAG criterion and by page. Print it, or choose
          &ldquo;Save as PDF&rdquo; in the print window.
        </p>
        <ButtonLink href={`/reports/${site.id}`}>Open printable report</ButtonLink>
      </Card>
    </div>
  );
}
